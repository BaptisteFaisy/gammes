/**
 * Gammes — site public : l'état de la démonstration.
 *
 * Le site utilise **le vrai cœur** du produit (`src/core`) avec le magasin en mémoire :
 * ce qui est montré ici est exactement ce que fait l'app dans Forge, sans Forge.
 * Aucune donnée réelle n'est embarquée ; le modèle, lui, peut l'être (écran « Modèle réel »).
 */

import { PAGES, seedAtelier, seedSettings } from "../seed/atelier";
import type { Deps, LlmBudget } from "../src/core/ports";
import type { ActorKind, ActorRef, EvidenceStrength, Gamme, RunOutcome } from "../src/core/types";
import { agent, human } from "../test/helpers";
import { memoryBudget } from "../src/platform/llm/budget";
import { buildLlm, loadSettings, saveSettings, type ModelCall, type ModelSettings } from "./llm";

export const OWNER = "ari:cloud:aaid:demo:ana";
export const AGENT_ID = "ari:cloud:rovo:agent:compagnon";

export type AppState = {
  /** Remplaçable : changer de modèle ne doit pas faire perdre l'atelier en cours. */
  deps: Deps;
  readonly budget: LlmBudget;
  readonly modelLog: ModelCall[];
  model: ModelSettings;
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
  tool?: string;
  lang?: "fr" | "en";
  eventKind?: string;
  /** Contenu réel collé par le visiteur (page Confluence, tickets Jira). */
  realPage?: string;
  realPageTitle?: string;
  realTickets?: string;
  /** Réglages de l'écran « Dérouler ». */
  mode?: "normal" | "emergency";
  emergencyReason?: string;
  ticketRef?: string;
  evidenceStrength?: EvidenceStrength;
  reason?: string;
  outcome?: RunOutcome;
  intendedAction: string;
  service: string;
  message?: string;
};

export const createState = async (): Promise<AppState> => {
  const model = loadSettings();
  const budget = memoryBudget(new Date().toISOString().slice(0, 10));
  const modelLog: ModelCall[] = [];
  const { deps } = seedAtelier({ llm: buildLlm(model, budget, modelLog) });
  await seedSettings(deps);
  return {
    deps,
    budget,
    modelLog,
    model,
    page: Object.keys(PAGES)[0] ?? "",
    actorKind: "agent",
    intendedAction: "déployer le service paiements en production",
    service: "paiements",
  };
};

/**
 * Change de moteur de modèle **sans réinitialiser l'atelier** : seul le port `llm` est
 * remplacé, le magasin (gammes, versions, exécutions, traces) est conservé tel quel.
 */
export const applyModel = (state: AppState, settings: ModelSettings): void => {
  saveSettings(settings);
  state.modelLog.length = 0;
  state.model = settings;
  state.deps = { ...state.deps, llm: buildLlm(settings, state.budget, state.modelLog) };
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
export const gammeOptions = async (
  state: AppState,
  filter?: (g: Gamme) => boolean,
): Promise<readonly { value: string; label: string }[]> => {
  const gammes = await state.deps.store.gammes.list(filter);
  return [
    { value: "", label: "— choisir une gamme —" },
    ...gammes.map((g) => ({ value: g.code, label: `${g.code} · ${g.state} · v${g.currentVersion}` })),
  ];
};
