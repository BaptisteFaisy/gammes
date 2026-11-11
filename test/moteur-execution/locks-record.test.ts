/**
 * Verrous, preuves, déviations et trace (§ 8, § 9, GA-08, GA-09, GA-12).
 *
 * Recette 8  : un agent qui acquitte une étape `human_only` reçoit un refus, et la
 *              tentative apparaît dans les déviations.
 * Recette 9  : une étape à risque exécutée par un agent sans permis valide est refusée,
 *              avec la demande de permis à créer.
 * Recette 10 : une étape sans preuve là où une preuve est exigée n'avance pas.
 * Recette 11 : une déviation déclarée est visible dans la trace.
 * Recette 13 : une exécution close produit une trace citable.
 */

import { describe, expect, it } from "vitest";
import { agent, human, makeDeps, T0 } from "../helpers";
import { finishRun, getCurrentStep, recordStep, reportDeviation, startRun } from "../../src/core/run/runs";
import { buildTrace, citeRun, renderTraceMarkdown } from "../../src/core/trace/trace";
import {
  attestation,
  deniedPermits,
  grantedPermits,
  machineEvidence,
  PERMIT_URL,
  seedApprovedGamme,
  validInputs,
} from "./fixtures";
import type { Deps } from "../../src/core/ports";
import type { Run } from "../../src/core/types";

const start = async (deps: Deps, actor = human()): Promise<Run> => {
  const res = await startRun(deps, { code: "GAM-deploy-01", inputs: validInputs(), actor });
  if (!res.ok) throw new Error(`démarrage refusé : ${res.error.code}`);
  return res.value.run;
};

const ack = (deps: Deps, runId: string, stepId: string, actor = human(), evidence = machineEvidence(), reason?: string) =>
  recordStep(deps, { runId, stepId, outcome: "done", actor, evidence, ...(reason ? { reason } : {}) });

/** Amène l'exécution jusqu'à l'étape 3, acquittée par un humain. */
const walkToStep3 = async (deps: Deps, runId: string): Promise<void> => {
  await ack(deps, runId, "stp_1");
  await ack(deps, runId, "stp_2");
};

describe("verrou humain (GA-08, recette 8)", () => {
  it("un agent refusé sur une étape humaine, et la tentative devient une déviation", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const run = await start(deps);
    await walkToStep3(deps, run.id);

    const res = await ack(deps, run.id, "stp_3", agent(), attestation());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.accepted).toBe(false);
    expect(res.value.refusal?.code).toBe("lock_human_only");
    expect(res.value.refusal?.lockRefusal).toBe(true);
    expect(res.value.deviation?.origin).toBe("lock_refusal");
    expect(res.value.deviation?.actorKind).toBe("agent");

    // Rien n'est silencieux : la déviation est dans la table ET dans l'exécution.
    expect(await deps.store.deviations.count()).toBe(1);
    const stored = await deps.store.runs.get(run.id);
    expect(stored?.deviations).toHaveLength(1);
    const attempts = stored?.steps.find((s) => s.stepId === "stp_3")?.attempts;
    expect(attempts).toBe(1);

    // L'étape reste courante : un humain peut prendre la suite.
    const current = await getCurrentStep(deps, run.id);
    expect(current.ok).toBe(true);
    if (current.ok) expect(current.value.step.id).toBe("stp_3");

    // Et un humain, lui, passe.
    const byHuman = await ack(deps, run.id, "stp_3", human(), attestation());
    expect(byHuman.ok).toBe(true);
    if (byHuman.ok) expect(byHuman.value.accepted).toBe(true);
  });
});

