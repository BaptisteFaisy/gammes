/**
 * Gammes — site public : écrans « Atelier », « Compiler » et « Dérouler ».
 *
 * Ces écrans appellent le vrai cœur (détection, compilation, approbation, exécution,
 * trace). Chaque refus est affiché tel quel : le site ne maquille rien.
 */

import type { AppState } from "./state";
import { pageOptions } from "./state";
import { badge, button, clear, code, h, kv, line, panel, select, toneOf } from "./dom";
import { detectCandidates, explainScore } from "../src/core/detect/detect-candidates";
import { compilePage } from "../src/core/compile/compile-page";
import { approveVersion, getVersion } from "../src/core/version/versioning";
import { startRun, recordStep, reportDeviation, finishRun, getCurrentStep } from "../src/core/run/runs";
import { renderTraceMarkdown } from "../src/core/trace/trace";
import { workshopDust, freshness } from "../src/core/stats/workshop";
import { coverageDetail, renderCoverage } from "../src/core/coverage/coverage";
import { PAGES } from "../seed/atelier";
import { human, agent } from "../test/helpers";
import type { ActorRef, Evidence, Step } from "../src/core/types";

const OWNER = "ari:cloud:aaid:demo:ana";
const machineEvidence = (): Evidence => ({
  kind: "command_output",
  strength: "machine",
  ref: "https://ci.example.internal/build/42",
  capturedAt: new Date().toISOString(),
});

export type Rerender = () => void;

/** L'atelier : candidates détectées, gammes, poussières, fraîcheur, couverture. */
export const atelierPanel = async (state: AppState): Promise<HTMLElement> => {
  const { deps } = state;
  const candidates = await detectCandidates(deps, Object.values(PAGES));
  const gammes = await deps.store.gammes.list();
  const dust = await workshopDust(deps);
  const fresh = await freshness(deps);
  const coverage = renderCoverage(await coverageDetail(deps, "*"), "fr");

  const candidateRows = candidates.map((c) =>
    line(badge(c.recommended ? "recommandée" : "écartée", c.recommended ? "ok" : "idle"), h("strong", {}, c.title), ` · score ${c.score.toFixed(2)}`),
  );
  const gammeRows = gammes.length
    ? gammes.map((g) => line(badge(g.state, toneOf(g.state)), badge(g.sync, toneOf(g.sync)), h("strong", {}, g.code), ` · v${g.currentVersion} · ${g.title}`))
    : [h("p", { class: "muted" }, "Aucune gamme compilée pour l'instant — va dans « Compiler ».")];
  const dustRows = dust.length ? dust.map((d) => line(badge(d.kind, "warn"), h("strong", {}, d.code), ` · ${d.reason}`)) : [h("p", { class: "muted" }, "Aucune poussière.")];

  return panel(
    "L'atelier",
    h("h3", {}, `Gammes (${gammes.length})`),
    ...gammeRows,
    h("h3", {}, `Poussières (${dust.length})`),
    ...dustRows,
    h("h3", {}, "Fraîcheur"),
    kv("synchronisées", `${fresh.syncedPct} %`),
    kv("âge médian de l'écart", `${fresh.medianGapDays} j`),
    kv("désynchronisées > 90 j", String(fresh.staleOver90d)),
    h("h3", {}, "Couverture"),
    code(coverage),
    h("h3", {}, `Candidates détectées (${candidates.length})`),
    ...candidateRows,
  );
};

/** Compiler : choisir une page, voir le score, compiler en brouillon, approuver. */
export const compilePanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Compiler une page en gamme");
  const picker = line(
    select(pageOptions(), (value) => { state.page = value; }, state.page),
    button("Voir le score", () => showScore(state, out)),
    button("Compiler (brouillon)", () => void compile(state, rerender, out), "primary"),
  );
  const out = h("div", { class: "out" });
  root.append(picker, out);
  return root;
};

