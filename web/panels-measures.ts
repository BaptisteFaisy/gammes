/**
 * Gammes — site public : « Mesures » et « Amendements ».
 *
 * § 11, GA-19/20/21/24 : taux d'échec et de saut par étape avec effectif et fourchette,
 * « pas assez de recul » sous le seuil, comparaison de versions, étapes délégables à un
 * agent, et amendements proposés depuis les traces — jamais appliqués seuls.
 */

import type { AppState } from "./state";
import { OWNER, gammeOptions } from "./state";
import { badge, button, code, field, h, kv, line, list, note, panel, select, table } from "./dom";
import { computeStepStats, compareVersions, failingSteps, renderComparison, skippedSteps, DEFAULT_PERIOD } from "../src/core/stats/step-stats";
import { DEFAULT_THRESHOLD, renderRate } from "../src/core/stats/rates";
import { decideAmendment, proposeFromTraces } from "../src/core/amendments/amendments";
import { DELEGATION_FAIL_CEILING, delegableSteps, renderDelegation } from "../src/integrations/delegable-ou-pas";
import { groupErrors } from "../src/integrations/deja-vu-ci";
import { seedTraces } from "../seed/atelier";
import { human } from "../test/helpers";
import type { Rerender } from "./types";

export const mesuresPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Statistiques d'atelier (§ 11 · GA-19/21/24)");
  const out = h("div", { class: "out" });
  const picker = select([], (v) => { state.gamme = v || undefined; }, state.gamme);
  root.append(
    note(
      `Règle absolue : sous le seuil de ${DEFAULT_THRESHOLD} exécutions, aucun pourcentage n'est affiché — l'app dit « pas assez de recul ». ` +
        `Chaque taux publié porte sa fourchette de Wilson à 95 % et son effectif. Aucune statistique par personne.`,
    ),
    line(picker, button("Calculer", () => void stats(state, out), "primary")),
    line(field("ou code de gamme", state.gamme ?? "", (v) => { state.gamme = v || undefined; }, "GAM-…")),
    line(
      button("Semer 40 exécutions (24 échecs)", () => void seed(state, 40, 24, out), "warn"),
      button("Semer 3 exécutions (2 échecs)", () => void seed(state, 3, 2, out), "warn"),
    ),
    line(button("Comparer v1 et v2", () => void compare(state, out)), button("Étapes délégables à un agent", () => void delegable(state, out))),
    out,
  );
  void gammeOptions(state).then((options) =>
    picker.replaceChildren(
      ...options.map((o) => {
        const opt = h("option", { value: o.value }, o.label) as HTMLOptionElement;
        if (o.value === state.gamme) opt.selected = true;
        return opt;
      }),
    ),
  );
  return root;
};

const seed = async (state: AppState, n: number, failures: number, out: HTMLElement): Promise<void> => {
  if (!state.gamme) {
    out.replaceChildren(note("Choisis d'abord une gamme.", "info"));
    return;
  }
  const gamme = await state.deps.store.gammes.list((g) => g.code === state.gamme);
  const versions = await state.deps.store.versions.list((v) => v.gammeId === gamme[0]?.id);
  const version = versions.find((v) => v.version === gamme[0]?.currentVersion) ?? versions[0];
  if (!gamme[0] || !version) {
    out.replaceChildren(note("Gamme ou version introuvable.", "ko"));
    return;
  }
  const stepId = version.steps[1]?.id ?? version.steps[0]?.id ?? "";
  await seedTraces(state.deps, { gammeId: gamme[0].id, code: gamme[0].code, versionId: version.id, n, failures, stepId });
  out.replaceChildren(note(`${n} exécutions semées, dont ${failures} en échec sur l'étape ${stepId}.`, "ok"));
  await stats(state, out, true);
};

const stats = async (state: AppState, out: HTMLElement, keep = false): Promise<void> => {
  if (!state.gamme) return;
  const rows = await computeStepStats(state.deps, { code: state.gamme, period: DEFAULT_PERIOD });
  const block = h("div", {});
  if (keep) out.append(block);
  else out.replaceChildren(block);
  if (rows.length === 0) {
    block.append(note("Aucune exécution : aucune statistique. L'app ne devine pas.", "info"));
    return;
  }
  block.append(
    h("h3", {}, `Par étape — ${state.gamme}`),
    table(
      ["Étape", "Effectif", "Taux d'échec", "Taux de saut", "Déviations", "Durée médiane"],
      rows.map((s) => [
        h("code", {}, s.stepId),
        String(s.n),
        renderRate(s.failRate, "fr"),
        renderRate(s.skipRate, "fr"),
        String(s.deviations),
        s.medianS !== undefined ? `${s.medianS} s` : "—",
      ]),
    ),
  );
  const failing = await failingSteps(state.deps, { code: state.gamme });
  const skipped = await skippedSteps(state.deps, { code: state.gamme });
  block.append(
    kv("étapes qui échouent ≥ 50 %", failing.length ? list(failing.map((s) => `${s.stepId} — ${renderRate(s.failRate, "fr")}`)) : "aucune"),
    kv("étapes sautées ≥ 50 %", skipped.length ? list(skipped.map((s) => `${s.stepId} — ${renderRate(s.skipRate, "fr")}`)) : "aucune"),
  );
  block.append(signaturesBlock(rows));
};

