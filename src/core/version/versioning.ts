/**
 * Gammes — versions immuables et cycle de vie (§ 14, GA-05 et GA-06).
 *
 * `brouillon → en revue → approuvée → (exécutée, mesurée) → amendée → dépréciée`
 *
 * Trois règles tiennent tout le produit :
 * - une version approuvée est **immuable** : on n'édite pas, on crée la suivante ;
 * - l'approbation est un **acte humain daté**, avec une date de révision ;
 * - déprécier n'est **jamais** supprimer : les versions et les traces restent lisibles.
 */

import type { Deps } from "../ports";
import { fail, ok, refusals, type Result } from "../result";
import type { ActorRef, Gamme, GammeVersion, RiskLevel } from "../types";
import { syncBindingToVersion } from "../binding/binding";
import { fold, STOP_WORDS } from "../text/tokens";

/** Ce que produit la compilation avant gravure : tout sauf l'identité et le numéro. */
export type VersionDraft = Omit<GammeVersion, "id" | "gammeId" | "immutable" | "version">;

const RISK_ORDER: readonly RiskLevel[] = ["none", "low", "medium", "high", "critical"];

export const maxRisk = (levels: readonly RiskLevel[]): RiskLevel =>
  levels.reduce<RiskLevel>((worst, l) => (RISK_ORDER.indexOf(l) > RISK_ORDER.indexOf(worst) ? l : worst), "none");

