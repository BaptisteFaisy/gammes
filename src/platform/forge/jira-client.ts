/**
 * Le client Jira réel (idée de consolidation n° 3).
 *
 * L'app lit des tickets **vrais** : résumé, composants, étiquettes, dates,
 * commentaires, affectations, transitions. Une réponse malformée donne un ticket
 * minimal, jamais un ticket inventé.
 *
 * Le transport est injecté : en production `api.asUser()`, en test une fonction.
 */

import type { JiraPort } from "../../core/ports";
import type { IssueDigest } from "../../core/types";
import type { AtlassianClient } from "./atlassian-http";

export type JiraOptions = {
  readonly client: AtlassianClient;
  /** Les champs demandés : le strict nécessaire, rien de plus. */
  readonly champs?: readonly string[];
};

const CHAMPS = ["summary", "labels", "components", "created", "resolutiondate", "comment", "assignee"];

const objet = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
const texte = (v: unknown): string => (typeof v === "string" ? v : "");
const nombre = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const liste = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);

const nomsDe = (v: unknown): readonly string[] =>
  liste(v).map((e) => texte(objet(e).name)).filter(Boolean);

const commentairesDe = (v: unknown): readonly string[] =>
  liste(objet(v).comments).map((c) => texte(objet(c).body)).filter(Boolean);

/** Le ticket tel que l'API v3 le rend, réduit à ce dont le cœur a besoin. */
const issueDe = (brut: unknown, transitions: readonly string[]): IssueDigest => {
  const p = objet(brut);
  const f = objet(p.fields);
  const projet = texte(objet(f.project).key);
  const cle = texte(p.key);
  return {
    id: texte(p.id),
    key: cle,
    projectKey: projet || (cle.includes("-") ? cle.split("-")[0] ?? "" : ""),
    summary: texte(f.summary),
    components: nomsDe(f.components),
    labels: liste(f.labels).map((l) => texte(l)).filter(Boolean),
    createdAt: texte(f.created),
    ...(texte(f.resolutiondate) ? { resolvedAt: texte(f.resolutiondate) } : {}),
    transitions,
    commentBodies: commentairesDe(f.comment),
    assigneeCount: f.assignee ? 1 : 0,
  };
};

/** Les transitions du ticket : ce que Jira autorise réellement aujourd'hui. */
const transitionsDe = (brut: unknown): readonly string[] =>
  liste(objet(brut).transitions).map((t) => texte(objet(t).name)).filter(Boolean);

/** Le client Jira : un ticket, et une recherche par JQL. */
export const jiraClient = (options: JiraOptions): JiraPort => ({
  getIssue: async (issueId: string): Promise<IssueDigest> => {
    const champs = (options.champs ?? CHAMPS).join(",");
    const reponse = await options.client.get<unknown>(`/rest/api/3/issue/${issueId}`, { fields: champs });
    if (!reponse.ok) return issueDe({ id: issueId, key: issueId, fields: {} }, []);
    const suite = await options.client.get<unknown>(`/rest/api/3/issue/${issueId}/transitions`);
    return issueDe(reponse.value, suite.ok ? transitionsDe(suite.value) : []);
  },

  searchIssues: async (projectKey: string | undefined, limit: number): Promise<readonly IssueDigest[]> => {
    const jql = projectKey ? `project = "${projectKey}" ORDER BY created DESC` : "ORDER BY created DESC";
    const reponse = await options.client.paginate<unknown>(
      "/rest/api/3/search/jql",
      { jql, maxResults: Math.max(1, Math.min(limit, 100)), fields: CHAMPS.join(",") },
      (corps) => ({
        items: liste(objet(corps).issues),
        next: texte(objet(corps).nextPageToken) || undefined,
      }),
    );
    if (!reponse.ok) return [];
    return reponse.value.map((brut) => issueDe(brut, []));
  },
});
