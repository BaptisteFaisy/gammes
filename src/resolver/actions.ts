/**
 * Gammes — les actions du resolver (§ 20).
 *
 * Le resolver est le SEUL point de montage : il n'importe que des services des lots
 * A–G, aucune logique métier n'y vit. Chaque action est une fonction pure
 * `(deps, payload, request) => Promise<…>` — testable avec le magasin en mémoire, hors Forge.
 */

import type { Deps } from "../core/ports";
import { ok, type Result } from "../core/result";
import type { ActorKind, ActorRef, Lang } from "../core/types";
import { handleTool, type McpToolKey, type Args } from "../core/mcp/tools";
import { getGammeByCode, getVersion } from "../core/version/versioning";
import { computeStepStats } from "../core/stats/step-stats";
import { workshopDust, freshness } from "../core/stats/workshop";
import { coverageDetail } from "../core/coverage/coverage";
import { detectConflicts } from "../core/conflicts/detect";
import { detectGhosts } from "../core/ghosts/ghosts";
import { getCurrentStep } from "../core/run/runs";
import { panelActions, panelKeys, type PanelActions } from "./panel";
import { macroActions, macroKeys, type MacroActions } from "./macro";
import { jiraActions, jiraKeys, type JiraActions } from "./jira";
import { checkSync, markSourceGone } from "../core/binding/binding";
import { compileIfProcedure } from "../core/compile/auto-compile";
import { persistStepStats } from "../core/stats/step-stats";
import { proposeFromTraces } from "../core/amendments/amendments";

/** Requête Forge : au minimum l'accountId de l'appelant (pour `asUser`). */
export type ForgeRequest = { readonly accountId?: string; readonly payload?: unknown };

export type ActionPayload = Readonly<Record<string, unknown>>;

export const actorFromRequest = (request: ForgeRequest, kind: ActorKind = "human"): ActorRef => ({
  id: request.accountId ?? "forge:anonymous",
  kind,
});

const langOf = (p: ActionPayload): Lang => (p.lang === "en" ? "en" : "fr");

/** Toutes les actions, construites à partir d'un `Deps` — le contrat du resolver. */
export const createActions = (deps: Deps) => ({
  ...readActions(deps),
  ...runActions(deps),
  ...eventActions(deps),
  ...panelActions(deps),
  ...macroActions(deps),
  ...jiraActions(deps),
});

/** Lectures : atelier, fiche de gamme, statistiques, conflits, fantômes, encart Jira. */
const readActions = (deps: Deps) => ({
  atelier: async (): Promise<Result<unknown>> => {
    const gammes = await deps.store.gammes.list();
    return ok({ gammes, dust: await workshopDust(deps), freshness: await freshness(deps), coverage: await coverageDetail(deps, "*") });
  },
  gamme: async (p: ActionPayload & { code: string }): Promise<Result<unknown>> => {
    const gamme = await getGammeByCode(deps, p.code);
    if (!gamme) return handleTool(deps, "get-procedure", { code: p.code });
    const version = await getVersion(deps, p.code);
    return ok({ gamme, version: version.ok ? version.value : undefined, stats: await computeStepStats(deps, { code: p.code }) });
  },
  stats: async (p: ActionPayload & { code: string }): Promise<Result<unknown>> => ok(await computeStepStats(deps, { code: p.code })),
  conflicts: async (p: ActionPayload): Promise<Result<unknown>> => ok(await detectConflicts(deps, p.service ? { service: String(p.service) } : {})),
  ghosts: async (p: ActionPayload): Promise<Result<unknown>> =>
    ok(await detectGhosts(deps, { ...(p.projectKey ? { projectKey: String(p.projectKey) } : {}), limit: Number(p.limit ?? 20) })),
});

/** Exécutions et outils MCP : le relais vers le cœur, sans logique propre. */
const runActions = (deps: Deps) => ({
  mcp: (p: ActionPayload & { tool: McpToolKey; args?: Args }): Promise<Result<unknown>> => handleTool(deps, p.tool, p.args ?? {}),
  run: (p: ActionPayload & { runId: string }): Promise<Result<unknown>> => getCurrentStep(deps, p.runId),
});

