/**
 * GA-16 — l'encart Jira : quelle gamme s'applique à ce ticket, ce qu'elle exige
 * de l'opérateur, et ce qui a déjà été exécuté.
 *
 * Trois questions, dans cet ordre : **quelle gamme**, **la démarrer**, **voir les
 * traces**. Tout ce qui se calcule vit ici, en fonctions pures `(deps, args)` ;
 * le `.tsx` ne fait que mettre en forme. Un refus de verrou se rend comme un
 * refus lisible — jamais comme une erreur technique.
 *
 * Discipline : aucune identité d'acteur ne sort d'ici (GA-21), et une gamme qui
 * n'existe pas n'est jamais remplacée par une invention.
 */

import type { Deps } from "../../core/ports";
import type { ActorKind } from "../../core/types";
import { findProcedure } from "../../core/mcp/search";
import { startRun } from "../../core/run/runs";
import { getGammeByCode, getVersion, isInvocable } from "../../core/version/versioning";
import { tracesOfIssue, type TraceRef } from "../../jira/trace-gate";

/** Une entrée typée demandée par la gamme. */
export type PanelInput = {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly description?: string;
};

/** Une gamme candidate pour ce ticket. */
export type PanelCandidate = {
  readonly code: string;
  readonly title: string;
  readonly version: number;
  readonly state: string;
  readonly confidence: number;
  readonly reasons: readonly string[];
  /** La gamme est-elle invocable (approuvée, propriétaire, non dépréciée) ? */
  readonly invocable: boolean;
  /** L'étape contient-elle un verrou humain ou un verrou de permis ? */
  readonly requiresHuman: boolean;
  readonly requiresPermit: boolean;
  readonly inputs: readonly PanelInput[];
};

/** La preuve attendue par une étape : ce qu'elle doit laisser derrière elle. */
export type PanelProof = {
  readonly kind: string;
  readonly strength: string;
  readonly required: boolean;
  readonly hint?: string;
};

/** Une étape de la gamme, avec la preuve attendue et la preuve acquittée. */
export type PanelStep = {
  readonly stepId: string;
  readonly ord: number;
  readonly text: string;
  readonly proofExpected: PanelProof;
  readonly locks: readonly { readonly kind: string; readonly reason: string }[];
  /** La preuve réellement laissée par l'exécution, si l'étape a été franchie. */
  readonly proof?: { readonly kind: string; readonly strength: string; readonly ref: string };
};

/** L'état de l'encart pour un ticket. */
export type PanelState = {
  readonly issueKey: string;
  readonly candidates: readonly PanelCandidate[];
  /** Y a-t-il une gamme applicable ? Sinon l'encart le dit — il n'invente rien. */
  readonly applies: boolean;
  /** Les entrées encore à fournir pour la première candidate applicable. */
  readonly missingInputs: readonly string[];
  /** Les traces déjà liées à ce ticket. */
  readonly traces: readonly TraceRef[];
};

const verrousDe = (locks: readonly { kind: string }[]) => ({
  human: locks.some((l) => l.kind === "human"),
  permit: locks.some((l) => l.kind === "permit"),
});

/** Les candidats, avec leurs exigences : c'est le cœur de l'encart. */
const candidats = async (deps: Deps, args: { summary?: string; service?: string }): Promise<readonly PanelCandidate[]> => {
  const matches = await findProcedure(deps, {
    query: args.summary ?? "",
    context: { service: args.service },
  });
  const out: PanelCandidate[] = [];
  for (const match of matches) {
    const gamme = await getGammeByCode(deps, match.code);
    const version = gamme ? await getVersion(deps, match.code) : undefined;
    const steps = version?.ok ? version.value.steps : [];
    const verrous = verrousDe(steps.flatMap((s) => s.locks));
    out.push({
      code: match.code,
      title: match.title,
      version: match.version,
      state: match.state,
      confidence: match.confidence,
      reasons: match.reasons,
      invocable: gamme ? isInvocable(gamme) : false,
      requiresHuman: verrous.human,
      requiresPermit: verrous.permit,
      inputs: version?.ok
        ? version.value.inputs.map((i) => ({
            name: i.name, type: i.type, required: i.required, description: i.description,
          }))
        : [],
    });
  }
  return out;
};

/** Les entrées encore manquantes pour la première gamme applicable. */
const manquantes = (candidate: PanelCandidate | undefined, fournis: readonly string[]): readonly string[] => {
  if (!candidate) return [];
  return candidate.inputs
    .filter((i) => i.required && !fournis.includes(i.name))
    .map((i) => i.name);
};

/** L'état complet de l'encart pour un ticket. */
export const panelState = async (
  deps: Deps,
  args: { readonly issueKey: string; readonly summary?: string; readonly service?: string; readonly provided?: readonly string[] },
): Promise<PanelState> => {
  const candidates = await candidats(deps, { summary: args.summary, service: args.service });
  const applicable = candidates.find((c) => c.invocable);
  const traces = await tracesOfIssue(deps, args.issueKey);
  return {
    issueKey: args.issueKey,
    candidates,
    applies: Boolean(applicable),
    missingInputs: manquantes(applicable, args.provided ?? []),
    traces,
  };
};

/** Les traces liées au ticket, en Alleyes de citation. */
export const panelTraces = async (deps: Deps, issueKey: string): Promise<readonly TraceRef[]> =>
  tracesOfIssue(deps, issueKey);

/**
 * Les étapes d'une gamme avec, pour chacune, **la preuve attendue** et **la
 * preuve acquittée**.
 *
 * C'est la règle du produit, appliquée au premier écran : on ne dit jamais
 * qu'une étape est faite sans montrer ce qui l'atteste. Une étape franchie sans
 * preuve reste sans preuve — l'écran la signale, il ne l'arrange pas.
 */
export const panelSteps = async (
  deps: Deps,
  args: { readonly code: string; readonly runId?: string },
): Promise<readonly PanelStep[]> => {
  const version = await getVersion(deps, args.code);
  if (!version.ok) return [];
  const run = args.runId ? await deps.store.runs.get(args.runId) : undefined;
  const preuves = new Map((run?.steps ?? []).map((s) => [s.stepId, s.evidence]));
  return [...version.value.steps]
    .sort((a, b) => a.ord - b.ord)
    .map((step) => {
      const preuve = preuves.get(step.id);
      return {
        stepId: step.id,
        ord: step.ord,
        text: step.text,
        proofExpected: {
          kind: step.evidence.kind,
          strength: step.evidence.strength,
          required: step.evidence.required,
          ...(step.evidence.hint ? { hint: step.evidence.hint } : {}),
        },
        locks: step.locks.map((l) => ({ kind: l.kind, reason: l.reason })),
        ...(preuve ? { proof: { kind: preuve.kind, strength: preuve.strength, ref: preuve.ref } } : {}),
      };
    });
};
