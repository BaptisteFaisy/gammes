/**
 * Statistiques d'atelier et amendements (§ 11, GA-19, GA-20, GA-21, GA-24).
 *
 * Recette 14 : une étape en échec six fois sur dix sur 40 exécutions déclenche une
 *              proposition d'amendement avec ses preuves.
 * Recette 15 : un taux calculé sur trois exécutions affiche « pas assez de recul ».
 * Recette 16 : la comparaison v6/v7 affiche les deux taux avec leurs effectifs.
 */

import { describe, expect, it } from "vitest";
import { agent, human, makeDeps, makeVersion, T0 } from "../helpers";
import type { StepStat } from "../../src/core/types";
import { DEFAULT_THRESHOLD, notEnoughHistory, rate, renderRate, wilsonInterval } from "../../src/core/stats/rates";
import {
  compareVersions,
  computeStepStats,
  failingSteps,
  persistStepStats,
  renderComparison,
  skippedSteps,
} from "../../src/core/stats/step-stats";
import { decideAmendment, hasOpenAmendment, proposeAmendment, proposeFromTraces } from "../../src/core/amendments/amendments";
import { CODE, makeRun, seedGamme, seedRuns, STEP_IDS } from "./fixtures";

const statOf = (stats: readonly StepStat[], stepId: string): StepStat | undefined =>
  stats.find((s) => s.stepId === stepId);

describe("taux et effectifs (GA-19, recette 15)", () => {
  it("sous le seuil : aucun pourcentage, seulement « pas assez de recul »", () => {
    const small = rate(2, 3);
    expect(small.value).toBeUndefined();
    expect(small.low).toBeUndefined();
    expect(small.cohort).toEqual({ n: 3, threshold: DEFAULT_THRESHOLD, enoughHistory: false });
    expect(renderRate(small, "fr")).toContain("pas assez de recul");
    expect(renderRate(small, "fr")).not.toMatch(/\d+\s*%/);
    expect(renderRate(small, "en")).toContain("not enough history");
    expect(notEnoughHistory(0).cohort.n).toBe(0);
  });

  it("au-dessus du seuil : valeur, fourchette et effectif", () => {
    const published = rate(24, 40);
    expect(published.value).toBe(0.6);
    expect(published.cohort.enoughHistory).toBe(true);
    expect(published.low!).toBeLessThan(0.6);
    expect(published.high!).toBeGreaterThan(0.6);
    expect(renderRate(published, "fr")).toContain("60 %");
    expect(renderRate(published, "fr")).toContain("40 exécutions");
    expect(renderRate(published, "en")).toContain("60%");
    const interval = wilsonInterval(0, 40);
    expect(interval.low).toBe(0);
    expect(wilsonInterval(1, 0)).toEqual({ low: 0, high: 1 });
  });

  it("recette 15 bis : trois exécutions ne produisent aucun taux dans les statistiques d'étape", async () => {
    const deps = makeDeps();
    await seedGamme(deps);
    await seedRuns(deps, 3, 2, STEP_IDS[1]);
    const stats = await computeStepStats(deps, { code: CODE });
    const failing = statOf(stats, STEP_IDS[1]!);
    expect(failing?.failRate.value).toBeUndefined();
    expect(failing?.failRate.cohort.n).toBe(3);
    expect(await failingSteps(deps, { code: CODE })).toHaveLength(0);
  });
});

