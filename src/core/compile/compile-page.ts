/**
 * Gammes — compiler une page en gamme (§ 6, GA-05 et GA-11).
 *
 * **Compiler ne publie rien.** L'app produit un brouillon, un diff et ses
 * signalements ; l'approbation est un acte humain daté, séparé
 * (`src/core/version/versioning.ts`). Trois règles tiennent ici :
 * - la confirmation humaine est obligatoire avant toute compilation ;
 * - une étape qui contient un secret n'est pas une étape : elle devient un
 *   signalement, et la gamme n'est pas publiable tant qu'il est ouvert ;
 * - chaque étape garde le passage source exact qui l'a produite.
 */

import type { Deps } from "../ports";
import { ok, refusals, type Result } from "../result";
import type {
  ActorPolicy,
  ActorRef,
  Conditions,
  Fallback,
  Gamme,
  GammeScope,
  GammeVersion,
  InputSpec,
  PageDigest,
  SecretFinding,
  Step,
} from "../types";
import { extractSteps, type DraftStep } from "../extract/extract-steps";
import { qualifySteps } from "../qualify/qualify-steps";
import { detectSecrets } from "../secrets/detectors";
import { upsertBinding } from "../binding/binding";
import { diffSteps, renderVersionDiff } from "./diff";
import { createVersion, listVersions, maxRisk, nextCode } from "../version/versioning";

export type CompileOutcome = {
  readonly gamme: Gamme;
  readonly version: GammeVersion;
  readonly diff: string;
  readonly findings: readonly SecretFinding[];
  readonly nonFalsifiable: readonly string[];
  readonly usedModel: boolean;
  /** Étapes écartées parce qu'elles contenaient un secret : la gamme n'est pas publiable. */
  readonly droppedSteps: number;
};

const PRE_RE = /avant de commencer|pr[ée]requis|preconditions?|conditions initiales/i;
const POST_RE = /r[ée]sultat attendu|postconditions?|[àa] la fin|une fois termin[ée]/i;
const FALLBACK_RE = /si [çc]a tourne mal|si [ée]chec|repli|rollback|retour arri[èe]re|fallback/i;
/** Une section d'entrées décrit les paramètres typés, pas des étapes à dérouler. */
const INPUTS_RE = /entr[ée]es|inputs?|param[èe]tres/i;
const TITLE_PREFIX_RE =
  /^\s*(?:proc[ée]dure|mode\s*op[ée]ratoire|runbook|how[- ]to|\bsop\b|checklist)\s*[:\-–]\s*/i;

/** Classes d'actions qui imposent une exécution exclusive (une seule à la fois). */
export const EXCLUSIVE_CLASSES: readonly string[] = ["production-write", "destructive-database", "kubernetes-delete"];

const DURATION_BY_KIND: Readonly<Record<Step["kind"], number>> = {
  command: 120,
  check: 90,
  manual: 180,
  decision: 60,
  notification: 30,
};

export const estimateDuration = (steps: readonly Step[]): number =>
  steps.reduce((total, s) => total + (DURATION_BY_KIND[s.kind] ?? 120), 0);

const cleanTitle = (title: string): string => title.replace(TITLE_PREFIX_RE, "").trim() || title.trim();

const overlaps = (step: Step, finding: SecretFinding): boolean =>
  step.source.start < finding.where.end && finding.where.start < step.source.end;

type DraftGroups = {
  readonly steps: readonly DraftStep[];
  readonly preconditions: readonly string[];
  readonly postconditions: readonly string[];
  readonly fallback: readonly DraftStep[];
};

/** Les sections « avant de commencer » et « si ça tourne mal » ne sont pas des étapes ordinaires. */
export const splitBySection = (drafts: readonly DraftStep[]): DraftGroups => {
  const out: {
    steps: DraftStep[];
    preconditions: string[];
    postconditions: string[];
    fallback: DraftStep[];
  } = { steps: [], preconditions: [], postconditions: [], fallback: [] };
  for (const draft of drafts) {
    const section = draft.sectionTitle ?? "";
    if (INPUTS_RE.test(section)) continue; // déjà traitées comme entrées typées
    if (PRE_RE.test(section)) out.preconditions.push(draft.text);
    else if (POST_RE.test(section)) out.postconditions.push(draft.text);
    else if (FALLBACK_RE.test(section)) out.fallback.push(draft);
    else out.steps.push(draft);
  }
  return out;
};

