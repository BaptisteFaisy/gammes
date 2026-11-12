/**
 * Gammes — site public : « Dérouler ».
 *
 * § 8, GA-07/08/09/12/29 : l'exécution pas à pas, les preuves, les trois verrous, les
 * déviations, la reprise, le mode dégradé d'urgence et la trace citable. Le refus d'un
 * verrou est affiché tel quel et **enregistré comme déviation** — jamais avalé.
 */

import type { AppState } from "./state";
import { OWNER, actorOf, gammeOptions, say } from "./state";
import { append, badge, button, code, details, field, h, kv, line, list, note, panel, select, table, toneOf } from "./dom";
import { finishRun, getCurrentStep, recordStep, reportDeviation, resumeRun, startRun } from "../src/core/run/runs";
import { citeRun, renderTraceMarkdown } from "../src/core/trace/trace";
import { evidenceRule, STRENGTH_ORDER } from "../src/integrations/preuve-a-l-appui";
import type { Evidence, EvidenceStrength, RunOutcome, StepOutcome } from "../src/core/types";
import type { Rerender } from "./types";

const EVIDENCE_REFS: Record<EvidenceStrength, string> = {
  machine: "https://ci.example.internal/build/42",
  attested: `attestation:${OWNER}`,
  declared: "déclaré oralement en astreinte",
};

export const runPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Dérouler une gamme (§ 8 · GA-07/08/09/12/29)");
  const controls = h("div", { class: "controls" });
  const out = h("div", { class: "out" });
  root.append(controls, out);
  void buildControls(state, controls, out, rerender);
  return root;
};

const buildControls = async (state: AppState, controls: HTMLElement, out: HTMLElement, rerender: Rerender): Promise<void> => {
  const options = await gammeOptions(state, (g) => g.state === "approved");
  controls.replaceChildren(
    note(evidenceRule("fr")),
    line(
      select(options, (v) => { state.gamme = v || undefined; }, state.gamme),
      select(
        [
          { value: "human", label: "acteur : humain (astreinte)" },
          { value: "agent", label: "acteur : agent Rovo (le compagnon)" },
        ],
        (v) => { state.actorKind = v === "human" ? "human" : "agent"; },
        state.actorKind,
      ),
    ),
    line(
      select(
        [
          { value: "normal", label: "mode : normal" },
          { value: "emergency", label: "mode : urgence (dégradé)" },
        ],
        (v) => { state.mode = v as "normal" | "emergency"; },
        state.mode ?? "normal",
      ),
      field("raison du mode dégradé", state.emergencyReason ?? "", (v) => { state.emergencyReason = v; }, "incident INC-…"),
    ),
    line(field("ticket lié (facultatif)", state.ticketRef ?? "", (v) => { state.ticketRef = v; }, "PAY-412")),
    line(
      button("Démarrer l'exécution", () => void start(state, out, rerender), "primary"),
      button("Reprendre après interruption", () => void resume(state, out, rerender)),
    ),
  );
};

const start = async (state: AppState, out: HTMLElement, rerender: Rerender): Promise<void> => {
  if (!state.gamme) {
    out.replaceChildren(note("Choisis une gamme approuvée.", "info"));
    return;
  }
  const inputs: Record<string, unknown> = { service: state.service || "paiements", version_cible: "1.8.2" };
  const res = await startRun(state.deps, {
    code: state.gamme,
    inputs,
    actor: actorOf(state),
    ...(state.ticketRef ? { ticketRef: state.ticketRef } : {}),
    ...(state.mode === "emergency" ? { mode: "emergency", emergencyReason: state.emergencyReason ?? "" } : {}),
  });
  out.replaceChildren();
  if (!res.ok) {
    out.append(note(`Démarrage refusé : ${res.error.code} — ${res.error.messageFr}`, "ko"));
    return;
  }
  state.runId = res.value.run.id;
  const run = res.value.run;
  append(out, [
    note(`Exécution ${citeRun(run)} démarrée par ${run.actor.kind}. Version épinglée : la page peut changer, l'exécution ne change pas de gamme.`, "ok"),
    kv("mode", run.mode === "emergency" ? badge("urgence (dégradé)", "ko") : badge("normal", "ok")),
    run.emergencyReason ? kv("raison du mode dégradé", run.emergencyReason) : null,
    run.emergencyReviewDueAt ? kv("revue différée exigée avant le", run.emergencyReviewDueAt) : null,
    run.ticketRef ? kv("ticket lié", run.ticketRef) : null,
  ]);
  await renderCurrent(state, out, rerender);
};

