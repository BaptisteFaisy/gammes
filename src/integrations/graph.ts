/**
 * Gammes × Teamwork Graph — le périmètre et le propriétaire (§ 16, GA-27, § 22).
 *
 * Lecture du graphe au nom d'un utilisateur connecté. **Droit manquant = résultat vide
 * sans erreur** : `readable()` permet à l'écran de couverture de distinguer « pas de
 * droit » de « pas de données ». Le fetcher est injecté — aucun réseau en test.
 *
 * Requête réelle (dans Forge, via `api._requestAtlassian` GraphQL Teamwork Graph) :
 *   query(ari) {
 *     ari(ari: $ari) {
 *       ... on document { connectedObjects(types: [software-service]) { name } }
 *       ... on document { connectedObjects(types: [project]) { key } }
 *       ... on document { owners { accountId } }
 *     }
 *   }
 */

import type { GraphPort } from "../core/ports";

export type GraphFetcher = (
  query: string,
  variables: Record<string, unknown>,
) => Promise<{ data?: unknown; errors?: readonly { message?: string }[] }>;

const PERMISSION_MARKERS = /permission|forbidden|unauthorized|not allowed|denied/i;

const isPermissionError = (errors: readonly { message?: string }[] | undefined): boolean =>
  errors?.some((e) => PERMISSION_MARKERS.test(e.message ?? "")) ?? false;

type NamesPayload = { data?: { ari?: { connectedObjects?: { name?: string }[] | null } | null } };
type OwnerPayload = { data?: { ari?: { owners?: { accountId?: string }[] | null } | null } };
type ProjectsPayload = { data?: { ari?: { connectedObjects?: { key?: string }[] | null } | null } };

export const createGraphPort = (fetcher?: GraphFetcher): GraphPort => {
  const readable = async (): Promise<boolean> => {
    if (!fetcher) return false;
    try {
      const res = await fetcher("query reachability { ari(ari: \"ari:cloud:graph::site/1\") { id } }", {});
      return !isPermissionError(res.errors);
    } catch {
      return false;
    }
  };

  const connected = async (pageAri: string, type: string): Promise<readonly string[]> => {
    if (!fetcher) return [];
    try {
      const query = `query($ari: ID!) { ari(ari: $ari) { connectedObjects(types: ["${type}"]) { name } } }`;
      const payload = (await fetcher(query, { ari: pageAri })) as NamesPayload;
      return (payload.data?.ari?.connectedObjects ?? []).flatMap((o) => (o.name ? [o.name] : []));
    } catch {
      return [];
    }
  };

  return {
    readable,
    servicesFor: (pageAri) => connected(pageAri, "software-service"),
    projectsFor: async (pageAri) => {
      if (!fetcher) return [];
      try {
        const query = `query($ari: ID!) { ari(ari: $ari) { connectedObjects(types: ["project"]) { key } } }`;
        const payload = (await fetcher(query, { ari: pageAri })) as ProjectsPayload;
        return (payload.data?.ari?.connectedObjects ?? []).flatMap((o) => (o.key ? [o.key] : []));
      } catch {
        return [];
      }
    },
    ownerOf: async (pageAri) => {
      if (!fetcher) return undefined;
      try {
        const query = `query($ari: ID!) { ari(ari: $ari) { owners { accountId } } }`;
        const payload = (await fetcher(query, { ari: pageAri })) as OwnerPayload;
        return payload.data?.ari?.owners?.[0]?.accountId;
      } catch {
        return undefined;
      }
    },
  };
};