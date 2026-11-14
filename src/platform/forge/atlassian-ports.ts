/**
 * Gammes — ports Atlassian sur @forge/api (§ 20, § 22).
 *
 * Lecture **au nom de l'utilisateur connecté** (`asUser`) : le graphe et le contenu ne
 * renvoient que ce que l'utilisateur a le droit de voir. Droit manquant = résultat vide
 * sans erreur (l'écran de couverture distingue « pas de droit » de « pas de données »).
 *
 * Les chemins d'API exacts sont à valider sur un site de développement (§ 22 « à confirmer ») ;
 * le mapping est défensif : un champ absent ne fait jamais planter l'app. Les chemins sont
 * enveloppés par `assumeTrustedRoute` (constantes internes, aucune saisie utilisateur).
 */

import { asApp, asUser, assumeTrustedRoute, requestConfluence } from "@forge/api";
import type { ConfluencePort, GraphPort, JiraPort } from "../../core/ports";
import type { IssueDigest, PageDigest } from "../../core/types";

type Json = Record<string, unknown>;
const asJson = async (res: { json(): Promise<unknown>; ok: boolean }): Promise<Json | undefined> => {
  if (!res.ok) return undefined;
  return (await res.json()) as Json;
};
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const arr = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const pageIdOf = (ari: string): string => ari.split("/").pop() ?? ari;

/**
 * Lit une page au nom de l'utilisateur connecté, et **au nom de l'app** quand il n'y en a
 * pas. Un déclencheur (`avi:confluence:…`) n'a pas d'utilisateur : `asUser()` y échoue, la
 * page restait « injoignable », et l'app ne compilait donc jamais une page créée dans le
 * tenant — silencieusement. L'app a `read:confluence-content.all`, elle peut lire seule.
 */
/** Les lectures possibles d'une page : l'API v2 (sans puis avec query), puis l'API REST v1. */
const CHEMINS_PAGE = (id: string): readonly string[] => [
  // Sans chaîne de requête d'abord : `assumeTrustedRoute` et une query string ne font
  // pas bon ménage (404 côté plateforme). Le format de corps par défaut de l'API v2
  // est déjà « storage », le paramètre est donc redondant.
  `/wiki/api/v2/pages/${id}`,
  `/wiki/api/v2/pages/${id}?body-format=storage`,
  `/wiki/rest/api/content/${id}?expand=body.storage,version,space`,
];

const lirePageConfluence = async (chemin: string): Promise<Json | undefined> => {
  try {
    const parUtilisateur = await asJson(await asUser().requestConfluence(assumeTrustedRoute(chemin)));
    if (parUtilisateur) return parUtilisateur;
  } catch {
    // Pas d'utilisateur connecté (déclencheur, consommateur) : on continue au nom de l'app.
  }
  try {
    const parApp = await asJson(await asApp().requestConfluence(assumeTrustedRoute(chemin)));
    if (parApp) return parApp;
  } catch {
    // Ni l'utilisateur ni le mode app n'ont de jeton : on continue au jeton par défaut.
  }
  // Ni l'utilisateur ni le mode « asApp » n'ont de jeton dans un déclencheur : la
  // requête part alors avec le jeton de l'app par défaut.
  try {
    return await asJson(await requestConfluence(assumeTrustedRoute(chemin)));
  } catch {
    return undefined;
  }
};

const EMPTY_PAGE = (ari: string, id: string): PageDigest => ({
  ari, id, spaceKey: "", title: "", storageBody: "", labels: [], lastModifiedAt: "", pageVersion: 0, wordCount: 0, reachable: false,
});

