/**
 * Gammes — domaine : gamme.
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
// Étapes, entrées, versions, gammes
// ---------------------------------------------------------------------------

export type Step = {
  readonly id: string;
  readonly ord: number;
  readonly kind: StepKind;
  readonly text: string;
  readonly command?: string;
  readonly expectedResult?: string;
  readonly evidence: EvidenceSpec;
  readonly locks: readonly StepLock[];
  readonly humanOnly: boolean;
  readonly idempotent: boolean;
  readonly risk: RiskLevel;
  /** Classe d'actions à risque (`rm -rf`, `DROP`, `kubectl delete`, force-push…). */
  readonly riskClass?: string;
  readonly onFailure: OnFailure;
  readonly timeoutS?: number;
  readonly source: SourceSpan;
  /** Une étape invérifiable est signalée, jamais devinée (§ 7). */
  readonly falsifiable: boolean;
  readonly falsifiabilityNote?: string;
  readonly rewording?: string;
  readonly section?: string;
  /** Ajout du modèle sur prose ambiguë : la raison est toujours visible. */
  readonly inferredBy?: "rule" | "model";
  readonly inferredReason?: string;
  /** Une étape composée appelle une autre gamme (GA-32), acquittée par sa trace. */
  readonly subGamme?: SubGammeRef;
};

/** Référence vers une gamme appelée par une étape composée (GA-32). */
export type SubGammeRef = {
  readonly code: string;
  /** Version précise, ou la version courante au lancement. */
  readonly version?: number;
};

export type InputType = "string" | "number" | "boolean" | "enum" | "date" | "ref";

export type InputSpec = {
  readonly name: string;
  readonly type: InputType;
  readonly required: boolean;
  readonly description?: string;
  readonly enumValues?: readonly string[];
};

export type Conditions = {
  readonly preconditions: readonly string[];
  readonly postconditions: readonly string[];
};

export type Fallback = {
  readonly text?: string;
  /** Étapes de repli, elles aussi outillées. */
  readonly steps: readonly Step[];
};

export type GammeScope = {
  readonly services: readonly string[];
  readonly projects: readonly string[];
  readonly spaces: readonly string[];
};

/** Une version est IMMUABLE ; une exécution est épinglée à sa version (§ 4). */
export type GammeVersion = {
  readonly id: string;
  readonly gammeId: string;
  readonly version: number;
  readonly title: string;
  readonly sourcePageAri?: string;
  readonly contentHash?: ContentFingerprint;
  readonly compiledAt: string;
  readonly compiledBy: string;
  readonly approvedAt?: string;
  readonly approvedByRef?: string;
  readonly reviewDueAt?: string;
  readonly notes?: string;
  readonly inputs: readonly InputSpec[];
  readonly steps: readonly Step[];
  readonly conditions: Conditions;
  readonly fallback: Fallback;
  readonly actorPolicy: ActorPolicy;
  readonly estimatedDurationS?: number;
  readonly exclusive: boolean;
  readonly immutable: true;
  /** Provenance multi-pages : une étape cite sa page et son passage (§ 24). */
  readonly sourcePages: readonly string[];
};

export type Gamme = {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly state: GammeState;
  readonly ownerRef?: string;
  readonly spaceKey: string;
  readonly currentVersion: number;
  readonly risk: RiskLevel;
  readonly exclusive: boolean;
  readonly createdAt: string;
  readonly approvedAt?: string;
  readonly approvedByRef?: string;
  readonly reviewDueAt?: string;
  readonly deprecatedAt?: string;
  readonly replacedBy?: string;
  readonly scope: GammeScope;
  readonly sync: SyncState;
};
