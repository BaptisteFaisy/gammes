/**
 * Le client Confluence réel (idée de consolidation n° 2).
 *
 * L'app lit des pages **vraies** : format `storage`, version figée, labels,
 * espace. Tout est défensif — une réponse qui n'a pas la forme attendue donne
 * une page « injoignable », jamais une page inventée.
 *
 * Le transport est injecté : en production c'est `api.asUser()` (le droit de
 * l'utilisateur qui consulte), en test c'est une fonction. Aucun réseau ici.
 */

import type { ConfluencePort } from "../../core/ports";
import type { PageDigest } from "../../core/types";
import type { AtlassianClient } from "./atlassian-http";

export type ConfluenceOptions = {
  readonly client: AtlassianClient;
  /** L'identifiant de la page dans son ARI : `…:page/12345`. */
  readonly idFromAri?: (ari: string) => string;
};

const idParDefaut = (ari: string): string => {
  const dernier = ari.split("/").pop() ?? ari;
  return dernier.includes(":") ? dernier.split(":").pop() ?? dernier : dernier;
};

const liste = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);
const objet = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};

const texte = (v: unknown): string => (typeof v === "string" ? v : "");
const nombre = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const labelsDe = (v: unknown): readonly string[] => {
  const resultats = objet(v).results;
  if (!Array.isArray(resultats)) return [];
  return resultats.map((l) => texte(objet(l).name)).filter(Boolean);
};

const stockageDe = (v: unknown): string => texte(objet(objet(v).storage).value);

/** La page telle que l'API v2 la rend, réduite à ce dont le cœur a besoin. */
const pageDe = (brut: unknown, id: string): PageDigest => {
  const p = objet(brut);
  const version = objet(p.version);
  const corps = stockageDe(p.body);
  return {
    ari: texte(p.id) ? `ari:cloud:confluence:site:page/${texte(p.id)}` : `page/${id}`,
    id,
    spaceKey: texte(p.spaceKey) || texte(p.spaceId) || "",
    title: texte(p.title),
    storageBody: corps,
    labels: labelsDe(p.labels),
    lastModifiedAt: texte(version.createdAt) || texte(p.lastModifiedAt),
    pageVersion: nombre(version.number) || 1,
    wordCount: corps.split(/\s+/).filter(Boolean).length,
    reachable: true,
  };
};

/** L'identifiant de page contenu dans un ARI. */
export const idDePage = (ari: string, extrait?: (a: string) => string): string =>
  (extrait ?? idParDefaut)(ari);

/**
 * Le client Confluence : lecture de page, recherche par CQL, et une sonde de
 * joignabilité. Chaque appel est un aller-retour explicite, jamais un cache
 * silencieux.
 */
export const confluenceClient = (options: ConfluenceOptions): ConfluencePort => ({
  getPage: async (pageAri: string): Promise<PageDigest> => {
    const id = idDePage(pageAri, options.idFromAri);
    const reponse = await options.client.get<unknown>(`/wiki/api/v2/pages/${id}`, { "body-format": "storage" });
    if (!reponse.ok) {
      return { ...pageInjoignable(pageAri), reachable: false };
    }
    return pageDe(reponse.value, id);
  },

  listPages: async (spaceKey: string): Promise<readonly PageDigest[]> => {
    const cql = `space="${spaceKey}" AND type=page ORDER BY lastmodified DESC`;
    const reponse = await options.client.paginate<unknown>(
      "/wiki/rest/api/content/search",
      { cql, expand: "body.storage,version,labels,space" },
      (corps) => ({
        items: liste(objet(corps).results),
        next: texte(objet(objet(corps)._links).next) || undefined,
      }),
    );
    if (!reponse.ok) return [];
    return reponse.value.map((brut) => {
      const p = objet(brut);
      const id = texte(p.id);
      return pageDe({ ...p, id, body: objet(p.body), version: objet(p.version), labels: { results: objet(objet(p.metadata).labels).results ?? [] } }, id);
    });
  },

  isReachable: async (): Promise<boolean> => {
    const reponse = await options.client.get<unknown>("/wiki/api/v2/spaces", { limit: 1 });
    return reponse.ok;
  },
});

/** La page inaccessible — jamais une page vide qui ferait croire à un contenu. */
const pageInjoignable = (ari: string): PageDigest => ({
  ari,
  id: idDePage(ari),
  spaceKey: "",
  title: "",
  storageBody: "",
  labels: [],
  lastModifiedAt: "",
  pageVersion: 0,
  wordCount: 0,
  reachable: false,
});
