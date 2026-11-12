/**
 * Gammes — site public : l'état de la démonstration.
 *
 * Le site utilise **le vrai cœur** du produit (src/core) avec le magasin en mémoire :
 * ce qui est montré ici est exactement ce que fait l'app dans Forge, sans Forge.
 * Aucun réseau, aucun secret, aucune donnée réelle.
 */

import { seedAtelier, seedSettings, PAGES } from "../seed/atelier";
import type { Deps } from "../src/core/ports";

export type AppState = {
  readonly deps: Deps;
  /** ARI de la page choisie dans l'écran « compiler ». */
  page: string;
  /** Code de la gamme choisie. */
  gamme?: string;
  /** Exécution en cours. */
  runId?: string;
  /** Dernier message d'action (trace lisible de ce que l'utilisateur a fait). */
  message?: string;
};

export const createState = async (): Promise<AppState> => {
  const { deps } = seedAtelier();
  await seedSettings(deps);
  return { deps, page: Object.keys(PAGES)[0] ?? "" };
};

export const pageOptions = (): readonly { value: string; label: string }[] =>
  Object.values(PAGES).map((p) => ({ value: p.ari, label: p.title }));

export const log = (state: AppState, message: string): void => {
  state.message = message;
};
