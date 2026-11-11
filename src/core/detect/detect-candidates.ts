/**
 * Gammes — repérer les pages candidates (§ 6 étage 1, GA-01).
 *
 * Signaux faibles et forts, chacun avec son poids et **sa raison lisible** : un score
 * sans raisons n'est pas explicable, et l'explicabilité est une exigence (§ 23).
 * L'app ne compile jamais une page sans confirmation humaine : `detectCandidates`
 * produit des candidates, pas des gammes.
 */

import type { Deps } from "../ports";
import type { CandidatePage, CandidateSignal, PageDigest, SpaceSettings } from "../types";

export type SignalTest = {
  readonly key: string;
  readonly weight: number;
  readonly reason: string;
  readonly test: (page: PageDigest) => boolean;
};

/** Au-dessus de ce score, la page est recommandée à la compilation (confirmation humaine requise). */
export const RECOMMEND_THRESHOLD = 0.5;

const TITLE_RE = /proc[ée]dure|runbook|mode\s*op[ée]ratoire|how[- ]to|\bSOP\b|checklist|guide\s+d(?:e|')/i;
const LABEL_RE = /runbook|proc[ée]dure|\bsop\b|mode[- _]?op[ée]ratoire|astreinte|on[- ]call/i;
const ORDERED_LIST_RE = /<ol[\s>]/i;
const LIST_ITEM_RE = /<li[\s>]/gi;
const CHECKBOX_RE = /ac:task|type="checkbox"|\[[ xX]\]/i;
const CODE_RE = /ac:name="code"|<pre[\s>]|<code[\s>]/i;
const STEP_TABLE_RE = /<th[^>]*>[^<]*(?:[ée]tape|step|action|commande)/i;
const VERB_RE = /\b(?:ex[ée]cuter|lancer|v[ée]rifier|d[ée]ployer|contr[ôo]ler|ouvrir|appliquer|run|execute|verify|deploy)\b/i;

const countListItems = (body: string): number => (body.match(LIST_ITEM_RE) ?? []).length;

export const DETECTION_SIGNALS: readonly SignalTest[] = [
  {
    key: "titre_procedure",
    weight: 0.35,
    reason: "le titre annonce une procédure (Procédure, Runbook, Mode opératoire, How to, SOP)",
    test: (p) => TITLE_RE.test(p.title),
  },
  {
    key: "etiquette",
    weight: 0.15,
    reason: "une étiquette runbook / procédure / astreinte est posée",
    test: (p) => p.labels.some((l) => LABEL_RE.test(l)),
  },
  {
    key: "liste_numerotee",
    weight: 0.2,
    reason: "liste numérotée d'au moins deux éléments",
    test: (p) => ORDERED_LIST_RE.test(p.storageBody) && countListItems(p.storageBody) >= 2,
  },
  {
    key: "cases_a_cocher",
    weight: 0.1,
    reason: "cases à cocher : une checklist est déjà là",
    test: (p) => CHECKBOX_RE.test(p.storageBody),
  },
  {
    key: "blocs_de_code",
    weight: 0.15,
    reason: "au moins un bloc de code : des commandes outillables",
    test: (p) => CODE_RE.test(p.storageBody),
  },
  {
    key: "tableau_etapes",
    weight: 0.1,
    reason: "tableau d'étapes (colonne étape / action / commande)",
    test: (p) => STEP_TABLE_RE.test(p.storageBody),
  },
  {
    key: "lien_astreinte",
    weight: 0.1,
    reason: "liée depuis une page d'astreinte",
    test: (p) => p.linkedFromOnCall === true,
  },
  {
    key: "consultation",
    weight: 0.05,
    reason: "page consultée au moins 20 fois sur 30 jours",
    test: (p) => (p.viewsLast30d ?? 0) >= 20,
  },
  {
    key: "verbes_operatoires",
    weight: 0.1,
    reason: "verbes opératoires (exécuter, vérifier, déployer…)",
    test: (p) => VERB_RE.test(p.storageBody),
  },
];

export type Scored = { readonly score: number; readonly signals: readonly CandidateSignal[] };

/** Score borné à 1, avec la raison de chaque signal retenu. */
export const scorePage = (page: PageDigest, _settings?: SpaceSettings): Scored => {
  const signals: CandidateSignal[] = DETECTION_SIGNALS.flatMap((s) =>
    s.test(page) ? [{ key: s.key, weight: s.weight, reason: s.reason }] : [],
  );
  const raw = signals.reduce((total, s) => total + s.weight, 0);
  return { score: Math.min(1, Math.round(raw * 1000) / 1000), signals };
};

const inScope = (page: PageDigest, settings?: SpaceSettings): boolean =>
  !settings || settings.spaceKey === "*" || settings.spaceKey === page.spaceKey;

/** Une candidate par page : score, raisons, recommandation. Rien n'est compilé ici. */
export const detectCandidates = async (
  deps: Deps,
  pages: readonly PageDigest[],
  settings?: SpaceSettings,
): Promise<readonly CandidatePage[]> => {
  const scannedAt = deps.clock.now();
  const existing = await deps.store.candidates.list();
  const byAri = new Map(existing.map((c) => [c.pageAri, c.id]));
  const out: CandidatePage[] = [];
  for (const page of pages) {
    if (!inScope(page, settings)) continue;
    const { score, signals } = scorePage(page, settings);
    const candidate: CandidatePage = {
      id: byAri.get(page.ari) ?? deps.ids.next("cnd"),
      pageAri: page.ari,
      title: page.title,
      spaceKey: page.spaceKey,
      score,
      signals,
      recommended: score >= RECOMMEND_THRESHOLD,
      scannedAt,
    };
    await deps.store.candidates.insert(candidate);
    out.push(candidate);
  }
  return [...out].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
};

/** Les raisons d'un score, telles qu'affichées à la personne qui confirme. */
export const explainScore = (candidate: CandidatePage, lang: "fr" | "en" = "fr"): string => {
  if (candidate.signals.length === 0) {
    return lang === "fr"
      ? "Aucun signal de procédure : page non recommandée."
      : "No procedure signal: page not recommended.";
  }
  const head =
    lang === "fr"
      ? `Score ${candidate.score.toFixed(2)} — ${candidate.recommended ? "recommandée" : "non recommandée"} :`
      : `Score ${candidate.score.toFixed(2)} — ${candidate.recommended ? "recommended" : "not recommended"}:`;
  return [head, ...candidate.signals.map((s) => `  · ${s.reason} (+${s.weight})`)].join("\n");
};
