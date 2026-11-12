/**
 * La preuve de la démo : chaque étape a un élément qui la prouve, et l'étape joue
 * vraiment.
 *
 * Ce test rejoue le scénario complet du site public sur un atelier neuf, dans l'ordre
 * de la démo, et vérifie deux choses :
 * - chaque étape rend une preuve **non vide** (donc l'écran a de quoi montrer) ;
 * - chaque écran du scénario a un élément mis en avant par défaut (donc le visiteur sait
 *   où regarder).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState } from "../../web/state";
import { HIGHLIGHT_BY_SCREEN } from "../../web/tour";
import { TOUR_STEPS, TOUR_TESTS } from "../../web/tour-steps";

describe("démo guidée : une preuve par étape", () => {
  it("chaque étape du scénario a un élément qui sert de preuve", () => {
    const sansPreuve = TOUR_STEPS.filter((step) => !HIGHLIGHT_BY_SCREEN[step.screen] && !step.highlight);
    expect(sansPreuve.map((s) => s.id)).toEqual([]);
  });

  it("le scénario se joue de bout en bout, chaque étape rend sa preuve", async () => {
    const state = await createState();
    const preuves: { id: string; proof: string }[] = [];
    for (const step of TOUR_STEPS) {
      const proof = await step.run(state);
      expect(typeof proof, step.id).toBe("string");
      expect(proof.trim().length, step.id).toBeGreaterThan(10);
      preuves.push({ id: step.id, proof });
    }
    expect(preuves).toHaveLength(TOUR_STEPS.length);
    // Les refus du produit sont des preuves, pas des échecs : ils doivent être là.
    const refus = preuves.filter((p) => /REFUS|lock_|refusée|pas assez de recul/i.test(p.proof));
    expect(refus.length).toBeGreaterThanOrEqual(4);
  }, 120_000);
});

describe("démo guidée : les tests cités existent", () => {
  it("chaque étape cite un fichier de test présent et un test qui existe dedans", () => {
    for (const step of TOUR_STEPS) {
      const test = TOUR_TESTS[step.id];
      expect(test, step.id).toBeDefined();
      if (!test) continue;
      const source = readFileSync(test.file, "utf8");
      expect(source.includes(test.name), `${step.id} → ${test.file} ne contient pas « ${test.name} »`).toBe(true);
    }
  });
});