describe("verrou de permis (GA-12, recette 9)", () => {
  it("sans permis valide : refus explicite et demande de permis à créer", async () => {
    const deps = makeDeps({ permits: deniedPermits() });
    await seedApprovedGamme(deps);
    const run = await start(deps, agent());
    await ack(deps, run.id, "stp_1", agent());

    const res = await ack(deps, run.id, "stp_2", agent());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.accepted).toBe(false);
    expect(res.value.refusal?.code).toBe("lock_permit_missing");
    expect(res.value.refusal?.details).toMatchObject({ permitClass: "production-write" });
    expect(res.value.refusal?.details).toHaveProperty("requestUrl", `${PERMIT_URL}/production-write`);
    expect(await deps.store.permits.count()).toBe(1);
    expect((await deps.store.permits.list())[0]?.result).toBe("denied");
  });

  it("avec un permis valide : l'agent passe, la vérification est tracée", async () => {
    const deps = makeDeps({ permits: grantedPermits() });
    await seedApprovedGamme(deps);
    const run = await start(deps, agent());
    await ack(deps, run.id, "stp_1", agent());
    const res = await ack(deps, run.id, "stp_2", agent());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.accepted).toBe(true);
    expect(res.value.next?.step.id).toBe("stp_3");
    expect((await deps.store.permits.list())[0]?.result).toBe("granted");
  });

  it("registre de permis absent : refus prudent, jamais d'accord par défaut", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const run = await start(deps, agent());
    await ack(deps, run.id, "stp_1", agent());
    const res = await ack(deps, run.id, "stp_2", agent());
    if (!res.ok) throw new Error("appel en échec");
    expect(res.value.accepted).toBe(false);
    expect(res.value.refusal?.code).toBe("lock_permit_missing");
    expect((await deps.store.permits.list())[0]?.result).toBe("unknown_service");
  });

  it("un humain n'a pas à présenter de permis", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const run = await start(deps);
    await ack(deps, run.id, "stp_1");
    const res = await ack(deps, run.id, "stp_2");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.accepted).toBe(true);
    expect(await deps.store.permits.count()).toBe(0);
  });
});

describe("preuve exigée (recette 10)", () => {
  it("sans preuve, l'étape n'avance pas ; une preuve trop faible non plus", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const run = await start(deps);

    const noEvidence = await recordStep(deps, { runId: run.id, stepId: "stp_1", outcome: "done", actor: human() });
    expect(noEvidence.ok).toBe(true);
    if (!noEvidence.ok) return;
    expect(noEvidence.value.accepted).toBe(false);
    expect(noEvidence.value.refusal?.code).toBe("evidence_required");
    expect(noEvidence.value.deviation?.origin).toBe("missing_evidence");

    const tooWeak = await recordStep(deps, {
      runId: run.id,
      stepId: "stp_1",
      outcome: "done",
      actor: human(),
      evidence: { kind: "attestation", strength: "declared", ref: "parole donnée", capturedAt: T0 },
    });
    if (!tooWeak.ok) throw new Error("appel en échec");
    expect(tooWeak.value.accepted).toBe(false);
    expect(tooWeak.value.refusal?.code).toBe("evidence_required");

    // Deux tentatives refusées, l'étape est toujours courante.
    const current = await getCurrentStep(deps, run.id);
    if (!current.ok) throw new Error("étape courante illisible");
    expect(current.value.step.id).toBe("stp_1");
    expect(current.value.run.steps.find((s) => s.stepId === "stp_1")?.attempts).toBe(2);

    const withProof = await ack(deps, run.id, "stp_1");
    if (!withProof.ok) throw new Error("acquittement refusé");
    expect(withProof.value.accepted).toBe(true);
    expect(withProof.value.next?.step.id).toBe("stp_2");
  });

  it("acquitter une étape qui n'est pas courante est refusé", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const run = await start(deps);
    const res = await ack(deps, run.id, "stp_3");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.accepted).toBe(false);
    expect(res.value.refusal?.code).toBe("step_not_current");
  });
});

