/**
 * GA-25 — le flux Jira de la version humaine d'une gamme, et le validateur de
 * transition qui exige une trace.
 *
 * La règle du produit tient en une phrase : **une transition vers « Terminé » ne
 * passe pas tant qu'aucune trace d'exécution close n'est liée au ticket** (§ 4 :
 * l'app ne dit jamais « la procédure est respectée » sans trace). Le refus est
 * motivé et dit exactement ce qui manque — il ne note personne (GA-21) : une
 * trace cite la nature de l'acteur, jamais son identité.
 *
 * Fonctions pures `(deps, args) => …` : testables hors Forge, sans réseau.
 */

import type { Deps } from "../core/ports";
import type { ActorKind, RunOutcome } from "../core/types";
import { getGammeByCode, getVersion } from "../core/version/versioning";

/** Pourquoi une transition est refusée. */
export type RefusalReason = "no_trace" | "no_closed_trace" | "unknown_gamme";

/** Une trace liée au ticket, citable : version épinglée, issue, nature d'acteur. */
export type TraceRef = {
  readonly runId: string;
  readonly code: string;
  readonly version: number;
  readonly closed: boolean;
  readonly actorKind: ActorKind;
  readonly outcome?: RunOutcome;
  readonly startedAt: string;
  readonly finishedAt?: string;
};

/** Le verdict du validateur : autorisé, ou refusé avec ce qui manque. */
export type TransitionVerdict =
  | { readonly allowed: true; readonly issueKey: string; readonly traces: readonly TraceRef[] }
  | {
      readonly allowed: false;
      readonly issueKey: string;
      readonly reason: RefusalReason;
      readonly message: string;
      readonly messageEn: string;
    };

/** Une étape de la version humaine : ce que le ticket doit porter comme transition. */
export type WorkflowStep = {
  readonly ord: number;
  readonly stepId: string;
  readonly transition: string;
  readonly text: string;
  readonly humanOnly: boolean;
  readonly evidenceRequired: boolean;
};

const ref = (r: {
  id: string; code: string; pinnedVersion: number; finishedAt?: string;
  outcome?: RunOutcome; startedAt: string; actor: { kind: ActorKind };
}): TraceRef => ({
  runId: r.id,
  code: r.code,
  version: r.pinnedVersion,
  closed: r.finishedAt !== undefined,
  actorKind: r.actor.kind,
  startedAt: r.startedAt,
  ...(r.outcome ? { outcome: r.outcome } : {}),
  ...(r.finishedAt ? { finishedAt: r.finishedAt } : {}),
});

/** Les traces liées à un ticket, les plus récentes d'abord, sans identité d'acteur. */
export const tracesOfIssue = async (deps: Deps, issueKey: string): Promise<readonly TraceRef[]> => {
  const runs = await deps.store.runs.list((r) => r.ticketRef === issueKey);
  return runs.map(ref).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
};

/** Le verdict de transition : une trace close est exigée, et une seule suffit. */
export const validateTransition = async (
  deps: Deps,
  args: { issueKey: string },
): Promise<TransitionVerdict> => {
  const issueKey = args.issueKey;
  if (!issueKey) {
    return {
      allowed: false, issueKey: "", reason: "no_trace",
      message: "Aucun ticket identifié : la transition ne peut pas être vérifiée.",
      messageEn: "No issue identified: the transition cannot be verified.",
    };
  }
  const traces = await tracesOfIssue(deps, issueKey);
  if (traces.length === 0) {
    return {
      allowed: false, issueKey, reason: "no_trace",
      message: `Aucune exécution de gamme liée à ${issueKey}. Déroulez la gamme applicable (outil start-run avec ticketRef), puis rejouez la transition.`,
      messageEn: `No gamme run linked to ${issueKey}. Run the applicable gamme (start-run with ticketRef), then retry the transition.`,
    };
  }
  const closes = traces.filter((t) => t.closed);
  if (closes.length === 0) {
    return {
      allowed: false, issueKey, reason: "no_closed_trace",
      message: `${traces.length} exécution(s) liée(s) à ${issueKey}, aucune n'est close. Terminez l'exécution (finish-run) pour produire la trace.`,
      messageEn: `${traces.length} run(s) linked to ${issueKey}, none closed. Finish the run (finish-run) to produce the trace.`,
    };
  }
  return { allowed: true, issueKey, traces: closes };
};

/**
 * Le flux Jira de la version humaine : une transition par étape, dans l'ordre de
 * la gamme. Généré depuis la gamme — jamais une seconde source de vérité.
 */
export const humanWorkflow = async (
  deps: Deps,
  code: string,
): Promise<{ readonly code: string; readonly version: number; readonly steps: readonly WorkflowStep[] } | undefined> => {
  const gamme = await getGammeByCode(deps, code);
  if (!gamme) return undefined;
  const version = await getVersion(deps, code);
  if (!version.ok) return undefined;
  const steps = [...version.value.steps]
    .sort((a, b) => a.ord - b.ord)
    .map((s) => ({
      ord: s.ord,
      stepId: s.id,
      transition: `Gammes ${version.value.version}.${s.ord} — ${s.text.slice(0, 40)}`,
      text: s.text,
      humanOnly: s.locks.some((l) => l.kind === "human"),
      evidenceRequired: s.evidence.required,
    }));
  return { code: gamme.code, version: version.value.version, steps };
};
