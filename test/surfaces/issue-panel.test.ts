/**
 * GA-16 — l'encart Jira : quelle gamme s'applique, ce qu'elle exige, ce qui a
 * déjà été exécuté. Testé au niveau du modèle (pur) et des actions du resolver.
 */
import { describe, expect, it } from "vitest";
import { makeDeps } from "../helpers";
import { seedApprovedGamme, validInputs } from "../moteur-execution/fixtures";
import { finishRun, startRun } from "../../src/core/run/runs";
import { human } from "../helpers";
import { panelState, panelTraces } from "../../src/ui/issue-panel/panel-model";
import { createActions } from "../../src/resolver/actions";

const ISSUE = "PAY-123";

describe("état de l'encart (GA-16)", () => {
  it("sans gamme applicable, l'encart ne propose rien", async () => {
    const deps = makeDeps();
    const etat = await panelState(deps, { issueKey: ISSUE, summary: "facture impayée" });
    expect(etat.candidates).toHaveLength(0);
    expect(etat.applies).toBe(false);
    expect(etat.traces).toHaveLength(0);
  });

  it("la gamme applicable est proposée avec ses verrous et son état", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const etat = await panelState(deps, { issueKey: ISSUE, summary: "déployer paiements" });
    expect(etat.applies).toBe(true);
    expect(etat.candidates[0]?.code).toBe("GAM-deploy-01");
    expect(etat.candidates[0]?.invocable).toBe(true);
    expect(etat.candidates[0]?.requiresHuman).toBe(true);
    expect(etat.candidates[0]?.requiresPermit).toBe(true);
  });

  it("une gamme non approuvée n'est pas applicable", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps, { state: "draft" });
    const etat = await panelState(deps, { issueKey: ISSUE, summary: "déployer paiements" });
    expect(etat.candidates[0]?.invocable).toBe(false);
    expect(etat.applies).toBe(false);
  });

  it("les entrées manquantes sont listées, et se complètent", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const vide = await panelState(deps, { issueKey: ISSUE, summary: "déployer paiements" });
    expect(vide.missingInputs).toContain("service");
    const fourni = await panelState(deps, {
      issueKey: ISSUE,
      summary: "déployer paiements",
      provided: ["service", "version_cible"],
    });
    expect(fourni.missingInputs).toEqual([]);
  });
});

describe("traces de l'encart (GA-16)", () => {
  it("aucune trace avant exécution, puis la trace liée au ticket", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    expect(await panelTraces(deps, ISSUE)).toHaveLength(0);
    const started = await startRun(deps, {
      code: "GAM-deploy-01", inputs: validInputs(), actor: human(), ticketRef: ISSUE,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const traces = await panelTraces(deps, ISSUE);
    expect(traces).toHaveLength(1);
    expect(traces[0]?.closed).toBe(false);
    await finishRun(deps, { runId: started.value.run.id, outcome: "succeeded" });
    const closes = await panelTraces(deps, ISSUE);
    expect(closes[0]?.closed).toBe(true);
    expect(closes[0]?.outcome).toBe("succeeded");
  });

  it("aucune identité d'acteur dans les traces (GA-21)", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    await startRun(deps, {
      code: "GAM-deploy-01", inputs: validInputs(), actor: human(), ticketRef: ISSUE,
    });
    const traces = await panelTraces(deps, ISSUE);
    expect(JSON.stringify(traces)).not.toContain("ari:cloud:aaid:demo:ana");
  });
});

describe("actions du resolver pour l'encart (GA-16)", () => {
  it("issuePanel garde son contrat historique : la liste des gammes correspondantes", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const actions = createActions(deps);
    const res = await actions.issuePanel({ summary: "déployer paiements" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const matches = res.value as { code: string }[];
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.code).toBe("GAM-deploy-01");
  });

  it("issuePanelState rend l'état, issuePanelStart démarre une exécution liée au ticket", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const actions = createActions(deps);
    const etat = await actions.issuePanelState({ issueKey: ISSUE, summary: "déployer paiements" });
    expect(etat.ok).toBe(true);
    if (!etat.ok) return;
    const contenu = etat.value as { applies: boolean; candidates: { code: string }[] };
    expect(contenu.applies).toBe(true);
    expect(contenu.candidates[0]?.code).toBe("GAM-deploy-01");

    const depart = await actions.issuePanelStart({
      code: "GAM-deploy-01", issueKey: ISSUE, inputs: validInputs(), actorKind: "human",
    });
    expect(depart.ok).toBe(true);
    const runs = await deps.store.runs.list();
    expect(runs[0]?.ticketRef).toBe(ISSUE);
  });

  it("un démarrage refusé est refusé, pas contourné", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps, { state: "draft" });
    const actions = createActions(deps);
    const depart = await actions.issuePanelStart({
      code: "GAM-deploy-01", issueKey: ISSUE, inputs: validInputs(), actorKind: "human",
    });
    expect(depart.ok).toBe(false);
    if (depart.ok) return;
    expect(depart.error.code).toBe("gamme_not_approved");
  });
});
