/**
 * Gammes — liaison page ↔ gamme (§ 10, GA-10).
 *
 * Le couple page/gamme est le point fragile de tout outillage de procédures. Trois
 * cas, traités explicitement : la page change (désynchronisation + âge de l'écart),
 * la gamme change (proposition de modification de la page), la page disparaît
 * (la gamme garde sa dernière version compilée et reste exécutable).
 */

import type { Deps } from "../ports";
import { fail, ok, refusals, type Result } from "../result";
import type { Binding, Gamme, GammeVersion, PageDigest, SyncState } from "../types";
import { daysBetween } from "../../platform/clock";

export type SyncReport = {
  readonly sync: SyncState;
  readonly ageDays?: number;
  readonly diff?: string;
  readonly binding: Binding;
};

/** Écrit ou rafraîchit le lien page ↔ gamme. Une seule implémentation, appelée par la compilation. */
export const upsertBinding = async (
  deps: Deps,
  gammeId: string,
  page: PageDigest,
  extra: Partial<Binding> = {},
): Promise<Binding> => {
  const existing = (await deps.store.bindings.list((b) => b.gammeId === gammeId))[0];
  const binding: Binding = {
    id: existing?.id ?? deps.ids.next("bnd"),
    gammeId,
    pageAri: page.ari,
    contentHash: deps.hasher.contentHash(page.storageBody),
    syncedAt: deps.clock.now(),
    sync: page.reachable ? "synced" : "source_gone",
    ...extra,
  };
  await deps.store.bindings.insert(binding);
  return binding;
};

export const bindPage = async (deps: Deps, gammeId: string, page: PageDigest): Promise<Binding> =>
  upsertBinding(deps, gammeId, page);

const staleAge = (binding: Binding, now: string): number =>
  daysBetween(binding.staleSince ?? binding.syncedAt, now);

/** Empreinte comparée : la gamme suit la page, ou signale son âge. */
export const checkSync = async (deps: Deps, gammeId: string, page: PageDigest): Promise<Result<SyncReport>> => {
  const binding = (await deps.store.bindings.list((b) => b.gammeId === gammeId))[0];
  if (!binding) {
    return fail(
      "unknown_gamme",
      `Aucune page liée à la gamme ${gammeId} : la lier avant de vérifier la synchronisation.`,
      `No page bound to gammes ${gammeId}: bind it before checking synchronisation.`,
      { gammeId },
    );
  }
  if (!page.reachable) {
    const gone = await markSourceGone(deps, gammeId);
    if (!gone.ok) return gone;
    return ok({ sync: "source_gone", binding: gone.value });
  }
  const now = deps.clock.now();
  const currentHash = deps.hasher.contentHash(page.storageBody);
  if (currentHash === binding.contentHash) {
    await markGammeSync(deps, gammeId, "synced");
    if (binding.sync === "synced") return ok({ sync: "synced", binding });
    const resynced = await upsertBinding(deps, gammeId, page);
    return ok({ sync: "synced", binding: resynced });
  }
  const staleSince = binding.staleSince ?? now;
  const stale = await upsertBinding(deps, gammeId, page, {
    sync: "stale",
    staleSince,
    contentHash: binding.contentHash, // l'empreinte de référence reste celle de la compilation
    syncedAt: binding.syncedAt,
    ...(binding.lastDiffJson ? { lastDiffJson: binding.lastDiffJson } : {}),
  });
  await markGammeSync(deps, gammeId, "stale");
  return ok({
    sync: "stale",
    ageDays: staleAge(stale, now),
    binding: stale,
    ...(stale.lastDiffJson ? { diff: stale.lastDiffJson } : {}),
  });
};

/** Page supprimée : la gamme garde sa dernière version, l'absence de source est affichée partout. */
export const markSourceGone = async (deps: Deps, gammeId: string): Promise<Result<Binding>> => {
  const binding = (await deps.store.bindings.list((b) => b.gammeId === gammeId))[0];
  const gamme = await deps.store.gammes.get(gammeId);
  if (!binding && !gamme) {
    return fail("unknown_gamme", `Gamme ${gammeId} introuvable.`, `Gammes ${gammeId} not found.`, { gammeId });
  }
  const now = deps.clock.now();
  const gone: Binding = {
    id: binding?.id ?? deps.ids.next("bnd"),
    gammeId,
    pageAri: binding?.pageAri ?? "",
    contentHash: binding?.contentHash ?? "",
    syncedAt: binding?.syncedAt ?? now,
    staleSince: binding?.staleSince,
    sync: "source_gone",
    ...(binding?.lastDiffJson ? { lastDiffJson: binding.lastDiffJson } : {}),
  };
  await deps.store.bindings.insert(gone);
  await deps.store.gammes.update(gammeId, (g) => ({ ...g, sync: "source_gone" }));
  return ok(gone);
};

/** Âge de l'écart, pour le panneau rouge de l'atelier et le compteur de fraîcheur. */
export const stalenessOf = (binding: Binding, now: string): number | undefined =>
  binding.sync === "stale" ? staleAge(binding, now) : undefined;

/** Une gamme désynchronisée reste exécutable : on affiche l'âge, on ne bloque rien. */
export const isRunnableWhileStale = (gamme: Gamme): boolean => gamme.state === "approved";

/** Signale la désynchronisation côté gamme (panneau rouge, atelier, macro). */
export const markGammeSync = async (deps: Deps, gammeId: string, sync: SyncState): Promise<void> => {
  await deps.store.gammes.update(gammeId, (g) => ({ ...g, sync }));
  if (sync === "stale") {
    await deps.store.appendEvent({
      at: deps.clock.now(),
      kind: "binding.stale",
      subjectRef: gammeId,
      payload: { sync },
    });
  }
};

/**
 * Une version vient d'être approuvée : le lien repart de son empreinte à elle.
 * C'est le seul moment où l'écart page ↔ gamme est refermé.
 */
export const syncBindingToVersion = async (deps: Deps, gammeId: string, version: GammeVersion): Promise<void> => {
  const binding = (await deps.store.bindings.list((b) => b.gammeId === gammeId))[0];
  if (!binding || !version.contentHash || !version.sourcePageAri) return;
  await deps.store.bindings.insert({
    ...binding,
    pageAri: version.sourcePageAri,
    contentHash: version.contentHash,
    syncedAt: deps.clock.now(),
    staleSince: undefined,
    sync: "synced",
  });
  await deps.store.gammes.update(gammeId, (g) => ({ ...g, sync: "synced" }));
};
