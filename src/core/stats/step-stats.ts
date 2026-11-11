/**
 * Gammes — statistiques d'atelier par étape (§ 11, GA-19 et GA-24).
 *
 * « Une étape qui échoue six fois sur dix n'est pas une étape difficile : c'est une
 * étape fausse. » Tout est calculé depuis les traces, par étape et par version, avec
 * son effectif et sa fourchette. Sous le seuil : « pas assez de recul », jamais un chiffre.
 */

import type { Deps } from "../ports";
import type { Cohort, Gamme, Run, StepStat, VersionComparison } from "../types";
import { getGammeByCode, listVersions } from "../version/versioning";
import { DEFAULT_THRESHOLD, median, notEnoughHistory, rate, renderRate } from "./rates";

/** Période par défaut : le trimestre glissant, comme les revues d'atelier. */
export const DEFAULT_PERIOD = "trimestre";

export type StepAggregate = {
  readonly stepId: string;
  readonly n: number;
  readonly failures: number;
  readonly skips: number;
  readonly deviations: number;
  readonly durations: readonly number[];
};

/** Une exécution ne compte pour une étape que si elle l'a atteinte (état ≠ pending). */
const aggregatesOf = (runs: readonly Run[], stepIds: readonly string[]): readonly StepAggregate[] =>
  stepIds.map((stepId) => {
    const touched = runs.flatMap((run) => run.steps.filter((s) => s.stepId === stepId && s.state !== "pending"));
    const failures = touched.filter((s) => s.state === "failed" || s.state === "refused").length;
    const skips = touched.filter((s) => s.state === "skipped").length;
    const durations = touched.flatMap((s) => (s.durationS !== undefined ? [s.durationS] : []));
    const deviations = runs.reduce(
      (total, run) => total + run.deviations.filter((d) => d.stepId === stepId).length,
      0,
    );
    return { stepId, n: touched.length, failures, skips, deviations, durations };
  });

const runsOf = async (deps: Deps, gamme: Gamme, version?: number): Promise<readonly Run[]> => {
  const versions = await listVersions(deps, gamme.id);
  const wanted = version ? versions.filter((v) => v.version === version) : versions;
  const ids = new Set(wanted.map((v) => v.id));
  return deps.store.runs.list((r) => r.gammeId === gamme.id && ids.has(r.versionId));
};

export type ComputeStatsArgs = {
  readonly code: string;
  readonly version?: number;
  readonly period?: string;
  readonly threshold?: number;
};

/** Taux d'échec, taux de saut, déviations et durée médiane, par étape et par version. */
export const computeStepStats = async (deps: Deps, args: ComputeStatsArgs): Promise<readonly StepStat[]> => {
  const gamme = await getGammeByCode(deps, args.code);
  if (!gamme) return [];
  const versions = await listVersions(deps, gamme.id);
  const wanted = args.version ? versions.filter((v) => v.version === args.version) : versions;
  const threshold = args.threshold ?? (await deps.store.settings.get(gamme.spaceKey))?.statThreshold ?? DEFAULT_THRESHOLD;
  const period = args.period ?? DEFAULT_PERIOD;
  const out: StepStat[] = [];
  for (const version of wanted) {
    const runs = await runsOf(deps, gamme, version.version);
    for (const agg of aggregatesOf(runs, version.steps.map((s) => s.id))) {
      const medianS = median(agg.durations);
      out.push({
        id: deps.ids.next("stt"),
        versionId: version.id,
        stepId: agg.stepId,
        period,
        n: agg.n,
        failRate: rate(agg.failures, agg.n, threshold),
        skipRate: rate(agg.skips, agg.n, threshold),
        deviations: agg.deviations,
        ...(medianS !== undefined ? { medianS } : {}),
        computedAt: deps.clock.now(),
      });
    }
  }
  return out;
};

/** Enregistre les statistiques calculées (travail de nuit) et journalise le calcul. */
export const persistStepStats = async (deps: Deps, args: ComputeStatsArgs): Promise<readonly StepStat[]> => {
  const stats = await computeStepStats(deps, args);
  for (const stat of stats) await deps.store.stepStats.insert(stat);
  await deps.store.appendEvent({
    at: deps.clock.now(),
    kind: "stats.computed",
    subjectRef: args.code,
    payload: { code: args.code, version: args.version ?? null, steps: stats.length, period: args.period ?? DEFAULT_PERIOD },
  });
  return stats;
};