/** Confluence : lire une page (format storage) et lister les pages d'un espace. */
export const confluencePort = (): ConfluencePort => ({
  getPage: async (ari): Promise<PageDigest> => {
    const id = pageIdOf(ari);
    let body: Json | undefined;
    for (const chemin of CHEMINS_PAGE(id)) {
      body = await lirePageConfluence(chemin);
      if (body) break;
    }
    if (!body) return EMPTY_PAGE(ari, id);
    const storage = str(obj(obj(body.body).storage).value);
    const version = obj(body.version);
    return {
      ari: str(body.ari, ari),
      id,
      spaceKey: str(obj(body.space).key) || str(body.spaceId) || str(obj(obj(body.space).key)),
      title: str(body.title),
      storageBody: storage,
      labels: arr(body.labels).map((l) => str(obj(l).name)),
      lastModifiedAt: str(version.when) || str(body.createdAt),
      pageVersion: num(version.number, 1),
      wordCount: storage.split(/\s+/).filter(Boolean).length,
      reachable: true,
    };
  },
  listPages: async (spaceKey): Promise<readonly PageDigest[]> => {
    const body = await lirePageConfluence(`/wiki/api/v2/spaces/${spaceKey}/pages?limit=100`);
    return arr(body?.results).map((r) => {
      const page = obj(r);
      return { ...EMPTY_PAGE(str(page.ari), str(page.id)), spaceKey, title: str(page.title), reachable: true };
    });
  },
  isReachable: async (): Promise<boolean> => {
    try {
      return (await asUser().requestConfluence(assumeTrustedRoute("/wiki/api/v2/spaces?limit=1"))).ok;
    } catch {
      return false;
    }
  },
});

const issueOf = (raw: Json): IssueDigest => {
  const fields = obj(raw.fields);
  const resolution = obj(fields.resolution);
  return {
    id: str(raw.id),
    key: str(raw.key),
    projectKey: str(obj(fields.project).key),
    summary: str(fields.summary),
    components: arr(fields.components).map((c) => str(obj(c).name)),
    labels: arr(fields.labels).map((l) => str(l)),
    createdAt: str(fields.created),
    ...(fields.resolution ? { resolvedAt: str(resolution.resolutionDate) } : {}),
    transitions: [],
    commentBodies: arr(obj(fields.comment).comments).map((c) => str(obj(c).body)),
    assigneeCount: fields.assignee ? 1 : 0,
  };
};

/** Jira : chercher des tickets (fantômes) et en lire un (encart). */
export const jiraPort = (): JiraPort => ({
  getIssue: async (issueId): Promise<IssueDigest> => {
    const body = await asJson(await asUser().requestJira(assumeTrustedRoute(`/rest/api/3/issue/${issueId}`)));
    return issueOf(body ?? ({ id: issueId, key: issueId, fields: {} } as Json));
  },
  searchIssues: async (projectKey, limit): Promise<readonly IssueDigest[]> => {
    const jql = projectKey ? `project = ${projectKey} ORDER BY created DESC` : "ORDER BY created DESC";
    const path = `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${limit}`;
    const body = await asJson(await asUser().requestJira(assumeTrustedRoute(path)));
    return arr(body?.issues).map((i) => issueOf(obj(i)));
  },
});

/**
 * Teamwork Graph : lecture GraphQL au nom de l'utilisateur. Droit manquant = tableau vide,
 * jamais d'erreur remontée. La requête exacte est à valider sur un site de dev (§ 22).
 */
export const graphPort = (): GraphPort => {
  const query = async (ari: string, gql: string): Promise<Json | undefined> => {
    try {
      const res = await asUser().requestAtlassian(assumeTrustedRoute("/gateway/api/graphql"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: gql, variables: { ari } }),
      });
      return asJson(res);
    } catch {
      return undefined;
    }
  };
  const connected = async (ari: string, type: string, field: string): Promise<readonly string[]> => {
    const data = await query(ari, `query($ari: ID!) { ari(ari: $ari) { connectedObjects(types: ["${type}"]) { ${field} } } }`);
    return arr(obj(data?.ari).connectedObjects).map((o) => str(obj(o)[field])).filter(Boolean);
  };
  return {
    readable: async () => (await query("ari:cloud:graph::site/self", "query($ari: ID!) { ari(ari: $ari) { id } }")) !== undefined,
    servicesFor: (ari) => connected(ari, "software-service", "name"),
    projectsFor: (ari) => connected(ari, "project", "key"),
    ownerOf: async (ari) => {
      const data = await query(ari, "query($ari: ID!) { ari(ari: $ari) { owners { accountId } } }");
      const owners = arr(obj(data?.ari).owners);
      const id = owners[0] ? str(obj(owners[0]).accountId) : "";
      return id || undefined;
    },
  };
};