describe("statistiques par étape (GA-19, recette 14)", () => {
  it("six échecs sur dix sur 40 exécutions : taux publié, déviations et durée médiane", async () => {
    const deps = makeDeps();
    await seedGamme(deps);
    await seedRuns(deps, 40, 24, STEP_IDS[1]);
    const stats = await computeStepStats(deps, { code: CODE });
    expect(stats).toHaveLength(3);
    const failing = statOf(stats, STEP_IDS[1]!);
    expect(failing?.failRate.value).toBe(0.6);
    expect(failing?.n).toBe(40);
    expect(failing?.deviations).toBe(24);
    expect(failing?.medianS).toBeDefined();
    expect(statOf(stats, STEP_IDS[0]!)?.failRate.value).toBe(0);
    expect((await failingSteps(deps, { code: CODE })).map((s) => s.stepId)).toEqual([STEP_IDS[1]]);
  });

  it("les étapes systématiquement sautées sont repérées, sans suppression automatique", async () => {
    const deps = makeDeps();
    await seedGamme(deps);
    for (let i = 0; i < 40; i += 1) {
      await deps.store.runs.insert(makeRun({ id: `run_skip_${i}`, states: { [STEP_IDS[2]!]: "skipped" } }));
    }
    const skipped = await skippedSteps(deps, { code: CODE });
    expect(skipped.map((s) => s.stepId)).toEqual([STEP_IDS[2]]);
    expect(skipped[0]?.skipRate.value).toBe(1);
    // Rien n'est supprimé : la version garde ses trois étapes.
    const version = await deps.store.versions.get("ver_stats_1");
    expect(version?.steps).toHaveLength(3);
  });

  it("le calcul est persisté et journalisé", async () => {
    const deps = makeDeps();
    await seedGamme(deps);
    await seedRuns(deps, 40, 24, STEP_IDS[1]);
    const persisted = await persistStepStats(deps, { code: CODE, period: "2026-T4" });
    expect(persisted).toHaveLength(3);
    expect(await deps.store.stepStats.count()).toBe(3);
    expect((await deps.store.events()).some((e) => e.kind === "stats.computed")).toBe(true);
  });

  it("gamme inconnue : pas de statistiques inventées", async () => {
    const deps = makeDeps();
    expect(await computeStepStats(deps, { code: "GAM-absent-01" })).toHaveLength(0);
  });
});

describe("comparaison de versions (GA-24, recette 16)", () => {
  it("v1 contre v2 : les deux taux sont affichés avec leurs effectifs", async () => {
    const deps = makeDeps();
    await seedGamme(deps);
    await deps.store.versions.insert(
      makeVersion({ id: "ver_stats_2", gammeId: "gam_stats", version: 2, approvedAt: T0 }),
    );
    await seedRuns(deps, 40, 24, STEP_IDS[1], T0, "ver_stats_1", "run_v1");
    await seedRuns(deps, 40, 8, STEP_IDS[1], T0, "ver_stats_2", "run_v2");

    const comparison = await compareVersions(deps, CODE, 1, 2);
    // Taux agrégé sur toutes les étapes de la version : 24 échecs / 120 étapes atteintes.
    expect(comparison.left.failRate.value).toBe(0.2);
    expect(comparison.right.failRate.value).toBe(0.067);
    expect(comparison.left.failRate.cohort.n).toBe(120);
    expect(comparison.right.failRate.cohort.n).toBe(120);
    expect(comparison.verdict).toBe("improved");
    expect(renderComparison(comparison, "fr")).toContain("v1");
    expect(renderComparison(comparison, "fr")).toContain("améliorée");
    expect(renderComparison(comparison, "en")).toContain("improved");
  });

  it("sans effectif suffisant d'un côté : on ne conclut pas", async () => {
    const deps = makeDeps();
    await seedGamme(deps);
    await deps.store.versions.insert(makeVersion({ id: "ver_stats_2", gammeId: "gam_stats", version: 2 }));
    await seedRuns(deps, 40, 24, STEP_IDS[1], T0, "ver_stats_1", "run_v1");
    await seedRuns(deps, 3, 1, STEP_IDS[1], T0, "ver_stats_2", "run_v2");
    const comparison = await compareVersions(deps, CODE, 1, 2);
    expect(comparison.verdict).toBe("not_enough_history");
    expect(renderComparison(comparison, "fr")).toContain("pas assez de recul");
  });

  it("un amendement qui dégrade est dit, et la version précédente reste disponible", async () => {
    const deps = makeDeps();
    await seedGamme(deps);
    await deps.store.versions.insert(makeVersion({ id: "ver_stats_2", gammeId: "gam_stats", version: 2 }));
    await seedRuns(deps, 40, 8, STEP_IDS[1], T0, "ver_stats_1", "run_v1");
    await seedRuns(deps, 40, 30, STEP_IDS[1], T0, "ver_stats_2", "run_v2");
    const comparison = await compareVersions(deps, CODE, 1, 2);
    expect(comparison.verdict).toBe("degraded");
    expect(await deps.store.versions.count()).toBe(2);
  });
});

