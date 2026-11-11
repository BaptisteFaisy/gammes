# CONTRATS — qui possède quoi, et avec quelles signatures

Ce fichier est la loi du dépôt. Plusieurs personnes (et plusieurs agents) écrivent en parallèle :
chacun possède des dossiers, personne ne touche aux fichiers partagés, et les signatures publiques
sont fixées ici **avant** d'écrire le code. Si une signature doit changer, on ne la change pas en
silence : on ouvre une demande dans `docs/DEMANDES/<branche>.md` et l'intégrateur tranche.

## Règles de la maison (bloquantes en CI, `npm run lint`)

1. Aucun fichier ≥ **500 lignes** ; aucune fonction ≥ **50 lignes**. Au-delà : découper.
2. **Zéro duplication** : chercher l'existant avant d'écrire, paramétrer au lieu de copier.
3. Syntaxe effaçable seulement : pas d'`enum`, pas de `namespace`, pas de classe dans `src/core/`.
4. `src/core/` ne lit jamais l'heure système : passer par le port `Clock`.
5. Aucune statistique par personne, nulle part (GA-21) : pas de `byActor`, `perPerson`, `ranking`,
   `classement`, `leaderboard`.
6. Aucun secret commité. Une fausse clé de fixture porte le marqueur
   `// gammes-allow-secret-fixture` sur sa ligne.
7. Tests sans réseau : `forbiddenLlm()` par défaut dans `makeDeps()`, ports bouchonnés sinon.

## Fichiers partagés — lecture seule pour tout le monde

`package.json`, `package-lock.json`, `tsconfig.json`, `manifest.yml`, `.github/**`,
`scripts/check-limits.mjs`, `src/core/types.ts`, `src/core/types/*.ts`, `src/core/ports.ts`,
`src/core/result.ts`, `test/helpers.ts`.

Besoin d'une dépendance npm, d'un type, d'un code d'erreur, d'une fixture ? →
`docs/DEMANDES/<branche>.md`, l'intégrateur l'applique sur `main`.

## Branches et intégration

- Une branche par lot, `feat/<lot>`, poussée **puis PR ouverte dans la minute** (draft si WIP).
- Une branche meurt avec son PR : merge ou fermeture ⇒ branche supprimée côté GitHub et en local.
- Chaque lot vit dans un worktree : `git worktree add ../gammes-wt/<branche> -b feat/<branche>`.
- Avant de pousser : `npm run verify` vert (lint + typecheck + tests).
- Les conflits de fusion sont traités par des agents **hermes** (voir `CONTRIBUTING.md`).

## Le socle déjà en place

```ts
src/core/types.ts            // baril : types/common.ts, types/gamme.ts, types/run.ts, types/atelier.ts
src/core/result.ts           // Result<T>, AppError, ErrorCode, refusals.* (refus canoniques)
src/core/ports.ts            // Clock, IdGen, Hasher, LlmClient, LlmBudget, ConfluencePort, JiraPort,
                             // GraphPort, PermitRegistry, SecretScanner, FailureSignatures,
                             // ReservationRegistry, Collection<T>, Store, Deps, DomainEvent
src/platform/memory-store.ts // memoryStore(): Store
src/platform/clock.ts        // systemClock, fixedClock, steppingClock, shiftDays, daysBetween
src/platform/ids.ts          // seqIds, randomIds, listIds
src/platform/hash.ts         // contentFingerprint, normalizeContent, maskSecret, makeHasher
src/platform/llm/*           // memoryBudget, fakeLlm, scriptedLlm, forbiddenLlm, inferHubLlm
test/helpers.ts              // makeDeps, makeGamme, makeVersion, makeStep, makePage, makeIssue,
                             // span, evidenceSpec, lock, human(), agent(), T0
```

`Deps` est l'unique point d'entrée d'un service : `monService(deps: Deps, args)`.

---

