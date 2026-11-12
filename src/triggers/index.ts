/**
 * Gammes — déclencheurs (§ 20) : événements de page, travail de nuit, traitements longs.
 *
 * Trois entrées asynchrones, toutes fines : elles construisent le `Deps` de production et
 * délèguent aux actions du resolver. La compilation et les recalculs passent par le
 * `consumer` (jusqu'à 900 s) ; la fraîcheur, les statistiques, les fantômes et les conflits
 * par le déclencheur planifié de nuit (un seul, § 22).
 */

import type { Deps } from "../core/ports";
import { buildForgeDeps } from "../platform/forge/deps";
import { createActions } from "../resolver/actions";

let depsPromise: Promise<Deps> | undefined;
const deps = (): Promise<Deps> => (depsPromise ??= buildForgeDeps());

type PageEvent = { readonly ari?: string; readonly page?: { readonly ari?: string }; readonly kind?: string };

/** Page créée/modifiée/supprimée : contrôle de synchronisation de la gamme liée. */
export const pageEventHandler = async (event: PageEvent): Promise<unknown> => {
  const ari = event.ari ?? event.page?.ari;
  if (!ari) return { handled: false, reason: "événement sans ARI de page" };
  const kind = event.kind ?? "updated";
  const d = await deps();
  return createActions(d).pageEvent({ ari, kind });
};

/** Nuit : fraîcheur, statistiques, amendements, fantômes, conflits. */
export const nightlyHandler = async (): Promise<unknown> => {
  const d = await deps();
  return createActions(d).nightly();
};

type ConsumerPayload = { readonly job?: string; readonly pageAri?: string; readonly confirmedById?: string; readonly code?: string };

/** Traitements longs (consumer, 900 s) : compilation d'une page, recalcul de statistiques. */
export const consumerHandler = async (payload: ConsumerPayload): Promise<unknown> => {
  const d = await deps();
  const actions = createActions(d);
  if (payload.job === "compile" && payload.pageAri) {
    return actions.mcp({ tool: "compile-page", args: { pageAri: payload.pageAri, confirmedById: payload.confirmedById ?? "" } });
  }
  if (payload.job === "recompute-stats" && payload.code) {
    return actions.stats({ code: payload.code });
  }
  return actions.nightly();
};
