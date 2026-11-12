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

const textOf = (body: ChatCompletion): string =>
  body.choices?.[0]?.message?.content ?? "";

/**
 * Un modèle de raisonnement peut consommer tous les jetons en réflexion : la réponse
 * arrive vide, ou tronquée au milieu d'un JSON. Dans les deux cas, on **retente avec un
 * budget plus large** au lieu de perdre la réponse.
 */
const looksUnusable = (body: ChatCompletion, wantsJson: boolean): boolean => {
  const text = textOf(body).trim();
  if (text.length === 0) return true;
  if (!wantsJson) return false;
  return !(text.startsWith("{") || text.startsWith("[") || text.startsWith("```"));
};

const chatOnce = async (req: LlmRequest, ctx: Ctx, maxTokens: number): Promise<ChatCompletion> => {
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
      max_tokens: maxTokens,
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as ChatCompletion;
};

const postChat = async (req: LlmRequest, ctx: Ctx): Promise<LlmResponse> => {
  const base = req.maxTokens ?? 2048;
  let body = await chatOnce(req, ctx, base);
  for (const factor of [2, 4]) {
    if (!looksUnusable(body, req.json === true)) break;
    body = await chatOnce(req, ctx, Math.min(base * factor, 16384));
  }
  return {
    text: textOf(body),
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
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 150_000);
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
