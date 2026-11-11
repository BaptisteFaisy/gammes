/**
 * Gammes — les amendements (§ 11, § 10, GA-20).
 *
 * Une procédure s'améliore parce qu'on s'en sert. Les traces montrent les étapes
 * fausses (elles échouent) et les étapes inutiles (on les saute en le disant) : l'app
 * **propose** un amendement, preuves à l'appui. Elle ne l'applique jamais seule :
 * la décision est humaine, datée, nommée, et la modification de la page source est
 * proposée à son propriétaire.
 */

import type { Deps } from "../ports";
import { fail, ok, refusals, type Result } from "../result";
import type { ActorKind, ActorRef, Amendment, Run, StepStat } from "../types";
import { getGammeByCode, listVersions } from "../version/versioning";
import { renderRate } from "../stats/rates";
import { failingSteps, skippedSteps } from "../stats/step-stats";

export type ProposeArgs = {
  readonly gammeId: string;
  readonly stepId?: string;
  readonly proposal: string;
  readonly rationale: string;
  readonly evidenceRefs: readonly string[];
  readonly proposedBy: ActorKind;
};

export const proposeAmendment = async (deps: Deps, args: ProposeArgs): Promise<Result<Amendment>> => {
  const gamme = await deps.store.gammes.get(args.gammeId);
  if (!gamme) {
    return fail("unknown_gamme", `Gamme ${args.gammeId} introuvable.`, `Gammes ${args.gammeId} not found.`, {
      gammeId: args.gammeId,
    });
  }
  const amendment: Amendment = {
    id: deps.ids.next("amd"),
    gammeId: args.gammeId,
    proposal: args.proposal,
    rationale: args.rationale,
    evidenceRefs: args.evidenceRefs,
    state: "proposed",
    proposedAt: deps.clock.now(),
    proposedBy: args.proposedBy,
    ...(args.stepId ? { stepId: args.stepId } : {}),
  };
  await deps.store.amendments.insert(amendment);
  await deps.store.appendEvent({
    at: amendment.proposedAt,
    kind: "amendment.proposed",
    subjectRef: amendment.id,
    actorKind: args.proposedBy,
    payload: { code: gamme.code, stepId: args.stepId ?? null, evidence: args.evidenceRefs.length },
  });
  return ok(amendment);
};

/** Un amendement ouvert existe déjà pour cette étape : on ne spamme pas le propriétaire. */
export const hasOpenAmendment = async (deps: Deps, gammeId: string, stepId?: string): Promise<boolean> => {
  const open = await deps.store.amendments.list(
    (a) => a.gammeId === gammeId && (a.state === "proposed" || a.state === "in_review") && (!stepId || a.stepId === stepId),
  );
  return open.length > 0;
};

const runsFor = async (deps: Deps, gammeId: string, stepId: string): Promise<readonly Run[]> =>
  deps.store.runs.list((r) => r.gammeId === gammeId && r.steps.some((s) => s.stepId === stepId));

/** Ce que les gens ont fait à la place : la matière la plus précieuse du produit. */
const insteadOf = (runs: readonly Run[], stepId: string): readonly string[] =>
  runs
    .flatMap((r) => r.deviations.filter((d) => d.stepId === stepId))
    .map((d) => `${d.whatHappened} — ${d.why}`)
    .slice(0, 5);

const failingProposal = (stat: StepStat, ord: number, instead: readonly string[]): ProposeArgs => ({
  gammeId: "",
  stepId: stat.stepId,
  proposal: `Réécrire l'étape ${ord} : elle échoue ${renderRate(stat.failRate, "fr")}. Énoncer le critère de succès observable et la conduite en cas d'échec.`,
  rationale: [
    `Échecs : ${renderRate(stat.failRate, "fr")} sur ${stat.n} exécution(s) atteignant cette étape.`,
    instead.length > 0 ? `Ce qui a été fait à la place : ${instead.join(" ; ")}` : "Aucune déviation déclarée : l'échec est subi, pas contourné.",
  ].join(" "),
  evidenceRefs: [],
  proposedBy: "agent",
});

