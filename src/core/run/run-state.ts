/**
 * Gammes — l'état d'une exécution (§ 8).
 *
 * Un seul endroit lit et écrit la forme `Run` : ni `runs.ts` ni `record.ts` ne la
 * recopient. L'exécution est **épinglée à sa version** : on relit toujours la version
 * gravée au démarrage, jamais la version courante de la gamme.
 */

import type { Deps } from "../ports";
import { fail, type Result } from "../result";
import type {
  ActorKind,
  Deviation,
  DeviationOrigin,
  EvidenceSpec,
  GammeVersion,
  Run,
  RunStep,
  Step,
  StepLock,
} from "../types";

export type RunContext = {
  readonly run: Run;
  readonly version: GammeVersion;
  readonly step: Step;
  readonly current: RunStep;
};

export const loadRun = async (deps: Deps, runId: string): Promise<Result<Run>> => {
  const run = await deps.store.runs.get(runId);
  if (!run) {
    return fail("unknown_run", `Exécution ${runId} introuvable.`, `Run ${runId} not found.`, { runId });
  }
  return { ok: true, value: run };
};

export const loadVersion = async (deps: Deps, run: Run): Promise<Result<GammeVersion>> => {
  const version = await deps.store.versions.get(run.versionId);
  if (!version) {
    return fail("unknown_version", `Version ${run.versionId} introuvable.`, `Version ${run.versionId} not found.`, {
      versionId: run.versionId,
    });
  }
  return { ok: true, value: version };
};

export const currentStepOf = (run: Run): RunStep | undefined => run.steps.find((s) => s.state === "current");

export const stepOf = (version: GammeVersion, stepId: string): Step | undefined =>
  version.steps.find((s) => s.id === stepId);

/** Charge l'exécution, sa version épinglée, l'étape visée et l'étape courante. */
export const loadContext = async (deps: Deps, runId: string, stepId?: string): Promise<Result<RunContext>> => {
  const loaded = await loadRun(deps, runId);
  if (!loaded.ok) return loaded;
  const run = loaded.value;
  if (run.finishedAt) {
    return fail(
      "run_already_finished",
      `Exécution ${runId} close le ${run.finishedAt} : sa trace est immuable.`,
      `Run ${runId} finished at ${run.finishedAt}: its trace is immutable.`,
      { runId, finishedAt: run.finishedAt },
    );
  }
  const versionRes = await loadVersion(deps, run);
  if (!versionRes.ok) return versionRes;
  const current = currentStepOf(run);
  const wantedId = stepId ?? current?.stepId;
  if (!wantedId || !current) {
    return fail(
      "step_not_current",
      "Aucune étape courante : l'exécution attend sa clôture.",
      "No current step: the run is awaiting closure.",
      { runId },
    );
  }
  const step = stepOf(versionRes.value, wantedId);
  if (!step) {
    return fail("unknown_step", `Étape ${wantedId} absente de la version épinglée.`, `Step ${wantedId} not in the pinned version.`, {
      stepId: wantedId,
    });
  }
  return { ok: true, value: { run, version: versionRes.value, step, current } };
};

export const patchStep = (run: Run, stepId: string, patch: Partial<RunStep>): Run => ({
  ...run,
  steps: run.steps.map((s) => (s.stepId === stepId ? { ...s, ...patch } : s)),
});

/** L'étape suivante dans l'ordre de la version épinglée. */
export const nextStepOf = (run: Run, version: GammeVersion, afterStepId: string): Step | undefined => {
  const ordered = [...version.steps].sort((a, b) => a.ord - b.ord);
  const index = ordered.findIndex((s) => s.id === afterStepId);
  return index >= 0 ? ordered[index + 1] : undefined;
};

/** Fait avancer l'exécution : l'étape suivante devient courante, son chronomètre démarre. */
export const advance = (run: Run, version: GammeVersion, now: string): Run => {
  const current = currentStepOf(run);
  if (!current) return run;
  const next = nextStepOf(run, version, current.stepId);
  if (!next) return run;
  return patchStep(run, next.id, { state: "current", startedAt: now });
};

export const persist = async (deps: Deps, run: Run): Promise<Run> => {
  await deps.store.runs.insert(run);
  return run;
};

export type DeviationArgs = {
  readonly runId: string;
  readonly stepId?: string;
  readonly whatHappened: string;
  readonly why: string;
  readonly actorKind: ActorKind;
  readonly origin: DeviationOrigin;
};

export const makeDeviation = (deps: Deps, args: DeviationArgs): Deviation => ({
  id: deps.ids.next("dev"),
  runId: args.runId,
  whatHappened: args.whatHappened,
  why: args.why,
  at: deps.clock.now(),
  actorKind: args.actorKind,
  origin: args.origin,
  ...(args.stepId ? { stepId: args.stepId } : {}),
});

/** Une déviation est à la fois dans l'exécution (trace) et dans sa table (statistiques). */
export const attachDeviation = async (deps: Deps, run: Run, deviation: Deviation): Promise<Run> => {
  await deps.store.deviations.insert(deviation);
  const next: Run = { ...run, deviations: [...run.deviations, deviation] };
  return persist(deps, next);
};

export const progressOf = (run: Run, version: GammeVersion): { done: number; total: number } => ({
  done: run.steps.filter((s) => s.state === "done" || s.state === "skipped").length,
  total: version.steps.length,
});

/** Ce que l'app rend à l'opérateur comme à l'agent : le même contenu, deux rendus. */
export type CurrentStep = {
  readonly run: Run;
  readonly step: Step;
  readonly evidence: EvidenceSpec;
  readonly locks: readonly StepLock[];
  readonly progress: { readonly done: number; readonly total: number };
};

/** Vue de l'étape courante, ou `undefined` quand l'exécution attend sa clôture. */
export const viewOf = (run: Run, version: GammeVersion): CurrentStep | undefined => {
  const current = currentStepOf(run);
  if (!current) return undefined;
  const step = stepOf(version, current.stepId);
  if (!step) return undefined;
  return { run, step, evidence: step.evidence, locks: step.locks, progress: progressOf(run, version) };
};