const showScore = async (state: AppState, out: HTMLElement): Promise<void> => {
  const page = PAGES[state.page];
  if (!page) return;
  const [candidate] = await detectCandidates(state.deps, [page]);
  clear(out);
  out.append(h("h3", {}, "Score et raisons"), code(candidate ? explainScore(candidate) : "—"));
};

const compile = async (state: AppState, rerender: Rerender, out: HTMLElement): Promise<void> => {
  const page = PAGES[state.page];
  if (!page) return;
  const res = await compilePage(state.deps, { page, confirmedBy: human(OWNER) });
  clear(out);
  if (!res.ok) {
    out.append(h("p", { class: "ko" }, `Compilation refusée : ${res.error.messageFr}`));
    return;
  }
  const { gamme, version, diff, findings, droppedSteps } = res.value;
  state.gamme = gamme.code;
  out.append(
    h("h3", {}, `Brouillon ${gamme.code} (v${version.version})`),
    kv("état", badge(gamme.state, toneOf(gamme.state))),
    kv("étapes", String(version.steps.length)),
    kv("signalements de secret", String(findings.length)),
    kv("étapes écartées (secret)", String(droppedSteps)),
    h("h4", {}, "Étapes — chacune cite son passage source"),
    ...version.steps.map((s) => stepLine(s)),
    h("h4", {}, "Diff"),
    code(diff),
    button("Approuver (acte humain daté)", () => void approve(state, gamme.id, version.id, rerender, out), "primary"),
  );
};

const stepLine = (s: Step): HTMLElement =>
  line(
    badge(s.kind, "idle"),
    s.humanOnly ? badge("humain", "ko") : null,
    s.locks.some((l) => l.kind === "permit") ? badge("permis", "warn") : null,
    h("strong", {}, `${s.ord}. ${s.text}`),
    s.command ? code(s.command) : null,
    h("span", { class: "muted" }, `preuve : ${s.evidence.kind}/${s.evidence.strength}${s.evidence.required ? " (exigée)" : ""}`),
    h("span", { class: "quote" }, `« ${s.source.quote} »`),
  );

const approve = async (state: AppState, gammeId: string, versionId: string, rerender: Rerender, out: HTMLElement): Promise<void> => {
  await state.deps.store.gammes.update(gammeId, (g) => ({ ...g, ownerRef: OWNER }));
  const res = await approveVersion(state.deps, { versionId, approver: human(OWNER) });
  clear(out);
  if (!res.ok) {
    out.append(h("p", { class: "ko" }, `Approbation refusée : ${res.error.messageFr}`));
    return;
  }
  out.append(h("p", { class: "ok" }, `Gamme ${res.value.code} approuvée en version immuable v${res.value.currentVersion}. Révision due le ${res.value.reviewDueAt}.`));
  rerender();
};

/** Dérouler : démarrer une exécution, acquitter les étapes, voir les verrous, clore. */
export const runPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Dérouler une gamme");
  const body = h("div", { class: "out" });
  const gammeSelect = select(
    [{ value: "", label: "— choisir une gamme approuvée —" }],
    (value) => { state.gamme = value || undefined; },
    state.gamme,
  );
  root.append(line(gammeSelect, button("Démarrer (humain)", () => void start(state, "human", rerender, body), "primary"), button("Démarrer (agent)", () => void start(state, "agent", rerender, body))), body);
  void loadGammeOptions(state, gammeSelect);
  return root;
};

const loadGammeOptions = async (state: AppState, node: HTMLSelectElement): Promise<void> => {
  const gammes = await state.deps.store.gammes.list((g) => g.state === "approved");
  for (const g of gammes) {
    const opt = h("option", { value: g.code }, `${g.code} (v${g.currentVersion})`) as HTMLOptionElement;
    if (g.code === state.gamme) opt.selected = true;
    node.append(opt);
  }
};

const actorOf = (kind: "human" | "agent"): ActorRef => (kind === "human" ? human(OWNER) : agent("ari:agent:compagnon"));

