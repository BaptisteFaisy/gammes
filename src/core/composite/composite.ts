/**
 * Gammes — ordonnancement des gammes composées (GA-32).
 *
 * Une étape peut déclarer `subGamme` : elle ne s'acquitte pas à la main, elle est
 * acquittée par la **trace close** de la gamme qu'elle appelle. L'enfant est une
 * exécution épinglée à sa version, reliée à son parent ; l'ordre est celui des
 * étapes de l'enfant, jamais improvisé par le parent. Un échec de l'enfant fait
 * échouer l'étape composante : on ne saute pas une gamme qui a mal tourné.
 */

import type { Deps } from "../ports";
import { fail, ok, type Result } from "../result";
import type { ActorRef, Evidence, Run } from "../types";
import { startRun, type StartRunArgs } from "../run/runs";
import { advance, loadContext, patchStep, persist, viewOf, type CurrentStep } from "../run/run-state";

export type StartSubRunArgs = {
  readonly runId: string;
  readonly stepId: string;
  readonly actor: ActorRef;
  readonly inputs?: Record<string, unknown>;
  readonly mode?: StartRunArgs["mode"];
  readonly emergencyReason?: string;
};

export type SubRunStarted = {
  readonly parent: Run;
  readonly child: Run;
};

export type CompleteSubRunResult = {
  readonly run: Run;
  readonly completed: boolean;
  readonly evidence?: Evidence;
  readonly next?: CurrentStep;
};

const attemptsOf = (run: Run, stepId: string): number =>
  (run.steps.find((s) => s.stepId === stepId)?.attempts ?? 0) + 1;

const compositeRefusal = (stepId: string) =>
  fail(
    "composite_requires_subrun",
    `Étape ${stepId} sans gamme composée.`,
    `Step ${stepId} has no sub-gamme.`,
    { stepId },
  );

export const startSubRun = async (deps: Deps, args: StartSubRunArgs): Promise<Result<SubRunStarted>> => {
  const ctx = await loadContext(deps, args.runId, args.stepId);
  if (!ctx.ok) return ctx;
  const { run, step, current } = ctx.value;
  if (!step.subGamme) return compositeRefusal(step.id);
  if (current.subRunId) {
    const child = await deps.store.runs.get(current.subRunId);
    if (!child) return fail("unknown_run", `Sous-exécution ${current.subRunId} introuvable.`, `Sub-run ${current.subRunId} not found.`, {
      runId: current.subRunId,
    });
    return ok({ parent: run, child });
  }
  const childStart = await startRun(deps, {
    code: step.subGamme.code,
    version: step.subGamme.version,
    inputs: args.inputs ?? {},
    actor: args.actor,
    ticketRef: run.ticketRef,
    mode: args.mode,
    emergencyReason: args.emergencyReason,
  });
  if (!childStart.ok) return childStart;
  const child = await persist(deps, { ...childStart.value.run, parentRunId: run.id, parentStepId: step.id });
  const parent = await persist(deps, patchStep(run, step.id, { subRunId: child.id }));
  await deps.store.appendEvent({
    at: deps.clock.now(),
    kind: "run.subrun_started",
    subjectRef: run.id,
    actorKind: args.actor.kind,
    payload: { stepId: step.id, subRunId: child.id, code: step.subGamme.code },
  });
  return ok({ parent, child });
};

/** Acquitter la composante par la trace de sa gamme enfant, une fois celle-ci close. */
export const completeSubRun = async (
  deps: Deps,
  args: { readonly runId: string; readonly stepId: string },
): Promise<Result<CompleteSubRunResult>> => {
  const ctx = await loadContext(deps, args.runId, args.stepId);
  if (!ctx.ok) return ctx;
  const { run, version, step, current } = ctx.value;
  if (!step.subGamme) return compositeRefusal(step.id);
  const subRunId = current.subRunId;
  if (!subRunId) {
    return fail(
      "subrun_not_started",
      `Étape ${step.id} : aucune sous-exécution lancée.`,
      `Step ${step.id}: no sub-run started.`,
      { stepId: step.id },
    );
  }
  const child = await deps.store.runs.get(subRunId);
  if (!child) return fail("unknown_run", `Sous-exécution ${subRunId} introuvable.`, `Sub-run ${subRunId} not found.`, { runId: subRunId });
  if (!child.finishedAt) {
    return fail(
      "subrun_not_finished",
      `La sous-exécution ${subRunId} n'est pas close.`,
      `Sub-run ${subRunId} is not finished.`,
      { runId: subRunId },
    );
  }
  if (child.parentRunId !== run.id || child.parentStepId !== step.id) {
    return fail("internal", "La sous-exécution ne correspond pas à cette étape.", "The sub-run does not match this step.", {
      subRunId,
      stepId: step.id,
    });
  }
  const succeeded = child.outcome === "succeeded";
  const now = deps.clock.now();
  const evidence: Evidence | undefined = succeeded
    ? {
        kind: "log_ref",
        strength: "machine",
        ref: `${child.code}@v${child.pinnedVersion} · run:${child.id}`,
        capturedAt: now,
        note: "Trace close de la gamme composée",
      }
    : undefined;
  let updated: Run;
  if (succeeded) {
    updated = advance(patchStep(run, step.id, { state: "done", doneAt: now, evidence }), version, now, step.id);
  } else {
    updated = patchStep(run, step.id, {
      state: "failed",
      doneAt: now,
      attempts: attemptsOf(run, step.id),
      refusedReason: `gamme composée close (${child.outcome ?? "sans issue"})`,
    });
  }
  await persist(deps, updated);
  await deps.store.appendEvent({
    at: now,
    kind: "run.subrun_completed",
    subjectRef: run.id,
    payload: { stepId: step.id, subRunId, outcome: child.outcome ?? null },
  });
  const next = viewOf(updated, version);
  return ok({ run: updated, completed: succeeded, ...(evidence ? { evidence } : {}), ...(next ? { next } : {}) });
};