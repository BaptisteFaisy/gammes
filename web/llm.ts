/**
 * Gammes — site public : brancher un vrai modèle.
 *
 * Par défaut le site tourne sur un modèle **scripté** : déterministe, sans réseau, sans clé.
 * C'est ce qui permet à une démo publique de ne dépendre de personne — et de ne fuir aucune clé.
 *
 * Pour passer sur un vrai modèle, deux voies, et une seule règle (aucune clé de l'équipe
 * n'est jamais embarquée dans un site public) :
 *
 * 1. **Ta propre clé** (BYO) : collée ici, stockée dans `localStorage` de ton navigateur
 *    uniquement, envoyée au fournisseur que tu as choisi. Fonctionne directement avec un
 *    fournisseur qui répond au navigateur (CORS) — InferHub et OpenRouter le font.
 * 2. **Un proxy** (`scripts/llm-proxy.py`) : la clé reste côté serveur, le proxy ajoute les
 *    en-têtes CORS, borne les jetons et limite le débit. Indispensable pour **OpenCode Zen**,
 *    qui ne renvoie aucun `Access-Control-Allow-*` sur POST : depuis un navigateur, la réponse
 *    est bloquée quelle que soit la clé.
 *
 * Le client lui-même n'est pas réécrit ici : c'est `src/platform/llm/inferhub-llm.ts`
 * (OpenAI-compatible) — une seule implémentation, trois moteurs.
 */

import { inferHubLlm } from "../src/platform/llm/inferhub-llm";
import { scriptedLlm } from "../src/platform/llm/fake-llm";
import type { LlmBudget, LlmClient, LlmRequest, LlmResponse, LlmTask } from "../src/core/ports";

export type ProviderKey = "auto" | "scripted" | "opencode" | "inferhub" | "openrouter" | "custom";

/**
 * Proxys connus, sondés au démarrage. Si l'un répond, le site passe **tout seul** sur un vrai
 * modèle, sans que le visiteur ait une clé à coller. La réponse doit se présenter
 * (`service: "gammes-llm-proxy"`) : un 200 HTML quelconque n'est pas un proxy.
 */
export const PROXY_CANDIDATES: readonly string[] = ["https://r630-debian.tail3a8bdf.ts.net/gammes-llm/v1"];

export type Provider = {
  readonly key: ProviderKey;
  readonly label: string;
  readonly baseUrl: string;
  readonly models: readonly string[];
  readonly needsKey: boolean;
  /** Le fournisseur répond-il directement au navigateur (en-têtes CORS sur POST) ? */
  readonly browserDirect: boolean;
  readonly note: string;
};

export const PROVIDERS: readonly Provider[] = [
  {
    key: "auto",
    label: "Automatique (proxy du dépôt s'il répond, sinon scripté)",
    baseUrl: "",
    models: [],
    needsKey: false,
    browserDirect: true,
    note: "Sonde les proxys connus au démarrage : s'il y en a un, le modèle est réel et aucune clé n'est demandée.",
  },
  {
    key: "scripted",
    label: "Modèle scripté (défaut, hors ligne)",
    baseUrl: "",
    models: ["fake/gammes-deterministic"],
    needsKey: false,
    browserDirect: true,
    note: "Réponses figées : la démo publique tourne sans clé, sans réseau, sans coût.",
  },
  {
    key: "opencode",
    label: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    models: ["claude-haiku-4-5", "claude-sonnet-4-5", "big-pickle", "deepseek-v4.1-flash-free"],
    needsKey: true,
    browserDirect: false,
    note: "Aucun en-tête CORS sur POST, et les modèles -free renvoient 429 FreeUsageLimitError : passer par le proxy.",
  },
  {
    key: "inferhub",
    label: "InferHub",
    baseUrl: "https://api.inferhub.dev/v1",
    models: ["combo/cheap", "ali/qwen3.8-max-0903"],
    needsKey: true,
    browserDirect: true,
    note: "OpenAI-compatible, CORS ouvert (Access-Control-Allow-Origin: *) : appel direct possible avec TA clé.",
  },
  {
    key: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: ["anthropic/claude-3.5-haiku", "openai/gpt-4o-mini"],
    needsKey: true,
    browserDirect: true,
    note: "OpenAI-compatible, CORS ouvert : appel direct possible avec TA clé.",
  },
  {
    key: "custom",
    label: "Endpoint personnalisé (proxy, vLLM, Ollama…)",
    baseUrl: "http://127.0.0.1:8899/v1",
    models: ["(celui du serveur)"],
    needsKey: false,
    browserDirect: true,
    note: "Tout endpoint OpenAI-compatible — dont scripts/llm-proxy.py, qui garde la clé côté serveur.",
  },
];

