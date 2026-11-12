/**
 * Gammes — publier une gamme vers un autre espace ou une autre organisation (GA-30).
 *
 * Une publication est un **instantané d'une version immuable**, jamais un lien vivant :
 * la gamme publiée ne suit pas les amendements de la source. Trois garde-fous :
 * - seule une gamme approuvée est publiable ;
 * - la demande et la décision sont des actes humains, datés et nommés ;
 * - révoquer n'efface rien : la publication reste lisible, à l'état `revoked`.
 */

import type { Deps } from "../ports";
import { fail, ok, refusals, type Result } from "../result";
import type { ActorRef, Publication, PublicationTarget } from "../types";
import { getGammeByCode, getVersion } from "../version/versioning";

export type ProposePublicationArgs = {
  readonly code: string;
  readonly target: PublicationTarget;
  readonly reason: string;
  readonly by: ActorRef;
  readonly version?: number;
};

export type DecidePublicationArgs = {
  readonly id: string;
  readonly by: ActorRef;
  readonly accept: boolean;
  readonly receiptRef?: string;
  readonly reason?: string;
};

export type RevokePublicationArgs = {
  readonly id: string;
  readonly by: ActorRef;
  readonly reason: string;
};

const humanGuard = (actor: ActorRef): Result<void> =>
  actor.kind === "human" ? ok(undefined) : refusals.approvalRequiresHuman(actor.id);

/** Proposition : gamme approuvée, version épinglée, destination datée. */
export const proposePublication = async (
  deps: Deps,
  args: ProposePublicationArgs,
): Promise<Result<Publication>> => {
  const human = humanGuard(args.by);
  if (!human.ok) return human;
  const gamme = await getGammeByCode(deps, args.code);
  if (!gamme) {
    return fail("unknown_gamme", `Gamme ${args.code} introuvable.`, `Gammes ${args.code} not found.`, { code: args.code });
  }
  if (gamme.state !== "approved") return refusals.notApproved(gamme.code, gamme.state);
  const version = await getVersion(deps, args.code, args.version);
  if (!version.ok) return version;
  const publication: Publication = {
    id: deps.ids.next("pub"),
    gammeId: gamme.id,
    versionId: version.value.id,
    code: gamme.code,
    target: args.target,
    reason: args.reason,
    requestedBy: args.by,
    state: "proposed",
    requestedAt: deps.clock.now(),
  };
  await deps.store.publications.insert(publication);
  await deps.store.appendEvent({
    at: publication.requestedAt,
    kind: "publication.proposed",
    subjectRef: publication.id,
    actorKind: args.by.kind,
    payload: { code: gamme.code, version: version.value.version, spaceKey: args.target.spaceKey },
  });
  return ok(publication);
};

/** Décision : acceptée (avec récépissé) ou rejetée (avec motif). */
export const decidePublication = async (
  deps: Deps,
  args: DecidePublicationArgs,
): Promise<Result<Publication>> => {
  const human = humanGuard(args.by);
  if (!human.ok) return human;
  const current = await deps.store.publications.get(args.id);
  if (!current) {
    return fail("unknown_publication", `Publication ${args.id} introuvable.`, `Publication ${args.id} not found.`, { id: args.id });
  }
  if (current.state !== "proposed") {
    return fail(
      "publication_state",
      `Publication ${args.id} déjà tranchée (état : ${current.state}).`,
      `Publication ${args.id} already decided (state: ${current.state}).`,
      { id: args.id, state: current.state },
    );
  }
  const decided = await deps.store.publications.update(args.id, (p) => ({
    ...p,
    state: args.accept ? "accepted" : "rejected",
    decidedAt: deps.clock.now(),
    decidedByRef: args.by.id,
    ...(args.accept && args.receiptRef ? { receiptRef: args.receiptRef } : {}),
    ...(!args.accept && args.reason ? { reason: args.reason } : {}),
  }));
  if (!decided) {
    return fail("unknown_publication", `Publication ${args.id} introuvable.`, `Publication ${args.id} not found.`, { id: args.id });
  }
  await deps.store.appendEvent({
    at: decided.decidedAt ?? deps.clock.now(),
    kind: "publication.decided",
    subjectRef: decided.id,
    actorKind: args.by.kind,
    payload: { code: decided.code, state: decided.state, receiptRef: decided.receiptRef ?? null },
  });
  return ok(decided);
};

/** Révoquer une publication acceptée : jamais une suppression. */
export const revokePublication = async (
  deps: Deps,
  args: RevokePublicationArgs,
): Promise<Result<Publication>> => {
  const human = humanGuard(args.by);
  if (!human.ok) return human;
  const current = await deps.store.publications.get(args.id);
  if (!current) {
    return fail("unknown_publication", `Publication ${args.id} introuvable.`, `Publication ${args.id} not found.`, { id: args.id });
  }
  if (current.state !== "accepted") {
    return fail(
      "publication_state",
      `Seule une publication acceptée se révoque (état : ${current.state}).`,
      `Only an accepted publication can be revoked (state: ${current.state}).`,
      { id: args.id, state: current.state },
    );
  }
  const revoked = await deps.store.publications.update(args.id, (p) => ({
    ...p,
    state: "revoked",
    decidedAt: deps.clock.now(),
    decidedByRef: args.by.id,
    reason: args.reason,
  }));
  if (!revoked) {
    return fail("unknown_publication", `Publication ${args.id} introuvable.`, `Publication ${args.id} not found.`, { id: args.id });
  }
  await deps.store.appendEvent({
    at: revoked.decidedAt ?? deps.clock.now(),
    kind: "publication.decided",
    subjectRef: revoked.id,
    actorKind: args.by.kind,
    payload: { code: revoked.code, state: "revoked" },
  });
  return ok(revoked);
};

export const listPublications = async (
  deps: Deps,
  filter?: (p: Publication) => boolean,
): Promise<readonly Publication[]> => deps.store.publications.list(filter);