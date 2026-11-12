/**
 * Gammes — domaine : common.
 *
 * Contrat partagé : types immuables, syntaxe effaçable (pas d'enum, pas de
 * classe), aucune donnée par personne, aucun secret. Voir `docs/CONTRATS.md`.
 */

// ---------------------------------------------------------------------------
// Acteurs, natures, états
// ---------------------------------------------------------------------------

/** Un humain, ou un agent. Toute trace nomme l'acteur et SA NATURE. */
export type ActorKind = "human" | "agent";

export type ActorRef = {
  readonly id: string;
  readonly kind: ActorKind;
  /** Affichage seulement. Jamais utilisé pour une statistique. */
  readonly displayName?: string;
};

/** Cycle de vie d'une gamme (§ 14). */
export type GammeState = "draft" | "in_review" | "approved" | "deprecated";

/** État du couple page ↔ gamme (§ 10). */
export type SyncState = "synced" | "stale" | "source_gone" | "unknown";

/** Les cinq natures d'une étape (§ 4). */
export type StepKind = "manual" | "command" | "check" | "decision" | "notification";

/** Force d'une preuve : machine > attestée > déclarée (grille reprise de `preuve-a-l-appui`). */
export type EvidenceStrength = "machine" | "attested" | "declared";

export type EvidenceKind =
  | "command_output"
  | "build_link"
  | "screenshot"
  | "log_ref"
  | "ticket_ref"
  | "attestation"
  | "none";

/** Conduite en cas d'échec d'une étape. */
export type OnFailure = "stop" | "retry" | "escalate" | "skip_with_reason";

export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

/** Les trois verrous (§ 9) : humain, permis, secret. */
export type LockKind = "human" | "permit" | "secret";

export type AmendmentState = "proposed" | "in_review" | "accepted" | "rejected";

export type ConflictKind = "requirement_mismatch" | "policy_contradiction" | "exclusive_resource";

export type ConflictState = "raised" | "acknowledged" | "resolved" | "dismissed";

export type GhostState = "proposed" | "drafted" | "adopted" | "dismissed";

export type RunMode = "normal" | "emergency";

export type RunOutcome = "succeeded" | "failed" | "aborted" | "expired";

export type StepOutcome = "done" | "failed" | "skipped" | "refused";

export type RunStepState = "pending" | "current" | "done" | "failed" | "skipped" | "refused";

/** Qui peut dérouler : par gamme ET par étape (§ 7). */
export type ActorPolicy = "human_only" | "human_or_permitted_agent" | "agent_free";

/** Empreinte de contenu normalisé — sert la détection de désynchronisation (§ 10). */
export type ContentFingerprint = string;

/** Langue d'interface (§ 23 : anglais et français). */
export type Lang = "fr" | "en";

// ---------------------------------------------------------------------------
// Provenance : rien n'est affirmé sans sa source (§ 6, étage 2)
// ---------------------------------------------------------------------------

export type SourceSpan = {
  readonly pageAri: string;
  /** Décalages dans le texte de la page (storage format). */
  readonly start: number;
  readonly end: number;
  /** Le passage cité, tel quel. */
  readonly quote: string;
};

// ---------------------------------------------------------------------------
// Preuves et verrous
// ---------------------------------------------------------------------------

export type EvidenceSpec = {
  readonly kind: EvidenceKind;
  readonly strength: EvidenceStrength;
  readonly required: boolean;
  /** Ce que l'opérateur doit laisser derrière lui, en clair. */
  readonly hint?: string;
};

export type Evidence = {
  readonly kind: EvidenceKind;
  readonly strength: EvidenceStrength;
  /** Référence, jamais le contenu brut d'un secret. */
  readonly ref: string;
  readonly capturedAt: string;
  readonly note?: string;
  /**
   * D'où vient la preuve : `real` (produite par l'exécution qui la porte) ou
   * `fixture` (posée d'avance pour la démo). L'app l'affiche : elle ne fait
   * jamais passer une fixture pour une preuve réelle.
   */
  readonly origin?: "real" | "fixture";
};

/** Emplacement proposé à la place d'un secret détecté (§ 9, verrou de secret). */
export type SecretReplacement = {
  readonly kind: "vault_link" | "env_var" | "secret_manager";
  readonly target: string;
  readonly findingId: string;
};

export type StepLock = {
  readonly kind: LockKind;
  readonly reason: string;
  /** Classe d'actions pour le verrou de permis (`permis-forge`). */
  readonly permitClass?: string;
  readonly replacement?: SecretReplacement;
};
