/**
 * Gammes — couverture (§ 11, § 19, GA-18).
 *
 * Part des runbooks compilés, part des exécutions tracées, part des gammes approuvées,
 * part désynchronisée. **Une couverture partielle est déclarée, jamais masquée** :
 * l'écran de couverture distingue aussi « pas de droit sur le graphe » de « pas de
 * données », parce que ce n'est pas la même dette.
 */

import type { Deps } from "../ports";
import type { Coverage } from "../types";

const pct = (part: number, total: number): number => (total === 0 ? 0 : Math.round((part / total) * 100));

const inScope = (spaceKey: string, scope: string): boolean => scope === "*" || scope === spaceKey;

export type CoverageDetail = Coverage & {
  readonly pagesDetected: number;
  readonly compiled: number;
  readonly approved: number;
  readonly traced: number;
  readonly stale: number;
  readonly graphReadable: boolean;
};

/** Calcule, enregistre et rend la couverture d'un périmètre (espace ou `*`). */
export const computeCoverage = async (deps: Deps, scope: string): Promise<Coverage> => {
  const detail = await coverageDetail(deps, scope);
  const coverage: Coverage = {
    id: `${scope}:${detail.computedAt}`,
    scope,
    pagesDetected: detail.pagesDetected,
    compiledPct: detail.compiledPct,
    approvedPct: detail.approvedPct,
    tracedPct: detail.tracedPct,
    stalePct: detail.stalePct,
    computedAt: detail.computedAt,
  };
  await deps.store.coverage.insert(coverage);
  return coverage;
};

/** Le détail brut : ce que l'écran de couverture affiche, chiffres et absences compris. */
export const coverageDetail = async (deps: Deps, scope: string): Promise<CoverageDetail> => {
  const now = deps.clock.now();
  const candidates = await deps.store.candidates.list((c) => inScope(c.spaceKey, scope));
  const gammes = await deps.store.gammes.list((g) => inScope(g.spaceKey, scope));
  const runs = await deps.store.runs.list();
  const traced = gammes.filter((g) => runs.some((r) => r.gammeId === g.id));
  const approved = gammes.filter((g) => g.state === "approved");
  const stale = gammes.filter((g) => g.sync === "stale");
  return {
    id: `${scope}:${now}`,
    scope,
    computedAt: now,
    pagesDetected: candidates.length,
    compiled: gammes.length,
    approved: approved.length,
    traced: traced.length,
    stale: stale.length,
    compiledPct: pct(gammes.length, candidates.length),
    approvedPct: pct(approved.length, gammes.length),
    tracedPct: pct(traced.length, gammes.length),
    stalePct: pct(stale.length, gammes.length),
    graphReadable: deps.graph ? await deps.graph.readable() : false,
  };
};

/** Rendu lisible : la couverture partielle est dite, jamais arrondie à 100 %. */
export const renderCoverage = (detail: CoverageDetail, lang: "fr" | "en"): string => {
  const lines =
    lang === "fr"
      ? [
          `Périmètre : ${detail.scope}`,
          `Pages détectées : ${detail.pagesDetected}`,
          `Compilées : ${detail.compiledPct} % (${detail.compiled})`,
          `Approuvées : ${detail.approvedPct} % (${detail.approved})`,
          `Exécutions tracées : ${detail.tracedPct} % (${detail.traced})`,
          `Désynchronisées : ${detail.stalePct} % (${detail.stale})`,
          detail.graphReadable ? "Graphe : lisible" : "Graphe : droit manquant — le périmètre affiché est incomplet",
        ]
      : [
          `Scope: ${detail.scope}`,
          `Detected pages: ${detail.pagesDetected}`,
          `Compiled: ${detail.compiledPct}% (${detail.compiled})`,
          `Approved: ${detail.approvedPct}% (${detail.approved})`,
          `Traced runs: ${detail.tracedPct}% (${detail.traced})`,
          `Out of sync: ${detail.stalePct}% (${detail.stale})`,
          detail.graphReadable ? "Graph: readable" : "Graph: missing permission — the displayed scope is incomplete",
        ];
  return lines.join("\n");
};
