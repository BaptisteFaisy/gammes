/**
 * Gammes — site public : l'état du moteur, affiché en permanence.
 *
 * Le visiteur doit toujours savoir **qui a répondu** : un modèle scripté déterministe,
 * ou un vrai modèle (et lequel). C'est la même discipline que dans le produit : on ne
 * laisse jamais croire qu'une machine a tranché à la place d'un humain, ni qu'un chiffre
 * sort de nulle part.
 */

import type { AppState } from "./state";
import { effectiveBaseUrl, isLive, providerOf } from "./llm";

export const describeEngine = (state: AppState): string => {
  if (!isLive(state.model)) {
    return "moteur : scripté (hors ligne, déterministe) — branche un vrai modèle dans « 16 · Modèle réel »";
  }
  const budget = state.budget.snapshot();
  const provider = providerOf(state.model.provider);
  const via = state.model.proxyUrl ? "via proxy" : "appel direct";
  return `moteur : ${provider.label} · ${state.deps.llm.name} · ${via} · ${budget.llmCalls} appel(s) · ${budget.tokens} jetons · ${effectiveBaseUrl(state.model)}`;
};

/** Vrai quand un modèle réel est branché : sert à prévenir avant un appel coûteux. */
export const isRealModel = (state: AppState): boolean => isLive(state.model);
