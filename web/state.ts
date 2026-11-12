/**
 * Gammes — site public : l'état de la démonstration.
 *
 * Le site utilise **le vrai cœur** du produit (`src/core`) avec le magasin en mémoire :
 * ce qui est montré ici est exactement ce que fait l'app dans Forge, sans Forge.
 * Aucun réseau, aucun secret, aucune donnée réelle — tout vient de `seed/atelier.ts`.
 */

import { PAGES, seedAtelier, seedSettings } from "../seed/atelier";
import type { Deps } from "../src/core/ports";
import type { ActorKind, ActorRef, EvidenceStrength, Gamme, RunOutcome } from "../src/core/types";
import { agent, human } from "../test/helpers";

export const OWNER = "ari:cloud:aaid:demo:ana";
export const AGENT_ID = "ari:cloud:rovo:agent:compagnon";

export type AppState = {
  readonly deps: Deps;
  /** Page Confluence choisie (ARI). */
  page: string;
  /** Gamme choisie (code). */
  gamme?: string;
  /** Version choisie (numéro) — par défaut la courante. */
  version?: number;
  /** Exécution en cours. */
  runId?: string;
  /** Acteur choisi pour les exécutions. */
  actorKind: ActorKind;
  /** Sélection des autres écrans. */
  conflictId?: string;
  ghostId?: string;
  amendmentId?: string;
  projectKey?: string;
  /** Outil MCP sélectionné dans l'écran « Outils MCP ». */
  tool?: string;
  /** Langue d'affichage des exports et des traces. */
  lang?: "fr" | "en";
  /** Filtre du journal d'audit. */
  eventKind?: string;
  /** Geste envisagé, pour « avant d'agir ». */
  intendedAction: string;
  service: string;
  /** Réglages de l'écran « Dérouler ». */
  mode?: "normal" | "emergency";
  emergencyReason?: string;
  ticketRef?: string;
  evidenceStrength?: EvidenceStrength;
  reason?: string;
  outcome?: RunOutcome;
  /** Dernier message d'action, affiché en haut de l'écran. */
  message?: string;
};

export const createState = async (): Promise<AppState> => {
  const { deps } = seedAtelier();
  await seedSettings(deps);
  return {
    deps,
    page: Object.keys(PAGES)[0] ?? "",
    actorKind: "agent",
    intendedAction: "déployer le service paiements en production",
    service: "paiements",
  };
};

export const pageOptions = (): readonly { value: string; label: string }[] =>
  Object.values(PAGES).map((p) => ({ value: p.ari, label: p.title }));

/** L'acteur courant : c'est lui qui décide si un verrou humain tombe ou refuse. */
export const actorOf = (state: AppState): ActorRef =>
  state.actorKind === "human" ? human(OWNER) : agent(AGENT_ID);

export const say = (state: AppState, message: string): void => {
  state.message = message;
};

/** Les gammes connues, pour tous les sélecteurs du site. */
export const gammeOptions = async (state: AppState, filter?: (g: Gamme) => boolean): Promise<readonly { value: string; label: string }[]> => {
  const gammes = await state.deps.store.gammes.list(filter);
  return [
    { value: "", label: "— choisir une gamme —" },
    ...gammes.map((g) => ({ value: g.code, label: `${g.code} · ${g.state} · v${g.currentVersion}` })),
  ];
};