const scopeOf = async (deps: Deps, page: PageDigest): Promise<GammeScope> => ({
  services: deps.graph ? await deps.graph.servicesFor(page.ari) : [],
  projects: deps.graph ? await deps.graph.projectsFor(page.ari) : [],
  spaces: [page.spaceKey],
});

const actorPolicyOf = async (deps: Deps, steps: readonly Step[], spaceKey: string): Promise<ActorPolicy> => {
  const settings = await deps.store.settings.get(spaceKey);
  if (settings?.lockPolicy) return settings.lockPolicy;
  if (steps.some((s) => s.humanOnly && s.locks.some((l) => l.kind === "permit"))) return "human_or_permitted_agent";
  if (steps.some((s) => s.humanOnly)) return "human_or_permitted_agent";
  return "agent_free";
};

const findExistingGamme = async (deps: Deps, page: PageDigest): Promise<Gamme | undefined> => {
  const binding = (await deps.store.bindings.list((b) => b.pageAri === page.ari))[0];
  return binding ? deps.store.gammes.get(binding.gammeId) : undefined;
};

/** Une page déjà compilée produit une nouvelle version de la même gamme, jamais un doublon. */
const resolveGamme = async (deps: Deps, page: PageDigest, spaceKey: string): Promise<Gamme> => {
  const existing = await findExistingGamme(deps, page);
  if (existing) return existing;
  const scope = await scopeOf(deps, page);
  const ownerRef = deps.graph ? await deps.graph.ownerOf(page.ari) : undefined;
  const gamme: Gamme = {
    id: deps.ids.next("gam"),
    code: await nextCode(deps, spaceKey, page.title),
    title: cleanTitle(page.title),
    state: "draft",
    spaceKey,
    currentVersion: 0,
    risk: "none",
    exclusive: false,
    createdAt: deps.clock.now(),
    scope,
    sync: "synced",
    ...(ownerRef ? { ownerRef } : {}),
  };
  await deps.store.gammes.insert(gamme);
  return gamme;
};

const recordFindings = async (deps: Deps, findings: readonly SecretFinding[]): Promise<void> => {
  for (const finding of findings) {
    await deps.store.findings.insert(finding);
    await deps.store.appendEvent({
      at: finding.openedAt,
      kind: "secret.found",
      subjectRef: finding.id,
      payload: { detector: finding.detector, kind: finding.kind, pageAri: finding.where.pageAri },
    });
  }
};

/** Compiler : extraire, qualifier, écarter les secrets, graver un brouillon, produire le diff. */
export const compilePage = async (
  deps: Deps,
  args: { readonly page: PageDigest; readonly confirmedBy: ActorRef; readonly spaceKey?: string },
): Promise<Result<CompileOutcome>> => {
  if (args.confirmedBy.kind !== "human") return refusals.approvalRequiresHuman(args.confirmedBy.id);
  if (!args.page.reachable) return refusals.sourceUnavailable(args.page.ari);

  const spaceKey = args.spaceKey ?? args.page.spaceKey;
  const extraction = await extractSteps(deps, args.page);
  const groups = splitBySection(extraction.drafts);
  const steps = await qualifySteps(deps, groups.steps, args.page);
  const fallbackSteps = await qualifySteps(deps, groups.fallback, args.page);

  const findings = detectSecrets(deps, args.page.storageBody, args.page.ari);
  await recordFindings(deps, findings);
  const kept = steps.filter((s) => !findings.some((f) => overlaps(s, f)));

  const gamme = await resolveGamme(deps, args.page, spaceKey);
  const previous = (await listVersions(deps, gamme.id)).find((v) => v.version === gamme.currentVersion);
  const version = await buildVersion(deps, gamme, args.page, {
    steps: kept,
    fallbackSteps,
    inputs: extraction.inputs,
    preconditions: groups.preconditions,
    postconditions: groups.postconditions,
  });
  if (!version.ok) return version;

  const updated = await refreshGamme(deps, gamme.id, kept);
  const diff = renderVersionDiff(
    previous ? previous.version : undefined,
    version.value.version,
    diffSteps(previous?.steps ?? [], kept),
  );
  await linkAfterCompile(deps, updated.id, args.page, gamme.state === "approved", diff);
  await deps.store.appendEvent({
    at: deps.clock.now(),
    kind: "gamme.compiled",
    subjectRef: updated.id,
    actorKind: args.confirmedBy.kind,
    payload: {
      code: updated.code,
      version: version.value.version,
      steps: kept.length,
      droppedSteps: steps.length - kept.length,
      findings: findings.length,
      usedModel: extraction.usedModel,
    },
  });

  return ok({
    gamme: updated,
    version: version.value,
    diff,
    findings,
    nonFalsifiable: kept.filter((s) => !s.falsifiable).map((s) => s.text),
    usedModel: extraction.usedModel,
    droppedSteps: steps.length - kept.length,
  });
};

