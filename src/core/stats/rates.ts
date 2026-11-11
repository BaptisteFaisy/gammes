/**
 * Gammes — cohortes et taux (§ 11, GA-19 et GA-21).
 *
 * Règle produit : **on ne conclut pas sans effectif**. Sous le seuil, `Rate.value`
 * reste `undefined` et aucun écran, export ou outil MCP n'affiche de pourcentage —
 * l'app dit « pas assez de recul ». La fourchette (Wilson à 95 %) accompagne chaque
 * taux publié : un taux sans son effectif et sa fourchette est une opinion, pas une mesure.
 */

import type { Cohort, Rate } from "../types";

/** Effectif minimal pour publier un taux. Réglable par espace (`SpaceSettings.statThreshold`). */
export const DEFAULT_THRESHOLD = 30;

/** z de la loi normale à 95 % : la fourchette est un intervalle de Wilson. */
const Z = 1.96;

export const cohortOf = (n: number, threshold: number = DEFAULT_THRESHOLD): Cohort => ({
  n,
  threshold,
  enoughHistory: n >= threshold,
});

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** Intervalle de Wilson : honnête aux petits effectifs, contrairement à l'intervalle normal. */
export const wilsonInterval = (numerator: number, n: number): { low: number; high: number } => {
  if (n <= 0) return { low: 0, high: 1 };
  const p = numerator / n;
  const denom = 1 + (Z * Z) / n;
  const center = p + (Z * Z) / (2 * n);
  const margin = Z * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n));
  return { low: round3(clamp01((center - margin) / denom)), high: round3(clamp01((center + margin) / denom)) };
};

/** « Pas assez de recul » : ni valeur, ni fourchette — seulement l'effectif et le seuil. */
export const notEnoughHistory = (n: number, threshold: number = DEFAULT_THRESHOLD): Rate => ({
  cohort: cohortOf(n, threshold),
});

/** Un taux publié : valeur arrondie, fourchette, effectif. Sous le seuil : pas de valeur. */
export const rate = (numerator: number, n: number, threshold: number = DEFAULT_THRESHOLD): Rate => {
  const cohort = cohortOf(n, threshold);
  if (!cohort.enoughHistory) return notEnoughHistory(n, threshold);
  const interval = wilsonInterval(numerator, n);
  return { value: round3(numerator / n), low: interval.low, high: interval.high, cohort };
};

/** Médiane d'une liste de durées (secondes) ; `undefined` si aucune mesure. */
export const median = (values: readonly number[]): number | undefined => {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round(((sorted[middle - 1]! + sorted[middle]!) / 2) * 10) / 10 : sorted[middle]!;
};

/** Formule lisible du taux, dans les deux langues, sans jamais inventer de chiffre. */
export const renderRate = (r: Rate, lang: "fr" | "en"): string => {
  if (r.value === undefined) {
    return lang === "fr"
      ? `pas assez de recul (${r.cohort.n} exécutions, seuil ${r.cohort.threshold})`
      : `not enough history (${r.cohort.n} runs, threshold ${r.cohort.threshold})`;
  }
  const pct = Math.round(r.value * 100);
  const low = Math.round((r.low ?? r.value) * 100);
  const high = Math.round((r.high ?? r.value) * 100);
  return lang === "fr"
    ? `${pct} % (fourchette ${low}–${high} %, sur ${r.cohort.n} exécutions)`
    : `${pct}% (range ${low}–${high}%, over ${r.cohort.n} runs)`;
};
