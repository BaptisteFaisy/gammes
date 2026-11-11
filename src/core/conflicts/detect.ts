/**
 * Gammes — détection des conflits entre gammes et avec les pages de politique
 * (§ 13, GA-23).
 *
 * Trois familles, toutes déterministes et toutes citées :
 * - même cible (service, environnement, ressource) avec des exigences différentes ;
 * - une étape qui contredit une page de politique déclarée dans les réglages ;
 * - deux gammes en concurrence sur la même ressource exclusive (réservation).
 *
 * Un conflit n'est JAMAIS tranché ici : il est gravé, porté aux deux propriétaires,
 * et le dossier de conciliation (lot `src/core/conciliation/`) reste une proposition.
 */

import type { Deps } from "../ports";
import { ok, refusals, type Result } from "../result";
import type { ActorRef, Conflict, ConflictFact, PageDigest } from "../types";
import { factsContradict, factsOf, type ConflictDraft, type LoadedGamme } from "./facts";
import { policyConflicts, readPolicyRequirements } from "./policy";

/** Signature stable d'un conflit : sert à ne jamais graver deux fois le même. */
export const signature = (c: ConflictDraft | Conflict): string =>
  [
    c.kind,
    [c.gammeA, c.gammeB ?? ""].sort().join("~"),
    c.policyPageAri ?? "",
    c.service ?? "",
    c.facts.map((f) => f.subject).sort().join(","),
  ].join("|");

export const loadApproved = async (deps: Deps, service?: string): Promise<readonly LoadedGamme[]> => {
  const gammes = await deps.store.gammes.list(
    (g) => g.state === "approved" && (!service || g.scope.services.includes(service)),
  );
  const out: LoadedGamme[] = [];
  for (const gamme of gammes) {
    const version = (await deps.store.versions.list((v) => v.gammeId === gamme.id)).find(
      (v) => v.version === gamme.currentVersion,
    );
    if (version) out.push({ gamme, version, facts: factsOf(gamme, version) });
  }
  return out;
};

const sharesService = (a: LoadedGamme, b: LoadedGamme): boolean =>
  a.gamme.scope.services.some((s) => b.gamme.scope.services.includes(s));

const pairFacts = (a: LoadedGamme, b: LoadedGamme): readonly ConflictFact[] => {
  const out: ConflictFact[] = [];
  for (const fa of a.facts) {
    const fb = b.facts.find((f) => f.subject === fa.subject);
    if (!fb || !factsContradict(fa, fb)) continue;
    out.push({
      subject: fa.subject,
      left: `${a.gamme.code} : ${fa.value}`,
      right: `${b.gamme.code} : ${fb.value}`,
      ...(fa.spans[0] ? { leftSpan: fa.spans[0] } : {}),
      ...(fb.spans[0] ? { rightSpan: fb.spans[0] } : {}),
    });
  }
  return out;
};

const pairDrafts = (loaded: readonly LoadedGamme[]): readonly ConflictDraft[] => {
  const out: ConflictDraft[] = [];
  for (let i = 0; i < loaded.length; i += 1) {
    for (let j = i + 1; j < loaded.length; j += 1) {
      const a = loaded[i];
      const b = loaded[j];
      if (!a || !b || !sharesService(a, b)) continue;
      const facts = pairFacts(a, b);
      if (facts.length === 0) continue;
      out.push({
        kind: "requirement_mismatch",
        gammeA: a.gamme.code,
        gammeB: b.gamme.code,
        service: a.gamme.scope.services.find((s) => b.gamme.scope.services.includes(s)),
        facts,
      });
    }
  }
  return out;
};

const exclusiveDrafts = (loaded: readonly LoadedGamme[]): readonly ConflictDraft[] => {
  const exclusive = loaded.filter((l) => l.gamme.exclusive);
  const out: ConflictDraft[] = [];
  for (let i = 0; i < exclusive.length; i += 1) {
    for (let j = i + 1; j < exclusive.length; j += 1) {
      const a = exclusive[i];
      const b = exclusive[j];
      if (!a || !b || !sharesService(a, b)) continue;
      const service = a.gamme.scope.services.find((s) => b.gamme.scope.services.includes(s));
      out.push({
        kind: "exclusive_resource",
        gammeA: a.gamme.code,
        gammeB: b.gamme.code,
        service,
        facts: [
          {
            subject: `ressource:${service ?? a.gamme.spaceKey}`,
            left: `${a.gamme.code} déclare la ressource exclusive`,
            right: `${b.gamme.code} déclare la ressource exclusive`,
            ...(a.facts[0]?.spans[0] ? { leftSpan: a.facts[0].spans[0] } : {}),
            ...(b.facts[0]?.spans[0] ? { rightSpan: b.facts[0].spans[0] } : {}),
          },
        ],
      });
    }
  }
  return out;
};