export type ModelSettings = {
  provider: ProviderKey;
  baseUrl: string;
  model: string;
  apiKey: string;
  proxyUrl: string;
};

export type ModelCall = {
  readonly at: string;
  readonly task: LlmTask;
  readonly model: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly cached: boolean;
  readonly ok: boolean;
  readonly error?: string;
};

const STORAGE_KEY = "gammes.modele.v1";

export const defaultSettings = (): ModelSettings => ({
  provider: "auto",
  baseUrl: "",
  model: "",
  apiKey: "",
  proxyUrl: "",
});

export const loadSettings = (): ModelSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<ModelSettings>;
    const base = defaultSettings();
    return {
      provider: (parsed.provider ?? base.provider) as ProviderKey,
      baseUrl: parsed.baseUrl ?? base.baseUrl,
      model: parsed.model ?? base.model,
      apiKey: parsed.apiKey ?? "",
      proxyUrl: parsed.proxyUrl ?? "",
    };
  } catch {
    return defaultSettings();
  }
};

export const saveSettings = (settings: ModelSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* stockage indisponible (mode privé) : la session reste valable, sans persistance */
  }
};

export const forgetSettings = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* rien à oublier */
  }
};

export const isLive = (settings: ModelSettings): boolean =>
  settings.provider !== "scripted" && settings.provider !== "auto";

export type ProxyProbe = { readonly url: string; readonly model: string };

