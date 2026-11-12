/**
 * Lecture du payload Forge du validateur de transition (GA-25).
 *
 * Séparé du handler (`src/validator.ts`) pour rester pur : ce fichier n'importe
 * aucun paquet `@forge/*`, donc il se teste hors runtime Forge. Jira n'a pas une
 * seule forme de payload documentée pour ce module — on lit donc défensivement,
 * et **une clé illisible vaut absence de clé** : le validateur échoue fermé.
 */

/** Ce que Jira peut envoyer au validateur. */
export type ValidatorPayload = { readonly issueKey?: unknown; readonly transition?: unknown };

const chaine = (v: unknown): string => (typeof v === "string" && v.trim() ? v.trim() : "");

/** La clé de ticket, cherchée au premier niveau puis dans `transition`. */
export const issueKeyOf = (payload: ValidatorPayload | undefined): string => {
  if (!payload || typeof payload !== "object") return "";
  const direct = chaine(payload.issueKey);
  if (direct) return direct;
  const transition = payload.transition;
  if (transition && typeof transition === "object") {
    return chaine((transition as Record<string, unknown>).issueKey);
  }
  return "";
};
