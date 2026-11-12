/**
 * Gammes — acquitter une étape, déclarer une déviation (§ 8, GA-07 et GA-08).
 *
 * Trois issues à un acquittement : accepté (l'étape avance), refusé par un verrou
 * (la tentative est **enregistrée comme déviation** et l'étape reste courante pour
 * qu'un humain prenne la main), refusé pour preuve manquante (l'étape n'avance pas).
 * Aucune commande n'est exécutée ici : l'app dit quoi faire et enregistre ce qui a été fait.
 */

import type { Deps } from "../ports";
import { fail, ok, refusals, type AppError, type Result } from "../result";
import type { ActorRef, Deviation, Evidence, GammeVersion, Run, Step, StepOutcome } from "../types";
import { evaluateStepLocks, evidenceRefusal } from "../locks/locks";
import { secondsBetween } from "../../platform/clock";
import {
  advance,
  attachDeviation,
  loadContext,
  loadRun,
  makeDeviation,
  patchStep,
  persist,
  viewOf,
  type CurrentStep,
} from "./run-state";

export type RecordStepArgs = {
  readonly runId: string;
  readonly stepId: string;
  readonly outcome: StepOutcome;
  readonly evidence?: Evidence;
  readonly reason?: string;
  readonly actor: ActorRef;
};

export type RecordOutcome = {
  readonly accepted: boolean;
  readonly next?: CurrentStep;
  readonly refusal?: AppError;
  readonly deviation?: Deviation;
};

export type DeviationArgs = {
  readonly runId: string;
  readonly stepId?: string;
  readonly whatHappened: string;
  readonly why: string;
  readonly actor: ActorRef;
  readonly origin?: Deviation["origin"];
};

type Ctx = { readonly run: Run; readonly version: GammeVersion; readonly step: Step };

const scopeOf = async (deps: Deps, run: Run): Promise<string> => {
  const gamme = await deps.store.gammes.get(run.gammeId);
  return gamme?.scope.services[0] ?? gamme?.spaceKey ?? run.code;
};

const attemptsOf = (run: Run, stepId: string): number =>
  (run.steps.find((s) => s.stepId === stepId)?.attempts ?? 0) + 1;

const logStep = async (
  deps: Deps,
  run: Run,
  kind: "run.step_recorded" | "run.refused",
  payload: Record<string, unknown>,
): Promise<void> => {
  await deps.store.appendEvent({
    at: deps.clock.now(),
    kind,
    subjectRef: run.id,
    actorKind: run.actor.kind,
    payload,
  });
};

/** Un refus de verrou n'est jamais silencieux : déviation tracée, étape laissée courante. */
const refuseStep = async (
  deps: Deps,
  run: Run,
  stepId: string,
  refusal: AppError,
  actor: ActorRef,
  origin: Deviation["origin"],
  whatHappened: string,
): Promise<Result<RecordOutcome>> => {
  const attempts = attemptsOf(run, stepId);
  const refused = await persist(deps, patchStep(run, stepId, { attempts, refusedReason: refusal.messageFr }));
  const deviation = makeDeviation(deps, {
    runId: refused.id,
    stepId,
    whatHappened,
    why: refusal.messageFr,
    actorKind: actor.kind,
    origin,
  });
  const traced = await attachDeviation(deps, refused, deviation);
  await logStep(deps, traced, "run.refused", { stepId, code: refusal.code, origin, attempts });
  return ok({ accepted: false, refusal, deviation });
};

/** Acquitter une étape : verrous, preuve, conduite en cas d'échec, avancement. */
export const recordStep = async (deps: Deps, args: RecordStepArgs): Promise<Result<RecordOutcome>> => {
  const ctxRes = await loadContext(deps, args.runId, args.stepId);
  if (!ctxRes.ok) return ctxRes;
  const { run, version, step, current } = ctxRes.value;
  if (current.stepId !== args.stepId) {
    const refusal = refusals.stepNotCurrent(args.stepId, current.stepId);
    return ok({ accepted: false, refusal: refusal.error });
  }
  if (step.subGamme) {
    return fail(
      "composite_requires_subrun",
      `Étape ${step.id} est une gamme composée : elle s'acquitte par la trace de sa sous-exécution, pas à la main.`,
      `Step ${step.id} is a composite gamme: it is completed by its sub-run trace, not by hand.`,
      { stepId: step.id },
    );
  }
  if (args.outcome === "skipped" && !args.reason?.trim()) {
    return fail(
      "input_missing",
      "Sauter une étape exige une raison écrite.",
      "Skipping a step requires a written reason.",
      { stepId: step.id },
    );
  }
  const scope = await scopeOf(deps, run);
  const decision = await evaluateStepLocks(deps, { step, actor: args.actor, scope });
  if (!decision.allowed && decision.refusal) {
    return refuseStep(
      deps,
      run,
      step.id,
      decision.refusal,
      args.actor,
      "lock_refusal",
      `Tentative d'acquittement par ${args.actor.kind} sur une étape verrouillée`,
    );
  }
  const missing = args.outcome === "done" ? evidenceRefusal(step, args.evidence) : undefined;
  if (missing) {
    return refuseStep(deps, run, step.id, missing, args.actor, "missing_evidence", "Étape acquittée sans la preuve exigée");
  }
  return args.outcome === "done" ? acceptStep(deps, args, { run, version, step }) : failStep(deps, args, { run, version, step });
};