const resume = async (state: AppState, out: HTMLElement, rerender: Rerender): Promise<void> => {
  if (!state.runId) {
    out.replaceChildren(note("Aucune exécution en cours à reprendre.", "info"));
    return;
  }
  const res = await resumeRun(state.deps, state.runId, actorOf(state));
  out.replaceChildren();
  if (!res.ok) {
    out.append(note(`Reprise refusée : ${res.error.messageFr}`, "ko"));
    return;
  }
  out.append(note(`Reprise n°${res.value.run.resumedCount} — toujours épinglée à v${res.value.run.pinnedVersion}.`, "ok"));
  await renderCurrent(state, out, rerender);
};

const renderCurrent = async (state: AppState, out: HTMLElement, rerender: Rerender): Promise<void> => {
  if (!state.runId) return;
  const res = await getCurrentStep(state.deps, state.runId);
  const box = h("div", { class: "current" });
  out.append(box);
  if (!res.ok) {
    box.append(note(`Plus d'étape courante : ${res.error.messageFr}`, "info"), closeBlock(state, out, rerender));
    return;
  }
  const { step, progress, run } = res.value;
  append(box, [
    h("h3", {}, `Étape ${step.ord} sur ${progress.total} — ${progress.done} acquittée(s)`),
    kv("texte", h("strong", {}, step.text)),
    step.command ? kv("commande", code(step.command)) : null,
    step.expectedResult ? kv("résultat attendu", step.expectedResult) : null,
    kv("preuve exigée", `${step.evidence.kind} · force ${step.evidence.strength} · ${step.evidence.required ? "obligatoire" : "facultative"}${step.evidence.hint ? ` — ${step.evidence.hint}` : ""}`),
    kv("verrous", step.locks.length ? list(step.locks.map((l) => `${l.kind} — ${l.reason}`)) : "aucun"),
    kv("réservée à un humain", step.humanOnly ? badge("oui", "ko") : badge("non", "ok")),
    kv("conduite en cas d'échec", step.onFailure),
    kv("passage source", h("span", { class: "quote" }, `« ${step.source.quote} »`)),
    h("h4", {}, "Acquitter"),
    line(
      select(
        STRENGTH_ORDER.slice().reverse().map((s) => ({ value: s, label: `preuve : ${s}` })),
        (v) => { state.evidenceStrength = v as EvidenceStrength; },
        state.evidenceStrength ?? "machine",
      ),
      button("Acquitter avec preuve", () => void record(state, "done", true, out, rerender), "primary"),
      button("Acquitter SANS preuve", () => void record(state, "done", false, out, rerender), "warn"),
    ),
    line(
      field("raison (échec ou saut)", state.reason ?? "", (v) => { state.reason = v; }, "pourquoi"),
      button("Échec", () => void record(state, "failed", true, out, rerender)),
      button("Sauter", () => void record(state, "skipped", true, out, rerender)),
      button("Déclarer une déviation", () => void deviate(state, step.id, out)),
    ),
    run.deviations.length
      ? details(`Déviations de cette exécution (${run.deviations.length})`, table(["Origine", "Étape", "Ce qui a été fait", "Pourquoi"], run.deviations.map((d) => [d.origin, d.stepId ?? "—", d.whatHappened, d.why])))
      : null,
    closeBlock(state, out, rerender),
  ]);
};

