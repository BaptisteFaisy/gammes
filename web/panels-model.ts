/**
 * Gammes — site public : brancher un vrai modèle (§ 23 « sobriété », § 6 « modèle sur l'ambigu »).
 *
 * Le site n'embarque **aucune clé de l'équipe** : par défaut il tourne sur un modèle scripté,
 * hors ligne. Ici le visiteur branche le sien — soit sa propre clé vers un fournisseur qui
 * répond au navigateur, soit un proxy qui garde la clé côté serveur.
 */

import type { AppState } from "./state";
import { applyModel, say } from "./state";
import { badge, button, code, details, field, h, kv, line, note, panel, select, table } from "./dom";
import { effectiveBaseUrl, forgetSettings, isLive, PROVIDERS, providerOf, testConnection, type ModelSettings, type ProviderKey } from "./llm";
import type { Rerender } from "./types";

const STORAGE_NOTE =
  "Ta clé reste dans le localStorage de ton navigateur et n'est envoyée qu'à l'endpoint que tu choisis. " +
  "Le dépôt et le site n'embarquent aucune clé : c'est vérifiable dans le code (web/llm.ts).";

export const modelePanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Modèle réel — OpenCode Zen, InferHub, OpenRouter, proxy");
  const out = h("div", { class: "out" });
  const draft: ModelSettings = { ...state.model };
  root.append(
    note(
      "Le modèle n'intervient que sur la prose ambiguë, la qualification fine, la reformulation des étapes " +
        "non falsifiables et la conciliation des conflits. Tout le reste est déterministe — et le reste " +
        "fonctionne donc sans aucun modèle.",
    ),
    note(STORAGE_NOTE, "info"),
    line(
      select(
        PROVIDERS.map((p) => ({ value: p.key, label: p.label })),
        (v) => {
          draft.provider = v as ProviderKey;
          const provider = providerOf(draft.provider);
          if (!draft.baseUrl || PROVIDERS.some((p) => p.baseUrl === draft.baseUrl)) draft.baseUrl = provider.baseUrl;
          if (!draft.model || draft.model.startsWith("fake/")) draft.model = provider.models[0] ?? "";
          showProviderNote(out, draft);
        },
        draft.provider,
      ),
    ),
    field("URL de base (OpenAI-compatible)", draft.baseUrl || providerOf(draft.provider).baseUrl, (v) => { draft.baseUrl = v; }),
    field("Modèle", draft.model, (v) => { draft.model = v; }),
    field("Clé d'API (la tienne — stockage local uniquement)", draft.apiKey, (v) => { draft.apiKey = v; }),
    field("Proxy (facultatif, garde la clé côté serveur)", draft.proxyUrl, (v) => { draft.proxyUrl = v; }, "https://mon-proxy.example/v1"),
    line(
      button("Tester la connexion", () => void probe(draft, out), "primary"),
      button("Appliquer à l'atelier", () => { applyModel(state, draft); say(state, `Moteur appliqué : ${describe(draft)}`); rerender(); }),
      button("Revenir au modèle scripté", () => { applyModel(state, { provider: "scripted", baseUrl: "", model: "fake/gammes-deterministic", apiKey: "", proxyUrl: "" }); forgetSettings(); rerender(); }, "warn"),
    ),
    out,
  );
  showProviderNote(out, draft);
  root.append(statusBlock(state), callsBlock(state), proxyHowTo());
  return root;
};

const describe = (settings: ModelSettings): string =>
  isLive(settings)
    ? `${providerOf(settings.provider).label} · ${settings.model || "(modèle du serveur)"} · ${effectiveBaseUrl(settings)}${settings.proxyUrl ? " (via proxy)" : ""}`
    : "modèle scripté (hors ligne, déterministe)";

const showProviderNote = (out: HTMLElement, draft: ModelSettings): void => {
  const provider = providerOf(draft.provider);
  out.replaceChildren(
    note(provider.note, provider.browserDirect ? "info" : "ko"),
    kv("fournisseur", provider.label),
    kv("appel direct depuis le navigateur", provider.browserDirect ? badge("oui (CORS ouvert)", "ok") : badge("non — proxy requis", "ko")),
    kv("clé requise", provider.needsKey ? "oui" : "non"),
    kv("modèles connus", provider.models.join(", ")),
  );
};

const probe = async (draft: ModelSettings, out: HTMLElement): Promise<void> => {
  const result = await testConnection(draft);
  out.append(
    result.ok
      ? note(`Connexion établie. ${result.detail}${result.model ? ` (modèle annoncé : ${result.model})` : ""}`, "ok")
      : note(`Échec — ${result.detail}`, "ko"),
  );
};

const statusBlock = (state: AppState): HTMLElement => {
  const budget = state.budget.snapshot();
  return details(
    "État courant du moteur et budget consommé",
    kv("moteur actif", h("code", {}, state.deps.llm.name)),
    kv("réglage enregistré", describe(state.model)),
    kv("appels au modèle", String(budget.llmCalls)),
    kv("jetons", String(budget.tokens)),
    kv("coût estimé (centimes)", String(budget.costEstimate)),
    note("Chaque appel est caché par empreinte de contenu : la même page recompilée ne rappelle pas le modèle.", "info"),
  );
};

const callsBlock = (state: AppState): HTMLElement =>
  details(
    `Journal des appels au modèle (${state.modelLog.length})`,
    state.modelLog.length === 0
      ? note("Aucun appel pour l'instant. Le modèle n'est appelé que sur la prose ambiguë, la reformulation et la conciliation.", "info")
      : table(
          ["Heure", "Tâche", "Modèle", "Jetons in/out", "Cache", "Issue"],
          state.modelLog.map((c) => [
            c.at.slice(11, 19),
            h("code", {}, c.task),
            c.model,
            `${c.tokensIn}/${c.tokensOut}`,
            c.cached ? badge("servi du cache", "ok") : "—",
            c.ok ? badge("ok", "ok") : badge(c.error?.slice(0, 60) ?? "échec", "ko"),
          ]),
        ),
  );

/** Le mode d'emploi du proxy, recopié tel quel — c'est la voie OpenCode Zen. */
export const proxyHowTo = (): HTMLElement =>
  details(
    "Lancer le proxy (nécessaire pour OpenCode Zen)",
    code(
      [
        "# 1. clé côté serveur, jamais dans le navigateur",
        "export GAMMES_LLM_KEY=…                      # clé OpenCode Zen ou InferHub",
        "export GAMMES_LLM_UPSTREAM=https://opencode.ai/zen/v1",
        "export GAMMES_LLM_MODEL=claude-haiku-4-5",
        "",
        "# 2. écoute locale",
        "python3 scripts/llm-proxy.py --port 8899",
        "",
        "# 3. exposition publique au choix (accord explicite requis)",
        "tailscale funnel 8899 on     # → https://<hote>.ts.net",
        "",
        "# 4. dans le site : champ « Proxy » = https://<hote>.ts.net/v1",
      ].join("\n"),
    ),
    note(
      "Le proxy ajoute les en-têtes CORS, borne les jetons (2 048 par défaut), limite à 20 requêtes/minute " +
        "par client et refuse toute origine hors liste. Un proxy public sans ces garde-fous est une pompe à crédits.",
      "info",
    ),
  );
