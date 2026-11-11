/**
 * Gammes — les 16 outils MCP (§ 18, GA-14).
 *
 * UN jeu d'outils sert TOUTES les gammes : le contenu vient de la base, pas du manifeste.
 * Lecture = `GET`, écriture = `CREATE`/`UPDATE`. Aucun outil ne renvoie de secret, aucun
 * n'accepte une attestation humaine au nom d'un agent, et `record-step` renvoie le refus
 * explicite du verrou (le refus est un résultat `ok`, pas une erreur : l'agent le lit).
 */

import type { Deps } from "../ports";
import { fail, ok, refusals, type Result } from "../result";
import type { ActorKind, ActorRef, Run, RunOutcome, StepOutcome } from "../types";
import { checkBeforeActing, findProcedure, type BeforeActingVerdict, type ProcedureMatch } from "./search";
import { getGammeByCode, getVersion, listVersions } from "../version/versioning";
import { finishRun, getCurrentStep, recordStep, reportDeviation, startRun } from "../run/runs";
import { buildTrace } from "../trace/trace";
import { computeStepStats } from "../stats/step-stats";
import { proposeAmendment, proposeFromTraces } from "../amendments/amendments";
import { detectGhosts } from "../ghosts/ghosts";
import { detectConflicts } from "../conflicts/detect";
import { exportSkillMd, type SkillExport } from "../export/skill-md";
import { compilePage, type CompileOutcome } from "../compile/compile-page";

export type ToolVerb = "GET" | "CREATE" | "UPDATE";

export type McpToolKey =
  | "find-procedure" | "check-before-acting" | "get-procedure" | "list-procedures"
  | "start-run" | "get-current-step" | "record-step" | "report-deviation" | "finish-run"
  | "get-run-trace" | "get-procedure-stats" | "propose-amendment" | "compile-page"
  | "export-skill" | "get-missing-procedures" | "get-conflicts";

export type McpToolDef = {
  readonly key: McpToolKey;
  readonly verb: ToolVerb;
  readonly description: string;
  readonly inputProperties: Readonly<Record<string, { readonly type: string; readonly description: string }>>;
};

const prop = (type: string, description: string) => ({ type, description });

export const MCP_TOOLS: readonly McpToolDef[] = [
  { key: "find-procedure", verb: "GET", description: "Chercher une gamme par intention ou contexte.", inputProperties: { query: prop("string", "mots-clés"), context: prop("object", "service, environnement, action visée") } },
  { key: "check-before-acting", verb: "GET", description: "Existe-t-il une gamme pour ce geste ? Verrous et permis requis.", inputProperties: { intendedAction: prop("string", "le geste envisagé"), service: prop("string", "service concerné") } },
  { key: "get-procedure", verb: "GET", description: "Étapes, entrées, preuves, verrous et provenance d'une gamme.", inputProperties: { code: prop("string", "code de gamme"), version: prop("number", "version précise (facultatif)") } },
  { key: "list-procedures", verb: "GET", description: "Le registre filtré : espace, état, fraîcheur.", inputProperties: { space: prop("string", "espace"), state: prop("string", "état"), stale: prop("boolean", "désynchronisées seulement") } },
  { key: "start-run", verb: "CREATE", description: "Démarrer une exécution épinglée à sa version.", inputProperties: { code: prop("string", "code"), inputs: prop("object", "entrées typées"), actorId: prop("string", "acteur"), actorKind: prop("string", "human|agent"), mode: prop("string", "normal|emergency"), emergencyReason: prop("string", "raison du mode dégradé") } },
  { key: "get-current-step", verb: "GET", description: "L'étape courante, sa preuve et ses verrous.", inputProperties: { runId: prop("string", "exécution") } },
  { key: "record-step", verb: "UPDATE", description: "Acquitter l'étape avec sa preuve, ou recevoir le refus du verrou.", inputProperties: { runId: prop("string", "exécution"), stepId: prop("string", "étape"), outcome: prop("string", "done|failed|skipped|refused"), evidence: prop("object", "preuve"), reason: prop("string", "raison d'un saut/échec"), actorId: prop("string", "acteur"), actorKind: prop("string", "human|agent") } },
  { key: "report-deviation", verb: "CREATE", description: "Déclarer ce qui a été fait à la place, et pourquoi.", inputProperties: { runId: prop("string", "exécution"), stepId: prop("string", "étape"), whatHappened: prop("string", "quoi"), why: prop("string", "pourquoi"), actorId: prop("string", "acteur"), actorKind: prop("string", "human|agent") } },
  { key: "finish-run", verb: "UPDATE", description: "Clore l'exécution et rendre la trace citable.", inputProperties: { runId: prop("string", "exécution"), outcome: prop("string", "succeeded|failed|aborted|expired"), notes: prop("string", "notes") } },
  { key: "get-run-trace", verb: "GET", description: "La trace complète d'une exécution.", inputProperties: { runId: prop("string", "exécution") } },
  { key: "get-procedure-stats", verb: "GET", description: "Échecs, sauts, déviations par étape, avec effectifs.", inputProperties: { code: prop("string", "code"), version: prop("number", "version (facultatif)") } },
  { key: "propose-amendment", verb: "CREATE", description: "Proposer un amendement (jamais appliqué seul).", inputProperties: { code: prop("string", "code"), proposal: prop("string", "proposition"), rationale: prop("string", "preuves") } },
  { key: "compile-page", verb: "CREATE", description: "Compiler une page en brouillon de gamme + diff. Rien n'est publié.", inputProperties: { pageAri: prop("string", "page Confluence"), confirmedById: prop("string", "qui confirme") } },
  { key: "export-skill", verb: "GET", description: "Le SKILL.md d'une gamme approuvée, en source ouverte.", inputProperties: { code: prop("string", "code"), version: prop("number", "version") } },
  { key: "get-missing-procedures", verb: "GET", description: "Les gammes fantômes, avec preuves et coût.", inputProperties: { projectKey: prop("string", "projet"), limit: prop("number", "max") } },
  { key: "get-conflicts", verb: "GET", description: "Les conflits détectés, passages cités de part et d'autre.", inputProperties: { service: prop("string", "service") } },
];

