/**
 * Gammes — démarrer, suivre, reprendre et clore une exécution (§ 8, GA-07).
 *
 * L'exécution est **épinglée à sa version** : la page peut changer entre-temps, la
 * gamme peut être amendée, l'exécution ne change pas de gamme. Le mode dégradé
 * d'urgence exige une raison écrite et une revue différée dans les 7 jours (§ 24).
 */

import type { Deps } from "../ports";
import { fail, ok, refusals, type Failure, type Result } from "../result";
import type {
  ActorRef,
  EvidenceSpec,
  Gamme,
  GammeVersion,
  InputSpec,
  Run,
  RunMode,
  RunOutcome,
  RunStep,
  Step,
  StepLock,
  Trace,
} from "../types";
import { getGammeByCode, getVersion, isInvocable } from "../version/versioning";
import { advance, currentStepOf, loadRun, loadVersion, persist, stepOf, viewOf, type CurrentStep } from "./run-state";
import { buildTrace } from "../trace/trace";

export type StartRunArgs = {
  readonly code: string;
  readonly inputs: Record<string, unknown>;
  readonly actor: ActorRef;
  readonly ticketRef?: string;
  readonly mode?: RunMode;
  readonly emergencyReason?: string;
};

export type RunStart = {
  readonly run: Run;
  readonly step: Step;
  readonly evidence: EvidenceSpec;
  readonly locks: readonly StepLock[];
};

const EMERGENCY_REVIEW_DAYS = 7;

const typeMatches = (spec: InputSpec, value: unknown): boolean => {
  switch (spec.type) {
    case "number":
      return typeof value === "number" || (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)));
    case "boolean":
      return typeof value === "boolean" || value === "oui" || value === "non";
    case "enum":
      return typeof value === "string" && (spec.enumValues ?? []).includes(value);
    case "date":
      return typeof value === "string" && !Number.isNaN(Date.parse(value));
    default:
      return typeof value === "string" && value.trim().length > 0;
  }
};

/** Entrées typées et obligatoires : une exécution ne démarre pas à moitié renseignée. */
export const validateInputs = (
  specs: readonly InputSpec[],
  inputs: Record<string, unknown>,
): Failure | undefined => {
  for (const spec of specs) {
    const value = inputs[spec.name];
    const missing = value === undefined || value === null || value === "";
    if (missing && spec.required) {
      return fail(
        "input_missing",
        `Entrée obligatoire manquante : ${spec.name}${spec.description ? ` (${spec.description})` : ""}.`,
        `Missing required input: ${spec.name}.`,
        { input: spec.name },
      );
    }
    if (!missing && !typeMatches(spec, value)) {
      return fail(
        "input_invalid",
        `Entrée ${spec.name} invalide : ${spec.type} attendu.`,
        `Invalid input ${spec.name}: expected ${spec.type}.`,
        { input: spec.name, expected: spec.type },
      );
    }
  }
  return undefined;
};

const initialSteps = (version: GammeVersion, now: string): readonly RunStep[] =>
  [...version.steps]
    .sort((a, b) => a.ord - b.ord)
    .map((step, index) => ({
      stepId: step.id,
      state: index === 0 ? ("current" as const) : ("pending" as const),
      attempts: 0,
      ...(index === 0 ? { startedAt: now } : {}),
    }));

/** Une gamme exclusive n'admet qu'une exécution à la fois ; la seconde est refusée. */
const exclusiveBusy = async (deps: Deps, gamme: Gamme, runId: string): Promise<Result<never> | undefined> => {
  if (!gamme.exclusive) return undefined;
  const running = (await deps.store.runs.list((r) => r.gammeId === gamme.id && !r.finishedAt))[0];
  if (running) return refusals.exclusiveBusy(gamme.code, running.id);
  if (deps.reservations) {
    const reserved = await deps.reservations.tryReserve(`gamme:${gamme.id}`, runId);
    if (!reserved.reserved) return refusals.exclusiveBusy(gamme.code, reserved.holder ?? "inconnu");
  }
  return undefined;
};

const buildRun = (deps: Deps, gamme: Gamme, version: GammeVersion, args: StartRunArgs): Run => {
  const now = deps.clock.now();
  const emergency = args.mode === "emergency";
  return {
    id: deps.ids.next("run"),
    gammeId: gamme.id,
    code: gamme.code,
    versionId: version.id,
    pinnedVersion: version.version,
    actor: args.actor,
    startedAt: now,
    mode: emergency ? "emergency" : "normal",
    resumedCount: 0,
    steps: initialSteps(version, now),
    deviations: [],
    links: args.ticketRef ? [{ targetType: "issue", targetRef: args.ticketRef }] : [],
    ...(args.ticketRef ? { ticketRef: args.ticketRef } : {}),
    ...(emergency && args.emergencyReason ? { emergencyReason: args.emergencyReason } : {}),
    ...(emergency ? { emergencyReviewDueAt: deps.clock.plusDays(EMERGENCY_REVIEW_DAYS, now) } : {}),
  };
};

