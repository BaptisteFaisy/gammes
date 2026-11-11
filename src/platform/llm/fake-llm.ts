/**
 * Gammes — faux client LLM, déterministe.
 *
 * Toute la recette (§ 25) tourne sans aucun appel réseau : le modèle n'intervient
 * que sur l'ambigu, et en test il est scripté. Deux formes :
 * - `scriptedLlm` : une réponse par tâche ;
 * - `fakeLlm(responder)` : réponse libre, avec l'historique des invites pour
 *   vérifier que le cœur n'appelle le modèle QUE quand les règles ont échoué.
 */

import type { LlmClient, LlmRequest, LlmResponse, LlmTask } from "../../core/ports";

export type Responder = (req: LlmRequest) => string;

export type RecordingLlm = LlmClient & { readonly calls: readonly LlmRequest[] };

export const fakeLlm = (responder: Responder, model = "fake/gammes-deterministic"): RecordingLlm => {
  const calls: LlmRequest[] = [];
  return {
    name: model,
    calls,
    complete: async (req: LlmRequest): Promise<LlmResponse> => {
      calls.push(req);
      const text = responder(req);
      return {
        text,
        model,
        tokensIn: Math.ceil(req.prompt.length / 4),
        tokensOut: Math.ceil(text.length / 4),
        cached: false,
      };
    },
  };
};

export const scriptedLlm = (
  byTask: Partial<Record<LlmTask, string>>,
  fallback = '{"note":"no scripted answer"}',
): RecordingLlm => fakeLlm((req) => byTask[req.task] ?? fallback);

/** Ne doit jamais être appelé : fait échouer le test si le cœur improvise un appel modèle. */
export const forbiddenLlm = (): LlmClient =>
  fakeLlm((req) => {
    throw new Error(`LLM appelé alors que les règles suffisaient (task=${req.task})`);
  }, "fake/forbidden");