const acceptStep = async (deps: Deps, args: RecordStepArgs, ctx: Ctx): Promise<Result<RecordOutcome>> => {
  const now = deps.clock.now();
  const startedAt = ctx.run.steps.find((s) => s.stepId === args.stepId)?.startedAt;
  const done = patchStep(ctx.run, args.stepId, {
    state: "done",
    doneAt: now,
    refusedReason: undefined,
    ...(startedAt ? { durationS: durationSeconds(startedAt, now) } : {}),
    ...(args.evidence ? { evidence: args.evidence } : {}),
  });
  const moved = advance(done, ctx.version, now, args.stepId);
  await persist(deps, moved);
  await logStep(deps, moved, "run.step_recorded", { stepId: args.stepId, outcome: "done" });
  const next = viewOf(moved, ctx.version);
  return ok({ accepted: true, ...(next ? { next } : {}) });
};

const durationSeconds = (fromIso: string, toIso: string): number => secondsBetween(fromIso, toIso);

/** Échec, saut ou refus déclaré : la conduite de l'étape décide si l'exécution avance. */
const failStep = async (deps: Deps, args: RecordStepArgs, ctx: Ctx): Promise<Result<RecordOutcome>> => {
  const now = deps.clock.now();
  const state = args.outcome === "skipped" ? "skipped" : args.outcome === "refused" ? "refused" : "failed";
  const retry = args.outcome === "failed" && ctx.step.onFailure === "retry";
  const advanceAfter = !retry && (state !== "failed" || ctx.step.onFailure === "skip_with_reason");
  let updated = patchStep(ctx.run, args.stepId, {
    state: retry ? "current" : state,
    attempts: attemptsOf(ctx.run, args.stepId),
    ...(retry ? {} : { doneAt: now }),
    ...(args.reason ? { refusedReason: args.reason } : {}),
  });
  updated = advanceAfter ? advance(updated, ctx.version, now, args.stepId) : updated;
  const deviation = args.reason
    ? makeDeviation(deps, {
        runId: updated.id,
        stepId: args.stepId,
        whatHappened: `étape ${args.outcome}`,
        why: args.reason,
        actorKind: args.actor.kind,
        origin: "declared",
      })
    : undefined;
  updated = deviation ? await attachDeviation(deps, updated, deviation) : await persist(deps, updated);
  await logStep(deps, updated, "run.step_recorded", {
    stepId: args.stepId,
    outcome: args.outcome,
    onFailure: ctx.step.onFailure,
  });
  const view = viewOf(updated, ctx.version);
  return ok({ accepted: true, ...(view ? { next: view } : {}), ...(deviation ? { deviation } : {}) });
};

/** Déclarer ce qui a été fait à la place, et pourquoi : la matière la plus précieuse du produit. */
export const reportDeviation = async (deps: Deps, args: DeviationArgs): Promise<Result<Deviation>> => {
  const loaded = await loadRun(deps, args.runId);
  if (!loaded.ok) return loaded;
  const deviation = makeDeviation(deps, {
    runId: args.runId,
    ...(args.stepId ? { stepId: args.stepId } : {}),
    whatHappened: args.whatHappened,
    why: args.why,
    actorKind: args.actor.kind,
    origin: args.origin ?? "declared",
  });
  await attachDeviation(deps, loaded.value, deviation);
  await deps.store.appendEvent({
    at: deviation.at,
    kind: "run.deviated",
    subjectRef: args.runId,
    actorKind: args.actor.kind,
    payload: { stepId: args.stepId ?? null, origin: deviation.origin, why: deviation.why },
  });
  return ok(deviation);
};
