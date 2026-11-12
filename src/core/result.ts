/**
 * Gammes — résultat, erreurs et refus.
 *
 * Le produit refuse autant qu'il propose : chaque refus est explicite, motivé,
 * bilingue, et enregistré (une tentative d'agent sur un verrou humain devient
 * une déviation, jamais une erreur silencieuse — § 9).
 */

export type ErrorCode =
  | "lock_human_only"
  | "lock_permit_missing"
  | "lock_secret"
  | "evidence_required"
  | "gamme_not_approved"
  | "gamme_deprecated"
  | "gamme_without_owner"
  | "version_immutable"
  | "unknown_gamme"
  | "unknown_version"
  | "unknown_run"
  | "unknown_step"
  | "unknown_conflict"
  | "conciliator_unavailable"
  | "step_not_current"
  | "run_already_finished"
  | "exclusive_busy"
  | "input_missing"
  | "input_invalid"
  | "source_unavailable"
  | "not_enough_history"
  | "conflict_unresolved"
  | "approval_requires_human"
  | "unknown_publication"
  | "unknown_graph_link"
  | "publication_state"
  | "graph_link_state"
  | "composite_requires_subrun"
  | "subrun_not_started"
  | "subrun_not_finished"
  | "internal";

export type AppError = {
  readonly code: ErrorCode;
  /** Message en français (langue par défaut de l'atelier). */
  readonly messageFr: string;
  readonly messageEn: string;
  readonly details?: Readonly<Record<string, unknown>>;
  /** Vrai quand le refus provient d'un verrou : la tentative doit être tracée. */
  readonly lockRefusal?: boolean;
};

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Failure = { readonly ok: false; readonly error: AppError };
export type Result<T> = Ok<T> | Failure;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const fail = (
  code: ErrorCode,
  messageFr: string,
  messageEn: string,
  details?: Readonly<Record<string, unknown>>,
  lockRefusal = false,
): Failure => ({ ok: false, error: { code, messageFr, messageEn, details, lockRefusal } });

export const isOk = <T>(r: Result<T>): r is Ok<T> => r.ok;

export const isFailure = <T>(r: Result<T>): r is Failure => !r.ok;

/** Lève sur un échec : réservé aux tests et aux chemins déjà validés. */
export const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.messageFr}`);
  return r.value;
};

export const message = (e: AppError, lang: "fr" | "en"): string =>
  lang === "fr" ? e.messageFr : e.messageEn;

export const mapValue = <A, B>(r: Result<A>, f: (a: A) => B): Result<B> =>
  r.ok ? ok(f(r.value)) : r;

/** Refus canoniques — mêmes mots partout, aucun agent ne les reformule. */
export const refusals = {
  humanOnly: (stepId: string, actor: string): Failure =>
    fail(
      "lock_human_only",
      `Étape ${stepId} réservée à un humain : un agent ne peut pas l'acquitter.`,
      `Step ${stepId} is human-only: an agent cannot acknowledge it.`,
      { stepId, actor },
      true,
    ),
  permitMissing: (stepId: string, permitClass: string, requestUrl?: string): Failure =>
    fail(
      "lock_permit_missing",
      `Étape ${stepId} : permis « ${permitClass} » requis pour un agent.`,
      `Step ${stepId}: permit "${permitClass}" is required for an agent.`,
      { stepId, permitClass, requestUrl },
      true,
    ),
  secretFound: (stepId: string, findingId: string): Failure =>
    fail(
      "lock_secret",
      `Étape ${stepId} : un secret a été détecté, publication refusée (signalement ${findingId}).`,
      `Step ${stepId}: a secret was detected, publication refused (finding ${findingId}).`,
      { stepId, findingId },
      true,
    ),
  evidenceRequired: (stepId: string, kind: string): Failure =>
    fail(
      "evidence_required",
      `Étape ${stepId} : une preuve « ${kind} » est exigée pour avancer.`,
      `Step ${stepId}: "${kind}" evidence is required to move on.`,
      { stepId, kind },
    ),
  notApproved: (code: string, state: string): Failure =>
    fail(
      "gamme_not_approved",
      `Gamme ${code} non approuvée (état : ${state}) : non invocable par un agent.`,
      `Gammes ${code} is not approved (state: ${state}): agents cannot invoke it.`,
      { code, state },
    ),
  stepNotCurrent: (stepId: string, currentId: string): Failure =>
    fail(
      "step_not_current",
      `Étape ${stepId} non acquittable : l'étape courante est ${currentId}.`,
      `Step ${stepId} cannot be acknowledged: current step is ${currentId}.`,
      { stepId, currentId },
    ),
  exclusiveBusy: (code: string, runId: string): Failure =>
    fail(
      "exclusive_busy",
      `Gamme ${code} exclusive : l'exécution ${runId} est déjà en cours.`,
      `Gammes ${code} is exclusive: run ${runId} is already in progress.`,
      { code, runId },
    ),
  approvalRequiresHuman: (actor: string): Failure =>
    fail(
      "approval_requires_human",
      "Approuver une gamme est un acte humain daté : refusé à un agent.",
      "Approving a gamme is a dated human act: refused to an agent.",
      { actor },
      true,
    ),
  notEnoughHistory: (n: number, threshold: number): Failure =>
    fail(
      "not_enough_history",
      `Pas assez de recul (${n} exécutions, seuil ${threshold}).`,
      `Not enough history (${n} runs, threshold ${threshold}).`,
      { n, threshold },
    ),
  sourceUnavailable: (pageAri: string): Failure =>
    fail(
      "source_unavailable",
      `Page source injoignable (${pageAri}) : la gamme approuvée reste déroulable depuis la base.`,
      `Source page unreachable (${pageAri}): the approved gamme still runs from the store.`,
      { pageAri },
    ),
  unknownConflict: (id: string): Failure =>
    fail(
      "unknown_conflict",
      `Conflit ${id} introuvable.`,
      `Conflict ${id} not found.`,
      { conflictId: id },
    ),
  conciliatorUnavailable: (conflictId: string, reason: string): Failure =>
    fail(
      "conciliator_unavailable",
      `Conciliateur indisponible pour le conflit ${conflictId} : ${reason}. Le conflit reste porté aux propriétaires.`,
      `Conciliator unavailable for conflict ${conflictId}: ${reason}. The conflict is still raised to both owners.`,
      { conflictId, reason },
    ),
} as const;
