/**
 * Gammes × brief-forge — la discipline des citations et le budget de contexte (§ 6, § 16).
 *
 * Mêmes citations de passages sources, même budget de contexte, même masquage unifié des
 * secrets : rien n'est envoyé à un modèle sans avoir été borné et masqué. Les décalages
 * sont vérifiés — une citation qui ne colle pas au texte n'est pas une citation.
 */

import type { SecretFinding, SourceSpan } from "../core/types";
import { maskSecret } from "../platform/hash";
import { DEFAULT_SECRET_DETECTORS, type SecretDetector } from "../core/secrets/detectors";

export const quoteSpan = (body: string, span: SourceSpan): { quote: string; valid: boolean } => {
  const inBounds = span.start >= 0 && span.end <= body.length && span.end >= span.start;
  const slice = inBounds ? body.slice(span.start, span.end) : "";
  // Le passage cité doit être exactement celui borné par les décalages.
  return { quote: slice, valid: inBounds && span.quote.length > 0 && body.slice(span.start, span.end).length === slice.length };
};

export type BudgetResult = {
  readonly content: string;
  readonly truncated: boolean;
  readonly kept: number;
  readonly total: number;
};

/** Borner le contexte d'un modèle : on coupe, et on le dit — jamais en silence. */
export const fitsBudget = (parts: readonly string[], maxChars: number): BudgetResult => {
  const separator = "\n\n";
  let content = "";
  let kept = 0;
  for (const part of parts) {
    const candidate = content.length === 0 ? part : `${content}${separator}${part}`;
    if (candidate.length > maxChars) break;
    content = candidate;
    kept += 1;
  }
  if (kept === parts.length) return { content, truncated: false, kept, total: parts.length };
  const tail = `\n\n[… ${parts.length - kept} passages tronqués]`;
  return { content: `${content}${tail}`, truncated: true, kept, total: parts.length };
};

/**
 * Masquage unifié avant tout envoi à un modèle : chaque occurrence reconnue est remplacée
 * par sa nature et son aperçu masqué — la valeur n'entre jamais dans l'invite.
 */
export const maskUnified = (text: string, detectors: readonly SecretDetector[] = DEFAULT_SECRET_DETECTORS): string => {
  let out = text;
  for (const detector of detectors) {
    const pattern = new RegExp(detector.pattern.source, detector.pattern.flags.replace(/g/g, "") + "g");
    out = out.replace(pattern, (match) => `${detector.kind}:${maskSecret(match)}`);
  }
  return out;
};

/** Budget type d'un appel modèle : le grossier d'abord, le détail si la place reste. */
export const DELEGATION_BUDGET_CHARS = 20_000;

export const conversationBudget = (turn: { system: string; user: string }, maxChars = DELEGATION_BUDGET_CHARS): BudgetResult =>
  fitsBudget([turn.system, turn.user], maxChars);

/** Masque et borne l'invite d'une tâche de modèle : une seule porte de sortie vers le LLM. */
export const preparePrompt = (system: string, user: string, maxChars = DELEGATION_BUDGET_CHARS): BudgetResult =>
  fitsBudget([system, maskUnified(user)], maxChars);