/** Déclencheurs : travail de nuit et événements de page. */
const eventActions = (deps: Deps) => ({
  nightly: async (): Promise<Result<unknown>> => {
    const gammes = await deps.store.gammes.list((g) => g.state === "approved");
    let stats = 0;
    let amendments = 0;
    for (const g of gammes) {
      stats += (await persistStepStats(deps, { code: g.code })).length;
      const proposed = await proposeFromTraces(deps, { code: g.code });
      if (proposed.ok) amendments += proposed.value.length;
    }
    const ghosts = await detectGhosts(deps, {});
    const conflicts = await detectConflicts(deps, {});
    return ok({ gammes: gammes.length, stats, amendments, ghosts: ghosts.length, conflicts: conflicts.length, at: deps.clock.now() });
  },
  pageEvent: async (p: ActionPayload & { ari: string; kind: string }): Promise<Result<unknown>> => {
    const binding = (await deps.store.bindings.list((b) => b.pageAri === p.ari))[0];
    if (!binding) return compileIfNewProcedure(deps, p);
    if (p.kind === "deleted") {
      const gone = await markSourceGone(deps, binding.gammeId);
      return ok({ handled: true, sync: gone.ok ? gone.value.sync : "source_gone" });
    }
    if (!deps.confluence) return ok({ handled: false, reason: "Confluence indisponible" });
    const page = await deps.confluence.getPage(p.ari);
    const report = await checkSync(deps, binding.gammeId, page);
    return ok({ handled: true, ...(report.ok ? { sync: report.value.sync, ageDays: report.value.ageDays } : {}) });
  },
});

/**
 * Page sans gamme liée : si son titre annonce une procédure, elle est compilée en
 * brouillon. Le confirmant est l'auteur de l'événement — la personne qui vient d'écrire
 * la page — et la compilation ne publie rien.
 */
const compileIfNewProcedure = async (
  deps: Deps,
  p: ActionPayload & { ari: string; kind: string },
): Promise<Result<unknown>> => {
  if (!deps.confluence) return ok({ handled: false, reason: "Confluence indisponible" });
  let page;
  try {
    page = await deps.confluence.getPage(p.ari);
  } catch {
    return ok({ handled: false, reason: "page inaccessible" });
  }
  const confirmedBy = actorFromRequest({ accountId: p.confirmedById ? String(p.confirmedById) : undefined });
  const outcome = await compileIfProcedure(deps, { page, confirmedBy });
  if (!outcome.ok) return outcome;
  return ok({ handled: outcome.value.compiled, ...outcome.value });
};

/** Les trois groupes d'actions des surfaces, pour que chaque lot n'édite que le sien. */
export type SurfaceActions = PanelActions & MacroActions & JiraActions;

export type Actions = ReturnType<typeof createActions>;
export type ActionKey = keyof Actions;

/** Clés du cœur (atelier, gamme, MCP, exécutions, déclencheurs). */
export const CORE_KEYS = [
  "mcp", "atelier", "gamme", "run", "stats", "conflicts", "ghosts", "nightly", "pageEvent",
] as const;

/**
 * Toutes les clés d'actions du resolver, composées depuis les groupes : un lot
 * qui ajoute une action n'édite que son propre module (`panel.ts`, `macro.ts`,
 * `jira.ts`) — jamais ce fichier ni `index.ts`. La cohérence entre cette liste
 * et `createActions` est vérifiée par `test/surfaces/action-keys.test.ts`.
 */
export const ACTION_KEYS: readonly ActionKey[] = [
  ...CORE_KEYS,
  ...panelKeys,
  ...macroKeys,
  ...jiraKeys,
];

/** Langue demandée par l'appelant (les rendus sont bilingues). */
export const requestedLang = (p: ActionPayload): Lang => langOf(p);
