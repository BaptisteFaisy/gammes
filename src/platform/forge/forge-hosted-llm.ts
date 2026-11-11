/**
 * Gammes — adaptateur LLM hébergé Forge du port `LlmClient` (§ 20, § 22).
 *
 * Même contrat que l'adaptateur InferHub (`inferhub-llm.ts`) : cache par empreinte de
 * contenu, budget enregistré, aucun secret dans l'invite (le masquage unifié est fait
 * en amont par `src/integrations/brief-forge.ts`). Limites respectées : 100 invites
 * par minute et par installation — d'où le cache et la règle « déterministe d'abord ».
 */

import { chat } from "@forge/llm";
import type { LlmBudget, LlmClient, LlmRequest, LlmResponse } from "../../core/ports";
import { HOSTED_MODEL, systemFor } from "../llm/prompts";

type ContentBlock = { readonly type?: string; readonly text?: string };
type HostedResponse = {
  readonly choices?: readonly { readonly message?: { readonly content?: string | readonly ContentBlock[] } }[];
  readonly content?: string | readonly ContentBlock[];
  readonly model?: string;
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly input_tokens?: number;
    readonly output_tokens?: number;
  };
};

export type HostedLlmOptions = {
  readonly model?: string;
  readonly budget?: LlmBudget;
  readonly maxTokens?: number;
};

const asText = (content: string | readonly ContentBlock[] | undefined): string => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((block) => block.text ?? "").join("");
};

const textOf = (res: HostedResponse): string =>
  asText(res.choices?.[0]?.message?.content) || asText(res.content);

const tokensOf = (res: HostedResponse): { tokensIn: number; tokensOut: number } => ({
  tokensIn: res.usage?.prompt_tokens ?? res.usage?.input_tokens ?? 0,
  tokensOut: res.usage?.completion_tokens ?? res.usage?.output_tokens ?? 0,
});

export const forgeHostedLlm = (
  options: HostedLlmOptions = {},
): LlmClient & { readonly cacheSize: () => number } => {
  const model = options.model ?? HOSTED_MODEL;
  const cache = new Map<string, LlmResponse>();

  return {
    name: `forge-hosted:${model}`,
    cacheSize: () => cache.size,
    complete: async (req: LlmRequest): Promise<LlmResponse> => {
      const key = req.cacheKey ? `${req.task}:${req.cacheKey}` : undefined;
      const hit = key ? cache.get(key) : undefined;
      if (hit) return { ...hit, cached: true };
      const res = (await chat({
        model,
        messages: [
          { role: "system", content: systemFor(req.task) },
          { role: "user", content: req.prompt },
        ],
        max_completion_tokens: req.maxTokens ?? options.maxTokens ?? 2048,
      })) as unknown as HostedResponse;
      const tokens = tokensOf(res);
      const response: LlmResponse = {
        text: textOf(res),
        model: res.model ?? model,
        tokensIn: tokens.tokensIn,
        tokensOut: tokens.tokensOut,
        cached: false,
      };
      options.budget?.record(req.task, response);
      if (key) cache.set(key, response);
      return response;
    },
  };
};
