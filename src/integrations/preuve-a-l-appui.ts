/**
 * Gammes × preuve-a-l'appui — la grille de force des preuves (§ 7, § 16).
 *
 * `machine > attestée > déclarée`. La grille vit dans le cœur
 * (`src/core/locks/evidence.ts`) : cet adaptateur la **consomme** et n'ajoute que ce qui
 * lui manque — le choix de la force *attendue* selon la nature de la preuve. Aucune règle
 * de preuve n'est recopiée ailleurs dans Gammes.
 */

import type { EvidenceKind, EvidenceStrength } from "../core/types";
import {
  STRENGTH_ORDER,
  explainStrength,
  isStrongEnough as coreIsStrongEnough,
  strengthRank,
} from "../core/locks/evidence";

export { STRENGTH_ORDER, strengthRank };

/** Une preuve attestée par une personne vaut plus qu'une déclaration, moins qu'une mesure. */
export const isStrongEnough = coreIsStrongEnough;

export const explain = explainStrength;

export type EvidenceContext = { readonly automated?: boolean };

/** La force attendue selon la nature de la preuve — la grille de `preuve-a-l'appui`. */
export const strengthFor = (kind: EvidenceKind, ctx: EvidenceContext = {}): EvidenceStrength => {
  switch (kind) {
    case "command_output":
    case "build_link":
    case "log_ref":
      return ctx.automated === false ? "attested" : "machine";
    case "screenshot":
    case "attestation":
      return "attested";
    case "ticket_ref":
      return "machine";
    default:
      return "declared";
  }
};

/** Rappel de la règle, en clair : ce que le validateur de transition peut exiger. */
export const evidenceRule = (lang: "fr" | "en"): string =>
  lang === "fr"
    ? "machine > attestée > déclarée : une étape qui exige une preuve machine n'est pas acquittable par une déclaration."
    : "machine > attested > declared: a step that requires machine evidence cannot be satisfied by a declaration.";