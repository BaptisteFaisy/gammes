/**
 * Gammes — domaine : run.
 *
 * Contrat partagé : types immuables, syntaxe effaçable (pas d'enum, pas de
 * classe), aucune donnée par personne, aucun secret. Voir `docs/CONTRATS.md`.
 */

import type {
  ActorKind,
  ActorRef,
  GammeState,
  SyncState,
  StepKind,
  EvidenceStrength,
  EvidenceKind,
  OnFailure,
  RiskLevel,
  LockKind,
  AmendmentState,
  ConflictKind,
  ConflictState,
  GhostState,
  RunMode,
  RunOutcome,
  StepOutcome,
  RunStepState,
  ActorPolicy,
  ContentFingerprint,
  Lang,
  SourceSpan,
  EvidenceSpec,
  Evidence,
  SecretReplacement,
  StepLock,
} from "./common";


// ---------------------------------------------------------------------------
// Exécution, trace, déviation (§ 8)
// ---------------------------------------------------------------------------

export type RunStep = {
  readonly stepId: string;
  readonly state: RunStepState;
  readonly startedAt?: string;
  readonly doneAt?: string;
  readonly evidence?: Evidence;
  readonly refusedReason?: string;
  readonly attempts: number;
  /** Quand l'étape est une gamme composée : l'exécution enfant qui l'acquitte. */
  readonly subRunId?: string;
  readonly durationS?: number;
};

/** Origine d'une déviation : déclarée, ou produite par un refus de verrou. */
export type DeviationOrigin = "declared" | "lock_refusal" | "missing_evidence" | "ghost_gesture";

export type Deviation = {
  readonly id: string;
  readonly runId: string;
  readonly stepId?: string;
  readonly whatHappened: string;
  readonly why: string;
  readonly at: string;
  readonly actorKind: ActorKind;
  readonly origin: DeviationOrigin;
  readonly reviewedAt?: string;
};

export type TraceLinkTarget = "issue" | "incident" | "deployment" | "page";

export type TraceLink = {
  readonly targetType: TraceLinkTarget;
  readonly targetRef: string;
};

export type Run = {
  readonly id: string;
  readonly gammeId: string;
  readonly code: string;
  readonly versionId: string;
  readonly pinnedVersion: number;
  readonly actor: ActorRef;
  readonly ticketRef?: string;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly outcome?: RunOutcome;
  readonly mode: RunMode;
  /** Mode dégradé : raison écrite et revue différée obligatoire (§ 24). */
  readonly emergencyReason?: string;
  readonly emergencyReviewDueAt?: string;
  readonly resumedCount: number;
  /** Exécution enfant d'une étape composée : elle pointe vers son parent. */
  readonly parentRunId?: string;
  readonly parentStepId?: string;
  readonly steps: readonly RunStep[];
  readonly deviations: readonly Deviation[];
  readonly links: readonly TraceLink[];
  readonly notes?: string;
};

/** Vue lisible et citable d'une exécution close. */
export type TraceStep = {
  readonly ord: number;
  readonly stepId: string;
  readonly text: string;
  readonly state: RunStepState;
  readonly evidence?: Evidence;
  readonly refusedReason?: string;
  readonly durationS?: number;
};

export type Trace = {
  readonly runId: string;
  readonly code: string;
  readonly version: number;
  readonly actorKind: ActorKind;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly outcome?: RunOutcome;
  readonly mode: RunMode;
  readonly steps: readonly TraceStep[];
  readonly deviations: readonly Deviation[];
  readonly links: readonly TraceLink[];
  readonly durationS: number;
  /** Forme citable : `GAM-deploy-01@v7 · run_xxx`. */
  readonly citation: string;
};
