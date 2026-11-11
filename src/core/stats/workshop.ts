/**
 * Gammes — l'atelier : poussière, toiles d'araignée et fraîcheur (§ 19, § 10, GA-18).
 *
 * Chaque élément de l'atelier porte une donnée mesurée, rien n'est décoratif :
 * la poussière dit « jamais exécutée depuis longtemps », la toile d'araignée dit
 * « l'approbation a passé sa date de révision », le panneau rouge dit « la page a
 * changé ». Aucune de ces mesures ne nomme une personne.
 */

import type { Deps } from "../ports";
import type { Binding, Gamme, Run, SpaceSettings } from "../types";
import { daysBetween, shiftDays } from "../../platform/clock";
import { median } from "./rates";

export type DustKind = "dust" | "cobweb" | "stale" | "orphan";

export type DustItem = {
  readonly gammeId: string;
  readonly code: string;
  readonly kind: DustKind;
  readonly ageDays: number;
  readonly reason: string;
};

export const DEFAULT_DUST_DAYS = 90;
export const STALE_ALERT_DAYS = 90;

export type Freshness = {
  readonly syncedPct: number;
  readonly medianGapDays: number;
  readonly staleOver90d: number;
  readonly total: number;
};

const settingsOf = async (deps: Deps, spaceKey: string, fallback?: SpaceSettings): Promise<SpaceSettings | undefined> =>
  (await deps.store.settings.get(spaceKey)) ?? fallback;

const lastRunOf = async (deps: Deps, gammeId: string): Promise<Run | undefined> => {
  const runs = await deps.store.runs.list((r) => r.gammeId === gammeId);
  return [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
};

const bindingOf = async (deps: Deps, gammeId: string): Promise<Binding | undefined> =>
  (await deps.store.bindings.list((b) => b.gammeId === gammeId))[0];

const dustItem = async (deps: Deps, gamme: Gamme, dustAfterDays: number, now: string): Promise<DustItem | undefined> => {
  const last = await lastRunOf(deps, gamme.id);
  const since = last ? last.startedAt : gamme.approvedAt ?? gamme.createdAt;
  const ageDays = daysBetween(since, now);
  if (ageDays < dustAfterDays) return undefined;
  return {
    gammeId: gamme.id,
    code: gamme.code,
    kind: "dust",
    ageDays,
    reason: last
      ? `aucune exécution depuis ${ageDays} jours`
      : `approuvée il y a ${ageDays} jours, jamais exécutée`,
  };
};

const cobwebItem = (gamme: Gamme, now: string): DustItem | undefined => {
  if (!gamme.reviewDueAt) return undefined;
  const overdue = daysBetween(gamme.reviewDueAt, now);
  if (overdue < 0) return undefined;
  return {
    gammeId: gamme.id,
    code: gamme.code,
    kind: "cobweb",
    ageDays: overdue,
    reason: `approbation à réviser depuis ${overdue} jour(s)`,
  };
};

const staleItem = (gamme: Gamme, binding: Binding | undefined, now: string): DustItem | undefined => {
  if (gamme.sync !== "stale") return undefined;
  const ageDays = binding?.staleSince ? daysBetween(binding.staleSince, now) : 0;
  return {
    gammeId: gamme.id,
    code: gamme.code,
    kind: "stale",
    ageDays,
    reason: `page source modifiée il y a ${ageDays} jour(s), gamme non recompilée`,
  };
};

const orphanItem = (gamme: Gamme): DustItem | undefined =>
  gamme.ownerRef
    ? undefined
    : { gammeId: gamme.id, code: gamme.code, kind: "orphan", ageDays: 0, reason: "sans propriétaire : file d'adoption" };

/** Les poussières de l'atelier : ce qui mérite un regard, sans jamais classer personne. */
export const workshopDust = async (deps: Deps, fallbackSettings?: SpaceSettings): Promise<readonly DustItem[]> => {
  const now = deps.clock.now();
  const gammes = await deps.store.gammes.list((g) => g.state === "approved");
  const out: DustItem[] = [];
  for (const gamme of gammes) {
    const settings = await settingsOf(deps, gamme.spaceKey, fallbackSettings);
    const dustDays = settings?.dustAfterDays ?? DEFAULT_DUST_DAYS;
    const binding = await bindingOf(deps, gamme.id);
    const items = [await dustItem(deps, gamme, dustDays, now), cobwebItem(gamme, now), staleItem(gamme, binding, now), orphanItem(gamme)];
    out.push(...items.filter((i): i is DustItem => i !== undefined));
  }
  return out.sort((a, b) => b.ageDays - a.ageDays);
};

/** Le compteur de fraîcheur : la dette documentaire mesurée, pas déclarée. */
export const freshness = async (deps: Deps): Promise<Freshness> => {
  const now = deps.clock.now();
  const gammes = await deps.store.gammes.list((g) => g.state === "approved");
  if (gammes.length === 0) return { syncedPct: 100, medianGapDays: 0, staleOver90d: 0, total: 0 };
  const gaps: number[] = [];
  let staleOver90d = 0;
  for (const gamme of gammes.filter((g) => g.sync === "stale")) {
    const binding = await bindingOf(deps, gamme.id);
    const gap = binding?.staleSince ? daysBetween(binding.staleSince, now) : 0;
    gaps.push(gap);
    if (gap > STALE_ALERT_DAYS) staleOver90d += 1;
  }
  const synced = gammes.filter((g) => g.sync === "synced").length;
  return {
    syncedPct: Math.round((synced / gammes.length) * 100),
    medianGapDays: median(gaps) ?? 0,
    staleOver90d,
    total: gammes.length,
  };
};

/** Une gamme approuvée il y a deux ans et jamais exécutée est signalée, pas oubliée. */
export const isForgotten = (gamme: Gamme, now: string, dustAfterDays = DEFAULT_DUST_DAYS): boolean =>
  gamme.state === "approved" && daysBetween(gamme.approvedAt ?? gamme.createdAt, now) > dustAfterDays;

/** Échéance de révision par défaut : un an après approbation. */
export const defaultReviewDue = (approvedAt: string, reviewAfterDays = 365): string =>
  shiftDays(approvedAt, reviewAfterDays);
