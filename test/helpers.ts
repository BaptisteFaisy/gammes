/**
 * Gammes — fixtures partagées de la recette (§ 25).
 *
 * Tout test construit ses objets ici : mêmes formes partout, aucune duplication
 * d'un fichier de test à l'autre (règle de la maison).
 */

import type { Clock, Deps, Hasher, IdGen, LlmClient, Store } from "../src/core/ports";
import type {
  ActorRef,
  ContentFingerprint,
  EvidenceSpec,
  Gamme,
  GammeScope,
  GammeVersion,
  InputSpec,
  PageDigest,
  SourceSpan,
  Step,
  StepLock,
  IssueDigest,
} from "../src/core/types";
import { memoryStore } from "../src/platform/memory-store";
import { fixedClock } from "../src/platform/clock";
import { seqIds } from "../src/platform/ids";
import { makeHasher } from "../src/platform/hash";
import { forbiddenLlm } from "../src/platform/llm/fake-llm";
import { memoryBudget } from "../src/platform/llm/budget";

export const T0 = "2026-11-11T09:00:00.000Z";

export type DepsOverrides = Partial<Omit<Deps, "store">> & { readonly store?: Store };

export const makeStore = (): Store => memoryStore();

export const makeClock = (start = T0): Clock & { advanceDays(d: number): void } => fixedClock(start);

export const makeIds = (start = 0): IdGen => seqIds(start);

export const makeHasherDeps = (): Hasher => makeHasher();

/** Dépendances complètes, sans aucun port Atlassian : le cœur tourne seul. */
export const makeDeps = (overrides: DepsOverrides = {}): Deps => ({
  store: overrides.store ?? makeStore(),
  clock: overrides.clock ?? makeClock(),
  ids: overrides.ids ?? makeIds(),
  hasher: overrides.hasher ?? makeHasherDeps(),
  llm: overrides.llm ?? forbiddenLlm(),
  budget: overrides.budget ?? memoryBudget("2026-11-11"),
  ...(overrides.confluence ? { confluence: overrides.confluence } : {}),
  ...(overrides.jira ? { jira: overrides.jira } : {}),
  ...(overrides.graph ? { graph: overrides.graph } : {}),
  ...(overrides.permits ? { permits: overrides.permits } : {}),
  ...(overrides.secrets ? { secrets: overrides.secrets } : {}),
  ...(overrides.signatures ? { signatures: overrides.signatures } : {}),
  ...(overrides.reservations ? { reservations: overrides.reservations } : {}),
});

// ---------------------------------------------------------------------------
// Étapes
// ---------------------------------------------------------------------------

export const span = (over: Partial<SourceSpan> = {}): SourceSpan => ({
  pageAri: over.pageAri ?? "ari:cloud:confluence:demo:page/1001",
  start: over.start ?? 0,
  end: over.end ?? 40,
  quote: over.quote ?? "Déployer la version candidate puis vérifier.",
});

export const evidenceSpec = (over: Partial<EvidenceSpec> = {}): EvidenceSpec => ({
  kind: over.kind ?? "command_output",
  strength: over.strength ?? "machine",
  required: over.required ?? true,
  ...(over.hint ? { hint: over.hint } : {}),
});

export const lock = (kind: StepLock["kind"], reason: string, over: Partial<StepLock> = {}): StepLock => ({
  kind,
  reason,
  ...(over.permitClass ? { permitClass: over.permitClass } : {}),
  ...(over.replacement ? { replacement: over.replacement } : {}),
});

