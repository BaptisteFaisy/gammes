/**
 * Gammes — site public : « Outils MCP ».
 *
 * § 18, GA-14 : les seize outils, leurs schémas d'entrée, et un appelant interactif qui
 * exécute **le vrai dispatch** (`handleTool`). Un seul jeu d'outils sert toutes les gammes :
 * le contenu vient de la base, pas du manifeste. Aucun outil ne renvoie de secret, aucun
 * n'accepte une attestation humaine au nom d'un agent, et `record-step` renvoie le refus
 * du verrou comme un résultat — pas comme une exception.
 */

import type { AppState } from "./state";
import { badge, button, code, details, h, kv, line, note, panel, select, table } from "./dom";
import { handleTool, MCP_TOOLS, type McpToolKey } from "../src/core/mcp/tools";
import type { Rerender } from "./types";

const examples = (gammeCode: string): Record<string, string> => ({
  "find-procedure": JSON.stringify({ query: "déployer paiements", context: { service: "paiements" } }, null, 2),
  "check-before-acting": JSON.stringify({ intendedAction: "déployer le service paiements en production", service: "paiements" }, null, 2),
  "get-procedure": JSON.stringify({ code: gammeCode }, null, 2),
  "list-procedures": JSON.stringify({ state: "approved" }, null, 2),
  "start-run": JSON.stringify({ code: gammeCode, inputs: { service: "paiements", version_cible: "1.8.2" }, actorId: "ari:cloud:rovo:agent:compagnon", actorKind: "agent" }, null, 2),
  "get-current-step": JSON.stringify({ runId: "run_1" }, null, 2),
  "record-step": JSON.stringify(
    {
      runId: "run_1",
      stepId: "stp_1",
      outcome: "done",
      evidence: { kind: "command_output", strength: "machine", ref: "https://ci.example.internal/build/42", capturedAt: "2026-11-11T09:00:00.000Z" },
      actorId: "ari:cloud:rovo:agent:compagnon",
      actorKind: "agent",
    },
    null,
    2,
  ),
  "report-deviation": JSON.stringify({ runId: "run_1", stepId: "stp_1", whatHappened: "vérifié à la main", why: "CI indisponible", actorId: "ari:cloud:aaid:demo:ana", actorKind: "human" }, null, 2),
  "finish-run": JSON.stringify({ runId: "run_1", outcome: "succeeded", notes: "clos depuis la démo" }, null, 2),
  "get-run-trace": JSON.stringify({ runId: "run_1" }, null, 2),
  "get-procedure-stats": JSON.stringify({ code: gammeCode }, null, 2),
  "propose-amendment": JSON.stringify({ code: gammeCode, proposal: "Clarifier le critère de succès", rationale: "échecs répétés observés dans les traces" }, null, 2),
  "compile-page": JSON.stringify({ pageAri: "ari:page/rotation", confirmedById: "ari:cloud:aaid:demo:ana" }, null, 2),
  "export-skill": JSON.stringify({ code: gammeCode }, null, 2),
  "get-missing-procedures": JSON.stringify({ projectKey: "PAY", limit: 10 }, null, 2),
  "get-conflicts": JSON.stringify({ service: "paiements" }, null, 2),
});

export const mcpPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Outils MCP (§ 18 · GA-14)");
  const out = h("div", { class: "out" });
  const toolSelect = select(
    MCP_TOOLS.map((t) => ({ value: t.key, label: `${t.key} (${t.verb})` })),
    (v) => { state.tool = v as McpToolKey; fillExample(state, argsArea); },
    state.tool ?? "check-before-acting",
  );
  const argsArea = h("textarea", { class: "input area big", rows: "10" }) as HTMLTextAreaElement;
  root.append(
    note("Même dispatch pour Rovo, un orchestrateur maison, un agent tiers et le webtrigger signé. Lecture = GET, écriture = CREATE/UPDATE."),
    h("h3", {}, `Les ${MCP_TOOLS.length} outils`),
    table(
      ["Outil", "Verbe", "Ce qu'il fait", "Entrées"],
      MCP_TOOLS.map((t) => [
        h("code", {}, t.key),
        badge(t.verb, t.verb === "GET" ? "ok" : t.verb === "CREATE" ? "warn" : "idle"),
        t.description,
        Object.entries(t.inputProperties).map(([name, spec]) => `${name}:${spec.type}`).join(", "),
      ]),
    ),
    h("h3", {}, "Appeler un outil"),
    line(toolSelect, button("Exécuter", () => void call(state, argsArea.value, out), "primary")),
    argsArea,
    out,
  );
  void fillGammeExample(state, argsArea, toolSelect);
  return root;
};

const fillExample = (state: AppState, area: HTMLTextAreaElement): void => {
  const all = examples(state.gamme ?? "GAM-deployer-service-paiements-01");
  area.value = all[state.tool ?? "check-before-acting"] ?? "{}";
};

const fillGammeExample = async (state: AppState, area: HTMLTextAreaElement, toolSelect: HTMLSelectElement): Promise<void> => {
  if (!state.gamme) {
    const gammes = await state.deps.store.gammes.list();
    state.gamme = gammes[0]?.code;
  }
  state.tool = (toolSelect.value || "check-before-acting") as McpToolKey;
  fillExample(state, area);
};

const call = async (state: AppState, rawArgs: string, out: HTMLElement): Promise<void> => {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs || "{}") as Record<string, unknown>;
  } catch {
    out.replaceChildren(note("Arguments JSON invalides.", "ko"));
    return;
  }
  const key = (state.tool ?? "check-before-acting") as McpToolKey;
  const res = await handleTool(state.deps, key, args);
  out.replaceChildren(h("h3", {}, `Résultat de ${key}`));
  if (!res.ok) {
    out.append(
      note(`Refus — ${res.error.code}`, "ko"),
      kv("message (fr)", res.error.messageFr),
      kv("message (en)", res.error.messageEn),
      kv("verrou ?", res.error.lockRefusal ? badge("oui — la tentative sera tracée", "ko") : badge("non", "idle")),
      details("Détails", code(JSON.stringify(res.error.details ?? {}, null, 2))),
    );
    return;
  }
  const serialized = JSON.stringify(res.value, null, 2);
  out.append(
    note("Résultat — aucun secret n'y figure, jamais.", "ok"),
    details(`JSON (${serialized.length} caractères)`, code(serialized)),
    invariantsCheck(serialized),
  );
};

/** Contrôle affiché à chaque appel : les invariants du § 18, vérifiés sous les yeux. */
const invariantsCheck = (serialized: string): HTMLElement => {
  const checks: [string, boolean][] = [
    ["aucune valeur de secret (AKIA…, sk-…, ghp_…)", !/AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}/.test(serialized)],
    ["aucune clé nommant une personne (assignee, byRef…)", !/"(?:assignee|actorName|personName|userLogin)"/i.test(serialized)],
    ["réponse bornée (pas de procédure de 3 000 lignes d'un bloc)", serialized.length < 200_000],
  ];
  return h(
    "div",
    {},
    h("h4", {}, "Invariants vérifiés sur cette réponse"),
    table(["Invariant", "Respecté"], checks.map(([label, pass]) => [label, pass ? badge("oui", "ok") : badge("NON", "ko")])),
  );
};
