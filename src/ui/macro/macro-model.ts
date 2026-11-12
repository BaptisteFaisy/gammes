/**
 * GA-17 — la macro Confluence : état, version, exécutions et fraîcheur de la
 * gamme compilée depuis cette page.
 *
 * La macro **lit** : elle n'écrit jamais dans la page, elle ne corrige rien, elle
 * ne publie rien. Elle rend les trois situations du § 10 sans jamais en inventer
 * une : page liée et synchronisée, page liée et **désynchronisée** (avec l'âge de
 * l'écart), page **non liée** (aucune gamme compilée).
 *
 * Fonctions pures `(deps, args)` : testables hors Forge, sans réseau, et l'âge
 * vient du port `Clock` — jamais de l'heure système.
 */

import type { Deps } from "../../core/ports";
import type { SyncState } from "../../core/types";
import { daysBetween } from "../../platform/clock";
import { getVersion } from "../../core/version/versioning";
import { freshness, type Freshness } from "../../core/stats/workshop";

/** L'état rendu par la macro. */
export type MacroState = {
  readonly ari: string;
  readonly bound: boolean;
  /** `unbound` quand aucune gamme n'a été compilée depuis cette page. */
  readonly sync: SyncState | "unbound";
  readonly code?: string;
  readonly title?: string;
  readonly state?: string;
  readonly version?: number;
  /** Âge de l'écart entre la page et la gamme, en jours (cas `stale`). */
  readonly ageDays?: number;
  readonly runs: number;
  readonly lastRunAt?: string;
  /** Jours de retard sur la date de révision, si elle est dépassée. */
  readonly reviewOverdueDays?: number;
  /** La fraîcheur de l'atelier entier : la dette documentaire, mesurée. */
  readonly workshop: Freshness;
  readonly message: string;
  readonly messageEn: string;
};

const UNBOUND: Omit<MacroState, "ari" | "workshop"> = {
  bound: false,
  sync: "unbound",
  runs: 0,
  message:
    "Aucune gamme compilée depuis cette page. La compilation produit un brouillon et un diff — rien n'est publié sans approbation humaine.",
  messageEn:
    "No gamme compiled from this page. Compilation produces a draft and a diff — nothing is published without human approval.",
};

/** La ligne d'état, dans les trois cas du § 10. */
const ligneEtat = (sync: SyncState, ageDays: number | undefined, code: string, version: number) => {
  if (sync === "source_gone") {
    return {
      message: `${code}@v${version} : la page source a disparu. La gamme reste exécutable, l'absence de source est affichée partout.`,
      messageEn: `${code}@v${version}: the source page is gone. The gamme stays executable, the missing source is shown everywhere.`,
    };
  }
  if (sync === "stale") {
    return {
      message: `${code}@v${version} : la page a changé depuis la compilation — écart de ${ageDays ?? 0} jour(s). Une recompilation est proposée en diff.`,
      messageEn: `${code}@v${version}: the page changed since compilation — ${ageDays ?? 0} day(s) behind. A recompilation diff is proposed.`,
    };
  }
  return {
    message: `${code}@v${version} : synchronisée avec cette page.`,
    messageEn: `${code}@v${version}: in sync with this page.`,
  };
};

/** L'état de la gamme liée à cette page, ou l'absence de lien. */
export const macroState = async (deps: Deps, args: { readonly ari: string }): Promise<MacroState> => {
  const atelier = await freshness(deps);
  if (!args.ari) return { ...UNBOUND, ari: args.ari, workshop: atelier };

  const binding = (await deps.store.bindings.list((b) => b.pageAri === args.ari))[0];
  if (!binding) return { ...UNBOUND, ari: args.ari, workshop: atelier };

  const gamme = (await deps.store.gammes.list((g) => g.id === binding.gammeId))[0];
  const runs = gamme ? await deps.store.runs.list((r) => r.gammeId === gamme.id) : [];
  const lastRunAt = [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]?.startedAt;
  const now = deps.clock.now();
  const ageDays = binding.sync === "stale" ? daysBetween(binding.staleSince ?? binding.syncedAt, now) : undefined;
  const version = gamme ? await getVersion(deps, gamme.code) : undefined;
  const numero = version?.ok ? version.value.version : gamme?.currentVersion ?? 0;
  const code = gamme?.code ?? binding.gammeId;
  const retard = gamme?.reviewDueAt ? daysBetween(gamme.reviewDueAt, now) : undefined;

  return {
    ari: args.ari,
    bound: true,
    sync: binding.sync,
    ...(gamme ? { code: gamme.code, title: gamme.title, state: gamme.state } : { code }),
    version: numero,
    ...(ageDays !== undefined ? { ageDays } : {}),
    runs: runs.length,
    ...(lastRunAt ? { lastRunAt } : {}),
    ...(retard !== undefined && retard > 0 ? { reviewOverdueDays: retard } : {}),
    workshop: atelier,
    ...ligneEtat(binding.sync, ageDays, code, numero),
  };
};
