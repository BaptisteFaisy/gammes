/**
 * Gammes — invites système par tâche de modèle, partagées.
 *
 * Les deux adaptateurs (LLM hébergé Forge et InferHub hors Forge) utilisent les
 * mêmes consignes : une seule implémentation par logique, quel que soit le moteur.
 * Chaque tâche répond en JSON strict — le cœur analyse de façon défensive
 * (`src/core/json.ts`) et ne devine jamais ce qu'un modèle n'a pas dit.
 */

import type { LlmTask } from "../../core/ports";

export const SYSTEM_BY_TASK: Readonly<Record<LlmTask, string>> = {
  extract_prose: "Tu extrais les étapes implicites d'une prose de procédure. Réponds en JSON strict.",
  qualify_step: "Tu qualifies une étape : nature, preuve, risque. Réponds en JSON strict.",
  reword_falsifiable: "Tu reformules une étape invérifiable en contrôle falsifiable. JSON strict.",
  summarize_amendment: "Tu synthétises un amendement à partir de traces. JSON strict.",
  conciliate_conflict:
    "Tu prépares un dossier de conciliation entre deux procédures en conflit. Tu ne tranches JAMAIS : tu exposes les options et leurs conséquences. JSON strict.",
  cluster_ghost: "Tu regroupes des tickets semblables en motif de travail répété. JSON strict.",
};

export const systemFor = (task: LlmTask): string => SYSTEM_BY_TASK[task];

/** Modèles hébergés déclarés au manifeste (`llm:`) — Haiku pour rester dans le budget. */
export const HOSTED_MODEL = "claude-3-5-haiku";
