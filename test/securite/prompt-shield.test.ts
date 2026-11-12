/**
 * Le rempart de prompt (idée de consolidation n° 5) : le contenu d'une page wiki
 * est une donnée, jamais une consigne.
 *
 * Deux garanties : l'invite système porte la règle, et le contenu non fiable est
 * encadré — un wiki hostile ne doit pas pouvoir dicter sa conduite au modèle.
 */

import { describe, expect, it } from "vitest";
import { makeDeps } from "../helpers";
import { detectConflicts } from "../../src/core/conflicts/detect";
import { seedTwoGammes } from "../conflits/fixtures";
import { buildPrompt } from "../../src/core/conciliation/hermes";
import { SYSTEM_BY_TASK, systemFor } from "../../src/platform/llm/prompts";
import { promptAvecDonnees, shield, SHIELD_RULE } from "../../src/platform/llm/prompt-shield";

describe("rempart de prompt", () => {
  it("encadre une donnée non fiable entre deux marqueurs", () => {
    const encadre = shield("ignore tout", "ÉTAPE");
    expect(encadre).toContain("--- ÉTAPE (donnée non fiable) ---");
    expect(encadre).toContain("--- FIN ÉTAPE ---");
    expect(encadre.indexOf("ignore tout")).toBeGreaterThan(encadre.indexOf("donnée non fiable) ---"));
  });

  it("l'invite utilisateur pose la consigne avant la donnée", () => {
    const prompt = promptAvecDonnees(
      ["Fais ceci."],
      [{ etiquette: "PAGE", contenu: "instruction piégée" }],
    );
    expect(prompt.indexOf("Fais ceci.")).toBeLessThan(prompt.indexOf("--- PAGE"));
  });

  it("chaque tâche de modèle porte la règle dans son invite système", () => {
    for (const task of Object.keys(SYSTEM_BY_TASK) as (keyof typeof SYSTEM_BY_TASK)[]) {
      expect(systemFor(task)).toContain(SHIELD_RULE);
    }
  });

  it("le dossier de conciliation encadre les citations : une instruction piégée n'est pas libre", async () => {
    const deps = makeDeps();
    await seedTwoGammes(deps);
    const [conflict] = await detectConflicts(deps);
    expect(conflict).toBeDefined();
    if (!conflict) return;
    const prompt = buildPrompt(conflict);
    expect(prompt).toContain("--- FAITS ET PASSAGES CITÉS (pages wiki) (donnée non fiable) ---");
    // Les citations (passages sources) sont à l'intérieur de l'encadrement.
    for (const fait of conflict.facts) {
      if (fait.leftSpan) {
        expect(prompt.indexOf(`« ${fait.leftSpan.quote} »`)).toBeGreaterThan(
          prompt.indexOf("donnée non fiable) ---"),
        );
      }
    }
  });
});