describe("échec, saut et déviation (§ 8, recette 11)", () => {
  it("un échec sur une étape en conduite « stop » n'avance pas", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const run = await start(deps);
    const res = await recordStep(deps, {
      runId: run.id,
      stepId: "stp_1",
      outcome: "failed",
      actor: human(),
      reason: "pipeline rouge sur le job de build",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.accepted).toBe(true);
    expect(res.value.next).toBeUndefined();
    expect(res.value.deviation?.why).toContain("pipeline rouge");
    const stored = await deps.store.runs.get(run.id);
    expect(stored?.steps.find((s) => s.stepId === "stp_1")?.state).toBe("failed");
  });

  it("sauter une étape exige une raison écrite", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const run = await start(deps);
    const noReason = await recordStep(deps, { runId: run.id, stepId: "stp_1", outcome: "skipped", actor: human() });
    expect(noReason.ok).toBe(false);
    if (!noReason.ok) expect(noReason.error.code).toBe("input_missing");

    const withReason = await recordStep(deps, {
      runId: run.id,
      stepId: "stp_1",
      outcome: "skipped",
      actor: human(),
      reason: "vérification déjà faite par le CI du merge",
    });
    expect(withReason.ok).toBe(true);
    if (!withReason.ok) return;
    expect(withReason.value.next?.step.id).toBe("stp_2");
    expect(withReason.value.next?.progress).toEqual({ done: 1, total: 3 });
  });

  it("recette 11 : une déviation déclarée est visible dans la trace", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const run = await start(deps);
    const res = await reportDeviation(deps, {
      runId: run.id,
      stepId: "stp_1",
      whatHappened: "vérification faite depuis le poste de l'astreinte, pas depuis le CI",
      why: "le runner CI était indisponible",
      actor: human(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.origin).toBe("declared");
    expect(await deps.store.deviations.count()).toBe(1);

    const trace = await buildTrace(deps, await deps.store.runs.get(run.id)!);
    expect(trace.deviations).toHaveLength(1);
    expect(trace.deviations[0]?.why).toContain("runner CI");
    const rendered = renderTraceMarkdown(trace, "fr", await deps.store.runs.get(run.id));
    expect(rendered).toContain("Déviations");
    expect(rendered).toContain("runner CI");
  });
});

describe("trace (GA-09, recette 13)", () => {
  it("une exécution complète produit une trace citable : version, acteur, étapes, preuves, issue", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const run = await start(deps);
    await ack(deps, run.id, "stp_1", human(), machineEvidence("https://ci.example.internal/build/42"));
    await ack(deps, run.id, "stp_2", human(), machineEvidence("https://cd.example.internal/rollout/9"));
    await ack(deps, run.id, "stp_3", human(), attestation());
    const closed = await finishRun(deps, { runId: run.id, outcome: "succeeded", notes: "RAS" });
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;

    const trace = closed.value;
    expect(trace.citation).toBe(citeRun({ ...run, pinnedVersion: 1 }));
    expect(trace.citation).toContain("GAM-deploy-01@v1");
    expect(trace.version).toBe(1);
    expect(trace.actorKind).toBe("human");
    expect(trace.outcome).toBe("succeeded");
    expect(trace.steps).toHaveLength(3);
    expect(trace.steps.every((s) => s.state === "done")).toBe(true);
    expect(trace.steps.map((s) => s.ord)).toEqual([1, 2, 3]);
    expect(trace.steps[0]?.evidence?.ref).toContain("build/42");
    expect(trace.steps[2]?.evidence?.strength).toBe("attested");
    expect(trace.durationS).toBeGreaterThanOrEqual(0);

    const rendered = renderTraceMarkdown(trace, "fr");
    expect(rendered).toContain("GAM-deploy-01@v1");
    expect(rendered).toContain("Vérifier que le pipeline est vert");
    expect(rendered).toContain("Aucune mesure par personne");
    expect(renderTraceMarkdown(trace, "en")).toContain("No per-person metric");
  });

  it("une trace ne contient jamais de secret, seulement des références", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const run = await start(deps);
    await recordStep(deps, {
      runId: run.id,
      stepId: "stp_1",
      outcome: "done",
      actor: human(),
      evidence: { kind: "command_output", strength: "machine", ref: "artifact://ci/42/logs", capturedAt: T0 },
    });
    const trace = await buildTrace(deps, (await deps.store.runs.get(run.id))!);
    const serialized = JSON.stringify(trace);
    expect(serialized).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(serialized).toContain("artifact://ci/42/logs");
  });
});
