/**
 * Ordonnancement des gammes composées (GA-32, anciennement « C »).
 *
 * Une étape `subGamme` s'acquitte par la trace close de sa gamme enfant, jamais à
 * la main. Un échec de l'enfant fait échouer la composante : l'ordre de l'enfant
 * ne se saute pas. Tout en mémoire, sans réseau.
 */

import { describe, expect, it } from "vitest";
import { agent, human, machineEvidence, makeDeps, makeGamme, makeStep, makeVersion } from "../helpers";
import type { Deps } from "../../src/core/ports";
import { finishRun, recordStep, startRun } from "../../src/core/run/runs";
import { completeSubRun, startSubRun } from "../../src/core/composite/composite";

const OWNER = "ari:cloud:aaid:demo:ana";

const seedComposite = async () => {
  const deps = makeDeps();
  await deps.store.gammes.insert(makeGamme({ id: "gam_parent", code: "GAM-parent-01", ownerRef: OWNER, state: "approved" }));
  await deps.store.gammes.insert(makeGamme({ id: "gam_child", code: "GAM-enfant-01", ownerRef: OWNER, state: "approved" }));
  await deps.store.versions.insert(
    makeVersion({
      id: "ver_parent",
      gammeId: "gam_parent",
      inputs: [],
      steps: [
        makeStep({ id: "stp_composee", ord: 1, subGamme: { code: "GAM-enfant-01" } }),
        makeStep({ id: "stp_finale", ord: 2 }),
      ],
    }),
  );
  await deps.store.versions.insert(
    makeVersion({ id: "ver_child", gammeId: "gam_child", inputs: [], steps: [makeStep({ id: "stp_enfant", ord: 1 })] }),
  );
  return deps;
};

const runChildToCompletion = async (deps: Deps, childId: string, succeeded: boolean) => {
  const rec = await recordStep(deps, {
    runId: childId,
    stepId: "stp_enfant",
    outcome: "done",
    evidence: machineEvidence(),
    actor: human(),
  });
  expect(rec.ok).toBe(true);
  const fin = await finishRun(deps, { runId: childId, outcome: succeeded ? "succeeded" : "failed" });
  expect(fin.ok).toBe(true);
};

describe("gammes composées (GA-32)", () => {
  it("une étape composée ne s'acquitte pas à la main", async () => {
    const deps = await seedComposite();
    const parent = await startRun(deps, { code: "GAM-parent-01", inputs: {}, actor: human() });
    if (!parent.ok) throw new Error("démarrage attendu");
    const out = await recordStep(deps, {
      runId: parent.value.run.id,
      stepId: "stp_composee",
      outcome: "done",
      evidence: machineEvidence(),
      actor: human(),
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("composite_requires_subrun");
  });

  it("démarrer la composante lie l'enfant au parent et fige sa version", async () => {
    const deps = await seedComposite();
    const parent = await startRun(deps, { code: "GAM-parent-01", inputs: {}, actor: human() });
    if (!parent.ok) throw new Error("démarrage attendu");
    const parentRunId = parent.value.run.id;
    const started = await startSubRun(deps, { runId: parentRunId, stepId: "stp_composee", actor: human() });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.child.parentRunId).toBe(parentRunId);
    expect(started.value.child.parentStepId).toBe("stp_composee");
    expect(started.value.child.code).toBe("GAM-enfant-01");
    // La composante reste courante tant que l'enfant tourne.
    const parentRun = await deps.store.runs.get(parentRunId);
    expect(parentRun?.steps.find((s) => s.stepId === "stp_composee")?.subRunId).toBe(started.value.child.id);
    const events = await deps.store.events();
    expect(events.some((e) => e.kind === "run.subrun_started")).toBe(true);
  });

  it("l'étape composante est acquittée par la trace close de l'enfant", async () => {
    const deps = await seedComposite();
    const parent = await startRun(deps, { code: "GAM-parent-01", inputs: {}, actor: human() });
    if (!parent.ok) throw new Error("démarrage attendu");
    const parentRunId = parent.value.run.id;
    const started = await startSubRun(deps, { runId: parentRunId, stepId: "stp_composee", actor: human() });
    if (!started.ok) throw new Error("sous-exécution attendue");

    const before = await completeSubRun(deps, { runId: parentRunId, stepId: "stp_composee" });
    expect(before.ok).toBe(false);
    if (!before.ok) expect(before.error.code).toBe("subrun_not_finished");

    await runChildToCompletion(deps, started.value.child.id, true);
    const done = await completeSubRun(deps, { runId: parentRunId, stepId: "stp_composee" });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.completed).toBe(true);
    const step = done.value.run.steps.find((s) => s.stepId === "stp_composee");
    expect(step?.state).toBe("done");
    expect(step?.evidence?.kind).toBe("log_ref");
    // L'enfant clos, l'étape suivante devient courante.
    expect(done.value.next?.step.id).toBe("stp_finale");
  });

  it("un échec de l'enfant fait échouer la composante, sans la sauter", async () => {
    const deps = await seedComposite();
    const parent = await startRun(deps, { code: "GAM-parent-01", inputs: {}, actor: human() });
    if (!parent.ok) throw new Error("démarrage attendu");
    const parentRunId = parent.value.run.id;
    const started = await startSubRun(deps, { runId: parentRunId, stepId: "stp_composee", actor: human() });
    if (!started.ok) throw new Error("sous-exécution attendue");

    await runChildToCompletion(deps, started.value.child.id, false);
    const done = await completeSubRun(deps, { runId: parentRunId, stepId: "stp_composee" });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.completed).toBe(false);
    const step = done.value.run.steps.find((s) => s.stepId === "stp_composee");
    expect(step?.state).toBe("failed");
    expect(step?.refusedReason).toContain("gamme composée close");
  });

  it("acquitter sans sous-exécution est refusé, et l'agent seul est borné", async () => {
    const deps = await seedComposite();
    const parent = await startRun(deps, { code: "GAM-parent-01", inputs: {}, actor: agent() });
    if (!parent.ok) throw new Error("démarrage attendu");
    const out = await completeSubRun(deps, { runId: parent.value.run.id, stepId: "stp_composee" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("subrun_not_started");
  });
});