export type Args = Readonly<Record<string, unknown>>;

const actorOf = (a: Args): ActorRef => ({
  id: typeof a.actorId === "string" ? a.actorId : "mcp-caller",
  kind: a.actorKind === "human" ? "human" : (a.actorKind as ActorKind) ?? "agent",
});

const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const obj = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;

const req = <T>(value: T | undefined, key: string): Result<T> =>
  value === undefined ? fail("input_missing", `Argument MCP manquant : ${key}.`, `Missing MCP argument: ${key}.`, { key }) : ok(value);

const contextOf = (a: Args): { service?: string; action?: string } | undefined => {
  const ctx = obj(a.context);
  return ctx ? { service: str(ctx.service), action: str(ctx.action) } : undefined;
};

const RUN_TOOLS: ReadonlySet<McpToolKey> = new Set([
  "start-run", "get-current-step", "record-step", "report-deviation", "finish-run", "get-run-trace",
]);
const WRITE_TOOLS: ReadonlySet<McpToolKey> = new Set(["propose-amendment", "compile-page", "export-skill"]);

/** Le point d'entrée unique : trois dispatchers courts, aucune logique métier ici. */
export const handleTool = async (deps: Deps, key: McpToolKey, args: Args): Promise<Result<unknown>> => {
  if (RUN_TOOLS.has(key)) return handleRunTool(deps, key, args);
  if (WRITE_TOOLS.has(key)) return handleWriteTool(deps, key, args);
  return handleReadTool(deps, key, args);
};

const handleReadTool = async (deps: Deps, key: McpToolKey, a: Args): Promise<Result<unknown>> => {
  switch (key) {
    case "find-procedure":
      return ok(await findProcedure(deps, { query: str(a.query), context: contextOf(a) }));
    case "check-before-acting": {
      const action = req(str(a.intendedAction), "intendedAction");
      return action.ok ? ok(await checkBeforeActing(deps, { intendedAction: action.value, service: str(a.service) })) : action;
    }
    case "get-procedure":
      return getProcedure(deps, str(a.code), num(a.version));
    case "list-procedures":
      return ok(await listProcedures(deps, { space: str(a.space), state: str(a.state), stale: a.stale === true }));
    case "get-procedure-stats": {
      const code = req(str(a.code), "code");
      return code.ok ? ok(await computeStepStats(deps, { code: code.value, ...(num(a.version) !== undefined ? { version: num(a.version) } : {}) })) : code;
    }
    case "get-missing-procedures":
      return ok(await detectGhosts(deps, { ...(str(a.projectKey) ? { projectKey: str(a.projectKey) } : {}), limit: num(a.limit) ?? 20 }));
    case "get-conflicts":
      return ok(await detectConflicts(deps, str(a.service) ? { service: str(a.service) } : {}));
    default:
      return unknownTool(key);
  }
};

const handleRunTool = async (deps: Deps, key: McpToolKey, a: Args): Promise<Result<unknown>> => {
  switch (key) {
    case "start-run": {
      const code = req(str(a.code), "code");
      return code.ok
        ? startRun(deps, {
            code: code.value,
            inputs: obj(a.inputs) ?? {},
            actor: actorOf(a),
            ...(str(a.mode) ? { mode: str(a.mode) as Run["mode"] } : {}),
            ...(str(a.emergencyReason) ? { emergencyReason: str(a.emergencyReason) } : {}),
          })
        : code;
    }
    case "get-current-step": {
      const runId = req(str(a.runId), "runId");
      return runId.ok ? getCurrentStep(deps, runId.value) : runId;
    }
    case "record-step":
      return recordStepTool(deps, a);
    case "report-deviation":
      return reportDeviationTool(deps, a);
    case "finish-run": {
      const runId = req(str(a.runId), "runId");
      return runId.ok ? finishRun(deps, { runId: runId.value, outcome: (str(a.outcome) ?? "succeeded") as RunOutcome, notes: str(a.notes) }) : runId;
    }
    case "get-run-trace":
      return getRunTrace(deps, str(a.runId));
    default:
      return unknownTool(key);
  }
};

