/**
 * Gammes — site public : le programme de la démo et, pour chaque étape, **le test qui
 * la prouve**.
 *
 * Chaque étape est adossée à un test réel du dépôt (fichier + nom exact du `it`). La CI
 * joue la suite, note le résultat par étape, et le site l'affiche : à chaque étape, on
 * voit que le test passe bien.
 */

import type { TourStep } from "./tour";
import { TOUR_PART1 } from "./tour-part1";
import { TOUR_PART2 } from "./tour-part2";

export const TOUR_STEPS: readonly TourStep[] = [...TOUR_PART1, ...TOUR_PART2];

export type TourTest = {
  /** Fichier de test qui prouve l'étape. */
  readonly file: string;
  /** Nom exact du test (`it("…")`). */
  readonly name: string;
};

export const TOUR_TESTS: Readonly<Record<string, TourTest>> = {
  detecter: { file: "test/compilateur-front/detect-extract.test.ts", name: "recette 2 : une page sans signal n'est pas proposée, et le dit" },
  compiler: { file: "test/compilateur-front/detect-extract.test.ts", name: "recette 1 : liste numérotée et bloc de code deviennent des étapes citant leur passage" },
  secret: { file: "test/cycle-de-vie/compile.test.ts", name: "recette 5 : une clé dans une étape empêche la publication et ouvre un signalement" },
  approuver: { file: "test/cycle-de-vie/versioning.test.ts", name: "l'approbation est un acte humain daté, nommé, avec une date de révision" },
  "avant-agir-oui": { file: "test/mcp/tools.test.ts", name: "trouve la gamme approuvée et dit si des permis sont requis" },
  "avant-agir-non": { file: "test/mcp/tools.test.ts", name: "sans gamme approuvée : on le dit, on n'improvise pas" },
  "executer-agent": { file: "test/moteur-execution/locks-record.test.ts", name: "sans permis valide : refus explicite et demande de permis à créer" },
  "verrou-humain": { file: "test/moteur-execution/locks-record.test.ts", name: "un agent refusé sur une étape humaine, et la tentative devient une déviation" },
  trace: { file: "test/moteur-execution/runs.test.ts", name: "le démarrage rend la première étape, ses verrous et sa preuve exigée" },
  desynchronisation: { file: "test/cycle-de-vie/binding.test.ts", name: "recette 12 : la page modifiée marque la gamme désynchronisée, avec l'âge et le diff" },
  recompilation: { file: "test/cycle-de-vie/binding.test.ts", name: "la recompilation proposée produit un diff et un brouillon, sans republier" },
  "refermer-ecart": { file: "test/cycle-de-vie/binding.test.ts", name: "l'approbation de la nouvelle version referme l'écart" },
  mesures: { file: "test/mesures-atelier/stats.test.ts", name: "six échecs sur dix sur 40 exécutions : taux publié, déviations et durée médiane" },
  "pas-assez-de-recul": { file: "test/mesures-atelier/stats.test.ts", name: "sous le seuil : aucun pourcentage, seulement « pas assez de recul »" },
  amendement: { file: "test/mesures-atelier/stats.test.ts", name: "recette 14 : l'étape qui échoue six fois sur dix déclenche une proposition, preuves à l'appui" },
  "amendement-decide": { file: "test/mesures-atelier/stats.test.ts", name: "décider est humain : refus à un agent, décision datée et nommée pour un humain" },
  comparaison: { file: "test/mesures-atelier/stats.test.ts", name: "v1 contre v2 : les deux taux sont affichés avec leurs effectifs" },
  delegable: { file: "test/integrations/atelier.test.ts", name: "une étape fiable pour un agent seulement si ses traces le prouvent" },
  fantomes: { file: "test/mesures-atelier/workshop-ghosts.test.ts", name: "recette 18 : 38 tickets semblables sans procédure écrite, avec preuves et coût" },
  "adopter-fantome": { file: "test/mesures-atelier/workshop-ghosts.test.ts", name: "l'adoption est humaine et ouvre un brouillon pré-rempli depuis les commentaires constants" },
  conflits: { file: "test/conflits/detect.test.ts", name: "19. deux gammes aux approbations incompatibles déclenchent un conflit, passages cités" },
  concilier: { file: "test/conflits/conciliate.test.ts", name: "prépare un dossier : résumé, options, aucune appliquée, décision humaine exigée" },
  mcp: { file: "test/surfaces/resolver.test.ts", name: "mcp : l'action relaie les 16 outils sans logique propre" },
  skill: { file: "test/mcp/skill-export.test.ts", name: "recette 17 : aucun secret ne passe dans l'export, même par accident" },
  encarts: { file: "test/surfaces/resolver.test.ts", name: "issuePanel : trouve la procédure qui correspond au ticket" },
  journal: { file: "test/demo/preuve.test.ts", name: "le scénario se joue de bout en bout, chaque étape rend sa preuve" },
  atelier: { file: "test/surfaces/resolver.test.ts", name: "atelier : registre, poussières, fraîcheur et couverture d'un coup" },
  reglages: { file: "test/mesures-atelier/workshop-ghosts.test.ts", name: "fraîcheur : part synchronisée, âge médian de l'écart, alerte au-delà de 90 jours" },
};

/** La commande qui rejoue le test d'une étape, pour la copier-coller. */
export const commandFor = (stepId: string): string | undefined => {
  const test = TOUR_TESTS[stepId];
  return test ? `npx vitest run ${test.file} -t "${test.name}"` : undefined;
};
