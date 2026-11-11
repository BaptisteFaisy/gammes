/**
 * Gammes — domaine : atelier.
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
// Liaison page ↔ gamme (§ 10)
// ---------------------------------------------------------------------------

export type Binding = {
  readonly id: string;
  readonly gammeId: string;
  readonly pageAri: string;
  readonly contentHash: ContentFingerprint;
  readonly syncedAt: string;
  readonly staleSince?: string;
  readonly lastDiffJson?: string;
  readonly sync: SyncState;
};

// ---------------------------------------------------------------------------
// Amendements, statistiques, fantômes, conflits (§ 11, § 12, § 13)
// ---------------------------------------------------------------------------

export type Amendment = {
  readonly id: string;
  readonly gammeId: string;
  readonly stepId?: string;
  readonly proposal: string;
  readonly rationale: string;
  readonly evidenceRefs: readonly string[];
  readonly state: AmendmentState;
  readonly proposedAt: string;
  readonly proposedBy: ActorKind;
  readonly decidedAt?: string;
  readonly decidedByRef?: string;
};

/** Effectif d'une cohorte : sous le seuil, on ne conclut pas (§ 5). */
export type Cohort = {
  readonly n: number;
  readonly threshold: number;
  readonly enoughHistory: boolean;
};

/** `value === undefined` ⇔ « pas assez de recul » : aucun pourcentage affiché. */
export type Rate = {
  readonly value?: number;
  readonly low?: number;
  readonly high?: number;
  readonly cohort: Cohort;
};

export type StepStat = {
  readonly id: string;
  readonly versionId: string;
  readonly stepId: string;
  readonly period: string;
  readonly n: number;
  readonly failRate: Rate;
  readonly skipRate: Rate;
  readonly deviations: number;
  readonly medianS?: number;
  readonly computedAt: string;
};

export type VersionComparison = {
  readonly code: string;
  readonly left: { readonly version: number; readonly failRate: Rate; readonly medianS?: number };
  readonly right: { readonly version: number; readonly failRate: Rate; readonly medianS?: number };
  readonly verdict: "improved" | "unchanged" | "degraded" | "not_enough_history";
};

export type GhostCandidate = {
  readonly id: string;
  readonly clusterKey: string;
  readonly label: string;
  readonly sampleIssueIds: readonly string[];
  readonly n: number;
  readonly spanDays: number;
  readonly medianHandleH: number;
  /** Nombre de personnes différentes — jamais de nom, jamais de classement. */
  readonly peopleCount: number;
  readonly costDays: number;
  readonly state: GhostState;
  readonly draftGammeId?: string;
  readonly projectKey?: string;
  readonly detectedAt: string;
};

export type ConflictFact = {
  readonly subject: string;
  readonly left: string;
  readonly right: string;
  readonly leftSpan?: SourceSpan;
  readonly rightSpan?: SourceSpan;
};

export type Conflict = {
  readonly id: string;
  readonly kind: ConflictKind;
  readonly gammeA: string;
  readonly gammeB?: string;
  readonly policyPageAri?: string;
  readonly service?: string;
  readonly facts: readonly ConflictFact[];
  readonly state: ConflictState;
  readonly raisedAt: string;
  readonly resolvedAt?: string;
  readonly resolutionNote?: string;
  /** Dossier préparé par le conciliateur — jamais une décision (§ 13). */
  readonly conciliationId?: string;
};

/** Dossier de conciliation : propositions rédigées, tranchées par les humains. */
export type Conciliation = {
  readonly id: string;
  readonly conflictId: string;
  readonly engine: string;
  readonly model: string;
  readonly summary: string;
  readonly options: readonly ConciliationOption[];
  readonly createdAt: string;
  readonly decidedOptionId?: string;
  readonly decidedByRef?: string;
};

export type ConciliationOption = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly affects: readonly string[];
  readonly requiresHuman: true;
};

// ---------------------------------------------------------------------------
// Verrou de permis, exports, couverture, budget (§ 9, § 18, § 23)
// ---------------------------------------------------------------------------

export type PermitCheck = {
  readonly id: string;
  readonly stepId: string;
  readonly permitClass: string;
  readonly permitId?: string;
  readonly checkedAt: string;
  readonly result: "granted" | "denied" | "unknown_service";
  readonly requestUrl?: string;
};

export type ExportRecord = {
  readonly id: string;
  readonly gammeId: string;
  readonly versionId: string;
  readonly skillMdHash: string;
  readonly exportedAt: string;
  readonly downloads: number;
};

export type Coverage = {
  readonly id: string;
  readonly scope: string;
  readonly pagesDetected: number;
  readonly compiledPct: number;
  readonly approvedPct: number;
  readonly tracedPct: number;
  readonly stalePct: number;
  readonly computedAt: string;
};

export type BudgetDay = {
  readonly day: string;
  readonly compiled: number;
  readonly llmCalls: number;
  readonly tokens: number;
  readonly costEstimate: number;
};

// ---------------------------------------------------------------------------
// Détection des candidates, réglages, signalements (§ 6, § 21)
// ---------------------------------------------------------------------------

export type PageDigest = {
  readonly ari: string;
  readonly id: string;
  readonly spaceKey: string;
  readonly title: string;
  /** Format storage de Confluence. */
  readonly storageBody: string;
  readonly labels: readonly string[];
  readonly lastModifiedAt: string;
  readonly pageVersion: number;
  readonly wordCount: number;
  readonly viewsLast30d?: number;
  readonly linkedFromOnCall?: boolean;
  readonly reachable: boolean;
};

export type CandidateSignal = {
  readonly key: string;
  readonly weight: number;
  readonly reason: string;
};

export type CandidatePage = {
  readonly id: string;
  readonly pageAri: string;
  readonly title: string;
  readonly spaceKey: string;
  readonly score: number;
  readonly signals: readonly CandidateSignal[];
  readonly recommended: boolean;
  readonly scannedAt: string;
};

export type SecretFinding = {
  readonly id: string;
  readonly detector: string;
  readonly kind: "api_key" | "password" | "personal_data" | "token" | "certificate";
  readonly where: SourceSpan;
  /** Empreinte et aperçu masqué : le secret n'est jamais copié (§ 9). */
  readonly fingerprint: string;
  readonly maskedPreview: string;
  readonly replacement: SecretReplacement;
  readonly openedAt: string;
  readonly state: "open" | "resolved";
};

export type SpaceSettings = {
  readonly spaceKey: string;
  readonly riskMotifs: readonly string[];
  readonly policyPages: readonly string[];
  readonly statThreshold: number;
  readonly lockPolicy: ActorPolicy;
  readonly reviewAfterDays: number;
  readonly dustAfterDays: number;
  readonly lang: Lang;
};

/** Un ticket Jira/JSM, matière première des gammes fantômes (§ 12). */
export type IssueDigest = {
  readonly id: string;
  readonly key: string;
  readonly projectKey: string;
  readonly summary: string;
  readonly components: readonly string[];
  readonly labels: readonly string[];
  readonly createdAt: string;
  readonly resolvedAt?: string;
  readonly transitions: readonly string[];
  readonly commentBodies: readonly string[];
  readonly assigneeCount: number;
};