export const makeStep = (over: Partial<Step> = {}): Step => ({
  id: over.id ?? "stp_1",
  ord: over.ord ?? 1,
  kind: over.kind ?? "command",
  text: over.text ?? "Déployer la version candidate sur paiements.",
  evidence: over.evidence ?? evidenceSpec(),
  locks: over.locks ?? [],
  humanOnly: over.humanOnly ?? false,
  idempotent: over.idempotent ?? true,
  risk: over.risk ?? "low",
  onFailure: over.onFailure ?? "stop",
  source: over.source ?? span(),
  falsifiable: over.falsifiable ?? true,
  ...(over.command !== undefined ? { command: over.command } : {}),
  ...(over.expectedResult !== undefined ? { expectedResult: over.expectedResult } : {}),
  ...(over.riskClass !== undefined ? { riskClass: over.riskClass } : {}),
  ...(over.timeoutS !== undefined ? { timeoutS: over.timeoutS } : {}),
  ...(over.section !== undefined ? { section: over.section } : {}),
  ...(over.falsifiabilityNote !== undefined ? { falsifiabilityNote: over.falsifiabilityNote } : {}),
  ...(over.rewording !== undefined ? { rewording: over.rewording } : {}),
  ...(over.inferredBy !== undefined ? { inferredBy: over.inferredBy } : {}),
  ...(over.inferredReason !== undefined ? { inferredReason: over.inferredReason } : {}),
});

export const makeInput = (over: Partial<InputSpec> = {}): InputSpec => ({
  name: over.name ?? "service",
  type: over.type ?? "string",
  required: over.required ?? true,
  ...(over.description ? { description: over.description } : {}),
  ...(over.enumValues ? { enumValues: over.enumValues } : {}),
});

// ---------------------------------------------------------------------------
// Versions et gammes
// ---------------------------------------------------------------------------

export const makeVersion = (over: Partial<GammeVersion> = {}): GammeVersion => ({
  id: over.id ?? "ver_1",
  gammeId: over.gammeId ?? "gam_1",
  version: over.version ?? 1,
  title: over.title ?? "Déployer le service paiements",
  compiledAt: over.compiledAt ?? T0,
  compiledBy: over.compiledBy ?? "ari:cloud:aaid:demo:compileur",
  inputs: over.inputs ?? [makeInput()],
  steps: over.steps ?? [makeStep()],
  conditions: over.conditions ?? { preconditions: [], postconditions: [] },
  fallback: over.fallback ?? { steps: [] },
  actorPolicy: over.actorPolicy ?? "human_or_permitted_agent",
  exclusive: over.exclusive ?? false,
  immutable: true,
  sourcePages: over.sourcePages ?? ["ari:cloud:confluence:demo:page/1001"],
  ...(over.sourcePageAri !== undefined ? { sourcePageAri: over.sourcePageAri } : {}),
  ...(over.contentHash !== undefined ? { contentHash: over.contentHash } : {}),
  ...(over.approvedAt !== undefined ? { approvedAt: over.approvedAt } : {}),
  ...(over.approvedByRef !== undefined ? { approvedByRef: over.approvedByRef } : {}),
  ...(over.reviewDueAt !== undefined ? { reviewDueAt: over.reviewDueAt } : {}),
  ...(over.notes !== undefined ? { notes: over.notes } : {}),
  ...(over.estimatedDurationS !== undefined ? { estimatedDurationS: over.estimatedDurationS } : {}),
});

export const scope = (over: Partial<GammeScope> = {}): GammeScope => ({
  services: over.services ?? ["paiements"],
  projects: over.projects ?? ["PAY"],
  spaces: over.spaces ?? ["SRE"],
});

export const makeGamme = (over: Partial<Gamme> = {}): Gamme => ({
  id: over.id ?? "gam_1",
  code: over.code ?? "GAM-deploy-01",
  title: over.title ?? "Déployer le service paiements",
  state: over.state ?? "approved",
  spaceKey: over.spaceKey ?? "SRE",
  currentVersion: over.currentVersion ?? 1,
  risk: over.risk ?? "low",
  exclusive: over.exclusive ?? false,
  createdAt: over.createdAt ?? T0,
  scope: over.scope ?? scope(),
  sync: over.sync ?? "synced",
  ...(over.ownerRef !== undefined ? { ownerRef: over.ownerRef } : {}),
  ...(over.approvedAt !== undefined ? { approvedAt: over.approvedAt } : {}),
  ...(over.approvedByRef !== undefined ? { approvedByRef: over.approvedByRef } : {}),
  ...(over.reviewDueAt !== undefined ? { reviewDueAt: over.reviewDueAt } : {}),
  ...(over.deprecatedAt !== undefined ? { deprecatedAt: over.deprecatedAt } : {}),
  ...(over.replacedBy !== undefined ? { replacedBy: over.replacedBy } : {}),
});

