/**
 * Qualification des étapes (GA-03), verrou des étapes à risque (GA-04) et étapes
 * non falsifiables (GA-28).
 *
 * Recette 4 : une étape contenant `kubectl delete` reçoit un verrou humain et une
 * classe de risque, visibles.
 */

import { describe, expect, it } from "vitest";
import { makeDeps, makePage, makeStep, span } from "../helpers";
import { extractSteps } from "../../src/core/extract/extract-steps";
import { qualificationSummary, qualifySteps } from "../../src/core/qualify/qualify-steps";
import { assessFalsifiability, proposeRewording } from "../../src/core/falsifiable/falsifiability";
import { scriptedLlm } from "../../src/platform/llm/fake-llm";
import type { DraftStep } from "../../src/core/extract/extract-steps";

const PAGE_AVEC_RISQUE = [
  "<h1>Procédure : nettoyer l'environnement de staging</h1>",
  "<h2>Étapes</h2>",
  "<ol>",
  "<li>Vérifier que personne ne développe sur staging.</li>",
  "<li>Supprimer l'espace de noms avec la commande :",
  '<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[kubectl delete ns staging]]></ac:plain-text-body></ac:structured-macro>',
  "</li>",
  "<li>Prévenir l'équipe que staging est de nouveau disponible.</li>",
  "</ol>",
].join("\n");

const draft = (over: Partial<DraftStep> = {}): DraftStep => ({
  ord: 1,
  kind: "manual",
  text: "Vérifier que le service répond",
  source: span({ quote: "Vérifier que le service répond" }),
  inferredBy: "rule",
  ...over,
});

describe("qualification des étapes (GA-03, GA-04)", () => {
  it("recette 4 : kubectl delete reçoit un verrou humain, une classe de risque et un verrou de permis", async () => {
    const deps = makeDeps();
    const page = makePage({ title: "Procédure : nettoyer staging", storageBody: PAGE_AVEC_RISQUE });
    const { drafts } = await extractSteps(deps, page);
    const steps = await qualifySteps(deps, drafts, page);
    const risky = steps.find((s) => s.command?.includes("kubectl delete"));
    expect(risky).toBeDefined();
    expect(risky?.risk).toBe("high");
    expect(risky?.riskClass).toBe("kubernetes-delete");
    expect(risky?.humanOnly).toBe(true);
    expect(risky?.onFailure).toBe("stop");
    const kinds = risky?.locks.map((l) => l.kind);
    expect(kinds).toContain("human");
    expect(kinds).toContain("permit");
    const permit = risky?.locks.find((l) => l.kind === "permit");
    expect(permit?.permitClass).toBe("kubernetes-delete");
    expect(permit?.reason).toContain("permis valide");
  });

  it("chaque étape reçoit sa preuve attendue et sa force", async () => {
    const deps = makeDeps();
    const page = makePage({ storageBody: PAGE_AVEC_RISQUE, title: "Procédure : nettoyer staging" });
    const { drafts } = await extractSteps(deps, page);
    const steps = await qualifySteps(deps, drafts, page);
    const check = steps.find((s) => s.kind === "check");
    expect(check?.evidence).toMatchObject({ kind: "command_output", strength: "machine", required: true });
    const command = steps.find((s) => s.kind === "command");
    expect(command?.evidence.strength).toBe("machine");
    const notify = steps.find((s) => s.kind === "notification");
    expect(notify?.evidence.required).toBe(false);
    expect(notify?.onFailure).toBe("skip_with_reason");
  });

  it("idempotence et délai sont posés par règles, sans modèle", async () => {
    const deps = makeDeps(); // forbiddenLlm
    const page = makePage({ storageBody: PAGE_AVEC_RISQUE, title: "Procédure : nettoyer staging" });
    const { drafts } = await extractSteps(deps, page);
    const steps = await qualifySteps(deps, drafts, page, { useModel: false });
    expect(steps.every((s) => s.id.length > 0 && s.timeoutS! > 0)).toBe(true);
    expect(steps.find((s) => s.command?.includes("kubectl delete"))?.idempotent).toBe(false);
    expect(steps.find((s) => s.kind === "check")?.idempotent).toBe(true);
    expect(steps.map((s) => s.ord)).toEqual(drafts.map((d) => d.ord));
    expect(qualificationSummary(steps)).toContain("étape(s) qualifiée(s)");
  });

  it("une étape manuelle longue et sans signal est confiée au modèle, et le résultat reste borné", async () => {
    const llm = scriptedLlm({ qualify_step: JSON.stringify({ kind: "check", humanOnly: true }) });
    const deps = makeDeps({ llm });
    const longue =
      "S'occuper du dossier de manière complète en regardant l'ensemble des éléments disponibles et en prenant les mesures qui s'imposent pour que la situation revienne à la normale.";
    const steps = await qualifySteps(deps, [draft({ text: longue })], makePage());
    expect(llm.calls.map((c) => c.task)).toEqual(["qualify_step", "reword_falsifiable"]);
    expect(steps[0]?.kind).toBe("check");
    expect(steps[0]?.humanOnly).toBe(true);
    // En mode strictement déterministe, aucun appel modèle n'est fait.
    const strict = makeDeps();
    const noModel = await qualifySteps(strict, [draft({ text: longue })], makePage(), { useModel: false });
    expect(noModel[0]?.kind).toBe("manual");
  });

  it("modèle muet ou invalide : la qualification par règles tient debout", async () => {
    const deps = makeDeps({ llm: scriptedLlm({ qualify_step: "je ne sais pas", reword_falsifiable: "{}" }, "nada") });
    const steps = await qualifySteps(
      deps,
      [draft({ text: "Regarder le tableau de bord et voir si la situation semble correcte pour tout le monde." })],
      makePage(),
    );
    expect(steps).toHaveLength(1);
    expect(steps[0]?.evidence.required).toBe(true);
  });
});

