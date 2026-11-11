/**
 * Gammes — les gammes fantômes (§ 12, GA-22).
 *
 * L'autre moitié du travail : ce qui n'a jamais été écrit. L'app cherche dans Jira et
 * JSM les motifs répétés — titres et composants proches, mêmes transitions, même durée
 * médiane — et propose : « ceci ressemble à une procédure que personne n'a écrite ».
 *
 * Chaque proposition porte ses preuves : nombre de tickets, étalement dans le temps,
 * durée médiane de traitement, nombre de personnes différentes (un **compte**, jamais
 * un nom, jamais un classement) et coût estimé en jours. L'adoption est humaine.
 */

import type { Deps } from "../ports";
import { fail, ok, refusals, type Result } from "../result";
import type { ActorRef, Gamme, GhostCandidate, IssueDigest } from "../types";
import { createVersion, nextCode } from "../version/versioning";
import { median } from "../stats/rates";
import { tokensOf as tokenize } from "../text/tokens";
import { daysBetween } from "../../platform/clock";

/** En dessous de ce nombre de tickets semblables, on ne propose rien : pas de motif, pas de fantôme. */
export const MIN_CLUSTER_SIZE = 5;
/** Une journée de travail facturée 8 h : le coût estimé est un ordre de grandeur, affiché comme tel. */
export const HOURS_PER_DAY = 8;

/** Le bruit des titres Jira/JSM : ces mots-là ne font pas un motif de procédure. */
const JIRA_NOISE = ["reset", "request"];

const tokensOf = (summary: string): readonly string[] => tokenize(summary, JIRA_NOISE);

/** Clé de regroupement : projet + composants + les trois mots les plus porteurs du titre. */
export const clusterKeyOf = (issue: IssueDigest): string => {
  const tokens = tokensOf(issue.summary).slice(0, 3).join("-");
  const components = [...issue.components].sort().join("+") || "sans-composant";
  return `${issue.projectKey}:${components}:${tokens}`;
};

const handleHoursOf = (issue: IssueDigest): number | undefined => {
  if (!issue.resolvedAt) return undefined;
  const hours = (Date.parse(issue.resolvedAt) - Date.parse(issue.createdAt)) / 3_600_000;
  return Number.isFinite(hours) && hours >= 0 ? Math.round(hours * 10) / 10 : undefined;
};

const labelsOf = (issues: readonly IssueDigest[]): string[] => {
  const counted = new Map<string, number>();
  for (const issue of issues) {
    for (const word of tokensOf(issue.summary)) counted.set(word, (counted.get(word) ?? 0) + 1);
  }
  return [...counted.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([word]) => word);
};

const candidateOf = (deps: Deps, key: string, issues: readonly IssueDigest[], projectKey?: string): GhostCandidate => {
  const handles = issues.flatMap((i) => (handleHoursOf(i) !== undefined ? [handleHoursOf(i)!] : []));
  const medianHandleH = median(handles) ?? 0;
  const dates = issues.map((i) => i.createdAt).sort();
  const spanDays = dates.length > 1 ? daysBetween(dates[0]!, dates[dates.length - 1]!) : 0;
  // Borne basse : on ne nomme personne, on ne classe personne — seulement un effectif.
  const peopleCount = Math.max(...issues.map((i) => i.assigneeCount), 1);
  return {
    id: deps.ids.next("gho"),
    clusterKey: key,
    label: labelsOf(issues).join(" ") || key,
    sampleIssueIds: issues.slice(0, 8).map((i) => i.key),
    n: issues.length,
    spanDays,
    medianHandleH,
    peopleCount,
    costDays: Math.round(((issues.length * medianHandleH) / HOURS_PER_DAY) * 10) / 10,
    state: "proposed",
    detectedAt: deps.clock.now(),
    ...(projectKey ? { projectKey } : {}),
  };
};

/** Cherche les motifs répétés qui n'ont aucune gamme écrite en face. */
export const detectGhosts = async (
  deps: Deps,
  args: { readonly projectKey?: string; readonly limit?: number } = {},
): Promise<readonly GhostCandidate[]> => {
  if (!deps.jira) return [];
  const issues = await deps.jira.searchIssues(args.projectKey, (args.limit ?? 20) * 10);
  const clusters = new Map<string, IssueDigest[]>();
  for (const issue of issues) {
    const key = clusterKeyOf(issue);
    clusters.set(key, [...(clusters.get(key) ?? []), issue]);
  }
  const covered = await coveredClusters(deps, [...clusters.keys()]);
  const found: GhostCandidate[] = [];
  for (const [key, group] of clusters) {
    if (group.length < MIN_CLUSTER_SIZE || covered.has(key)) continue;
    found.push(candidateOf(deps, key, group, args.projectKey ?? group[0]?.projectKey));
  }
  const ordered = found.sort((a, b) => b.costDays - a.costDays).slice(0, args.limit ?? 20);
  for (const candidate of ordered) await deps.store.ghosts.insert(candidate);
  for (const candidate of ordered) {
    await deps.store.appendEvent({
      at: candidate.detectedAt,
      kind: "ghost.proposed",
      subjectRef: candidate.id,
      payload: { clusterKey: candidate.clusterKey, n: candidate.n, costDays: candidate.costDays },
    });
  }
  return ordered;
};