/** `Procédure : déployer le service paiements` → `deployer-service-paiements`. */
export const slugify = (title: string): string => {
  const cleaned = fold(title)
    .replace(/procedure|mode operatoire|runbook|how-to|\bsop\b|checklist/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const words = cleaned.split("-").filter((w) => w.length > 0 && !STOP_WORDS.has(w));
  return words.slice(0, 3).join("-") || "gamme";
};

export const nextCode = async (deps: Deps, _spaceKey: string, slug: string): Promise<string> => {
  const prefix = `GAM-${slugify(slug)}`;
  const sameFamily = await deps.store.gammes.list((g) => g.code.startsWith(`${prefix}-`));
  const used = sameFamily
    .map((g) => Number(g.code.slice(prefix.length + 1)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length > 0 ? Math.max(...used) : 0) + 1;
  return `${prefix}-${String(next).padStart(2, "0")}`;
};

export const getGammeByCode = async (deps: Deps, code: string): Promise<Gamme | undefined> =>
  (await deps.store.gammes.list((g) => g.code === code))[0];

export const listVersions = async (deps: Deps, gammeId: string): Promise<readonly GammeVersion[]> => {
  const versions = await deps.store.versions.list((v) => v.gammeId === gammeId);
  return [...versions].sort((a, b) => a.version - b.version);
};

/** Une version précise, ou la version courante (la dernière approuvée). */
export const getVersion = async (
  deps: Deps,
  code: string,
  version?: number,
): Promise<Result<GammeVersion>> => {
  const gamme = await getGammeByCode(deps, code);
  if (!gamme) {
    return fail("unknown_gamme", `Gamme ${code} introuvable.`, `Gammes ${code} not found.`, { code });
  }
  const versions = await listVersions(deps, gamme.id);
  const wanted = version ?? gamme.currentVersion;
  const found = versions.find((v) => v.version === wanted);
  if (!found) {
    return fail("unknown_version", `Version v${wanted} introuvable pour ${code}.`, `Version v${wanted} not found for ${code}.`, {
      code,
      version: wanted,
    });
  }
  return ok(found);
};

/** Nouvelle version : toujours un ajout, jamais une modification de l'existant. */
export const createVersion = async (
  deps: Deps,
  gammeId: string,
  draft: VersionDraft,
): Promise<Result<GammeVersion>> => {
  const gamme = await deps.store.gammes.get(gammeId);
  if (!gamme) return fail("unknown_gamme", `Gamme ${gammeId} introuvable.`, `Gammes ${gammeId} not found.`, { gammeId });
  if (gamme.state === "deprecated") {
    return fail(
      "gamme_deprecated",
      `Gamme ${gamme.code} dépréciée : on ne l'amende plus, on la remplace (${gamme.replacedBy ?? "aucun remplacement"}).`,
      `Gammes ${gamme.code} is deprecated: amend it no more, replace it (${gamme.replacedBy ?? "no replacement"}).`,
      { code: gamme.code, replacedBy: gamme.replacedBy ?? null },
    );
  }
  const versions = await listVersions(deps, gammeId);
  const nextNumber = versions.length > 0 ? Math.max(...versions.map((v) => v.version)) + 1 : 1;
  const version: GammeVersion = {
    ...draft,
    id: deps.ids.next("ver"),
    gammeId,
    version: nextNumber,
    immutable: true,
  };
  await deps.store.versions.insert(version);
  // Tant qu'aucune version n'est approuvée, la gamme brouillon pointe sur son brouillon.
  if (!gamme.approvedAt) await deps.store.gammes.update(gammeId, (g) => ({ ...g, currentVersion: nextNumber }));
  return ok(version);
};

const DEFAULT_REVIEW_DAYS = 365;

export type ApproveArgs = {
  readonly versionId: string;
  readonly approver: ActorRef;
  readonly reviewAfterDays?: number;
  readonly notes?: string;
};

type Approvable = { readonly gamme: Gamme; readonly version: GammeVersion; readonly reviewDays: number };

/** Garde-fous d'approbation : acteur humain, version connue, propriétaire, aucun secret ouvert. */
const guardApproval = async (deps: Deps, args: ApproveArgs): Promise<Result<Approvable>> => {
  if (args.approver.kind !== "human") return refusals.approvalRequiresHuman(args.approver.id);
  const version = await deps.store.versions.get(args.versionId);
  if (!version) {
    return fail("unknown_version", `Version ${args.versionId} introuvable.`, `Version ${args.versionId} not found.`, {
      versionId: args.versionId,
    });
  }
  const gamme = await deps.store.gammes.get(version.gammeId);
  if (!gamme) return fail("unknown_gamme", "Gamme introuvable.", "Gammes not found.", { gammeId: version.gammeId });
  if (!gamme.ownerRef) {
    return fail(
      "gamme_without_owner",
      `Gamme ${gamme.code} sans propriétaire : elle passe par la file d'adoption avant approbation.`,
      `Gammes ${gamme.code} has no owner: it must be adopted before approval.`,
      { code: gamme.code },
    );
  }
  const openFindings = await deps.store.findings.list(
    (f) => f.state === "open" && (!version.sourcePageAri || f.where.pageAri === version.sourcePageAri),
  );
  if (openFindings.length > 0) return refusals.secretFound(String(version.version), openFindings[0]!.id);
  const settings = await deps.store.settings.get(gamme.spaceKey);
  const reviewDays = args.reviewAfterDays ?? settings?.reviewAfterDays ?? DEFAULT_REVIEW_DAYS;
  return ok({ gamme, version, reviewDays });
};

/** Grave l'approbation : version datée et nommée, gamme en service, lien resynchronisé. */
const stampApproval = async (deps: Deps, approved: Approvable, approver: ActorRef, notes?: string): Promise<Gamme> => {
  const approvedAt = deps.clock.now();
  const reviewDueAt = deps.clock.plusDays(approved.reviewDays, approvedAt);
  await deps.store.versions.update(approved.version.id, (v) => ({
    ...v,
    approvedAt,
    approvedByRef: approver.id,
    reviewDueAt,
    ...(notes ? { notes } : {}),
  }));
  const gamme = await deps.store.gammes.update(approved.gamme.id, (g) => ({
    ...g,
    state: "approved",
    currentVersion: approved.version.version,
    approvedAt,
    approvedByRef: approver.id,
    reviewDueAt,
  }));
  // L'approbation referme l'écart page ↔ gamme : le lien repart de cette empreinte.
  await syncBindingToVersion(deps, approved.gamme.id, approved.version);
  await deps.store.appendEvent({
    at: approvedAt,
    kind: "gamme.approved",
    subjectRef: approved.gamme.id,
    actorKind: approver.kind,
    payload: { code: approved.gamme.code, version: approved.version.version, reviewDays: approved.reviewDays },
  });
  return gamme ?? approved.gamme;
};

/** Approuver est un acte humain daté : version figée, gamme invocable, révision planifiée. */
export const approveVersion = async (deps: Deps, args: ApproveArgs): Promise<Result<Gamme>> => {
  const guard = await guardApproval(deps, args);
  if (!guard.ok) return guard;
  return ok(await stampApproval(deps, guard.value, args.approver, args.notes));
};

export type DeprecateArgs = { readonly gammeId: string; readonly by: ActorRef; readonly replacedBy?: string };

/** Déprécier : refusée aux agents, lisible par les humains, jamais destructive. */
export const deprecateGamme = async (deps: Deps, args: DeprecateArgs): Promise<Result<Gamme>> => {
  if (args.by.kind !== "human") return refusals.approvalRequiresHuman(args.by.id);
  const current = await deps.store.gammes.get(args.gammeId);
  if (!current) return fail("unknown_gamme", "Gamme introuvable.", "Gammes not found.", { gammeId: args.gammeId });
  const deprecated = await deps.store.gammes.update(args.gammeId, (g) => ({
    ...g,
    state: "deprecated",
    deprecatedAt: deps.clock.now(),
    ...(args.replacedBy ? { replacedBy: args.replacedBy } : {}),
  }));
  if (!deprecated) return fail("unknown_gamme", "Gamme introuvable.", "Gammes not found.", { gammeId: args.gammeId });
  await deps.store.appendEvent({
    at: deps.clock.now(),
    kind: "gamme.deprecated",
    subjectRef: deprecated.id,
    actorKind: args.by.kind,
    payload: { code: deprecated.code, replacedBy: args.replacedBy ?? null },
  });
  return ok(deprecated);
};

/** Ce qu'un agent peut invoquer : approuvée, avec un propriétaire, non dépréciée. */
export const isInvocable = (gamme: Gamme): boolean =>
  gamme.state === "approved" && Boolean(gamme.ownerRef) && !gamme.deprecatedAt;

/** Passage d'un état à l'autre : les transitions illégales sont refusées, pas corrigées. */
export const canTransition = (from: Gamme["state"], to: Gamme["state"]): boolean => {
  if (from === to) return true;
  if (from === "draft") return to === "in_review" || to === "approved";
  if (from === "in_review") return to === "approved" || to === "draft";
  if (from === "approved") return to === "deprecated";
  return false; // dépréciée est un état final : on remplace, on ne ressuscite pas
};
