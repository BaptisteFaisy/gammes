/**
 * Gammes — l'atelier : le registre des gammes du tenant, en données pures.
 *
 * L'écran de l'atelier affiche **ce que le tenant contient**, pas une description de
 * ce qu'il pourrait contenir : la donnée vient de l'action `atelier` du resolver, qui
 * lit le stockage de l'app (les gammes qu'elle a compilées depuis les pages du site).
 *
 * Discipline : la forme de la réponse est lue **défensivement** (le runtime Forge peut
 * rendre une enveloppe `{ data, metadata }` ou la donnée nue) ; un registre vide est
 * un état à afficher, jamais une erreur ; aucune donnée par personne n'est exposée.
 */

/** Une gamme, telle que l'écran la montre. */
export type GammeRow = {
  readonly code: string;
  readonly titre: string;
  readonly etat: string;
  readonly version: number;
  readonly espace: string;
  readonly synchronisation: string;
  /** L'étape suivante, quand l'app la sait — sinon vide. */
  readonly verrou: string;
};

/** Ce que l'écran affiche, prêt à rendre. */
export type AtelierView = {
  readonly ranges: readonly GammeRow[];
  readonly total: number;
  readonly approuvees: number;
  readonly brouillons: number;
  /** La phrase que l'écran affiche quand le registre est vide. */
  readonly message: string;
  /** Les compteurs de fraîcheur (synchronisation), quand le resolver les rend. */
  readonly freshness: string;
  readonly coverage: string;
};

/** Un objet lu sans jamais supposer sa forme. */
const objet = (valeur: unknown): Record<string, unknown> =>
  typeof valeur === "object" && valeur !== null ? (valeur as Record<string, unknown>) : {};

/** Une chaîne, ou rien. */
const texte = (valeur: unknown): string => (typeof valeur === "string" ? valeur : "");

/** Un nombre, ou zéro. */
const nombre = (valeur: unknown): number => (typeof valeur === "number" && Number.isFinite(valeur) ? valeur : 0);

/** La liste des gammes, quelle que soit la forme de la réponse. */
const listeGammes = (donnees: Record<string, unknown>): readonly unknown[] => {
  const brutes = donnees.gammes;
  return Array.isArray(brutes) ? brutes : [];
};

/** L'état d'une gamme, translated for the screen. */
const ETATS: Readonly<Record<string, string>> = {
  draft: "brouillon",
  in_review: "en revue",
  approved: "approuvée",
  deprecated: "dépréciée",
};

const SYNCS: Readonly<Record<string, string>> = {
  synced: "synchronisée",
  stale: "en retard",
  source_gone: "source disparue",
  unknown: "inconnue",
};

/** Une ligne d'écran, depuis une gamme. */
const ligne = (brute: unknown): GammeRow => {
  const g = objet(brute);
  const etat = texte(g.state);
  const sync = texte(g.sync);
  return {
    code: texte(g.code) || "(sans code)",
    titre: texte(g.title) || "(sans titre)",
    etat: ETATS[etat] ?? etat ?? "inconnu",
    version: nombre(g.currentVersion),
    espace: texte(g.spaceKey) || "(espace inconnu)",
    synchronisation: SYNCS[sync] ?? sync ?? "inconnue",
    verrou: texte(g.exclusive) ? "exclusif" : "",
  };
};

/**
 * La vue de l'atelier, depuis la réponse de l'action `atelier`.
 *
 * Un registre vide n'est pas une erreur : l'écran dit qu'il est vide et ce qu'il
 * faut faire pour le remplir.
 */
export const atelierView = (reponse: unknown): AtelierView => {
  const brut = objet(reponse);
  // Le runtime Forge rend la donnée nue ou enveloppée dans `{ data, metadata }` :
  // les deux sont lues pareil.
  const donnees = brut.data && typeof brut.data === "object" ? objet(brut.data) : brut;
  const ranges = listeGammes(donnees).map(ligne);
  const approuvees = ranges.filter((r) => r.etat === "approuvée").length;
  const brouillons = ranges.filter((r) => r.etat === "brouillon").length;
  const freshness = objet(donnees.freshness);
  const coverage = objet(donnees.coverage);
  const total = nombre(freshness.total) || ranges.length;
  const synchronisees = nombre(freshness.syncedPct);
  const message = ranges.length
    ? ""
    : "Aucune gamme dans ce tenant pour l'instant : l'app compile une page de procédure à la création, puis l'approuve à la main.";
  return {
    ranges,
    total,
    approuvees,
    brouillons,
    message,
    freshness: total
      ? `${total} gamme(s), ${Math.round(synchronisees * 100)} % synchronisées avec leur page source`
      : "Aucune synchronisation à relever",
    coverage: coverage.scope ? `Couverture ${texte(coverage.scope)} : ${nombre(coverage.approvedPct)} % approuvées` : "",
  };
};