const start = async (state: AppState, kind: "human" | "agent", rerender: Rerender, body: HTMLElement): Promise<void> => {
  if (!state.gamme) return;
  const version = await getVersion(state.deps, state.gamme);
  const inputs: Record<string, unknown> = {};
  if (version.ok) for (const spec of version.value.inputs) inputs[spec.name] = spec.name === "service" ? "paiements" : "1.8.2";
  const res = await startRun(state.deps, { code: state.gamme, inputs, actor: actorOf(kind) });
  clear(body);
  if (!res.ok) {
    body.append(h("p", { class: "ko" }, `Démarrage refusé : ${res.error.messageFr}`));
    return;
  }
  state.runId = res.value.run.id;
  state.message = `Exécution ${res.value.run.id} démarrée par ${kind}, épinglée à v${res.value.run.pinnedVersion}.`;
  body.append(h("p", { class: "ok" }, state.message));
  renderStep(state, kind, rerender, body);
};

const renderStep = async (state: AppState, kind: "human" | "agent", rerender: Rerender, body: HTMLElement): Promise<void> => {
  if (!state.runId) return;
  const current = await getCurrentStep(state.deps, state.runId);
  const traceBox = h("div", {});
  if (!current.ok) {
    body.append(h("p", {}, "Plus aucune étape courante."), closeBox(state, rerender));
    return;
  }
  const step = current.value.step;
  body.append(
    h("h3", {}, `Étape ${step.ord}/${current.value.progress.total}`),
    stepLine(step),
    line(
      button("Acquitter avec preuve", () => void record(state, kind, step.id, "done", true, rerender, body)),
      button("Acquitter SANS preuve", () => void record(state, kind, step.id, "done", false, rerender, body), "warn"),
      button("Déclarer une déviation", () => void deviate(state, kind, step.id, body)),
    ),
    traceBox,
    closeBox(state, rerender),
  );
};

const record = async (state: AppState, kind: "human" | "agent", stepId: string, outcome: "done", withProof: boolean, rerender: Rerender, body: HTMLElement): Promise<void> => {
  if (!state.runId) return;
  const res = await recordStep(state.deps, {
    runId: state.runId,
    stepId,
    outcome,
    actor: actorOf(kind),
    ...(withProof ? { evidence: machineEvidence() } : {}),
  });
  clear(body);
  if (!res.ok) {
    body.append(h("p", { class: "ko" }, `Erreur : ${res.error.messageFr}`));
    return;
  }
  if (!res.value.accepted) {
    body.append(h("p", { class: "ko" }, `Refus — ${res.value.refusal?.code} : ${res.value.refusal?.messageFr}`));
    if (res.value.deviation) body.append(h("p", { class: "muted" }, `Tentative enregistrée comme déviation (${res.value.deviation.origin}).`));
  }
  renderStep(state, kind, rerender, body);
};

const deviate = async (state: AppState, kind: "human" | "agent", stepId: string, body: HTMLElement): Promise<void> => {
  if (!state.runId) return;
  await reportDeviation(state.deps, { runId: state.runId, stepId, whatHappened: "fait autrement", why: "outil indisponible", actor: actorOf(kind) });
  body.append(h("p", { class: "ok" }, "Déviation déclarée et tracée."));
};

const closeBox = (state: AppState, rerender: Rerender): HTMLElement => {
  const out = h("div", {});
  return line(
    button("Clore l'exécution", () => void finish(state, rerender, out), "primary"),
    out,
  );
};

const finish = async (state: AppState, rerender: Rerender, out: HTMLElement): Promise<void> => {
  if (!state.runId) return;
  const res = await finishRun(state.deps, { runId: state.runId, outcome: "succeeded" });
  clear(out);
  if (!res.ok) {
    out.append(h("p", { class: "ko" }, res.error.messageFr));
    return;
  }
  out.append(h("h4", {}, `Trace citable : ${res.value.citation}`), code(renderTraceMarkdown(res.value, "fr")));
  state.runId = undefined;
  rerender();
};