## Lot A — `feat/compilateur-front` (GA-01, GA-02, GA-03, GA-04, GA-11, GA-28)

Dossiers possédés : `src/core/detect/`, `src/core/extract/`, `src/core/qualify/`, `src/core/risk/`,
`src/core/falsifiable/`, `src/core/secrets/`, `test/compilateur-front/`.

```ts
// src/core/detect/detect-candidates.ts
export const scorePage: (page: PageDigest, settings?: SpaceSettings) => { score: number; signals: readonly CandidateSignal[] };
export const detectCandidates: (deps: Deps, pages: readonly PageDigest[], settings?: SpaceSettings) => Promise<readonly CandidatePage[]>;   // persiste dans Store.candidates (async), déduplique par ARI
export const DETECTION_SIGNALS: readonly { key: string; weight: number; test: (p: PageDigest) => boolean; reason: string }[];

// src/core/extract/extract-steps.ts
export type DraftStep = { readonly ord: number; readonly kind: StepKind; readonly text: string;
  readonly command?: string; readonly expectedResult?: string; readonly source: SourceSpan;
  readonly sectionTitle?: string; readonly inferredBy: "rule" | "model"; readonly inferredReason?: string };
export type ParsedBlock = { readonly kind: "heading" | "list_item" | "checkbox" | "code" | "table_row" | "paragraph";
  readonly level?: number; readonly text: string; readonly command?: string; readonly start: number;
  readonly end: number; readonly section: string };
export type ExtractionResult = { readonly drafts: readonly DraftStep[]; readonly usedModel: boolean;
  readonly modelTasks: readonly string[]; readonly inputs: readonly InputSpec[] };
export const extractSteps: (deps: Deps, page: PageDigest) => Promise<ExtractionResult>;
export const parseStorageBody: (page: PageDigest) => readonly ParsedBlock[];   // déterministe, sans LLM
export const extractInputs: (blocks: readonly ParsedBlock[]) => readonly InputSpec[];
export const stripTags: (html: string) => string;

// src/core/qualify/qualify-steps.ts
export const qualifySteps: (deps: Deps, drafts: readonly DraftStep[], page: PageDigest) => Promise<readonly Step[]>;

// src/core/risk/risk-motifs.ts
export type RiskMotif = { readonly class: string; readonly pattern: RegExp; readonly level: RiskLevel; readonly label: string };
export const DEFAULT_RISK_MOTIFS: readonly RiskMotif[];   // rm -rf, DROP, kubectl delete, force-push, prod, données perso
export const detectRisk: (text: string, command?: string, motifs?: readonly RiskMotif[]) => RiskMotif | undefined;

// src/core/falsifiable/falsifiability.ts
export const assessFalsifiability: (text: string) => { falsifiable: boolean; note?: string };
export const proposeRewording: (deps: Deps, step: Step) => Promise<string | undefined>;

// src/core/secrets/detectors.ts
export type SecretDetector = { readonly name: string; readonly kind: SecretFinding["kind"]; readonly pattern: RegExp };
export const DEFAULT_SECRET_DETECTORS: readonly SecretDetector[];
export const detectSecrets: (deps: Deps, text: string, pageAri: string) => readonly SecretFinding[];
export const replacementFor: (finding: Omit<SecretFinding, "replacement">) => SecretReplacement;
```

Invariants : chaque étape porte son `SourceSpan` exact (décalages dans le `storageBody`) ; le modèle
n'est appelé **que** sur la prose ambiguë, avec `cacheKey = contentFingerprint(page.storageBody)` ;
un test prouve que `forbiddenLlm()` suffit sur une page bien formée.

## Lot B — `feat/moteur-execution` (GA-07, GA-08, GA-09, GA-12, GA-29)

Dossiers : `src/core/run/`, `src/core/locks/`, `src/core/trace/`, `test/moteur-execution/`.

