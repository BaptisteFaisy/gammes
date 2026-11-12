/**
 * Gammes — site public : « Avant d'agir ».
 *
 * La démonstration la plus parlante du produit (§ 15) : un agent demande s'il existe une
 * procédure avant un geste sensible. Sans gamme approuvée, l'app le dit et l'agent
 * **n'improvise pas**. Avec une gamme à verrou, l'app renvoie la demande de permis.
 * C'est le même verdict que celui du `webtrigger` signé et des outils MCP.
 */

import type { AppState } from "./state";
import { badge, button, code, details, field, h, kv, line, list, note, panel, table, toneOf } from "./dom";
import { checkBeforeActing, findProcedure } from "../src/core/mcp/search";
import { tokensOf } from "../src/core/text/tokens";
import { getVersion } from "../src/core/version/versioning";
import { evaluateStepLocks } from "../src/core/locks/locks";
import { agent, human } from "../test/helpers";
import { OWNER } from "./state";
import type { Rerender } from "./types";

const PRESET_ACTIONS: readonly { action: string; service: string; label: string }[] = [
  { action: "déployer le service paiements en production", service: "paiements", label: "déployer paiements en production" },
  { action: "supprimer l'espace de noms staging avec kubectl delete", service: "staging", label: "kubectl delete ns staging" },
  { action: "tourner la clé de signature des jetons", service: "paiements", label: "rotation de clé" },
  { action: "redémarrer le routeur de secours à 3 h du matin", service: "reseau", label: "geste sensible sans procédure" },
];

export const beforeActingPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Avant d'agir — « existe-t-il une procédure pour ce que je m'apprête à faire ? »");
  const out = h("div", { class: "out" });
  root.append(
    note("Même verdict partout : outil MCP `check-before-acting`, `webtrigger` signé pour le CI, et cet écran. L'app ne laisse personne improviser un geste sensible."),
    field("Geste envisagé", state.intendedAction, (v) => { state.intendedAction = v; }),
    field("Service", state.service, (v) => { state.service = v; }),
    line(
      button("Vérifier avant d'agir", () => void check(state, out), "primary"),
      button("Chercher les gammes proches", () => void search(state, out)),
    ),
    h("h3", {}, "Exemples à essayer"),
    ...PRESET_ACTIONS.map((p) =>
      line(
        button(p.label, () => {
          state.intendedAction = p.action;
          state.service = p.service;
          void check(state, out);
        }),
        h("span", { class: "muted" }, p.action),
      ),
    ),
    out,
  );
  return root;
};

const check = async (state: AppState, out: HTMLElement): Promise<void> => {
  const verdict = await checkBeforeActing(state.deps, {
    intendedAction: state.intendedAction,
    service: state.service || undefined,
  });
  out.replaceChildren(
    h("h3", {}, "Verdict"),
    verdict.found ? badge("gamme trouvée", "ok") : badge("aucune gamme approuvée", "ko"),
    kv("gamme", verdict.code ?? "—"),
    kv("version", verdict.version ? `v${verdict.version}` : "—"),
    kv("état", verdict.state ? badge(verdict.state, toneOf(verdict.state)) : "—"),
    kv("risque", verdict.risk ?? "—"),
    kv("permis requis", verdict.permitRequired ? badge("oui", "warn") : badge("non", "ok")),
    kv("verrous", verdict.locks?.length ? list(verdict.locks.map((l) => `${l.kind} — ${l.reason}`)) : "aucun"),
    note(verdict.messageFr, verdict.found && verdict.state === "approved" ? "ok" : "ko"),
    note(verdict.messageEn, "info"),
  );
  if (verdict.found && verdict.code) out.append(await lockDetail(state, verdict.code, verdict.version));
  out.append(details("Mots-clés extraits de la demande", code(tokensOf(state.intendedAction).join(" ") || "—")));
};

const lockDetail = async (state: AppState, code_: string, version?: number): Promise<HTMLElement> => {
  const res = await getVersion(state.deps, code_, version);
  if (!res.ok) return note(res.error.messageFr, "ko");
  const scope = state.service || "inconnu";
  const rows: (string | HTMLElement)[][] = [];
  for (const step of res.value.steps) {
    const asAgent = await evaluateStepLocks(state.deps, { step, actor: agent(), scope });
    const asHuman = await evaluateStepLocks(state.deps, { step, actor: human(OWNER), scope });
    rows.push([
      `${step.ord}. ${step.text.slice(0, 46)}`,
      step.riskClass ?? "—",
      asHuman.allowed ? badge("passe", "ok") : badge(asHuman.refusal?.code ?? "refus", "ko"),
      asAgent.allowed ? badge("passe", "ok") : badge(asAgent.refusal?.code ?? "refus", "ko"),
    ]);
  }
  return details(
    "Ce que chaque verrou fait, pour un humain et pour un agent",
    table(["Étape", "Classe de risque", "Humain", "Agent"], rows),
  );
};

const search = async (state: AppState, out: HTMLElement): Promise<void> => {
  const matches = await findProcedure(state.deps, {
    query: state.intendedAction,
    context: { service: state.service || undefined, action: state.intendedAction },
  });
  out.replaceChildren(
    h("h3", {}, `Gammes candidates (${matches.length})`),
    matches.length
      ? table(
          ["Confiance", "Gamme", "État", "Version", "Raisons"],
          matches.map((m) => [
            m.confidence.toFixed(2),
            h("strong", {}, m.code),
            badge(m.state, toneOf(m.state)),
            `v${m.version}`,
            list(m.reasons),
          ]),
        )
      : note("Aucune gamme ne correspond. L'app ne devine pas : elle le dit.", "ko"),
  );
};