const signaturesBlock = (rows: readonly { stepId: string; n: number }[]): HTMLElement => {
  const errors = rows.filter((r) => r.n > 0).map((r) => `échec de l'étape ${r.stepId} à 2026-11-11T09:00:00Z (run ${r.n})`);
  const groups = groupErrors(errors);
  return h(
    "div",
    {},
    h("h4", {}, "Signature d'échec (déjà-vu-ci) — les erreurs se regroupent"),
    groups.length ? table(["Signature", "Effectif", "Exemple"], groups.map((g) => [h("code", {}, g.signature.slice(0, 16)), String(g.count), g.example])) : note("Aucune erreur à regrouper.", "info"),
  );
};

const compare = async (state: AppState, out: HTMLElement): Promise<void> => {
  if (!state.gamme) return;
  const comparison = await compareVersions(state.deps, state.gamme, 1, 2);
  out.append(
    h("h3", {}, "Comparaison de versions (GA-24)"),
    code(renderComparison(comparison, "fr")),
    kv("verdict", badge(comparison.verdict, comparison.verdict === "improved" ? "ok" : comparison.verdict === "degraded" ? "ko" : "idle")),
    note("Un amendement qui dégrade est dit. La version précédente reste disponible : déprécier n'est pas supprimer.", "info"),
  );
};

const delegable = async (state: AppState, out: HTMLElement): Promise<void> => {
  if (!state.gamme) return;
  const rows = await computeStepStats(state.deps, { code: state.gamme });
  const verdicts = delegableSteps(rows);
  out.append(
    h("h3", {}, `Quelles étapes sont fiables pour un agent ? (delegable-ou-pas, plafond ${DELEGATION_FAIL_CEILING * 100} % d'échec)`),
    note(renderDelegation(verdicts, "fr"), "info"),
    table(
      ["Étape", "Verdict", "Taux d'échec", "Effectif"],
      verdicts.map((v) => [
        h("code", {}, v.stepId),
        badge(v.verdict, v.verdict === "delegable" ? "ok" : v.verdict === "needs_human" ? "ko" : "idle"),
        v.failRate !== undefined ? `${Math.round(v.failRate * 100)} %` : "pas assez de recul",
        String(v.n),
      ]),
    ),
  );
};

/** Amendements : proposés depuis les traces, décidés par un humain, jamais appliqués seuls. */
export const amendementsPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Amendements (§ 11 · GA-20)");
  const out = h("div", { class: "out" });
  root.append(
    note("Une procédure s'améliore parce qu'on s'en sert. L'app propose, preuves à l'appui ; un humain décide. Accepter ne modifie rien : la page est proposée à son propriétaire."),
    line(button("Proposer depuis les traces", () => void propose(state, out), "primary"), button("Lister les amendements", () => void listAll(state, out, rerender))),
    out,
  );
  return root;
};

const propose = async (state: AppState, out: HTMLElement): Promise<void> => {
  if (!state.gamme) {
    out.replaceChildren(note("Choisis une gamme dans « Mesures » d'abord.", "info"));
    return;
  }
  const res = await proposeFromTraces(state.deps, { code: state.gamme });
  out.replaceChildren();
  if (!res.ok) {
    out.append(note(res.error.messageFr, "ko"));
    return;
  }
  if (res.value.length === 0) {
    out.append(note("Aucune proposition : pas assez de recul, ou un amendement est déjà ouvert pour ces étapes.", "info"));
    return;
  }
  out.append(
    h("h3", {}, `${res.value.length} amendement(s) proposé(s)`),
    ...res.value.map((a) =>
      line(
        badge(a.state, "warn"),
        h("strong", {}, a.proposal),
        h("div", { class: "muted" }, a.rationale),
        h("div", { class: "muted" }, `preuves : ${a.evidenceRefs.slice(0, 6).join(", ")}${a.evidenceRefs.length > 6 ? "…" : ""}`),
        button("Accepter (humain)", () => void decide(state, a.id, "accepted", out)),
        button("Rejeter (humain)", () => void decide(state, a.id, "rejected", out)),
      ),
    ),
  );
};

const decide = async (state: AppState, id: string, decision: "accepted" | "rejected", out: HTMLElement): Promise<void> => {
  const res = await decideAmendment(state.deps, { id, decision, by: human(OWNER) });
  out.append(
    res.ok
      ? note(`Amendement ${decision === "accepted" ? "accepté" : "rejeté"} par ${OWNER} le ${res.value.decidedAt}. ${decision === "accepted" ? "La modification de la page est proposée à son propriétaire." : ""}`, "ok")
      : note(`Refusé : ${res.error.messageFr}`, "ko"),
  );
};

const listAll = async (state: AppState, out: HTMLElement, rerender: Rerender): Promise<void> => {
  const all = await state.deps.store.amendments.list();
  out.replaceChildren(
    h("h3", {}, `Tous les amendements (${all.length})`),
    all.length
      ? table(
          ["État", "Gamme", "Étape", "Proposition", "Raison", "Proposé par", "Décidé le / par"],
          all.map((a) => [
            badge(a.state, a.state === "accepted" ? "ok" : a.state === "rejected" ? "ko" : "warn"),
            a.gammeId,
            a.stepId ?? "—",
            a.proposal,
            a.rationale,
            a.proposedBy,
            a.decidedAt ? `${a.decidedAt} · ${a.decidedByRef ?? "—"}` : "—",
          ]),
        )
      : note("Aucun amendement.", "info"),
    note("Un amendement déjà ouvert bloque une nouvelle proposition pour la même étape : on ne spamme pas le propriétaire.", "info"),
  );
  rerender();
};
