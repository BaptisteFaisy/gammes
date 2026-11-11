/**
 * Gammes × vigie — les résultats clés de niveau A (§ 16, § 30).
 *
 * Une gamme est une source de niveau A : part des déploiements sous procédure tracée,
 * taux d'étapes en échec (avec effectif, « pas assez de recul » sous le seuil),
 * fraîcheur des gammes. Sortie stable pour `vigie`, sans aucune mesure par personne.
 */

import type { Deps } from "../core/ports";
import type { Rate } from "../core/types";
import { freshness } from "../core/stats/workshop";
import { computeStepStats } from "../core/stats/step-stats";
import { rate } from "../core/stats/rates";
import { coverageDetail } from "../core/coverage/coverage";

export type KeyResults = {
  readonly scope: string;
  readonly tracedPct: number;
  readonly stepFailureRate: Rate;
  readonly syncedPct: number;
  readonly staleOver90d: number;
  readonly compiledPct: number;
};

/** Mesure d'une étape sur toutes les gammes : l'échec agrégé, avec son effectif. */
const overallStepFailure = async (deps: Deps): Promise<Rate> => {
  const gammes = await deps.store.gammes.list();
  let failures = 0;
  let touched = 0;
  for (const gamme of gammes) {
    const stats = await computeStepStats(deps, { code: gamme.code, version: gamme.currentVersion });
    for (const stat of stats) {
      touched += stat.n;
      failures += stat.n * (stat.failRate.value ?? 0);
    }
  }
  return { ...rate(Math.round(failures), touched), value: touched === 0 ? undefined : Math.round((failures / touched) * 1000) / 1000 };
};

export const keyResults = async (deps: Deps, scope = "*"): Promise<KeyResults> => {
  const coverage = await coverageDetail(deps, scope);
  const fresh = await freshness(deps);
  return {
    scope,
    tracedPct: coverage.tracedPct,
    stepFailureRate: await overallStepFailure(deps),
    syncedPct: fresh.syncedPct,
    staleOver90d: fresh.staleOver90d,
    compiledPct: coverage.compiledPct,
  };
};

/** Charge utile stable pour `vigie` : aucun nom, aucun identifiant d'acteur. */
export const toVigiePayload = (results: KeyResults): Record<string, unknown> => ({
  scope: results.scope,
  part_deploiements_sous_procedure: results.tracedPct,
  taux_echec_etapes: {
    value: results.stepFailureRate.value,
    low: results.stepFailureRate.low,
    high: results.stepFailureRate.high,
    n: results.stepFailureRate.cohort.n,
    enough_history: results.stepFailureRate.cohort.enoughHistory,
  },
  fraicheur: {
    part_synchronisees: results.syncedPct,
    desynchronisees_depuis_plus_de_90_jours: results.staleOver90d,
  },
  part_compilee: results.compiledPct,
});