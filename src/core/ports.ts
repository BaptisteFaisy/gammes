/**
 * Gammes — les ports (frontières du domaine).
 *
 * Le cœur ne connaît ni Forge, ni Confluence, ni Jira, ni aucun fournisseur de
 * modèle : il ne connaît que ces interfaces. Les adaptateurs vivent dans
 * `src/platform/` (Forge SQL, LLM hébergé, InferHub, mémoire pour les tests).
 * C'est ce qui permet de tester la recette complète hors plateforme (§ 25).
 */

import type {
  ActorKind,
  BudgetDay,
  CandidatePage,
  Conflict,
  Conciliation,
  ContentFingerprint,
  Coverage,
  ExportRecord,
  GhostCandidate,
  IssueDigest,
  PageDigest,
  PermitCheck,
  Run,
  SecretFinding,
  SpaceSettings,
  StepStat,
  Amendment,
  Binding,
  Deviation,
  Gamme,
  GammeVersion,
} from "./types";

// ---------------------------------------------------------------------------
// Utilitaires transverses
// ---------------------------------------------------------------------------

export interface Clock {
  now(): string;
  /** Pour les tests : avance contrôlée. */
  plusDays?(days: number): string;
}

export interface IdGen {
  next(prefix: string): string;
}

export interface Hasher {
  /** Empreinte du contenu normalisé d'une page : sert la désynchronisation. */
  contentHash(text: string): ContentFingerprint;
  hash(text: string): string;
}

// ---------------------------------------------------------------------------
// Modèle : déterministe d'abord, LLM sur l'ambigu seulement (§ 6, § 23)
// ---------------------------------------------------------------------------

export type LlmTask =
  | "extract_prose"
  | "qualify_step"
  | "reword_falsifiable"
  | "summarize_amendment"
  | "conciliate_conflict"
  | "cluster_ghost";

export type LlmRequest = {
  readonly task: LlmTask;
  readonly prompt: string;
  /** Cache par empreinte de contenu : même page, même réponse, zéro appel. */
  readonly cacheKey?: string;
  readonly json?: boolean;
  readonly maxTokens?: number;
};

export type LlmResponse = {
  readonly text: string;
  readonly model: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly cached: boolean;
};

export interface LlmClient {
  readonly name: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
}

/** Budget affiché, jamais caché (§ 23 « sobriété »). */
export interface LlmBudget {
  record(task: LlmTask, res: LlmResponse): void;
  snapshot(): BudgetDay;
}

// ---------------------------------------------------------------------------
// Atlassian : Confluence, Jira, graphe
// ---------------------------------------------------------------------------

export interface ConfluencePort {
  getPage(pageAri: string): Promise<PageDigest>;
  listPages(spaceKey: string): Promise<readonly PageDigest[]>;
  isReachable(): Promise<boolean>;
  /** Écrire `asUser()` : à valider par prototype (§ 22). Jamais automatique. */
  proposePageEdit?(pageAri: string, diff: string, reason: string): Promise<{ readonly url: string }>;
}

export interface JiraPort {
  getIssue(issueId: string): Promise<IssueDigest>;
  searchIssues(projectKey: string | undefined, limit: number): Promise<readonly IssueDigest[]>;
}

/** Droit manquant = résultat vide sans erreur ; l'écran de couverture distingue les deux. */
export interface GraphPort {
  servicesFor(pageAri: string): Promise<readonly string[]>;
  projectsFor(pageAri: string): Promise<readonly string[]>;
  ownerOf(pageAri: string): Promise<string | undefined>;
  readable(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Portefeuille réutilisé : une seule implémentation par logique (§ 16)
// ---------------------------------------------------------------------------

/** `permis-forge` : le verrou de permis appelle son registre, ne le réinvente pas. */
export interface PermitRegistry {
  check(actorId: string, actorKind: ActorKind, permitClass: string, scope: string): Promise<PermitCheck>;
  requestUrl(permitClass: string): string;
}

/** `placard-wiki` : détecteurs de secrets et de données personnelles. */
export interface SecretScanner {
  scan(text: string, pageAri: string): readonly SecretFinding[];
}

/** `deja-vu-ci` : signature d'échec, pour regrouper les erreurs d'étape. */
export interface FailureSignatures {
  signatureOf(errorText: string): string;
}

/** `chantiers-en-collision` : réservation de ressource exclusive. */
export interface ReservationRegistry {
  tryReserve(resource: string, runId: string): Promise<{ readonly reserved: boolean; readonly holder?: string }>;
  release(resource: string, runId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Persistance : collections + journal d'audit immuable
// ---------------------------------------------------------------------------

export interface Collection<T> {
  list(filter?: (item: T) => boolean): Promise<readonly T[]>;
  get(id: string): Promise<T | undefined>;
  insert(item: T): Promise<T>;
  update(id: string, patch: (item: T) => T): Promise<T | undefined>;
  count(filter?: (item: T) => boolean): Promise<number>;
}

export type DomainEventKind =
  | "gamme.compiled"
  | "gamme.approved"
  | "gamme.deprecated"
  | "run.started"
  | "run.step_recorded"
  | "run.refused"
  | "run.deviated"
  | "run.finished"
  | "binding.stale"
  | "amendment.proposed"
  | "amendment.decided"
  | "conflict.raised"
  | "conflict.conciliated"
  | "conflict.resolved"
  | "ghost.proposed"
  | "secret.found"
  | "skill.exported"
  | "stats.computed";

export type DomainEvent = {
  readonly id: string;
  readonly at: string;
  readonly kind: DomainEventKind;
  readonly subjectRef: string;
  readonly actorKind?: ActorKind;
  readonly payload: Readonly<Record<string, unknown>>;
};

export interface Store {
  readonly gammes: Collection<Gamme>;
  readonly versions: Collection<GammeVersion>;
  readonly runs: Collection<Run>;
  readonly bindings: Collection<Binding>;
  readonly amendments: Collection<Amendment>;
  readonly stepStats: Collection<StepStat>;
  readonly conflicts: Collection<Conflict>;
  readonly conciliations: Collection<Conciliation>;
  readonly ghosts: Collection<GhostCandidate>;
  readonly permits: Collection<PermitCheck>;
  readonly exports: Collection<ExportRecord>;
  readonly coverage: Collection<Coverage>;
  readonly budget: Collection<BudgetDay>;
  readonly findings: Collection<SecretFinding>;
  readonly candidates: Collection<CandidatePage>;
  readonly settings: Collection<SpaceSettings>;
  /** Déviations : table à part, comme au § 21. */
  readonly deviations: Collection<Deviation>;
  appendEvent(event: Omit<DomainEvent, "id">): Promise<DomainEvent>;
  events(filter?: (e: DomainEvent) => boolean): Promise<readonly DomainEvent[]>;
}

/** Ce dont le cœur a besoin, regroupé — un seul objet à construire en test. */
export type Deps = {
  readonly store: Store;
  readonly clock: Clock;
  readonly ids: IdGen;
  readonly hasher: Hasher;
  readonly llm: LlmClient;
  readonly budget: LlmBudget;
  readonly confluence?: ConfluencePort;
  readonly jira?: JiraPort;
  readonly graph?: GraphPort;
  readonly permits?: PermitRegistry;
  readonly secrets?: SecretScanner;
  readonly signatures?: FailureSignatures;
  readonly reservations?: ReservationRegistry;
};