/**
 * Un motif n'est pas un fantôme s'il est déjà outillé : une gamme existante dont le
 * titre partage au moins deux mots porteurs avec la clé du groupe. Les fantômes déjà
 * proposés ne sont pas reproposés.
 */
const coveredClusters = async (deps: Deps, keys: readonly string[]): Promise<Set<string>> => {
  const gammes = await deps.store.gammes.list();
  const titles = gammes.map((g) => new Set(tokensOf(g.title)));
  const covered = new Set<string>();
  for (const key of keys) {
    const words = key.split(":")[2]?.split("-") ?? [];
    if (titles.some((set) => words.filter((w) => set.has(w)).length >= 2)) covered.add(key);
  }
  for (const ghost of await deps.store.ghosts.list()) covered.add(ghost.clusterKey);
  return covered;
};

const commentSteps = (issues: readonly IssueDigest[]): readonly string[] => {
  const counted = new Map<string, number>();
  for (const issue of issues) {
    for (const body of issue.commentBodies) {
      for (const line of body.split(/\n|\. /).map((l) => l.trim()).filter((l) => l.length > 12)) {
        counted.set(line, (counted.get(line) ?? 0) + 1);
      }
    }
  }
  return [...counted.entries()]
    .filter(([, n]) => n >= Math.max(2, Math.floor(issues.length / 3)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([line]) => line);
};

/** Adoption humaine : ouvre un brouillon pré-rempli depuis les commentaires les plus constants. */
export const adoptGhost = async (deps: Deps, ghostId: string, owner: ActorRef): Promise<Result<Gamme>> => {
  if (owner.kind !== "human") return refusals.approvalRequiresHuman(owner.id);
  const ghost = await deps.store.ghosts.get(ghostId);
  if (!ghost) return fail("unknown_gamme", `Fantôme ${ghostId} introuvable.`, `Ghost ${ghostId} not found.`, { ghostId });
  const issues = deps.jira ? await deps.jira.searchIssues(ghost.projectKey, ghost.n * 3) : [];
  const sameCluster = issues.filter((i) => clusterKeyOf(i) === ghost.clusterKey);
  const steps = commentSteps(sameCluster.length >= MIN_CLUSTER_SIZE ? sameCluster : issues);
  const gamme = await draftGamme(deps, ghost, owner);
  await draftVersion(deps, gamme, ghost, steps);
  await deps.store.ghosts.update(ghostId, (g) => ({ ...g, state: "drafted", draftGammeId: gamme.id }));
  return ok(gamme);
};

const draftGamme = async (deps: Deps, ghost: GhostCandidate, owner: ActorRef): Promise<Gamme> => {
  const spaceKey = ghost.projectKey ?? "ADOPTION";
  const gamme: Gamme = {
    id: deps.ids.next("gam"),
    code: await nextCode(deps, spaceKey, ghost.label),
    title: ghost.label,
    state: "draft",
    ownerRef: owner.id,
    spaceKey,
    currentVersion: 0,
    risk: "none",
    exclusive: false,
    createdAt: deps.clock.now(),
    scope: { services: [], projects: ghost.projectKey ? [ghost.projectKey] : [], spaces: [spaceKey] },
    sync: "source_gone", // aucune page source : la gamme naît des tickets
  };
  await deps.store.gammes.insert(gamme);
  await deps.store.appendEvent({
    at: gamme.createdAt,
    kind: "gamme.compiled",
    subjectRef: gamme.id,
    actorKind: owner.kind,
    payload: { from: "ghost", ghostId: ghost.id, n: ghost.n, costDays: ghost.costDays },
  });
  return gamme;
};

/** Le brouillon pré-rempli : une étape par geste constant, cité depuis les tickets. */
const draftVersion = async (
  deps: Deps,
  gamme: Gamme,
  ghost: GhostCandidate,
  lines: readonly string[],
): Promise<void> => {
  const steps = lines.map((line, index) => ({
    id: deps.ids.next("stp"),
    ord: index + 1,
    kind: "manual" as const,
    text: line,
    evidence: { kind: "attestation" as const, strength: "attested" as const, required: true, hint: "attestation de l'opérateur" },
    locks: [],
    humanOnly: false,
    idempotent: true,
    risk: "none" as const,
    onFailure: "stop" as const,
    source: {
      pageAri: `jira:${ghost.projectKey ?? "inconnu"}`,
      start: 0,
      end: line.length,
      quote: line,
    },
    falsifiable: true,
    inferredBy: "rule" as const,
    inferredReason: `geste répété dans ${ghost.n} tickets, jamais écrit`,
  }));
  await createVersion(deps, gamme.id, {
    title: gamme.title,
    compiledAt: deps.clock.now(),
    compiledBy: "gammes:ghost-adopter",
    inputs: [],
    steps,
    conditions: { preconditions: [], postconditions: [] },
    fallback: { steps: [], text: "Aucun repli connu : la procédure n'a jamais été écrite." },
    actorPolicy: "human_only",
    exclusive: false,
    sourcePages: [`jira:${ghost.projectKey ?? "inconnu"}`],
    notes: `Brouillon pré-rempli depuis ${ghost.n} tickets semblables (coût estimé ${ghost.costDays} jours).`,
  });
};
