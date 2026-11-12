/**
 * Actions de la macro Confluence (GA-17) — propriétaire : lot L.
 * État, version, exécutions, fraîcheur : la macro réinsère dans la page source
 * ce que la compilation a produit, sans jamais réécrire la page.
 */
import type { Deps } from "../core/ports";
import { ok, type Result } from "../core/result";
import { getVersion } from "../core/version/versioning";
import { freshness } from "../core/stats/workshop";
import type { ActionPayload } from "./actions";

export const macroActions = (deps: Deps) => ({
  /** L'état de la gamme liée à cette page, ou l'absence de lien. */
  macroState: async (p: ActionPayload & { ari: string }): Promise<Result<unknown>> => {
    const binding = (await deps.store.bindings.list((b) => b.pageAri === p.ari))[0];
    if (!binding) return ok({ bound: false as const, ari: p.ari });
    const gamme = (await deps.store.gammes.list((g) => g.id === binding.gammeId))[0];
    const version = gamme ? await getVersion(deps, gamme.code) : undefined;
    const runs = gamme ? await deps.store.runs.list((r) => r.code === gamme.code) : [];
    return ok({
      bound: true as const,
      ari: p.ari,
      sync: binding.sync,
      staleSince: binding.staleSince,
      ...(gamme ? { code: gamme.code, state: gamme.state } : {}),
      ...(gamme?.ownerRef ? { owner: gamme.ownerRef } : {}),
      ...(version?.ok ? { version: version.value.version } : {}),
      runs: runs.length,
    });
  },

  /** La fraîcheur de l'atelier, pour l'encart « dette documentaire ». */
  macroFreshness: async (): Promise<Result<unknown>> => ok(await freshness(deps)),
});

/** Clés d'actions de ce groupe : le lot propriétaire n'édite que ce fichier. */
export const macroKeys = ["macroState", "macroFreshness"] as const;

export type MacroActions = ReturnType<typeof macroActions>;
