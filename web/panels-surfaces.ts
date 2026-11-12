/**
 * Gammes — site public : « Encarts », « Journal » et « Réglages ».
 *
 * GA-16/17 : l'encart sur le ticket Jira (quelle gamme s'applique, la démarrer, les traces
 * liées) et la macro dans la page source (état, version, exécutions, fraîcheur) — la page
 * dit elle-même si elle est outillée. Le journal est l'audit continu (§ 30) : chaque acte
 * d'autorité est daté, nommé, en append-only. Les réglages d'espace pilotent les seuils.
 */

import type { AppState } from "./state";
import { say } from "./state";
import { badge, button, code, details, field, h, kv, line, list, note, panel, select, table, toneOf } from "./dom";
import { findProcedure } from "../src/core/mcp/search";
import { getGammeByCode } from "../src/core/version/versioning";
import { freshness } from "../src/core/stats/workshop";
import { DEFAULT_RISK_MOTIFS } from "../src/core/risk/risk-motifs";
import { sealEvents, verifySeal } from "../src/core/audit/journal-seal";
import { DEFAULT_SECRET_DETECTORS } from "../src/core/secrets/detectors";
import { DEFAULT_THRESHOLD } from "../src/core/stats/rates";
import { PAGES, TICKETS } from "../seed/atelier";
import type { SpaceSettings } from "../src/core/types";
import type { DomainEvent } from "../src/core/ports";
import type { Rerender } from "./types";

/** L'encart sur le ticket Jira : quelle gamme s'applique, et quelles traces existent. */
export const encartsPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Encart Jira et macro Confluence (GA-16/17)");
  const out = h("div", { class: "out" });
  root.append(
    h("h3", {}, "Encart sur le ticket Jira (jira:issuePanel)"),
    line(
      select(
        TICKETS.slice(0, 12).map((t) => ({ value: t.key, label: `${t.key} — ${t.summary}` })),
        (v) => { state.ticketRef = v; },
        state.ticketRef,
      ),
      button("Quelle gamme s'applique ?", () => void issuePanel(state, out), "primary"),
    ),
    h("h3", {}, "Macro dans la page source (confluence:macro)"),
    line(
      select(
        Object.values(PAGES).map((p) => ({ value: p.ari, label: p.title })),
        (v) => { state.page = v; },
        state.page,
      ),
      button("Afficher la macro", () => void macro(state, out), "primary"),
    ),
    out,
  );
  return root;
};

const issuePanel = async (state: AppState, out: HTMLElement): Promise<void> => {
  const ticket = TICKETS.find((t) => t.key === state.ticketRef) ?? TICKETS[0]!;
  const matches = await findProcedure(state.deps, { query: ticket.summary, context: { service: ticket.components[0] } });
  const runs = await state.deps.store.runs.list((r) => r.ticketRef === ticket.key);
  const box = h("div", { class: "encart" });
  out.replaceChildren(box);
  box.append(
    h("h4", {}, `Gammes · ${ticket.key}`),
    kv("ticket", `${ticket.summary} (${ticket.projectKey})`),
    matches.length
      ? table(
          ["Gamme", "État", "Version", "Confiance", "Raisons"],
          matches.map((m) => [h("strong", {}, m.code), badge(m.state, toneOf(m.state)), `v${m.version}`, m.confidence.toFixed(2), list(m.reasons)]),
        )
      : note("Aucune gamme approuvée pour ce ticket. Ne pas improviser : proposer de compiler la page.", "ko"),
    h("h4", {}, `Traces liées à ce ticket (${runs.length})`),
    runs.length
      ? table(["Exécution", "Gamme", "Version", "Acteur", "Issue"], runs.map((r) => [r.id, r.code, `v${r.pinnedVersion}`, r.actor.kind, r.outcome ?? "en cours"]))
      : note("Aucune exécution rattachée.", "info"),
  );
};

