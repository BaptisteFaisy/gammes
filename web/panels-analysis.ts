/**
 * Gammes — site public : écrans « Mesures », « Conflits », « Fantômes » et « SKILL.md ».
 *
 * Les chiffres sont ceux du produit : effectif, fourchette de Wilson, et « pas assez
 * de recul » quand l'effectif ne suffit pas. Le conciliateur prépare un dossier ;
 * il ne tranche jamais.
 */

import type { AppState } from "./state";
import { badge, button, clear, code, h, kv, line, panel, select } from "./dom";
import { computeStepStats, renderComparison } from "../src/core/stats/step-stats";
import { renderRate } from "../src/core/stats/rates";
import { proposeFromTraces } from "../src/core/amendments/amendments";
import { detectConflicts } from "../src/core/conflicts/detect";
import { conciliate } from "../src/core/conciliation/hermes";
import { detectGhosts } from "../src/core/ghosts/ghosts";
import { exportSkillMd } from "../src/core/export/skill-md";
import { getGammeByCode } from "../src/core/version/versioning";
import type { Rerender } from "./panels-atelier";

/** Mesures : taux par étape (avec effectif et fourchette) et proposition d'amendement. */
export const mesuresPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Statistiques d'atelier");
  const out = h("div", { class: "out" });
  root.append(line(button("Calculer les statistiques", () => void showStats(state, out), "primary"), button("Proposer un amendement", () => void propose(state, out))), out);
  return root;
};

const showStats = async (state: AppState, out: HTMLElement): Promise<void> => {
  const code_ = state.gamme ?? (await firstGamme(state));
  if (!code_) return;
  const stats = await computeStepStats(state.deps, { code: code_ });
  clear(out);
  out.append(
    h("h3", {}, `Statistiques — ${code_}`),
    ...stats.map((s) =>
      line(
        h("strong", {}, s.stepId),
        ` échec : ${renderRate(s.failRate, "fr")}`,
        ` · saut : ${renderRate(s.skipRate, "fr")}`,
        ` · déviations : ${s.deviations}`,
        s.medianS !== undefined ? ` · durée médiane ${s.medianS} s` : "",
      ),
    ),
  );
};

const propose = async (state: AppState, out: HTMLElement): Promise<void> => {
  const code_ = state.gamme ?? (await firstGamme(state));
  if (!code_) return;
  const res = await proposeFromTraces(state.deps, { code: code_ });
  clear(out);
  if (!res.ok) {
    out.append(h("p", { class: "ko" }, res.error.messageFr));
    return;
  }
  if (res.value.length === 0) {
    out.append(h("p", { class: "muted" }, "Aucun amendement proposé : soit pas assez de recul, soit une proposition existe déjà."));
    return;
  }
  out.append(
    h("h3", {}, "Amendements proposés (jamais appliqués seuls)"),
    ...res.value.map((a) =>
      line(badge(a.state, "warn"), h("strong", {}, a.proposal), h("span", { class: "muted" }, ` — ${a.rationale} (${a.evidenceRefs.length} preuves)`)),
    ),
  );
};

const firstGamme = async (state: AppState): Promise<string | undefined> => {
  const gammes = await state.deps.store.gammes.list();
  return gammes[0]?.code;
};

/** Conflits : détection déterministe + dossier du conciliateur hermes. */
export const conflitsPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Conflits entre procédures");
  const out = h("div", { class: "out" });
  root.append(line(button("Détecter les conflits", () => void showConflicts(state, out), "primary")), out);
  return root;
};

const showConflicts = async (state: AppState, out: HTMLElement): Promise<void> => {
  const conflicts = await detectConflicts(state.deps, {});
  clear(out);
  if (conflicts.length === 0) {
    out.append(h("p", { class: "muted" }, "Aucun conflit détecté."));
    return;
  }
  for (const conflict of conflicts) {
    out.append(
      h("h3", {}, `${conflict.kind} · ${conflict.gammeA} ↔ ${conflict.gammeB ?? conflict.policyPageAri ?? "?"}`),
      ...conflict.facts.map((f) =>
        line(
          h("strong", {}, f.subject),
          ` ${f.left} — ${f.right}`,
          f.leftSpan ? h("span", { class: "quote" }, ` « ${f.leftSpan.quote} »`) : null,
          f.rightSpan ? h("span", { class: "quote" }, ` « ${f.rightSpan.quote} »`) : null,
        ),
      ),
      button("Préparer le dossier de conciliation (hermes)", () => void conciliateConflict(state, conflict.id, out)),
    );
  }
};

const conciliateConflict = async (state: AppState, conflictId: string, out: HTMLElement): Promise<void> => {
  const res = await conciliate(state.deps, conflictId);
  if (!res.ok) {
    out.append(h("p", { class: "ko" }, `Conciliateur indisponible : ${res.error.messageFr}`));
    return;
  }
  out.append(
    h("h4", {}, `Dossier ${res.value.engine} — décision humaine requise`),
    h("p", {}, res.value.summary),
    ...res.value.options.map((o) => line(badge("option", "idle"), h("strong", {}, o.title), ` — ${o.detail}`)),
  );
};

/** Fantômes : motifs répétés jamais écrits, avec leurs preuves et leur coût. */
export const fantomesPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Gammes fantômes (le travail jamais écrit)");
  const out = h("div", { class: "out" });
  root.append(line(button("Chercher les motifs répétés", () => void showGhosts(state, out), "primary")), out);
  return root;
};

const showGhosts = async (state: AppState, out: HTMLElement): Promise<void> => {
  const ghosts = await detectGhosts(state.deps, { projectKey: "PAY" });
  clear(out);
  if (ghosts.length === 0) {
    out.append(h("p", { class: "muted" }, "Aucun motif répété détecté."));
    return;
  }
  out.append(
    ...ghosts.map((g) =>
      line(
        h("strong", {}, g.label),
        ` · ${g.n} tickets · étalement ${g.spanDays} j · durée médiane ${g.medianHandleH} h · coût estimé ${g.costDays} j`,
        h("span", { class: "muted" }, ` (effectif de personnes : ${g.peopleCount} — jamais de nom)`),
      ),
    ),
  );
};

/** Export : le SKILL.md d'une gamme, prêt à être ajouté à un agent tiers. */
export const skillPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Exporter un SKILL.md");
  const out = h("div", { class: "out" });
  root.append(line(button("Exporter", () => void exportSkill(state, out), "primary")), out);
  return root;
};

const exportSkill = async (state: AppState, out: HTMLElement): Promise<void> => {
  const code_ = state.gamme ?? (await firstGamme(state));
  if (!code_) {
    out.append(h("p", { class: "muted" }, "Aucune gamme : compile d'abord une page."));
    return;
  }
  const res = await exportSkillMd(state.deps, { code: code_ });
  clear(out);
  if (!res.ok) {
    out.append(h("p", { class: "ko" }, `Export refusé : ${res.error.messageFr}`));
    return;
  }
  out.append(kv("empreinte du fichier", res.value.hash), code(res.value.skillMd));
};