// ---------------------------------------------------------------------------
// Pages, tickets, acteurs
// ---------------------------------------------------------------------------

export const makePage = (over: Partial<PageDigest> = {}): PageDigest => ({
  ari: over.ari ?? "ari:cloud:confluence:demo:page/1001",
  id: over.id ?? "1001",
  spaceKey: over.spaceKey ?? "SRE",
  title: over.title ?? "Procédure : déployer le service paiements",
  storageBody: over.storageBody ?? defaultStorageBody(),
  labels: over.labels ?? ["runbook", "deploiement"],
  lastModifiedAt: over.lastModifiedAt ?? T0,
  pageVersion: over.pageVersion ?? 3,
  wordCount: over.wordCount ?? 220,
  reachable: over.reachable ?? true,
  ...(over.viewsLast30d !== undefined ? { viewsLast30d: over.viewsLast30d } : {}),
  ...(over.linkedFromOnCall !== undefined ? { linkedFromOnCall: over.linkedFromOnCall } : {}),
});

/** Une page de procédure réaliste : titre, liste numérotée, bloc de code, case à cocher. */
export const defaultStorageBody = (): string =>
  [
    "<h1>Procédure : déployer le service paiements</h1>",
    "<p>Cette procédure décrit le déploiement en production du service paiements.</p>",
    "<h2>Avant de commencer</h2>",
    "<ul><li>Le merge check doit être vert.</li></ul>",
    "<h2>Étapes</h2>",
    "<ol>",
    "<li>Vérifier que le pipeline est vert sur la version candidate.</li>",
    "<li>Déployer la version candidate avec la commande suivante :",
    "<ac:structured-macro ac:name=\"code\"><ac:plain-text-body><![CDATA[kubectl rollout status deploy/paiements]]></ac:plain-text-body></ac:structured-macro>",
    "</li>",
    "<li>Contrôler le taux d'erreur pendant 5 minutes.</li>",
    "<li>Faire valider le déploiement par le responsable d'astreinte.</li>",
    "</ol>",
    "<h2>Si ça tourne mal</h2>",
    "<p>Revenir à la version précédente : kubectl rollout undo deploy/paiements.</p>",
  ].join("\n");

export const makeIssue = (over: Partial<IssueDigest> = {}): IssueDigest => ({
  id: over.id ?? "10001",
  key: over.key ?? "PAY-101",
  projectKey: over.projectKey ?? "PAY",
  summary: over.summary ?? "Réinitialiser le coffre de clés paiements",
  components: over.components ?? ["paiements"],
  labels: over.labels ?? [],
  createdAt: over.createdAt ?? T0,
  transitions: over.transitions ?? ["To Do", "In Progress", "Done"],
  commentBodies: over.commentBodies ?? ["Fait à la main, voir le commentaire."],
  assigneeCount: over.assigneeCount ?? 1,
  ...(over.resolvedAt !== undefined ? { resolvedAt: over.resolvedAt } : {}),
});

export const human = (id = "ari:cloud:aaid:demo:ana"): ActorRef => ({ id, kind: "human" });
export const agent = (id = "ari:cloud:rovo:agent:compagnon"): ActorRef => ({ id, kind: "agent" });

export const fingerprint = (hasher: Hasher, body: string): ContentFingerprint => hasher.contentHash(body);

/** Client LLM de secours quand un test a besoin d'un modèle sans scripter. */
export const echoLlm = (): LlmClient => ({
  name: "fake/echo",
  complete: async (req) => ({
    text: `echo:${req.task}`,
    model: "fake/echo",
    tokensIn: 1,
    tokensOut: 1,
    cached: false,
  }),
});
