/**
 * Gammes — les pages de politique (§ 13).
 *
 * Une page déclarée « politique » dans les réglages d'espace prescrit des exigences
 * (nombre d'approbations, gestes interdits). Une gamme dont une étape contredit la
 * page produit un conflit `policy_contradiction`, avec le passage de la politique
 * ET le passage de la gamme cités de part et d'autre. Extraction déterministe :
 * la détection d'un conflit ne dépend jamais d'un modèle.
 */

import type { PageDigest, SourceSpan } from "../types";
import type { ConflictDraft, LoadedGamme } from "./facts";
import { stepKey } from "./facts";

export type PolicyRequirement =
  | { readonly kind: "approvals"; readonly count: number; readonly span: SourceSpan }
  | { readonly kind: "forbidden"; readonly action: string; readonly span: SourceSpan };

const APPROVALS_RE = /(\d+)\s*(?:approbations?|validations?|relectures?|approvals?)/gi;
const FORBIDDEN_RE = /(?:interdit de|ne jamais|ne pas|must not|never)\s+([^.;\n]{4,90})/gi;

/** Le texte brut d'une page peut être du storage Confluence : on compare sur du texte nu. */
export const stripMarkup = (body: string): string =>
  body
    .replace(/<ac:structured-macro[\s\S]*?CDATA\[([\s\S]*?)\]\][\s\S]*?<\/ac:structured-macro>/gi, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const spanOf = (text: string, pageAri: string, index: number, length: number): SourceSpan => ({
  pageAri,
  start: index,
  end: index + length,
  quote: text.slice(index, index + length).trim(),
});

const approvalsOf = (text: string, pageAri: string): readonly PolicyRequirement[] => {
  const out: PolicyRequirement[] = [];
  for (const m of text.matchAll(APPROVALS_RE)) {
    const count = Number(m[1]);
    if (!Number.isFinite(count) || count === 0) continue;
    out.push({ kind: "approvals", count, span: spanOf(text, pageAri, m.index ?? 0, m[0].length) });
  }
  return out;
};

const forbiddenOf = (text: string, pageAri: string): readonly PolicyRequirement[] => {
  const out: PolicyRequirement[] = [];
  for (const m of text.matchAll(FORBIDDEN_RE)) {
    const action = (m[1] ?? "").trim();
    if (action.length < 4) continue;
    out.push({ kind: "forbidden", action, span: spanOf(text, pageAri, m.index ?? 0, m[0].length) });
  }
  return out;
};

export const readPolicyRequirements = (
  body: string,
  pageAri: string,
): readonly PolicyRequirement[] => {
  const text = stripMarkup(body);
  return [...approvalsOf(text, pageAri), ...forbiddenOf(text, pageAri)];
};

const approvalsConflict = (
  loaded: LoadedGamme,
  req: Extract<PolicyRequirement, { kind: "approvals" }>,
  pageAri: string,
): ConflictDraft | undefined => {
  const service = loaded.gamme.scope.services[0] ?? loaded.gamme.spaceKey;
  const fact = loaded.facts.find((f) => f.kind === "approvals" && f.subject === `approbations:${service}`);
  const have = fact?.count ?? 0;
  if (have >= req.count) return undefined;
  return {
    kind: "policy_contradiction",
    gammeA: loaded.gamme.code,
    policyPageAri: pageAri,
    service,
    facts: [
      {
        subject: `approbations:${service}`,
        left: `la politique exige ${req.count} approbation(s)`,
        right: fact?.value ?? "aucune approbation humaine exigée par la gamme",
        leftSpan: req.span,
        ...(fact ? { rightSpan: fact.spans[0] } : {}),
      },
    ],
  };
};

const forbiddenConflict = (
  loaded: LoadedGamme,
  req: Extract<PolicyRequirement, { kind: "forbidden" }>,
  pageAri: string,
): ConflictDraft | undefined => {
  const needle = req.action.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const hit = loaded.version.steps.find((s) => {
    const hay = `${s.text} ${s.command ?? ""} ${stepKey(s)}`.toLowerCase();
    return needle.length > 0 && needle.every((w) => hay.includes(w));
  });
  if (!hit) return undefined;
  return {
    kind: "policy_contradiction",
    gammeA: loaded.gamme.code,
    policyPageAri: pageAri,
    service: loaded.gamme.scope.services[0],
    facts: [
      {
        subject: `interdit:${req.action.slice(0, 40)}`,
        left: `la politique interdit : ${req.action}`,
        right: `la gamme prescrit : ${hit.text}`,
        leftSpan: req.span,
        rightSpan: hit.source,
      },
    ],
  };
};

/** Conflits entre une gamme et une page de politique. Rien n'est tranché : on expose. */
export const policyConflicts = (
  loaded: LoadedGamme,
  requirements: readonly PolicyRequirement[],
  page: PageDigest,
): readonly ConflictDraft[] =>
  requirements.flatMap((req) =>
    req.kind === "approvals"
      ? [approvalsConflict(loaded, req, page.ari)].filter((c): c is ConflictDraft => c !== undefined)
      : [forbiddenConflict(loaded, req, page.ari)].filter((c): c is ConflictDraft => c !== undefined),
  );