```ts
// src/core/locks/locks.ts
export type LockDecision = { readonly allowed: boolean; readonly applied: readonly StepLock[];
  readonly permit?: PermitCheck; readonly refusal?: AppError };
export const evaluateStepLocks: (deps: Deps, args: { step: Step; actor: ActorRef; scope: string }) => Promise<LockDecision>;

// src/core/run/runs.ts
export type RunStart = { readonly run: Run; readonly step: Step; readonly evidence: EvidenceSpec; readonly locks: readonly StepLock[] };
export type CurrentStep = { readonly run: Run; readonly step: Step; readonly evidence: EvidenceSpec;
  readonly locks: readonly StepLock[]; readonly progress: { done: number; total: number } };
export type RecordOutcome = { readonly accepted: boolean; readonly next?: CurrentStep; readonly refusal?: AppError;
  readonly deviation?: Deviation };
export const startRun: (deps: Deps, args: { code: string; inputs: Record<string, unknown>; actor: ActorRef;
  ticketRef?: string; mode?: RunMode; emergencyReason?: string }) => Promise<Result<RunStart>>;
export const getCurrentStep: (deps: Deps, runId: string) => Promise<Result<CurrentStep>>;
export const recordStep: (deps: Deps, args: { runId: string; stepId: string; outcome: StepOutcome;
  evidence?: Evidence; reason?: string; actor: ActorRef }) => Promise<Result<RecordOutcome>>;
export const reportDeviation: (deps: Deps, args: { runId: string; stepId?: string; whatHappened: string;
  why: string; actor: ActorRef; origin?: DeviationOrigin }) => Promise<Result<Deviation>>;
export const resumeRun: (deps: Deps, runId: string, actor: ActorRef) => Promise<Result<CurrentStep>>;
export const finishRun: (deps: Deps, args: { runId: string; outcome: RunOutcome; notes?: string }) => Promise<Result<Trace>>;

// src/core/trace/trace.ts
export const buildTrace: (deps: Deps, run: Run) => Promise<Trace>;
export const citeRun: (run: Run) => string;                       // « GAM-deploy-01@v7 · run_3 »
export const renderTraceMarkdown: (trace: Trace, lang: Lang) => string;
```

Invariants : un agent sur une étape `human_only` ⇒ refus **et** déviation `origin: "lock_refusal"` ;
preuve exigée absente ⇒ l'étape n'avance pas ; la version est épinglée au démarrage ; mode urgence ⇒
raison écrite + `emergencyReviewDueAt` à 7 jours ; aucun secret dans une trace (références seulement).

## Lot C — `feat/mesures-atelier` (GA-19, GA-20, GA-21, GA-22, GA-24, GA-18)

Dossiers : `src/core/stats/`, `src/core/amendments/`, `src/core/ghosts/`, `src/core/coverage/`,
`test/mesures-atelier/`.

```ts
// src/core/stats/rates.ts
export const DEFAULT_THRESHOLD = 30;
export const cohortOf: (n: number, threshold?: number) => Cohort;
export const rate: (numerator: number, n: number, threshold?: number) => Rate;   // value undefined sous le seuil
export const notEnoughHistory: (n: number, threshold?: number) => Rate;

// src/core/stats/step-stats.ts
export const computeStepStats: (deps: Deps, args: { code: string; version?: number; period?: string;
  threshold?: number }) => Promise<readonly StepStat[]>;
export const compareVersions: (deps: Deps, code: string, left: number, right: number) => Promise<VersionComparison>;
export const failingSteps: (deps: Deps, args: { code: string; threshold?: number }) => Promise<readonly StepStat[]>;

// src/core/stats/workshop.ts
export type DustItem = { readonly gammeId: string; readonly code: string; readonly kind: "dust" | "cobweb" | "stale" | "orphan";
  readonly ageDays: number; readonly reason: string };
export const workshopDust: (deps: Deps, settings?: SpaceSettings) => Promise<readonly DustItem[]>;
export const freshness: (deps: Deps) => Promise<{ syncedPct: number; medianGapDays: number; staleOver90d: number }>;

// src/core/amendments/amendments.ts
export const proposeFromTraces: (deps: Deps, args: { code: string; stepId?: string; threshold?: number }) => Promise<Result<readonly Amendment[]>>;
export const proposeAmendment: (deps: Deps, args: { gammeId: string; stepId?: string; proposal: string;
  rationale: string; evidenceRefs: readonly string[]; proposedBy: ActorKind }) => Promise<Result<Amendment>>;
export const decideAmendment: (deps: Deps, id: string, decision: "accepted" | "rejected", by: ActorRef) => Promise<Result<Amendment>>;

// src/core/ghosts/ghosts.ts
export const detectGhosts: (deps: Deps, args: { projectKey?: string; limit?: number }) => Promise<readonly GhostCandidate[]>;
export const adoptGhost: (deps: Deps, ghostId: string, owner: ActorRef) => Promise<Result<Gamme>>;

// src/core/coverage/coverage.ts
export const computeCoverage: (deps: Deps, scope: string) => Promise<Coverage>;
```

