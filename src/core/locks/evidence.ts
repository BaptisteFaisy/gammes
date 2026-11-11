/**
 * Gammes — grille de force des preuves (§ 7).
 *
 * `machine > attestée > déclarée`. Une étape qui exige une preuve machine n'est pas
 * acquittable avec une déclaration. Cette grille est la même que celle de
 * `preuve-a-l-appui` (§ 16) : une seule logique, un seul endroit.
 */

import type { EvidenceStrength } from "../types";

/** Du plus faible au plus fort. */
export const STRENGTH_ORDER: readonly EvidenceStrength[] = ["declared", "attested", "machine"];

export const strengthRank = (strength: EvidenceStrength): number => STRENGTH_ORDER.indexOf(strength);

export const isStrongEnough = (required: EvidenceStrength, provided?: EvidenceStrength): boolean =>
  provided !== undefined && strengthRank(provided) >= strengthRank(required);

export const explainStrength = (required: EvidenceStrength, provided: EvidenceStrength, lang: "fr" | "en"): string => {
  if (isStrongEnough(required, provided)) {
    return lang === "fr" ? `preuve suffisante (${provided} ≥ ${required})` : `evidence sufficient (${provided} ≥ ${required})`;
  }
  return lang === "fr"
    ? `preuve insuffisante : ${required} exigée, ${provided} fournie`
    : `insufficient evidence: ${required} required, ${provided} provided`;
};
