/**
 * Gammes — connecteur de graphe, app jumelle (GA-31).
 *
 * Le cœur Forge **lit** le graphe (GA-27, `src/integrations/graph.ts`) mais ne
 * l'écrit jamais. Graver une gamme comme document relié est le fait d'une app
 * jumelle, hors Forge : ce module tient la **proposition**, le **récépissé de
 * gravure** (jamais une écriture directe) et la **faillite** (un humain rejette).
 * Le lien gravé est daté, nommé, et porte la preuve reçue en retour.
 */

import type { Deps } from "../ports";
import { fail, ok, refusals, type Result } from "../result";
import type { ActorRef, GraphLinkKind, GraphLinkProposal } from "../types";
import { getGammeByCode } from "../version/versioning";

export type ProposeLinkArgs = {
  readonly code: string;
  readonly linkKind: GraphLinkKind;
  readonly targetRef: string;
  readonly reason: string;
  readonly by: ActorRef;
};

export type RecordEngravingArgs = {
  readonly id: string;
  readonly receiptRef: string;
  readonly by: ActorRef;
};

export type DismissLinkArgs = {
  readonly id: string;
  readonly by: ActorRef;
  readonly reason: string;
};

const humanGuard = (actor: ActorRef): Result<void> =>
  actor.kind === "human" ? ok(undefined) : refusals.approvalRequiresHuman(actor.id);

/** Proposition : une gamme approuvée, reliée à un objet du graphe. Décidée par un humain. */
export const proposeGraphLink = async (deps: Deps, args: ProposeLinkArgs): Promise<Result<GraphLinkProposal>> => {
  const human = humanGuard(args.by);
  if (!human.ok) return human;
  const gamme = await getGammeByCode(deps, args.code);
  if (!gamme) {
    return fail("unknown_gamme", `Gamme ${args.code} introuvable.`, `Gammes ${args.code} not found.`, { code: args.code });
  }
  if (gamme.state !== "approved") return refusals.notApproved(gamme.code, gamme.state);
  const proposal: GraphLinkProposal = {
    id: deps.ids.next("gl"),
    gammeId: gamme.id,
    code: gamme.code,
    linkKind: args.linkKind,
    targetRef: args.targetRef,
    reason: args.reason,
    state: "proposed",
    proposedAt: deps.clock.now(),
    proposedByRef: args.by.id,
  };
  await deps.store.graphLinks.insert(proposal);
  await deps.store.appendEvent({
    at: proposal.proposedAt,
    kind: "graph.link_proposed",
    subjectRef: proposal.id,
    actorKind: args.by.kind,
    payload: { code: gamme.code, linkKind: args.linkKind, targetRef: args.targetRef },
  });
  return ok(proposal);
};

/** L'app jumelle rapporte la gravure : le lien reçoit sa preuve, datée et nommée. */
export const recordGraphLink = async (deps: Deps, args: RecordEngravingArgs): Promise<Result<GraphLinkProposal>> => {
  const current = await deps.store.graphLinks.get(args.id);
  if (!current) {
    return fail("unknown_graph_link", `Lien de graphe ${args.id} introuvable.`, `Graph link ${args.id} not found.`, { id: args.id });
  }
  if (current.state !== "proposed") {
    return fail(
      "graph_link_state",
      `Lien ${args.id} non gravable (état : ${current.state}).`,
      `Graph link ${args.id} cannot be engraved (state: ${current.state}).`,
      { id: args.id, state: current.state },
    );
  }
  const engraved = await deps.store.graphLinks.update(args.id, (l) => ({
    ...l,
    state: "engraved",
    receiptRef: args.receiptRef,
    engravedAt: deps.clock.now(),
    engravedBy: args.by.id,
  }));
  if (!engraved) {
    return fail("unknown_graph_link", `Lien de graphe ${args.id} introuvable.`, `Graph link ${args.id} not found.`, { id: args.id });
  }
  await deps.store.appendEvent({
    at: engraved.engravedAt ?? deps.clock.now(),
    kind: "graph.link_engraved",
    subjectRef: engraved.id,
    actorKind: args.by.kind,
    payload: { code: engraved.code, linkKind: engraved.linkKind, targetRef: engraved.targetRef },
  });
  return ok(engraved);
};

/** Faillite : un humain rejette la proposition, jamais une écriture dans le graphe. */
export const dismissGraphLink = async (deps: Deps, args: DismissLinkArgs): Promise<Result<GraphLinkProposal>> => {
  const human = humanGuard(args.by);
  if (!human.ok) return human;
  const current = await deps.store.graphLinks.get(args.id);
  if (!current) {
    return fail("unknown_graph_link", `Lien de graphe ${args.id} introuvable.`, `Graph link ${args.id} not found.`, { id: args.id });
  }
  if (current.state !== "proposed") {
    return fail(
      "graph_link_state",
      `Lien ${args.id} non rejetable (état : ${current.state}).`,
      `Graph link ${args.id} cannot be dismissed (state: ${current.state}).`,
      { id: args.id, state: current.state },
    );
  }
  const dismissed = await deps.store.graphLinks.update(args.id, (l) => ({
    ...l,
    state: "dismissed",
    reason: args.reason,
  }));
  if (!dismissed) {
    return fail("unknown_graph_link", `Lien de graphe ${args.id} introuvable.`, `Graph link ${args.id} not found.`, { id: args.id });
  }
  await deps.store.appendEvent({
    at: deps.clock.now(),
    kind: "graph.link_engraved",
    subjectRef: dismissed.id,
    actorKind: args.by.kind,
    payload: { code: dismissed.code, state: "dismissed" },
  });
  return ok(dismissed);
};

export const listGraphLinks = async (
  deps: Deps,
  filter?: (l: GraphLinkProposal) => boolean,
): Promise<readonly GraphLinkProposal[]> => deps.store.graphLinks.list(filter);