/** Les étapes qui échouent le plus, avec leur effectif — la matière des amendements. */
export const failingSteps = async (deps: Deps, args: { code: string; threshold?: number }): Promise<readonly StepStat[]> => {
  const stats = await computeStepStats(deps, args);
  return stats
    .filter((s) => s.failRate.value !== undefined && s.failRate.value >= 0.5)
    .sort((a, b) => (b.failRate.value ?? 0) - (a.failRate.value ?? 0));
};

/** Les étapes systématiquement sautées : à supprimer ou à rendre conditionnelles — jamais automatiquement. */
export const skippedSteps = async (deps: Deps, args: { code: string; threshold?: number }): Promise<readonly StepStat[]> => {
  const stats = await computeStepStats(deps, args);
  return stats
    .filter((s) => s.skipRate.value !== undefined && s.skipRate.value >= 0.5)
    .sort((a, b) => (b.skipRate.value ?? 0) - (a.skipRate.value ?? 0));
};

type VersionAggregate = { failures: number; n: number; durations: readonly number[] };

const aggregateVersion = (runs: readonly Run[]): VersionAggregate => ({
  failures: runs.reduce((total, r) => total + r.steps.filter((s) => s.state === "failed").length, 0),
  n: runs.reduce((total, r) => total + r.steps.filter((s) => s.state !== "pending").length, 0),
  durations: runs.flatMap((r) => r.steps.flatMap((s) => (s.durationS !== undefined ? [s.durationS] : []))),
});

/** v6 contre v7 : l'amendement a-t-il amélioré quelque chose ? Sans effectif, on ne conclut pas. */
export const compareVersions = async (
  deps: Deps,
  code: string,
  left: number,
  right: number,
  threshold: number = DEFAULT_THRESHOLD,
): Promise<VersionComparison> => {
  const gamme = await getGammeByCode(deps, code);
  const empty = (version: number): VersionComparison["left"] => ({
    version,
    failRate: notEnoughHistory(0, threshold),
  });
  if (!gamme) {
    return { code, left: empty(left), right: empty(right), verdict: "not_enough_history" };
  }
  const sides = await Promise.all(
    [left, right].map(async (version) => {
      const runs = await runsOf(deps, gamme, version);
      const agg = aggregateVersion(runs);
      return {
        version,
        failRate: rate(agg.failures, agg.n, threshold),
        ...(median(agg.durations) !== undefined ? { medianS: median(agg.durations) } : {}),
      };
    }),
  );
  const [leftSide, rightSide] = sides as [VersionComparison["left"], VersionComparison["right"]];
  return { code, left: leftSide, right: rightSide, verdict: verdictOf(leftSide.failRate.cohort, rightSide.failRate.cohort, leftSide.failRate.value, rightSide.failRate.value) };
};

const verdictOf = (
  leftCohort: Cohort,
  rightCohort: Cohort,
  leftValue?: number,
  rightValue?: number,
): VersionComparison["verdict"] => {
  if (!leftCohort.enoughHistory || !rightCohort.enoughHistory) return "not_enough_history";
  if (leftValue === undefined || rightValue === undefined) return "not_enough_history";
  if (rightValue < leftValue - 0.05) return "improved";
  if (rightValue > leftValue + 0.05) return "degraded";
  return "unchanged";
};

/** Rendu d'une comparaison, dans les deux langues, avec les deux effectifs. */
export const renderComparison = (comparison: VersionComparison, lang: "fr" | "en"): string => {
  const label =
    comparison.verdict === "improved"
      ? lang === "fr" ? "améliorée" : "improved"
      : comparison.verdict === "degraded"
        ? lang === "fr" ? "dégradée" : "degraded"
        : comparison.verdict === "unchanged"
          ? lang === "fr" ? "inchangée" : "unchanged"
          : lang === "fr" ? "pas assez de recul" : "not enough history";
  return [
    `${comparison.code} · v${comparison.left.version} vs v${comparison.right.version} : ${label}`,
    `  v${comparison.left.version} — ${renderRate(comparison.left.failRate, lang)}`,
    `  v${comparison.right.version} — ${renderRate(comparison.right.failRate, lang)}`,
  ].join("\n");
};