const skippedProposal = (stat: StepStat, ord: number, instead: readonly string[]): ProposeArgs => ({
  gammeId: "",
  stepId: stat.stepId,
  proposal: `Rendre l'étape ${ord} conditionnelle ou la supprimer : elle est sautée ${renderRate(stat.skipRate, "fr")}.`,
  rationale:
    instead.length > 0
      ? `Raisons données : ${instead.join(" ; ")}`
      : "Étape sautée sans raison écrite : la reformuler ou la retirer.",
  evidenceRefs: [],
  proposedBy: "agent",
});

const stepOrdinal = async (deps: Deps, gammeId: string, stepId: string): Promise<number> => {
  const versions = await listVersions(deps, gammeId);
  const last = versions[versions.length - 1];
  return last?.steps.find((s) => s.id === stepId)?.ord ?? 0;
};

/** Depuis les traces : une proposition par étape en échec ou systématiquement sautée. */
export const proposeFromTraces = async (
  deps: Deps,
  args: { readonly code: string; readonly stepId?: string; readonly threshold?: number },
): Promise<Result<readonly Amendment[]>> => {
  const gamme = await getGammeByCode(deps, args.code);
  if (!gamme) {
    return fail("unknown_gamme", `Gamme ${args.code} introuvable.`, `Gammes ${args.code} not found.`, { code: args.code });
  }
  const query = { code: args.code, ...(args.threshold !== undefined ? { threshold: args.threshold } : {}) };
  const candidates = [...(await failingSteps(deps, query)), ...(await skippedSteps(deps, query))].filter(
    (s) => !args.stepId || s.stepId === args.stepId,
  );
  const out: Amendment[] = [];
  for (const stat of candidates) {
    if (await hasOpenAmendment(deps, gamme.id, stat.stepId)) continue;
    const runs = await runsFor(deps, gamme.id, stat.stepId);
    const instead = insteadOf(runs, stat.stepId);
    const ord = await stepOrdinal(deps, gamme.id, stat.stepId);
    const draft = stat.failRate.value !== undefined && stat.failRate.value >= 0.5
      ? failingProposal(stat, ord, instead)
      : skippedProposal(stat, ord, instead);
    const proposed = await proposeAmendment(deps, {
      ...draft,
      gammeId: gamme.id,
      evidenceRefs: [...runs.map((r) => r.id), ...runs.flatMap((r) => r.deviations.map((d) => d.id))].slice(0, 12),
    });
    if (proposed.ok) out.push(proposed.value);
  }
  return ok(out);
};

export type DecideArgs = { readonly id: string; readonly decision: "accepted" | "rejected"; readonly by: ActorRef };

/** Décider est humain ; accepter ne modifie rien : la page est proposée, pas réécrite. */
export const decideAmendment = async (deps: Deps, args: DecideArgs): Promise<Result<Amendment>> => {
  if (args.by.kind !== "human") return refusals.approvalRequiresHuman(args.by.id);
  const current = await deps.store.amendments.get(args.id);
  if (!current) {
    return fail("unknown_gamme", `Amendement ${args.id} introuvable.`, `Amendment ${args.id} not found.`, { id: args.id });
  }
  const decided = await deps.store.amendments.update(args.id, (a) => ({
    ...a,
    state: args.decision === "accepted" ? "accepted" : "rejected",
    decidedAt: deps.clock.now(),
    decidedByRef: args.by.id,
  }));
  if (!decided) return fail("unknown_gamme", "Amendement introuvable.", "Amendment not found.", { id: args.id });
  const pageUrl = await proposePageEdit(deps, decided);
  await deps.store.appendEvent({
    at: decided.decidedAt ?? deps.clock.now(),
    kind: "amendment.decided",
    subjectRef: decided.id,
    actorKind: args.by.kind,
    payload: { decision: args.decision, by: args.by.id, pageProposalUrl: pageUrl ?? null },
  });
  return ok(decided);
};

/** La gamme change, la page reste : on propose la modification au propriétaire (§ 10). */
const proposePageEdit = async (deps: Deps, amendment: Amendment): Promise<string | undefined> => {
  if (amendment.state !== "accepted" || !deps.confluence?.proposePageEdit) return undefined;
  const binding = (await deps.store.bindings.list((b) => b.gammeId === amendment.gammeId))[0];
  if (!binding) return undefined;
  const proposed = await deps.confluence.proposePageEdit(binding.pageAri, amendment.proposal, amendment.rationale);
  return proposed.url;
};