const macro = async (state: AppState, out: HTMLElement): Promise<void> => {
  const page = PAGES[state.page];
  if (!page) return;
  const binding = (await state.deps.store.bindings.list((b) => b.pageAri === page.ari))[0];
  const box = h("div", { class: "encart" });
  out.append(box);
  if (!binding) {
    box.append(h("h4", {}, "Gammes · cette page"), note("Cette page n'est pas outillée : aucune gamme compilée. Action disponible : « compiler en gamme ».", "info"));
    return;
  }
  const gamme = await state.deps.store.gammes.get(binding.gammeId);
  const runs = await state.deps.store.runs.list((r) => r.gammeId === binding.gammeId);
  const fresh = await freshness(state.deps);
  box.append(
    h("h4", {}, "Gammes · cette page est outillée"),
    kv("gamme", h("strong", {}, gamme?.code ?? binding.gammeId)),
    kv("état", gamme ? badge(gamme.state, toneOf(gamme.state)) : "—"),
    kv("version", `v${gamme?.currentVersion ?? 0}`),
    kv("exécutions", String(runs.length)),
    kv("liaison", badge(binding.sync, toneOf(binding.sync))),
    kv("fraîcheur de l'atelier", `${fresh.syncedPct} % synchronisées`),
    note("La page dit elle-même si elle est outillée — c'est tout l'intérêt de la macro.", "info"),
  );
};

/** Le journal d'audit : append-only, chaque acte d'autorité est daté et nommé. */
export const journalPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Journal d'audit — l'audit continu (§ 30)");
  const out = h("div", { class: "out" });
  root.append(
    note("Aucune ligne n'est modifiée ni supprimée : déprécier n'est pas effacer. « Quelle procédure, quelle version, quelle preuve, quel acteur » est une requête, pas une fouille."),
    line(
      select(
        [{ value: "", label: "tous les événements" }, ...KINDS.map((k) => ({ value: k, label: k }))],
        (v) => { state.eventKind = v; },
        state.eventKind ?? "",
      ),
      button("Afficher le journal", () => void showJournal(state, out), "primary"),
    ),
    out,
  );
  return root;
};

const KINDS: readonly string[] = [
  "gamme.compiled", "gamme.approved", "gamme.deprecated", "run.started", "run.step_recorded",
  "run.refused", "run.deviated", "run.finished", "binding.stale", "amendment.proposed",
  "amendment.decided", "conflict.raised", "conflict.conciliated", "conflict.resolved",
  "ghost.proposed", "secret.found", "skill.exported", "stats.computed",
];

/**
 * Le sceau : la tête de la chaîne d'empreintes et sa vérification.
 * Le journal est append-only ; le sceau prouve qu'il n'a pas été altéré.
 */
const sceauDuJournal = async (state: AppState): Promise<HTMLElement> => {
  const tous = await state.deps.store.events();
  if (!tous.length) return h("div", {});
  const seal = sealEvents(state.deps.hasher, tous);
  const verdict = verifySeal(state.deps.hasher, seal, tous);
  return h("div", { class: "line" },
    h("span", { class: "muted" }, "Sceau d'intégrité :"),
    h("code", {}, `${seal.head.slice(0, 16)}…`),
    verdict.valid
      ? badge(`chaîne vérifiée sur ${verdict.checked} entrée(s)`, "ok")
      : badge(`chaîne rompue à ${verdict.firstInvalidId ?? "?"}`, "ko"),
  );
};

const showJournal = async (state: AppState, out: HTMLElement): Promise<void> => {
  const events = await state.deps.store.events(state.eventKind ? (e: DomainEvent) => e.kind === state.eventKind : undefined);
  out.replaceChildren(
    h("h3", {}, `${events.length} événement(s)`),
    await sceauDuJournal(state),
    events.length
      ? table(
          ["Horodatage", "Acte", "Sujet", "Acteur", "Charge utile"],
          events.map((e) => [e.at, badge(e.kind, "idle"), h("code", {}, e.subjectRef), e.actorKind ?? "—", h("code", {}, JSON.stringify(e.payload).slice(0, 120))]),
        )
      : note("Journal vide : déroule une gamme pour l'alimenter.", "info"),
  );
};

/** Réglages d'espace : seuils, politique de verrous, pages de politique, motifs. */
export const reglagesPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Réglages d'espace (§ 19, écran 11)");
  const out = h("div", { class: "out" });
  root.append(out);
  void showSettings(state, out, rerender);
  return root;
};