Invariants : sous le seuil ⇒ `Rate.value === undefined` et aucun pourcentage rendu ; aucune agrégation
par acteur ; un amendement n'est jamais appliqué seul (il propose) ; `decideAmendment` refuse un agent.

## Lot D — `feat/conflits-hermes` (GA-23 + le conciliateur)

Dossiers : `src/core/conflicts/`, `src/core/conciliation/`, `agents/hermes-conciliator.md`,
`docs/HERMES.md`, `scripts/hermes-conciliate.ts`, `test/conflits/`.

```ts
// src/core/conflicts/detect.ts
export const detectConflicts: (deps: Deps, args?: { service?: string }) => Promise<readonly Conflict[]>;
export const raiseConflict: (deps: Deps, conflict: Omit<Conflict, "id" | "state" | "raisedAt">) => Promise<Result<Conflict>>;
export const acknowledgeConflict: (deps: Deps, id: string, by: ActorRef) => Promise<Result<Conflict>>;
export const resolveConflict: (deps: Deps, id: string, by: ActorRef, note: string) => Promise<Result<Conflict>>;

// src/core/conciliation/hermes.ts
export const HERMES_CONDUCT: string;                       // la conduite du conciliateur, en clair
export const conciliate: (deps: Deps, conflictId: string, opts?: { llm?: LlmClient }) => Promise<Result<Conciliation>>;
export const decideConciliation: (deps: Deps, id: string, optionId: string, by: ActorRef) => Promise<Result<Conciliation>>;
```

