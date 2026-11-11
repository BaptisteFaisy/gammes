/**
 * Démarrage, reprise et clôture d'une exécution (§ 8, GA-07, GA-29).
 *
 * Recette 7 : `start-run` épingle la version ; modifier la page ensuite ne change pas
 * l'exécution en cours.
 */

import { describe, expect, it } from "vitest";
import { agent, human, makeClock, makeDeps, makeVersion, T0 } from "../helpers";
import { finishRun, getCurrentStep, resumeRun, startRun, validateInputs } from "../../src/core/run/runs";
import { freeReservations, seedApprovedGamme, validInputs } from "./fixtures";
import { shiftDays } from "../../src/platform/clock";

describe("démarrer une exécution (GA-07)", () => {
  it("le démarrage rend la première étape, ses verrous et sa preuve exigée", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const res = await startRun(deps, { code: "GAM-deploy-01", inputs: validInputs(), actor: human() });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.step.id).toBe("stp_1");
    expect(res.value.evidence.required).toBe(true);
    expect(res.value.run.pinnedVersion).toBe(1);
    expect(res.value.run.actor.kind).toBe("human");
    expect(res.value.run.mode).toBe("normal");
    expect(res.value.run.steps.filter((s) => s.state === "pending")).toHaveLength(2);
    expect((await deps.store.events()).some((e) => e.kind === "run.started")).toBe(true);
  });

  it("une gamme non approuvée, dépréciée ou sans propriétaire n'est pas invocable", async () => {
    for (const state of ["draft", "in_review", "deprecated"] as const) {
      const deps = makeDeps();
      await seedApprovedGamme(deps, { state });
      const res = await startRun(deps, { code: "GAM-deploy-01", inputs: validInputs(), actor: agent() });
      expect(res.ok, state).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("gamme_not_approved");
    }
    const deps = makeDeps();
    await seedApprovedGamme(deps, { ownerRef: undefined });
    const orphan = await startRun(deps, { code: "GAM-deploy-01", inputs: validInputs(), actor: agent() });
    expect(orphan.ok).toBe(false);
  });

  it("les entrées typées sont obligatoires et contrôlées", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const missing = await startRun(deps, { code: "GAM-deploy-01", inputs: { service: "paiements" }, actor: human() });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("input_missing");

    const invalid = await startRun(deps, {
      code: "GAM-deploy-01",
      inputs: { ...validInputs(), fenetre: "soir" },
      actor: human(),
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.code).toBe("input_invalid");

    expect(validateInputs([{ name: "port", type: "number", required: true }], { port: "8080" })).toBeUndefined();
    expect(validateInputs([{ name: "port", type: "number", required: true }], { port: "abc" })?.ok).toBe(false);
  });

  it("gamme exclusive : la seconde exécution est refusée, avec renvoi vers la réservation", async () => {
    const deps = makeDeps({ reservations: freeReservations() });
    await seedApprovedGamme(deps, { exclusive: true });
    const first = await startRun(deps, { code: "GAM-deploy-01", inputs: validInputs(), actor: human() });
    expect(first.ok).toBe(true);
    const second = await startRun(deps, { code: "GAM-deploy-01", inputs: validInputs(), actor: agent() });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("exclusive_busy");
      expect(second.error.details).toMatchObject({ code: "GAM-deploy-01" });
    }
    expect(await deps.store.runs.count()).toBe(1);
  });

  it("recette 7 : la version est épinglée, un amendement ultérieur ne change pas l'exécution", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const started = await startRun(deps, { code: "GAM-deploy-01", inputs: validInputs(), actor: human() });
    if (!started.ok) throw new Error("démarrage refusé");

    // La page change, la gamme est amendée : une v2 approuvée apparaît.
    await deps.store.versions.insert(
      makeVersion({ id: "ver_2", gammeId: "gam_1", version: 2, steps: [], approvedAt: T0 }),
    );
    await deps.store.gammes.update("gam_1", (g) => ({ ...g, currentVersion: 2 }));

    const current = await getCurrentStep(deps, started.value.run.id);
    expect(current.ok).toBe(true);
    if (!current.ok) return;
    expect(current.value.run.pinnedVersion).toBe(1);
    expect(current.value.run.versionId).toBe("ver_1");
    expect(current.value.step.id).toBe("stp_1");
    expect(current.value.progress).toEqual({ done: 0, total: 3 });
  });

  it("mode dégradé d'urgence : raison écrite obligatoire et revue différée à 7 jours", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const withoutReason = await startRun(deps, {
      code: "GAM-deploy-01",
      inputs: validInputs(),
      actor: human(),
      mode: "emergency",
    });
    expect(withoutReason.ok).toBe(false);
    if (!withoutReason.ok) expect(withoutReason.error.code).toBe("input_missing");

    const res = await startRun(deps, {
      code: "GAM-deploy-01",
      inputs: validInputs(),
      actor: human(),
      mode: "emergency",
      emergencyReason: "incident INC-4412 : paiements indisponible",
      ticketRef: "PAY-412",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.run.mode).toBe("emergency");
    expect(res.value.run.emergencyReviewDueAt).toBe(shiftDays(T0, 7));
    expect(res.value.run.links).toEqual([{ targetType: "issue", targetRef: "PAY-412" }]);
  });
});

describe("reprendre et clore (§ 8)", () => {
  it("la reprise incrémente le compteur et rend l'étape courante", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const started = await startRun(deps, { code: "GAM-deploy-01", inputs: validInputs(), actor: human() });
    if (!started.ok) throw new Error("démarrage refusé");
    const resumed = await resumeRun(deps, started.value.run.id, human());
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.value.run.resumedCount).toBe(1);
    expect(resumed.value.run.pinnedVersion).toBe(1);
    expect(resumed.value.step.id).toBe("stp_1");
  });

  it("la clôture rend une trace citable ; une seconde clôture est refusée", async () => {
    const clock = makeClock(T0);
    const deps = makeDeps({ clock });
    await seedApprovedGamme(deps);
    const started = await startRun(deps, { code: "GAM-deploy-01", inputs: validInputs(), actor: human() });
    if (!started.ok) throw new Error("démarrage refusé");
    clock.advanceDays(0);
    const closed = await finishRun(deps, { runId: started.value.run.id, outcome: "aborted", notes: "interrompu" });
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.value.citation).toBe(`GAM-deploy-01@v1 · ${started.value.run.id}`);
    expect(closed.value.outcome).toBe("aborted");
    expect(closed.value.actorKind).toBe("human");

    const again = await finishRun(deps, { runId: started.value.run.id, outcome: "succeeded" });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe("run_already_finished");

    const after = await getCurrentStep(deps, started.value.run.id);
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.error.code).toBe("run_already_finished");
  });

  it("exécution inconnue : refus explicite, pas d'exception", async () => {
    const deps = makeDeps();
    expect((await getCurrentStep(deps, "run_absent")).ok).toBe(false);
    expect((await resumeRun(deps, "run_absent", human())).ok).toBe(false);
    const res = await finishRun(deps, { runId: "run_absent", outcome: "failed" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("unknown_run");
  });
});
