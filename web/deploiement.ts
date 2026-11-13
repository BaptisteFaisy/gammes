/**
 * Gammes — la provenance du déploiement : ce qui est **réellement installé**, où, et
 * depuis quand.
 *
 * Une seule source de vérité : le site public l'affiche, la documentation la cite, et
 * un test la compare au `manifest.yml`. Si l'identifiant affiché et l'identifiant
 * déployé divergent, la CI rougit — l'écran ne peut pas mentir en silence.
 *
 * Ce que ce relevé dit, et rien de plus : l'app **est** déployée et installée sur le
 * site ci-dessous, en environnement de développement. Ce n'est pas une installation de
 * production, et l'écran le dit.
 */

/** Ce que le déploiement a produit, relevé le jour du déploiement. */
export type Provenance = {
  /** L'ARI de l'application — l'identifiant public de l'app Forge. */
  readonly appId: string;
  /** L'identifiant court : celui que Forge met dans les URL d'installation. */
  readonly appIdCourt: string;
  /** Le tenant où l'app est installée. */
  readonly site: string;
  /** L'environnement Forge déployé (`development`, `staging`, `production`). */
  readonly environnement: string;
  /** La version déployée — celle que porte le manifeste. */
  readonly version: string;
  /** La date du relevé (ISO) : une provenance sans date n'est pas une provenance. */
  readonly releveLe: string;
  /** Les deux installations : l'atelier (Confluence) et l'encart (Jira). */
  readonly urls: {
    readonly confluence: string;
    readonly jira: string;
  };
  /** La PR qui a porté le déploiement, et les commandes qui l'ont produit. */
  readonly pullRequest: string;
  /** Le dépôt du code, et la démo publique. */
  readonly depot: string;
  readonly demo: string;
};

/** Le relevé du déploiement — les valeurs sont celles du déploiement réellement exécuté. */
export const DEPLOIEMENT: Provenance = {
  appId: "ari:cloud:ecosystem::app/22debf64-74af-4b39-a652-206d747b69c3",
  appIdCourt: "22debf64-74af-4b39-a652-206d747b69c3",
  site: "one-atlas-cndz.atlassian.net",
  environnement: "development",
  version: "2.1.0",
  releveLe: "2026-11-13",
  urls: {
    confluence:
      "https://one-atlas-cndz.atlassian.net/wiki/apps/22debf64-74af-4b39-a652-206d747b69c3/4f32b0c3-8131-457c-8f6d-4f7a180d9c48/atelier",
    jira: "https://one-atlas-cndz.atlassian.net/jira/apps/22debf64-74af-4b39-a652-206d747b69c3/4f32b0c3-8131-457c-8f6d-4f7a180d9c48",
  },
  pullRequest: "https://github.com/Tradoooo/gammes/pull/57",
  depot: "https://github.com/Tradoooo/gammes",
  demo: "https://tradoooo.github.io/gammes/",
};

/** Les commandes qui produisent ce relevé — pour le rejouer, pas pour le croire. */
export const COMMANDES_DEPLOIEMENT: readonly string[] = [
  "forge lint",
  "forge deploy -e development",
  "forge install --site one-atlas-cndz.atlassian.net --product confluence",
  "forge install --site one-atlas-cndz.atlassian.net --product jira",
];

/** L'URL d'installation de l'atelier (Confluence) — celle qu'un lien épinglé doit porter. */
export const URL_INSTALLATION = DEPLOIEMENT.urls.confluence;
