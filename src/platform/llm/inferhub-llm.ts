/**
 * Gammes — client LLM « InferHub » (OpenAI-compatible), pour le harness local.
 *
 * Deux voies de modèle dans le produit :
 * - dans Forge : le LLM hébergé (`llm:` au manifeste, adaptateur `forge-hosted-llm`) ;
 * - hors Forge (démo locale, conciliateur de conflits) : un endpoint
 *   OpenAI-compatible, par défaut **InferHub** (`https://api.inferhub.dev/v1`).
 *
 * La clé ne vient QUE de l'environnement (`INFERHUB_API_KEY`) : jamais commitée,
 * jamais stockée en base, jamais écrite dans une trace (§ 23 « sécurité »).
 */

import type { LlmBudget, LlmClient, LlmRequest, LlmResponse } from "../../core/ports";
import { systemFor } from "./prompts";

export type InferHubOptions = {
  readonly baseUrl?: string;
  readonly model?: string;
  readonly apiKey?: string;
  readonly budget?: LlmBudget;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
};

type ChatCompletion = {
  choices?: readonly { readonly message?: { readonly content?: string } }[];
  usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number };
  model?: string;
};

type Ctx = {
  baseUrl: string;
  model: string;
  apiKey: string;
  doFetch: typeof fetch;
  signal: AbortSignal;
};

const postChat = async (req: LlmRequest, ctx: Ctx): Promise<LlmResponse> => {
  const res = await ctx.doFetch(`${ctx.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    signal: ctx.signal,
    headers: {
      "content-type": "application/json",
      ...(ctx.apiKey ? { authorization: `Bearer ${ctx.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: ctx.model,
      messages: [
        { role: "system", content: systemFor(req.task) },
        { role: "user", content: req.prompt },
      ],
      max_tokens: req.maxTokens ?? 2048,
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as ChatCompletion;
  return {
    text: body.choices?.[0]?.message?.content ?? "",
    model: body.model ?? ctx.model,
    tokensIn: body.usage?.prompt_tokens ?? 0,
    tokensOut: body.usage?.completion_tokens ?? 0,
    cached: false,
  };
};

/**
 * Lecture d'environnement sûre : le même adaptateur sert dans Forge, dans le harness Node
 * et dans le navigateur (site public), où `process` n'existe pas.
 */
const env = (name: string): string | undefined => {
  const holder = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return holder?.env?.[name];
};

export const inferHubLlm = (options: InferHubOptions = {}): LlmClient & {
  readonly cacheSize: () => number;
} => {
  const baseUrl = options.baseUrl ?? env("LLM_BASE_URL") ?? "https://api.inferhub.dev/v1";
  const model = options.model ?? env("LLM_MODEL") ?? "combo/cheap";
  const apiKey = options.apiKey ?? env("INFERHUB_API_KEY") ?? "";
  // `fetch` détaché de son hôte perd son `this` et lève « Illegal invocation » dans un
  // navigateur : on passe par une flèche, pas par la référence nue.
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const cache = new Map<string, LlmResponse>();

  return {
    name: `inferhub:${model}`,
    cacheSize: () => cache.size,
    complete: async (req: LlmRequest): Promise<LlmResponse> => {
      const key = req.cacheKey ? `${req.task}:${req.cacheKey}` : undefined;
      const hit = key ? cache.get(key) : undefined;
      if (hit) return { ...hit, cached: true };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);
      let res: LlmResponse;
      try {
        res = await postChat(req, { baseUrl, model, apiKey, doFetch, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      options.budget?.record(req.task, res);
      if (key) cache.set(key, res);
      return res;
    },
  };
};
