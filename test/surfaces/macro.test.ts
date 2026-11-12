/**
 * GA-17 — la macro Confluence : état, version, exécutions, fraîcheur. Les trois
 * situations du § 10 sont rendues explicitement, l'âge vient du port `Clock`.
 */
import { describe, expect, it } from "vitest";
import { makeClock, makeDeps, makePage, T0 } from "../helpers";
import { upsertBinding } from "../../src/core/binding/binding";
import { seedApprovedGamme, validInputs } from "../moteur-execution/fixtures";
import { finishRun, startRun } from "../../src/core/run/runs";
import { human } from "../helpers";
import { macroState } from "../../src/ui/macro/macro-model";
import { createActions } from "../../src/resolver/actions";

const ARI = "ari:cloud:confluence:site:page/1";

describe("macro Confluence (GA-17)", () => {
  it("une page sans gamme liée ne produit aucun état inventé", async () => {
    const deps = makeDeps();
    const etat = await macroState(deps, { ari: ARI });
    expect(etat.bound).toBe(false);
    expect(etat.sync).toBe("unbound");
    expect(etat.code).toBeUndefined();
    expect(etat.version).toBeUndefined();
    expect(etat.message).toContain("brouillon");
  });

  it("une page liée et synchronisée rend la version et le nombre d'exécutions", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    await upsertBinding(deps, "gam_1", makePage({ ari: ARI }));
    await startRun(deps, { code: "GAM-deploy-01", inputs: validInputs(), actor: human() });
    const etat = await macroState(deps, { ari: ARI });
    expect(etat.bound).toBe(true);
    expect(etat.sync).toBe("synced");
    expect(etat.code).toBe("GAM-deploy-01");
    expect(etat.version).toBe(1);
    expect(etat.runs).toBe(1);
    expect(etat.message).toContain("synchronisée");
  });

  it("une page désynchronisée rend l'âge de l'écart, calculé par le port Clock", async () => {
    const clock = makeClock();
    const deps = makeDeps({ clock });
    await seedApprovedGamme(deps);
    await upsertBinding(deps, "gam_1", makePage({ ari: ARI }), { sync: "stale", staleSince: T0 });
    clock.advanceDays(12);
    const etat = await macroState(deps, { ari: ARI });
    expect(etat.sync).toBe("stale");
    expect(etat.ageDays).toBe(12);
    expect(etat.message).toContain("12 jour(s)");
    expect(etat.message).toContain("diff");
  });

  it("une source disparue reste exécutable et le dit", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    await upsertBinding(deps, "gam_1", makePage({ ari: ARI }), { sync: "source_gone" });
    const etat = await macroState(deps, { ari: ARI });
    expect(etat.sync).toBe("source_gone");
    expect(etat.message).toContain("disparu");
  });

  it("la fraîcheur de l'atelier est rendue, jamais une moyenne au jugé", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    await upsertBinding(deps, "gam_1", makePage({ ari: ARI }));
    const etat = await macroState(deps, { ari: ARI });
    expect(etat.workshop.total).toBe(1);
    expect(typeof etat.workshop.syncedPct).toBe("number");
  });

  it("une révision dépassée est signalée avec son retard", async () => {
    const clock = makeClock();
    const deps = makeDeps({ clock });
    await seedApprovedGamme(deps, { reviewDueAt: T0 });
    await upsertBinding(deps, "gam_1", makePage({ ari: ARI }));
    clock.advanceDays(30);
    const etat = await macroState(deps, { ari: ARI });
    expect(etat.reviewOverdueDays).toBe(30);
  });

  it("aucune identité d'acteur ne sort de la macro (GA-21)", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    await upsertBinding(deps, "gam_1", makePage({ ari: ARI }));
    const started = await startRun(deps, { code: "GAM-deploy-01", inputs: validInputs(), actor: human() });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    await finishRun(deps, { runId: started.value.run.id, outcome: "succeeded" });
    const etat = await macroState(deps, { ari: ARI });
    expect(JSON.stringify(etat)).not.toContain("ari:cloud:aaid:demo:ana");
    expect(JSON.stringify(etat)).not.toContain("byActor");
  });

  it("l'action du resolver rend le même état que le modèle", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    await upsertBinding(deps, "gam_1", makePage({ ari: ARI }));
    const res = await createActions(deps).macroState({ ari: ARI });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect((res.value as { code?: string }).code).toBe("GAM-deploy-01");
  });

  it("une gamme présente mais sans binding ne rend pas d'état fantôme", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const etat = await macroState(deps, { ari: ARI });
    expect(etat.bound).toBe(false);
    expect(etat.code).toBeUndefined();
  });
});