/**
 * Une première compilation synchronise le lien. La recompilation d'une gamme déjà
 * approuvée ne referme PAS l'écart : le brouillon n'est pas encore approuvé, la gamme
 * reste désynchronisée et le diff est conservé pour la revue.
 */
const linkAfterCompile = async (
  deps: Deps,
  gammeId: string,
  page: PageDigest,
  alreadyApproved: boolean,
  diff: string,
): Promise<void> => {
  if (!alreadyApproved) {
    await upsertBinding(deps, gammeId, page);
    return;
  }
  const existing = (await deps.store.bindings.list((b) => b.gammeId === gammeId))[0];
  await upsertBinding(deps, gammeId, page, {
    sync: "stale",
    staleSince: existing?.staleSince ?? deps.clock.now(),
    contentHash: existing?.contentHash ?? deps.hasher.contentHash(page.storageBody),
    syncedAt: existing?.syncedAt ?? deps.clock.now(),
    lastDiffJson: diff,
  });
};

type VersionParts = {
  readonly steps: readonly Step[];
  readonly fallbackSteps: readonly Step[];
  readonly inputs: readonly InputSpec[];
  readonly preconditions: readonly string[];
  readonly postconditions: readonly string[];
};

const buildVersion = async (
  deps: Deps,
  gamme: Gamme,
  page: PageDigest,
  parts: VersionParts,
): Promise<Result<GammeVersion>> => {
  const conditions: Conditions = {
    preconditions: parts.preconditions,
    postconditions: parts.postconditions,
  };
  const fallback: Fallback = {
    steps: parts.fallbackSteps,
    ...(parts.fallbackSteps.length === 0 ? { text: "Aucun repli écrit dans la page source." } : {}),
  };
  return createVersion(deps, gamme.id, {
    title: cleanTitle(page.title),
    sourcePageAri: page.ari,
    contentHash: deps.hasher.contentHash(page.storageBody),
    compiledAt: deps.clock.now(),
    compiledBy: "gammes:compiler",
    inputs: parts.inputs,
    steps: parts.steps,
    conditions,
    fallback,
    actorPolicy: await actorPolicyOf(deps, parts.steps, gamme.spaceKey),
    estimatedDurationS: estimateDuration(parts.steps),
    exclusive: parts.steps.some((s) => s.riskClass && EXCLUSIVE_CLASSES.includes(s.riskClass)),
    sourcePages: [page.ari],
  });
};

const refreshGamme = async (deps: Deps, gammeId: string, steps: readonly Step[]): Promise<Gamme> => {
  const risk = maxRisk(steps.map((s) => s.risk));
  const exclusive = steps.some((s) => s.riskClass && EXCLUSIVE_CLASSES.includes(s.riskClass));
  const updated = await deps.store.gammes.update(gammeId, (g) => ({ ...g, risk, exclusive }));
  return updated ?? (await deps.store.gammes.get(gammeId))!;
};