describe("étapes non falsifiables (GA-28)", () => {
  it("« s'assurer que tout va bien » est signalé, avec sa raison", () => {
    const vague = assessFalsifiability("S'assurer que tout va bien");
    expect(vague.falsifiable).toBe(false);
    expect(vague.note).toContain("invérifiable");
    expect(assessFalsifiability("Vérifier que tout fonctionne").falsifiable).toBe(false);
    expect(assessFalsifiability("Tout est ok").falsifiable).toBe(false);
  });

  it("un contrôle mesurable est falsifiable", () => {
    expect(assessFalsifiability("Vérifier que le taux d'erreur reste sous 1 % pendant 5 minutes").falsifiable).toBe(true);
    expect(assessFalsifiability("Attendre le code HTTP 200 sur https://paiements/healthz").falsifiable).toBe(true);
    expect(assessFalsifiability("Lancer kubectl rollout status deploy/paiements").falsifiable).toBe(true);
  });

  it("une reformulation est proposée par le modèle, jamais imposée", async () => {
    const llm = scriptedLlm({
      reword_falsifiable: JSON.stringify({
        rewording: "Vérifier que /healthz répond 200 et que le taux d'erreur reste sous 1 % pendant 5 minutes",
        observable: "code HTTP et métrique d'erreur",
      }),
    });
    const deps = makeDeps({ llm });
    const step = makeStep({ text: "S'assurer que tout va bien", falsifiable: false });
    const rewording = await proposeRewording(deps, step);
    expect(rewording).toContain("healthz");
    expect(llm.calls[0]?.task).toBe("reword_falsifiable");
    // Une étape déjà falsifiable ne demande rien au modèle.
    expect(await proposeRewording(deps, makeStep({ text: "Vérifier le code HTTP 200 sur /healthz" }))).toBeUndefined();
  });

  it("modèle indisponible : aucun rewording inventé", async () => {
    const deps = makeDeps({ llm: scriptedLlm({ reword_falsifiable: "{ cassé" }, "{ cassé") });
    const rewording = await proposeRewording(deps, makeStep({ text: "S'assurer que tout va bien" }));
    expect(rewording).toBeUndefined();
  });
});