Invariants : **un conflit n'est jamais tranché par l'app** — le conciliateur produit un dossier
(options + conséquences + passages cités de part et d'autre), `decideConciliation` exige un humain ;
chaque option porte `requiresHuman: true` ; les citations viennent des `SourceSpan`, jamais réécrites.
Le conciliateur tourne sur le LLM du port (`LlmTask = "conciliate_conflict"`), donc sur le LLM hébergé
dans Forge et sur InferHub dans le harness local (`scripts/hermes-conciliate.ts`).

## Lot E — `feat/integrations-portefeuille` (§ 16, GA-12, GA-27)

Dossiers : `src/integrations/`, `test/integrations/`. Un adaptateur par app du portefeuille, chacun
implémente **un port** et ne réinvente rien :

```
permis-forge.ts        → PermitRegistry      (classes d'actions, permis, demande de permis)
preuve-a-l-appui.ts    → grille de force des preuves : strengthFor(kind, ctx): EvidenceStrength
placard-wiki.ts        → SecretScanner       (délègue aux détecteurs de src/core/secrets/)
brief-forge.ts         → discipline des citations + budget de contexte : quoteSpan(), contextBudget()
delegable-ou-pas.ts    → cohortes et seuil : delegableSteps(stats): { delegable, needsHuman, notEnoughHistory }
deja-vu-ci.ts          → FailureSignatures   (signature d'échec des étapes)
chantiers-en-collision.ts → ReservationRegistry (ressource exclusive)
vigie.ts               → export des résultats clés de niveau A (part tracée, taux d'échec, fraîcheur)
graph.ts               → GraphPort           (lecture Teamwork Graph ; droit manquant = vide, pas d'erreur)
```

Chaque adaptateur est utilisable **hors Forge** (bouchon local) et documente l'appel réel dans son
en-tête. Aucun secret, aucun appel réseau en test.

## Lot F — `feat/cycle-de-vie` (GA-05, GA-06, GA-10) — fait

Dossiers : `src/core/compile/`, `src/core/version/`, `src/core/binding/`, `src/platform/forge/`,
`test/cycle-de-vie/`.

```ts
// src/core/compile/compile-page.ts
export type CompileOutcome = { readonly gamme: Gamme; readonly version: GammeVersion;
  readonly diff: string; readonly findings: readonly SecretFinding[]; readonly nonFalsifiable: readonly string[];
  readonly usedModel: boolean };
export const compilePage: (deps: Deps, args: { page: PageDigest; confirmedBy: ActorRef; spaceKey?: string }) => Promise<Result<CompileOutcome>>;

// src/core/version/versioning.ts
export type VersionDraft = Omit<GammeVersion, "id" | "gammeId" | "immutable" | "version">;  // la numérotation est calculée
export const createVersion: (deps: Deps, gammeId: string, draft: VersionDraft) => Promise<Result<GammeVersion>>;
export const isInvocable: (gamme: Gamme) => boolean;   // approuvée + propriétaire + non dépréciée
export const canTransition: (from: GammeState, to: GammeState) => boolean;
export const slugify: (title: string) => string;
export const approveVersion: (deps: Deps, args: { versionId: string; approver: ActorRef; reviewAfterDays?: number }) => Promise<Result<Gamme>>;
export const deprecateGamme: (deps: Deps, args: { gammeId: string; by: ActorRef; replacedBy?: string }) => Promise<Result<Gamme>>;
export const getVersion: (deps: Deps, code: string, version?: number) => Promise<Result<GammeVersion>>;
export const listVersions: (deps: Deps, gammeId: string) => Promise<readonly GammeVersion[]>;
export const nextCode: (deps: Deps, spaceKey: string, slug: string) => Promise<string>;   // GAM-deploy-01

// src/core/binding/binding.ts
export type SyncReport = { readonly sync: SyncState; readonly ageDays?: number; readonly diff?: string; readonly binding: Binding };
export const bindPage: (deps: Deps, gammeId: string, page: PageDigest) => Promise<Binding>;
export const upsertBinding: (deps: Deps, gammeId: string, page: PageDigest, extra?: Partial<Binding>) => Promise<Binding>;
export const checkSync: (deps: Deps, gammeId: string, page: PageDigest) => Promise<Result<SyncReport>>;
export const markSourceGone: (deps: Deps, gammeId: string) => Promise<Result<Binding>>;
export const markGammeSync: (deps: Deps, gammeId: string, sync: SyncState) => Promise<void>;
export const syncBindingToVersion: (deps: Deps, gammeId: string, version: GammeVersion) => Promise<void>;
export const stalenessOf: (binding: Binding, now: string) => number | undefined;
export const isRunnableWhileStale: (gamme: Gamme) => boolean;

// src/core/compile/recompile.ts — la recompilation vit chez `compile`, pas chez `binding`,
// pour éviter l'import circulaire (binding ← compile ← recompile).
export const proposeRecompile: (deps: Deps, args: { gammeId: string; page: PageDigest; confirmedBy: ActorRef }) => Promise<Result<CompileOutcome>>;

// src/platform/forge/ — schema.sql (DDL § 21), forge-sql.ts (Store sur @forge/sql),
// forge-hosted-llm.ts (LlmClient sur @forge/llm). Le port Clock exige désormais
// `plusDays(days, from?)` : les échéances (révision, revue différée) passent par là.
```

Invariants : compiler ne publie rien (état `draft`, diff fourni) ; une version approuvée est immuable ;
approbation = acte humain daté + `reviewDueAt` ; page modifiée ⇒ `stale` + âge + diff proposé ;
page disparue ⇒ `source_gone`, la gamme reste exécutable.

## Lot G — `feat/mcp-skill` (GA-13, GA-14, GA-26) — vague 2

Dossiers : `src/core/mcp/`, `src/core/export/`, `src/platform/webtrigger.ts`,
`skills/derouler-une-gamme/`, `agents/le-compagnon.md`, `test/mcp/`.

```ts
// src/core/mcp/tools.ts
export type McpToolKey = "find-procedure" | "check-before-acting" | "get-procedure" | "list-procedures"
  | "start-run" | "get-current-step" | "record-step" | "report-deviation" | "finish-run"
  | "get-run-trace" | "get-procedure-stats" | "propose-amendment" | "compile-page" | "export-skill"
  | "get-missing-procedures" | "get-conflicts";
export type McpToolDef = { readonly key: McpToolKey; readonly verb: "GET" | "CREATE" | "UPDATE";
  readonly description: string; readonly inputSchema: JsonSchema; readonly outputSchema: JsonSchema };
export const MCP_TOOLS: readonly McpToolDef[];
export const handleTool: (deps: Deps, key: McpToolKey, args: Record<string, unknown>) => Promise<McpToolResult>;
export const findProcedure: (deps: Deps, args: { query?: string; context?: { service?: string; env?: string; action?: string } }) => Promise<readonly ProcedureMatch[]>;
export const checkBeforeActing: (deps: Deps, args: { intendedAction: string; service?: string }) => Promise<BeforeActingVerdict>;

// src/core/export/skill-md.ts
export type SkillExport = { readonly skillMd: string; readonly files: Record<string, string>; readonly hash: string; readonly record: ExportRecord };
export const exportSkillMd: (deps: Deps, args: { code: string; version?: number; lang?: Lang }) => Promise<Result<SkillExport>>;
```

Invariants : aucun outil ne renvoie de secret ; aucun n'accepte une attestation humaine au nom d'un
agent ; `record-step` renvoie le refus explicite du verrou ; le `SKILL.md` exporté cite la version et
ne contient aucun secret (test automatique).

## Lot H — `feat/surfaces-forge` (GA-15 … GA-18, GA-25, GA-27) — vague 2

Dossiers : `src/resolver/`, `src/ui/`, `src/jira/`, `src/triggers/`, `static/`, `test/surfaces/`.
Le resolver est le **seul** point de montage : il n'importe que des services des lots A–G, aucune
logique métier n'y vit. Un écran = un fichier ; l'atelier visuel et le registre tableau portent la
même information (WCAG AA, la poussière et le panneau rouge ne sont jamais les seuls codages).

## Lot I — `feat/seed-recette` (§ 27, § 25) — vague 2

Dossiers : `seed/`, `scripts/seed.ts`, `scripts/demo.ts`, `test/recette/`, `docs/DEMO.md`,
`docs/JUGES.md`. Les **21 points de recette** du § 25 deviennent 21 tests nommés
`test/recette/NN-<slug>.test.ts`, un par point, avec le numéro du cahier des charges en commentaire.

## Lot J — `feat/docs-anglais` — vague 1

Dossiers : `docs/SPEC-EN.md`, `docs/GLOSSARY.md`, `docs/VIDEO-SCRIPT.md`, `docs/MARKETPLACE.md`.
Soumission en anglais (§ 23) : le pitch, le vocabulaire, le scénario de la vidéo de moins de cinq
minutes et le texte du listing Marketplace.