const record = async (state: AppState, outcome: StepOutcome, withEvidence: boolean, out: HTMLElement, rerender: Rerender): Promise<void> => {
  if (!state.runId) return;
  const current = await getCurrentStep(state.deps, state.runId);
  if (!current.ok) {
    out.append(note(current.error.messageFr, "ko"));
    return;
  }
  const strength = state.evidenceStrength ?? "machine";
  const evidence: Evidence | undefined = withEvidence
    ? { kind: strength === "machine" ? "command_output" : strength === "attested" ? "attestation" : "attestation", strength, ref: EVIDENCE_REFS[strength], capturedAt: state.deps.clock.now() }
    : undefined;
  const res = await recordStep(state.deps, {
    runId: state.runId,
    stepId: current.value.step.id,
    outcome,
    ...(evidence ? { evidence } : {}),
    ...(state.reason ? { reason: state.reason } : {}),
    actor: actorOf(state),
  });
  const log = h("div", { class: "log" });
  out.append(log);
  if (!res.ok) {
    log.append(note(`Erreur : ${res.error.code} — ${res.error.messageFr}`, "ko"));
    return;
  }
  if (!res.value.accepted) {
    append(log, [
      note(`REFUS — ${res.value.refusal?.code} : ${res.value.refusal?.messageFr}`, "ko"),
      res.value.deviation ? note(`Tentative enregistrée comme déviation (origine : ${res.value.deviation.origin}). Rien n'est silencieux.`, "info") : null,
    ]);
  } else {
    log.append(note(`Étape ${outcome} enregistrée par ${state.actorKind}.`, "ok"));
  }
  await renderCurrent(state, out, rerender);
};

const deviate = async (state: AppState, stepId: string, out: HTMLElement): Promise<void> => {
  if (!state.runId) return;
  const res = await reportDeviation(state.deps, {
    runId: state.runId,
    stepId,
    whatHappened: state.reason || "fait autrement que ce que prescrit l'étape",
    why: state.reason ? "raison saisie" : "outil indisponible, contournement temporaire",
    actor: actorOf(state),
  });
  out.append(res.ok ? note("Déviation déclarée et tracée.", "ok") : note(res.error.messageFr, "ko"));
};

const closeBlock = (state: AppState, out: HTMLElement, rerender: Rerender): HTMLElement => {
  const traceBox = h("div", {});
  return line(
    select(
      [
        { value: "succeeded", label: "issue : réussie" },
        { value: "failed", label: "issue : échouée" },
        { value: "aborted", label: "issue : interrompue" },
        { value: "expired", label: "issue : expirée" },
      ],
      (v) => { state.outcome = v as RunOutcome; },
      state.outcome ?? "succeeded",
    ),
    button("Clore l'exécution et produire la trace", () => void finish(state, traceBox, rerender), "primary"),
    traceBox,
  );
};

const finish = async (state: AppState, box: HTMLElement, rerender: Rerender): Promise<void> => {
  if (!state.runId) return;
  const res = await finishRun(state.deps, { runId: state.runId, outcome: state.outcome ?? "succeeded", notes: "clos depuis la démo publique" });
  box.replaceChildren();
  if (!res.ok) {
    box.append(note(`Clôture refusée : ${res.error.messageFr}`, "ko"));
    return;
  }
  append(box, [
    h("h4", {}, `Trace citable : ${res.value.citation}`),
    kv("acteur et sa nature", `${res.value.actorKind}`),
    kv("issue", badge(String(res.value.outcome), toneOf(String(res.value.outcome)))),
    kv("durée", `${res.value.durationS} s`),
    code(renderTraceMarkdown(res.value, "fr")),
    details("Même trace en anglais", code(renderTraceMarkdown(res.value, "en"))),
  ]);
  // La trace doit rester à l'écran : on ne redessine pas, on note seulement l'état.
  say(state, `Exécution ${res.value.citation} close — issue ${String(res.value.outcome)}.`);
  state.runId = undefined;
  void rerender;
};
