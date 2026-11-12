/**
 * Gammes — tokenisation des textes français (§ 16 : une implémentation par logique).
 *
 * Le socle commun de la recherche (`find-procedure`), du regroupement des fantômes
 * et des slugs de codes `GAM-` : même pliage des accents et des capitales, même
 * découpe en mots porteurs. Les mots vides du domaine (bruit Jira, etc.) sont
 * passés par l'appelant, la logique reste unique ici.
 */

/** Les mots vides partagés : search, fantômes et slugs filtrent sur la même liste. */
export const STOP_WORDS = new Set([
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "a", "sur", "pour",
  "the", "of", "and", "to", "in", "on",
]);

/** Minuscules sans accents : le pliage partagé par les slugs et les mots-clés. */
export const fold = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Mots porteurs : plus de deux lettres, hors mots vides et hors bruit du domaine. */
export const tokensOf = (text: string, noiseWords: readonly string[] = []): readonly string[] => {
  const stop = noiseWords.length === 0 ? STOP_WORDS : new Set([...STOP_WORDS, ...noiseWords]);
  return fold(text)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 2 && !stop.has(w));
};
