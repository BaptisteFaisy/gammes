/**
 * Le client Teamwork Graph (idée de consolidation n° 4 — le bonus « T »).
 *
 * Le graphe donne ce que le wiki ne dit pas : le **service** réellement visé par
 * une procédure, son **projet**, son **propriétaire**. C'est ce qui permet, plus
 * tard, d'attester une étape par un déploiement observé plutôt que par ce que
 * l'agent déclare.
 *
 * Deux règles du graphe qu'il faut respecter, pas négocier :
 *
 *   1. la lecture se fait **au nom d'un utilisateur connecté** — un droit
 *      manquant ne renvoie pas une erreur, il renvoie un résultat **vide** ;
 *   2. le graphe n'est pas une base de requêtes : on n'écrit **aucune**
 *      requête libre (le Cypher brut est refusé aux nouvelles apps), seulement
 *      des fragments de lecture déclarés ici.
 */

import type { GraphPort } from "../../core/ports";
import type { AtlassianClient } from "./atlassian-http";

export type GraphOptions = {
  readonly client: AtlassianClient;
};

const objet = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
const texte = (v: unknown): string => (typeof v === "string" ? v : "");
const liste = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);

/** Les fragments de lecture : rien d'autre ne sort d'ici. */
const QUERIES = {
  services: `query Services($id: ID!) { nodes(ids: [$id]) { ... on Document { id title relatedSoftwareServices(first: 20) { nodes { id name key } } } } }`,
  projects: `query Projects($id: ID!) { nodes(ids: [$id]) { ... on Document { id title relatedProjects(first: 20) { nodes { id name key } } } } }`,
  owner: `query Owner($id: ID!) { nodes(ids: [$id]) { ... on Document { id title ownedBy { id name email } } } }`,
} as const;

/** Le nœud lu, quel que soit le fragment : un objet ou une liste. */
const noeud = (corps: unknown): Record<string, unknown> => {
  const data = objet(corps).data;
  const noeuds = liste(objet(data).nodes);
  return objet(noeuds[0]);
};

const noms = (v: unknown): readonly string[] =>
  liste(objet(v).nodes).map((n) => texte(objet(n).name) || texte(objet(n).key)).filter(Boolean);

/**
 * Le client du graphe. Chaque droit manquant donne un résultat **vide**, jamais
 * une erreur : l'écran de couverture distingue « je ne peux pas le voir » de
 * « il n'existe pas », et les deux sont des résultats.
 */
export const graphClient = (options: GraphOptions): GraphPort => ({
  servicesFor: async (pageAri: string): Promise<readonly string[]> => {
    const reponse = await options.client.post<unknown>("/graph/1/graphql", { query: QUERIES.services, variables: { id: pageAri } });
    if (!reponse.ok) return [];
    return noms(objet(noeud(reponse.value).relatedSoftwareServices));
  },

  projectsFor: async (pageAri: string): Promise<readonly string[]> => {
    const reponse = await options.client.post<unknown>("/graph/1/graphql", { query: QUERIES.projects, variables: { id: pageAri } });
    if (!reponse.ok) return [];
    return noms(objet(noeud(reponse.value).relatedProjects));
  },

  ownerOf: async (pageAri: string): Promise<string | undefined> => {
    const reponse = await options.client.post<unknown>("/graph/1/graphql", { query: QUERIES.owner, variables: { id: pageAri } });
    if (!reponse.ok) return undefined;
    const proprietaire = objet(objet(noeud(reponse.value).ownedBy));
    return texte(proprietaire.name) || texte(proprietaire.email) || undefined;
  },

  readable: async (): Promise<boolean> => {
    const reponse = await options.client.post<unknown>("/graph/1/graphql", {
      query: "query Probe { nodes(ids: []) { id } }",
      variables: {},
    });
    return reponse.ok;
  },
});
