/**
 * Gammes — site public : « Atelier » et « Détecter ».
 *
 * L'atelier est la vue d'ensemble (§ 19) : établis, poussières, fraîcheur, couverture,
 * budget. La détection (§ 6, étage 1) montre chaque signal avec son poids et sa raison —
 * un score sans raisons n'est pas explicable.
 */

import type { AppState } from "./state";
import { pageOptions } from "./state";
import { badge, button, code, details, h, kv, line, list, note, panel, select, table, toneOf } from "./dom";
import { detectCandidates, DETECTION_SIGNALS, explainScore, RECOMMEND_THRESHOLD } from "../src/core/detect/detect-candidates";
import { workshopDust, freshness, DEFAULT_DUST_DAYS, STALE_ALERT_DAYS } from "../src/core/stats/workshop";
import { coverageDetail, renderCoverage } from "../src/core/coverage/coverage";
import { keyResults, toVigiePayload } from "../src/integrations/vigie";
import { PAGES } from "../seed/atelier";
import type { Rerender } from "./types";

/** L'atelier : tout l'état du produit sur un écran, avec ses chiffres réels. */
export const atelierPanel = async (state: AppState): Promise<HTMLElement> => {
  const { deps } = state;
  const gammes = await deps.store.gammes.list();
  const dust = await workshopDust(deps);
  const fresh = await freshness(deps);
  const coverage = renderCoverage(await coverageDetail(deps, "*"), "fr");
  const budget = deps.budget.snapshot();
  const results = await keyResults(deps, "*");

  const gammeRows = gammes.map((g) => [
    h("strong", {}, g.code),
    badge(g.state, toneOf(g.state)),
    badge(g.sync, toneOf(g.sync)),
    `v${g.currentVersion}`,
    g.title,
    g.ownerRef ? "adoptée" : badge("file d'adoption", "warn"),
  ]);

  const dustRows = dust.map((d) => [badge(d.kind, "warn"), h("strong", {}, d.code), `${d.ageDays} j`, d.reason]);

  return panel(
    "L'atelier",
    note(
      `Chaque élément porte une donnée : la poussière dit « jamais exécutée depuis ${DEFAULT_DUST_DAYS} jours », ` +
        `la toile d'araignée dit « approbation à réviser », le panneau rouge dit « page modifiée » (alerte au-delà de ${STALE_ALERT_DAYS} jours).`,
    ),
    h("h3", {}, `Établis — gammes (${gammes.length})`),
    gammes.length
      ? table(["Gamme", "État", "Page ↔ gamme", "Version", "Titre", "Propriétaire"], gammeRows)
      : note("Aucune gamme compilée : va dans « Détecter » puis « Compiler ».", "info"),
    h("h3", {}, `Poussières (${dust.length})`),
    dust.length ? table(["Marqueur", "Gamme", "Âge", "Raison"], dustRows) : note("Aucune poussière : tout sert.", "ok"),
    h("h3", {}, "Fraîcheur — la dette documentaire mesurée, pas déclarée"),
    kv("part synchronisée", `${fresh.syncedPct} %`),
    kv("âge médian de l'écart", `${fresh.medianGapDays} j`),
    kv(`désynchronisées depuis plus de ${STALE_ALERT_DAYS} j`, String(fresh.staleOver90d)),
    kv("gammes approuvées", String(fresh.total)),
    h("h3", {}, "Couverture"),
    code(coverage),
    h("h3", {}, "Budget — sobriété affichée (§ 23)"),
    kv("pages compilées", String(budget.compiled)),
    kv("appels au modèle", String(budget.llmCalls)),
    kv("jetons", String(budget.tokens)),
    kv("coût estimé (centimes)", String(budget.costEstimate)),
    h("h3", {}, "Résultats clés pour vigie (§ 16)"),
    code(JSON.stringify(toVigiePayload(results), null, 2)),
  );
};

/** Détecter : quelles pages sont des procédures, et pourquoi. */
export const detectPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Détecter les pages candidates (§ 6, étage 1 · GA-01)");
  const out = h("div", { class: "out" });
  root.append(
    note(
      `L'app ne compile jamais une page sans confirmation humaine. Au-dessus de ${RECOMMEND_THRESHOLD}, la page est recommandée — la décision reste à une personne.`,
    ),
    h("h3", {}, `Les ${DETECTION_SIGNALS.length} signaux, avec leur poids`),
    table(
      ["Signal", "Poids", "Raison affichée"],
      DETECTION_SIGNALS.map((s) => [h("code", {}, s.key), `+${s.weight}`, s.reason]),
    ),
    line(select(pageOptions(), (v) => { state.page = v; }, state.page), button("Analyser cette page", () => void analyse(state, out), "primary")),
    line(button("Analyser toutes les pages", () => void analyseAll(state, out)), button("Compiler la page choisie", () => rerender(), "primary")),
    out,
  );
  return root;
};

const analyse = async (state: AppState, out: HTMLElement): Promise<void> => {
  const page = PAGES[state.page];
  if (!page) return;
  const [candidate] = await detectCandidates(state.deps, [page]);
  out.replaceChildren(
    h("h3", {}, `Score de « ${page.title} »`),
    code(candidate ? explainScore(candidate) : "—"),
    details(
      "Détail signal par signal",
      table(
        ["Signal", "Poids", "Détecté", "Raison"],
        DETECTION_SIGNALS.map((s) => [
          h("code", {}, s.key),
          `+${s.weight}`,
          s.test(page) ? badge("oui", "ok") : badge("non", "idle"),
          s.reason,
        ]),
      ),
    ),
    details("Contenu de la page (format storage Confluence)", code(page.storageBody)),
  );
};

const analyseAll = async (state: AppState, out: HTMLElement): Promise<void> => {
  const candidates = await detectCandidates(state.deps, Object.values(PAGES));
  out.replaceChildren(
    h("h3", {}, `${candidates.length} pages analysées, classées par score`),
    table(
      ["Score", "Verdict", "Page", "Signaux retenus"],
      candidates.map((c) => [
        c.score.toFixed(2),
        badge(c.recommended ? "recommandée" : "écartée", c.recommended ? "ok" : "idle"),
        h("strong", {}, c.title),
        list(c.signals.map((s) => `${s.reason} (+${s.weight})`)),
      ]),
    ),
  );
};