/** Sonde un proxy : il doit se nommer, sinon ce n'est pas lui (un 200 HTML ne suffit pas). */
export const probeProxy = async (baseUrl: string, timeoutMs = 6000): Promise<ProxyProbe | undefined> => {
  const url = `${baseUrl.replace(/\/+$/, "")}/../healthz`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(new URL(url).toString(), { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return undefined;
    const body = (await res.json()) as { service?: string; modele_impose?: string; ok?: boolean };
    return body.service === "gammes-llm-proxy" && body.ok
      ? { url: baseUrl.replace(/\/+$/, ""), model: body.modele_impose ?? "" }
      : undefined;
  } catch {
    return undefined;
  }
};

/** Résout « auto » en un réglage concret : proxy trouvé, sinon modèle scripté. */
export const resolveSettings = async (settings: ModelSettings): Promise<{ settings: ModelSettings; detected?: string }> => {
  if (settings.provider !== "auto") return { settings };
  const candidates = settings.proxyUrl ? [settings.proxyUrl, ...PROXY_CANDIDATES] : [...PROXY_CANDIDATES];
  for (const candidate of candidates) {
    const found = await probeProxy(candidate);
    if (found) {
      return {
        settings: { provider: "custom", baseUrl: "", model: found.model, apiKey: "", proxyUrl: found.url },
        detected: `${found.url} · modèle imposé ${found.model || "(libre)"}`,
      };
    }
  }
  return { settings: { ...defaultSettings(), provider: "scripted", model: "fake/gammes-deterministic" } };
};

/** L'URL réellement appelée : le proxy gagne, sinon l'endpoint du fournisseur. */
export const effectiveBaseUrl = (settings: ModelSettings): string => {
  const raw = settings.proxyUrl.trim() || settings.baseUrl.trim() || providerOf(settings.provider).baseUrl;
  return raw.replace(/\/+$/, "");
};

export const providerOf = (key: ProviderKey): Provider =>
  PROVIDERS.find((p) => p.key === key) ?? PROVIDERS[0]!;

/** Réponses scriptées : ce que la démo publique raconte quand aucun modèle n'est branché. */
const scripted = (): LlmClient =>
  scriptedLlm({
    extract_prose: JSON.stringify({
      steps: [
        { paragraphIndex: 0, text: "Générer la nouvelle clé dans le coffre", kind: "command" },
        { paragraphIndex: 0, text: "Attendre le rechargement de tous les services", kind: "check" },
        { paragraphIndex: 0, text: "Révoquer l'ancienne clé après validation du responsable", kind: "manual" },
      ],
    }),
    qualify_step: JSON.stringify({ kind: "check", humanOnly: false }),
    reword_falsifiable: JSON.stringify({
      rewording: "Vérifier que /healthz répond 200 et que le taux d'erreur reste sous 1 % pendant 5 minutes",
      observable: "code HTTP et métrique d'erreur",
    }),
    summarize_amendment: JSON.stringify({ summary: "Étape à réécrire : critère de succès observable manquant." }),
    conciliate_conflict: JSON.stringify({
      summary: "Deux gammes prescrivent un nombre d'approbations différent pour le même service.",
      options: [
        { title: "Aligner la variante sur la gamme principale", detail: "Une seule procédure fait foi, l'autre est dépréciée.", affects: [] },
        { title: "Porter les deux au seuil de la politique", detail: "Conforme à la page de politique, coût : une approbation de plus.", affects: [] },
      ],
    }),
    cluster_ghost: JSON.stringify({ clusters: [] }),
  });

/** Journal des appels : ce que le site a vraiment demandé, et ce qui a répondu. */
export const withLog = (inner: LlmClient, sink: ModelCall[]): LlmClient => ({
  name: inner.name,
  complete: async (req: LlmRequest): Promise<LlmResponse> => {
    const at = new Date().toISOString();
    try {
      const res = await inner.complete(req);
      sink.push({ at, task: req.task, model: res.model, tokensIn: res.tokensIn, tokensOut: res.tokensOut, cached: res.cached, ok: true });
      return res;
    } catch (error) {
      sink.push({ at, task: req.task, model: inner.name, tokensIn: 0, tokensOut: 0, cached: false, ok: false, error: (error as Error).message.slice(0, 220) });
      throw error;
    }
  },
});

export const buildLlm = (settings: ModelSettings, budget: LlmBudget, sink: ModelCall[]): LlmClient => {
  if (!isLive(settings)) return withLog(scripted(), sink);
  return withLog(
    inferHubLlm({
      baseUrl: effectiveBaseUrl(settings),
      model: settings.model || providerOf(settings.provider).models[0]!,
      apiKey: settings.apiKey,
      budget,
    }),
    sink,
  );
};

export type ProbeResult = { readonly ok: boolean; readonly detail: string; readonly model?: string };

/** Test de connexion : une seule invite minuscule, et le diagnostic réel (CORS, clé, modèle). */
export const testConnection = async (settings: ModelSettings): Promise<ProbeResult> => {
  if (settings.provider === "auto") {
    const resolved = await resolveSettings(settings);
    return resolved.detected
      ? { ok: true, detail: `Proxy détecté : ${resolved.detected}` }
      : { ok: false, detail: "Aucun proxy connu ne répond : le site resterait sur le modèle scripté. Colle ta clé (InferHub/OpenRouter) ou l'URL d'un proxy." };
  }
  if (!isLive(settings)) return { ok: true, detail: "Modèle scripté : aucun réseau, aucune clé. La démo est déterministe." };
  const url = `${effectiveBaseUrl(settings)}/chat/completions`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {}) },
      body: JSON.stringify({
        model: settings.model || providerOf(settings.provider).models[0],
        messages: [{ role: "user", content: "Réponds exactement: ok" }],
        max_tokens: 8,
      }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status} — ${text.slice(0, 220)}` };
    const parsed = JSON.parse(text) as { model?: string; choices?: { message?: { content?: string } }[] };
    return { ok: true, detail: `Réponse : « ${(parsed.choices?.[0]?.message?.content ?? "").trim().slice(0, 60)} »`, model: parsed.model };
  } catch (error) {
    return { ok: false, detail: diagnose(error, settings) };
  }
};

const diagnose = (error: unknown, settings: ModelSettings): string => {
  const message = (error as Error).message ?? String(error);
  const provider = providerOf(settings.provider);
  if (!provider.browserDirect && !settings.proxyUrl) {
    return `${message} — ${provider.label} ne renvoie pas d'en-tête CORS sur POST : depuis un navigateur, il faut passer par le proxy (scripts/llm-proxy.py) et renseigner son URL.`;
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return `${message} — refus CORS, hôte injoignable, ou contenu mixte (site HTTPS appelant un proxy HTTP).`;
  }
  return message;
};
