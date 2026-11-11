/**
 * Gammes × delegable-ou-pas — quelles étapes sont fiables pour un agent (§ 11, § 16).
 *
 * Mêmes cohortes, même refus de conclure sous le seuil : une étape n'est « délégable »
 * que si ses traces le prouvent. Sous le seuil, on ne conclut rien — aucun pourcentage,
 * aucun « l'agent peut y aller ».
 */

import type { StepStat } from "../core/types";
import { DEFAULT_THRESHOLD } from "../core/stats/rates";

export type DelegationVerdict = "delegable" | "needs_human" | "not_enough_history";

export type StepDelegation = {
  readonly stepId: string;
  readonly versionId: string;
  readonly verdict: DelegationVerdict;
  readonly failRate?: number;
  readonly n: number;
};

/** Une étape est délégable à un agent seulement si ses traces le montrent. */
export const delegableSteps = (stats: readonly StepStat[], threshold: number = DEFAULT_THRESHOLD): readonly StepDelegation[] =>
  stats.map((stat) => {
    if (!stat.failRate.cohort.enoughHistory) {
      return { stepId: stat.stepId, versionId: stat.versionId, verdict: "not_enough_history", n: stat.failRate.cohort.n };
    }
    const value = stat.failRate.value ?? 0;
    if (value >= 0.2) {
      return { stepId: stat.stepId, versionId: stat.versionId, verdict: "needs_human", failRate: value, n: stat.failRate.cohort.n };
    }
    return { stepId: stat.stepId, versionId: stat.versionId, verdict: "delegable", failRate: value, n: stat.failRate.cohort.n };
  });

/** Le seuil d'échec au-delà duquel une étape revient à un humain : 20 %, comme les cohorts. */
export const DELEGATION_FAIL_CEILING = 0.2;

/** Résumé lisible pour l'écran de couverture et l'agent Rovo. */
export const renderDelegation = (steps: readonly StepDelegation[], lang: "fr" | "en"): string => {
  const counts = {
    delegable: steps.filter((s) => s.verdict === "delegable").length,
    needs_human: steps.filter((s) => s.verdict === "needs_human").length,
    not_enough_history: steps.filter((s) => s.verdict === "not_enough_history").length,
  };
  return lang === "fr"
    ? `${counts.delegable} délégable(s) · ${counts.needs_human} à garder humaines · ${counts.not_enough_history} sans recul suffisant`
    : `${counts.delegable} delegable · ${counts.needs_human} should stay human · ${counts.not_enough_history} without enough history`;
};