const policyPagesOf = async (deps: Deps, spaceKey: string): Promise<readonly string[]> => {
  const settings = await deps.store.settings.get(spaceKey);
  return settings?.policyPages ?? [];
};

const policyDrafts = async (deps: Deps, loaded: readonly LoadedGamme[]): Promise<readonly ConflictDraft[]> => {
  if (!deps.confluence) return [];
  const out: ConflictDraft[] = [];
  for (const item of loaded) {
    for (const ari of await policyPagesOf(deps, item.gamme.spaceKey)) {
      const page = await readPolicyPage(deps, ari);
      if (!page) continue;
      const requirements = readPolicyRequirements(page.storageBody, page.ari);
      out.push(...policyConflicts(item, requirements, page));
    }
  }
  return out;
};

const readPolicyPage = async (deps: Deps, ari: string): Promise<PageDigest | undefined> => {
  try {
    const page = await deps.confluence?.getPage(ari);
    return page && page.reachable ? page : undefined;
  } catch {
    return undefined; // politique injoignable : on ne devine pas, on ne bloque pas
  }
};

/** Détecte, grave les nouveautés, et renvoie tous les conflits du périmètre demandé. */
export const detectConflicts = async (
  deps: Deps,
  args: { service?: string } = {},
): Promise<readonly Conflict[]> => {
  const loaded = await loadApproved(deps, args.service);
  const drafts = [...pairDrafts(loaded), ...exclusiveDrafts(loaded), ...(await policyDrafts(deps, loaded))];
  const existing = await deps.store.conflicts.list();
  const known = new Set(existing.map(signature));
  for (const draft of drafts) {
    const sig = signature(draft);
    if (known.has(sig)) continue;
    known.add(sig);
    await raiseConflict(deps, draft);
  }
  const all = await deps.store.conflicts.list((c) => !args.service || c.service === args.service);
  return [...all].sort((a, b) => a.raisedAt.localeCompare(b.raisedAt));
};

export const raiseConflict = async (deps: Deps, draft: ConflictDraft): Promise<Result<Conflict>> => {
  const conflict: Conflict = {
    ...draft,
    id: deps.ids.next("cfl"),
    state: "raised",
    raisedAt: deps.clock.now(),
  };
  await deps.store.conflicts.insert(conflict);
  await deps.store.appendEvent({
    at: conflict.raisedAt,
    kind: "conflict.raised",
    subjectRef: conflict.id,
    payload: { kind: conflict.kind, gammeA: conflict.gammeA, gammeB: conflict.gammeB ?? null,
      service: conflict.service ?? null, subjects: conflict.facts.map((f) => f.subject) },
  });
  return ok(conflict);
};

const decidedByHuman = async (
  deps: Deps,
  id: string,
  by: ActorRef,
  patch: (c: Conflict) => Conflict,
  event: "conflict.resolved",
): Promise<Result<Conflict>> => {
  if (by.kind !== "human") return refusals.approvalRequiresHuman(by.id);
  const current = await deps.store.conflicts.get(id);
  if (!current) return refusals.unknownConflict(id);
  const next = await deps.store.conflicts.update(id, patch);
  if (!next) return refusals.unknownConflict(id);
  await deps.store.appendEvent({
    at: deps.clock.now(),
    kind: event,
    subjectRef: id,
    actorKind: by.kind,
    payload: { state: next.state, by: by.id },
  });
  return ok(next);
};

export const acknowledgeConflict = async (
  deps: Deps,
  id: string,
  by: ActorRef,
): Promise<Result<Conflict>> =>
  decidedByHuman(deps, id, by, (c) => ({ ...c, state: "acknowledged" }), "conflict.resolved");

export const resolveConflict = async (
  deps: Deps,
  id: string,
  by: ActorRef,
  note: string,
): Promise<Result<Conflict>> =>
  decidedByHuman(
    deps,
    id,
    by,
    (c) => ({ ...c, state: "resolved", resolvedAt: deps.clock.now(), resolutionNote: note }),
    "conflict.resolved",
  );
