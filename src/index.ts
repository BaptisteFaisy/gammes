/**
 * Point d'entrée Forge — le manifeste déclare `handler: index.handler`.
 *
 * Aucune logique ici : le resolver est construit dans `src/resolver/index.ts`,
 * qui reste le seul point de montage des actions. Ce fichier n'existe que pour
 * que la référence du manifeste pointe sur un fichier réel — le garde
 * `tools/check-manifest.mjs` vérifie les deux bouts.
 */
export { handler } from "./resolver/index";