const showSettings = async (state: AppState, out: HTMLElement, rerender: Rerender): Promise<void> => {
  const current = (await state.deps.store.settings.get("SRE")) ?? defaultSettings();
  const draft = {
    spaceKey: current.spaceKey,
    riskMotifs: [...current.riskMotifs] as string[],
    policyPages: [...current.policyPages] as string[],
    statThreshold: current.statThreshold,
    lockPolicy: current.lockPolicy,
    reviewAfterDays: current.reviewAfterDays,
    dustAfterDays: current.dustAfterDays,
    lang: current.lang,
  };
  out.replaceChildren(
    h("h3", {}, "Espace SRE"),
    field("seuil des statistiques (effectif minimal)", String(draft.statThreshold), (v) => { draft.statThreshold = Number(v) || DEFAULT_THRESHOLD; }),
    field("révision des approbations (jours)", String(draft.reviewAfterDays), (v) => { draft.reviewAfterDays = Number(v) || 365; }),
    field("poussière (jours sans exécution)", String(draft.dustAfterDays), (v) => { draft.dustAfterDays = Number(v) || 90; }),
    line(
      select(
        [
          { value: "human_only", label: "verrous : humain seul" },
          { value: "human_or_permitted_agent", label: "verrous : humain ou agent sous permis" },
          { value: "agent_free", label: "verrous : agent libre" },
        ],
        (v) => { draft.lockPolicy = v as SpaceSettings["lockPolicy"]; },
        draft.lockPolicy,
      ),
      select([{ value: "fr", label: "langue : français" }, { value: "en", label: "langue : anglais" }], (v) => { draft.lang = v === "en" ? "en" : "fr"; }, draft.lang),
    ),
    field("pages de politique (ARI séparés par des virgules)", draft.policyPages.join(", "), (v) => { draft.policyPages = v.split(",").map((s) => s.trim()).filter(Boolean); }),
    line(button("Enregistrer", () => void save(state, draft, out, rerender), "primary")),
    h("h3", {}, "Ce que ces réglages pilotent"),
    table(
      ["Réglage", "Effet mesurable"],
      [
        ["seuil des statistiques", `sous ${draft.statThreshold} exécutions, « pas assez de recul » — aucun pourcentage`],
        ["pages de politique", "une gamme qui les contredit déclenche un conflit `policy_contradiction`"],
        ["politique de verrous", "qui peut dérouler la gamme : humain seul, humain ou agent sous permis, agent libre"],
        ["révision des approbations", "au-delà, la gamme porte une toile d'araignée — signalée, jamais supprimée"],
        ["poussière", "au-delà, la gamme porte la poussière : jamais exécutée depuis longtemps"],
      ],
    ),
    details(`Motifs de risque disponibles (${DEFAULT_RISK_MOTIFS.length})`, table(["Classe", "Niveau", "Humain seul"], DEFAULT_RISK_MOTIFS.map((m) => [h("code", {}, m.class), m.level, m.humanOnly ? "oui" : "non — permis"]))),
    details(`Détecteurs de secrets et de données personnelles (${DEFAULT_SECRET_DETECTORS.length})`, table(["Détecteur", "Nature"], DEFAULT_SECRET_DETECTORS.map((d) => [h("code", {}, d.name), d.kind]))),
  );
};

const defaultSettings = (): SpaceSettings => ({
  spaceKey: "SRE",
  riskMotifs: [],
  policyPages: [],
  statThreshold: DEFAULT_THRESHOLD,
  lockPolicy: "human_or_permitted_agent",
  reviewAfterDays: 365,
  dustAfterDays: 90,
  lang: "fr",
});

const save = async (state: AppState, settings: SpaceSettings, out: HTMLElement, rerender: Rerender): Promise<void> => {
  await state.deps.store.settings.insert(settings);
  const gamme = state.gamme ? await getGammeByCode(state.deps, state.gamme) : undefined;
  const message = `Réglages enregistrés pour l'espace ${settings.spaceKey}.${gamme ? ` Ils s'appliquent aux prochaines mesures de ${gamme.code}.` : ""}`;
  say(state, message);
  out.append(note(message, "ok"), details("Réglages enregistrés", code(JSON.stringify(settings, null, 2))));
  rerender();
};