/** Démarrer : gamme invocable, entrées validées, version épinglée, exclusivité vérifiée. */
export const startRun = async (deps: Deps, args: StartRunArgs): Promise<Result<RunStart>> => {
  const gamme = await getGammeByCode(deps, args.code);
  if (!gamme) {
    return fail("unknown_gamme", `Gamme ${args.code} introuvable.`, `Gammes ${args.code} not found.`, { code: args.code });
  }
  if (!isInvocable(gamme)) return refusals.notApproved(gamme.code, gamme.state);
  const versionRes = await getVersion(deps, args.code);
  if (!versionRes.ok) return versionRes;
  const version = versionRes.value;
  if (version.steps.length === 0) {
    return fail("internal", `Gamme ${gamme.code} sans étape : rien à dérouler.`, `Gammes ${gamme.code} has no step.`, {
      code: gamme.code,
    });
  }
  const inputsError = validateInputs(version.inputs, args.inputs);
  if (inputsError) return inputsError;
  if (args.mode === "emergency" && !args.emergencyReason?.trim()) {
    return fail(
      "input_missing",
      "Le mode dégradé d'urgence exige une raison écrite.",
      "Emergency mode requires a written reason.",
      { mode: "emergency" },
    );
  }
  const run = buildRun(deps, gamme, version, args);
  const busy = await exclusiveBusy(deps, gamme, run.id);
  if (busy) return busy;
  await persist(deps, run);
  await deps.store.appendEvent({
    at: run.startedAt,
    kind: "run.started",
    subjectRef: run.id,
    actorKind: run.actor.kind,
    payload: { code: run.code, version: run.pinnedVersion, mode: run.mode, ticketRef: run.ticketRef ?? null },
  });
  const first = version.steps[0]!;
  return ok({ run, step: first, evidence: first.evidence, locks: first.locks });
};

/** L'étape courante : le même contenu pour un humain (checklist) et pour un agent (instruction). */
export const getCurrentStep = async (deps: Deps, runId: string): Promise<Result<CurrentStep>> => {
  const loaded = await loadRun(deps, runId);
  if (!loaded.ok) return loaded;
  if (loaded.value.finishedAt) {
    return fail(
      "run_already_finished",
      `Exécution ${runId} close : plus aucune étape à rendre.`,
      `Run ${runId} is finished: no step left to serve.`,
      { runId },
    );
  }
  const versionRes = await loadVersion(deps, loaded.value);
  if (!versionRes.ok) return versionRes;
  const view = viewOf(loaded.value, versionRes.value);
  if (!view) {
    return fail(
      "step_not_current",
      "Aucune étape courante : l'exécution attend sa clôture.",
      "No current step: the run is awaiting closure.",
      { runId },
    );
  }
  return ok(view);
};

/** Reprise après interruption : la version épinglée ne bouge pas. */
export const resumeRun = async (deps: Deps, runId: string, actor: ActorRef): Promise<Result<CurrentStep>> => {
  const loaded = await loadRun(deps, runId);
  if (!loaded.ok) return loaded;
  if (loaded.value.finishedAt) {
    return fail(
      "run_already_finished",
      `Exécution ${runId} déjà close.`,
      `Run ${runId} is already finished.`,
      { runId },
    );
  }
  const resumed = await persist(deps, { ...loaded.value, resumedCount: loaded.value.resumedCount + 1 });
  await deps.store.appendEvent({
    at: deps.clock.now(),
    kind: "run.started",
    subjectRef: resumed.id,
    actorKind: actor.kind,
    payload: { resumed: true, resumedCount: resumed.resumedCount, pinnedVersion: resumed.pinnedVersion },
  });
  return getCurrentStep(deps, runId);
};

export type FinishArgs = { readonly runId: string; readonly outcome: RunOutcome; readonly notes?: string };

/** Clore : la trace devient la preuve, et elle est immuable. */
export const finishRun = async (deps: Deps, args: FinishArgs): Promise<Result<Trace>> => {
  const loaded = await loadRun(deps, args.runId);
  if (!loaded.ok) return loaded;
  const run = loaded.value;
  if (run.finishedAt) {
    return fail(
      "run_already_finished",
      `Exécution ${args.runId} déjà close le ${run.finishedAt}.`,
      `Run ${args.runId} already finished at ${run.finishedAt}.`,
      { runId: args.runId },
    );
  }
  const now = deps.clock.now();
  const closed: Run = { ...run, finishedAt: now, outcome: args.outcome, ...(args.notes ? { notes: args.notes } : {}) };
  await persist(deps, closed);
  if (closed.mode === "emergency") {
    await deps.store.appendEvent({
      at: now,
      kind: "run.deviated",
      subjectRef: closed.id,
      actorKind: closed.actor.kind,
      payload: { mode: "emergency", reviewDueAt: closed.emergencyReviewDueAt ?? null },
    });
  }
  await deps.store.appendEvent({
    at: now,
    kind: "run.finished",
    subjectRef: closed.id,
    actorKind: closed.actor.kind,
    payload: { code: closed.code, version: closed.pinnedVersion, outcome: args.outcome },
  });
  return ok(await buildTrace(deps, closed));
};

export { recordStep, reportDeviation } from "./record";
export { currentStepOf, stepOf, advance };