const handleWriteTool = async (deps: Deps, key: McpToolKey, a: Args): Promise<Result<unknown>> => {
  switch (key) {
    case "propose-amendment":
      return proposeAmendmentTool(deps, str(a.code), str(a.proposal), str(a.rationale));
    case "compile-page":
      return compilePageTool(deps, str(a.pageAri), str(a.confirmedById));
    case "export-skill": {
      const code = req(str(a.code), "code");
      return code.ok ? exportSkillMd(deps, { code: code.value, ...(num(a.version) !== undefined ? { version: num(a.version) } : {}) }) : code;
    }
    default:
      return unknownTool(key);
  }
};

const recordStepTool = async (deps: Deps, a: Args): Promise<Result<unknown>> => {
  const runId = req(str(a.runId), "runId");
  const stepId = req(str(a.stepId), "stepId");
  if (!runId.ok) return runId;
  if (!stepId.ok) return stepId;
  return recordStep(deps, {
    runId: runId.value,
    stepId: stepId.value,
    outcome: (str(a.outcome) ?? "done") as StepOutcome,
    ...(obj(a.evidence) ? { evidence: obj(a.evidence) as never } : {}),
    ...(str(a.reason) ? { reason: str(a.reason) } : {}),
    actor: actorOf(a),
  });
};

const reportDeviationTool = async (deps: Deps, a: Args): Promise<Result<unknown>> => {
  const runId = req(str(a.runId), "runId");
  const what = req(str(a.whatHappened), "whatHappened");
  const why = req(str(a.why), "why");
  if (!runId.ok) return runId;
  if (!what.ok) return what;
  if (!why.ok) return why;
  return reportDeviation(deps, {
    runId: runId.value,
    ...(str(a.stepId) ? { stepId: str(a.stepId) } : {}),
    whatHappened: what.value,
    why: why.value,
    actor: actorOf(a),
  });
};

const unknownTool = (key: McpToolKey): Result<never> =>
  fail("input_invalid", `Outil MCP inconnu : ${String(key)}.`, `Unknown MCP tool: ${String(key)}.`, { key: String(key) });

export const getProcedure = async (deps: Deps, code: string | undefined, version?: number): Promise<Result<unknown>> => {
  const required = req(code, "code");
  if (!required.ok) return required;
  const v = await getVersion(deps, required.value, version);
  if (!v.ok) return v;
  const gamme = await getGammeByCode(deps, required.value);
  const versions = gamme ? await listVersions(deps, gamme.id) : [];
  return ok({ gamme, version: v.value, versions: versions.map((x) => x.version) });
};

export const listProcedures = async (deps: Deps, filter: { space?: string; state?: string; stale: boolean }) =>
  deps.store.gammes.list(
    (g) => (!filter.space || g.spaceKey === filter.space) && (!filter.state || g.state === filter.state) && (!filter.stale || g.sync === "stale"),
  );

export const getRunTrace = async (deps: Deps, runId: string | undefined): Promise<Result<unknown>> => {
  const required = req(runId, "runId");
  if (!required.ok) return required;
  const run = await deps.store.runs.get(required.value);
  if (!run) return refusalsOfRun(required.value);
  return ok(await buildTrace(deps, run));
};

const refusalsOfRun = (runId: string) => fail("unknown_run", `Exécution ${runId} introuvable.`, `Run ${runId} not found.`, { runId });
const refusalsOfGamme = (code: string) => fail("unknown_gamme", `Gamme ${code} introuvable.`, `Gammes ${code} not found.`, { code });

export const proposeAmendmentTool = async (deps: Deps, code: string | undefined, proposal?: string, rationale?: string): Promise<Result<unknown>> => {
  const required = req(code, "code");
  if (!required.ok) return required;
  if (proposal && rationale) {
    const gamme = await getGammeByCode(deps, required.value);
    if (!gamme) return refusalsOfGamme(required.value);
    return proposeAmendment(deps, { gammeId: gamme.id, proposal, rationale, evidenceRefs: [], proposedBy: "agent" });
  }
  return proposeFromTraces(deps, { code: required.value });
};

export const compilePageTool = async (deps: Deps, pageAri: string | undefined, confirmedById: string | undefined): Promise<Result<CompileOutcome>> => {
  const required = req(pageAri, "pageAri");
  if (!required.ok) return required;
  if (!deps.confluence) return refusals.sourceUnavailable(required.value);
  const page = await deps.confluence.getPage(required.value);
  return compilePage(deps, { page, confirmedBy: { id: confirmedById ?? "mcp-compiler", kind: "human" } });
};

export type { BeforeActingVerdict, ProcedureMatch, SkillExport };
