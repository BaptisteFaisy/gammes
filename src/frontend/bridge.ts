/**
 * Le pont vers le resolver — une seule implémentation pour toutes les surfaces.
 *
 * `invoke` peut rendre la donnée directement ou une enveloppe `{ data, metadata }`
 * selon la version du runtime : on normalise ici, une fois, plutôt que dans
 * chaque surface. Une erreur de transport rend `undefined` : l'écran affiche un
 * état vide, jamais une exception.
 */
import { invoke } from "@forge/bridge";

/** Ce que `invoke` peut rendre : la donnée, ou une enveloppe `{ data, metadata }`. */
export type Reponse<T> = T | { readonly data?: T; readonly metadata?: unknown };

/** Extrait la donnée d'une réponse d'`invoke`, quelle que soit sa forme. */
export const donnee = <T,>(reponse: Reponse<T> | undefined): T | undefined => {
  if (reponse === undefined || reponse === null) return undefined;
  if (typeof reponse === "object" && "data" in reponse) return (reponse as { data: T }).data;
  return reponse as T;
};

/** Appelle une action du resolver et rend la donnée, ou `undefined` en cas d'échec. */
export const appeler = async <T,>(
  cle: string,
  charge: Record<string, unknown> = {},
): Promise<T | undefined> => {
  try {
    return donnee<T>(await invoke<T>(cle, charge));
  } catch {
    return undefined;
  }
};