describe("amendements (GA-20)", () => {
  it("recette 14 : l'étape qui échoue six fois sur dix déclenche une proposition, preuves à l'appui", async () => {
    const deps = makeDeps();
    await seedGamme(deps);
    await seedRuns(deps, 40, 24, STEP_IDS[1]);
    const proposed = await proposeFromTraces(deps, { code: CODE });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(proposed.value).toHaveLength(1);
    const amendment = proposed.value[0]!;
    expect(amendment.state).toBe("proposed");
    expect(amendment.stepId).toBe(STEP_IDS[1]);
    expect(amendment.proposal).toContain("Réécrire l'étape 2");
    expect(amendment.rationale).toContain("60 %");
    expect(amendment.rationale).toContain("déployé depuis le poste de l'astreinte");
    expect(amendment.evidenceRefs.length).toBeGreaterThan(5);
    expect(amendment.evidenceRefs.length).toBeLessThanOrEqual(12);
    expect(await hasOpenAmendment(deps, "gam_stats", STEP_IDS[1])).toBe(true);

    // Une seconde passe ne repropose pas le même amendement.
    const again = await proposeFromTraces(deps, { code: CODE });
    if (!again.ok) throw new Error("seconde passe en échec");
    expect(again.value).toHaveLength(0);
  });

  it("décider est humain : refus à un agent, décision datée et nommée pour un humain", async () => {
    const deps = makeDeps();
    await seedGamme(deps);
    const proposed = await proposeAmendment(deps, {
      gammeId: "gam_stats",
      stepId: STEP_IDS[1],
      proposal: "Réécrire l'étape 2",
      rationale: "échecs répétés",
      evidenceRefs: ["run_1"],
      proposedBy: "agent",
    });
    if (!proposed.ok) throw new Error("proposition refusée");
    const byAgent = await decideAmendment(deps, { id: proposed.value.id, decision: "accepted", by: agent() });
    expect(byAgent.ok).toBe(false);
    if (!byAgent.ok) expect(byAgent.error.code).toBe("approval_requires_human");

    const byHuman = await decideAmendment(deps, { id: proposed.value.id, decision: "accepted", by: human() });
    expect(byHuman.ok).toBe(true);
    if (byHuman.ok) {
      expect(byHuman.value.state).toBe("accepted");
      expect(byHuman.value.decidedAt).toBe(T0);
      expect(byHuman.value.decidedByRef).toBeTruthy();
    }
    // Accepter ne modifie rien : la version garde ses trois étapes.
    expect((await deps.store.versions.get("ver_stats_1"))?.steps).toHaveLength(3);
    expect((await deps.store.events()).some((e) => e.kind === "amendment.decided")).toBe(true);
  });

  it("amendement sur une gamme inconnue : refus explicite", async () => {
    const deps = makeDeps();
    const res = await proposeAmendment(deps, {
      gammeId: "gam_absent",
      proposal: "x",
      rationale: "y",
      evidenceRefs: [],
      proposedBy: "human",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("unknown_gamme");
    expect((await proposeFromTraces(deps, { code: "GAM-absent-01" })).ok).toBe(false);
  });
});

describe("aucune statistique par personne (GA-21)", () => {
  // Une statistique ne porte aucun acteur : les références d'audit (décidé par, approuvé par)
  // vivent dans les amendements et les approbations, jamais dans les agrégats.
  const FORBIDDEN = /(actor|assignee|person|owner|user|byRef)/i;

  const keysOf = (value: unknown, out: string[] = []): string[] => {
    if (Array.isArray(value)) value.forEach((v) => keysOf(v, out));
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out.push(k);
        keysOf(v, out);
      }
    }
    return out;
  };

  it("les sorties statistiques ne contiennent aucune clé nommant une personne", async () => {
    const deps = makeDeps();
    await seedGamme(deps);
    await seedRuns(deps, 40, 24, STEP_IDS[1]);
    const stats = await computeStepStats(deps, { code: CODE });
    const comparison = await compareVersions(deps, CODE, 1, 1);
    for (const output of [stats, comparison]) {
      const forbidden = keysOf(output).filter((k) => FORBIDDEN.test(k));
      expect(forbidden, JSON.stringify(forbidden)).toHaveLength(0);
    }
    // Le rendu texte non plus : aucun nom, aucun identifiant d'acteur.
    expect(renderRate(stats[0]!.failRate, "fr")).not.toMatch(/ari:/);
  });
});
