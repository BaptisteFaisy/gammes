/**
 * Déclarations d'ambience pour le site (Vite).
 * `?raw` importe un fichier du dépôt tel quel — c'est ainsi que le site affiche les
 * fichiers réellement livrés (SKILL.md générique, prompt de l'agent), sans les recopier.
 */

declare module "*?raw" {
  const content: string;
  export default content;
}
