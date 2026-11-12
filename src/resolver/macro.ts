/**
 * Actions de la macro Confluence (GA-17) — propriétaire : lot L.
 *
 * État, version, exécutions, fraîcheur : la macro réinsère dans la page source ce
 * que la compilation a produit, sans jamais réécrire la page. Aucune logique
 * métier ici — le calcul vit dans `src/ui/macro/macro-model.ts`.
 */
import type { Deps } from "../core/ports";
import { ok, type Result } from "../core/result";
import { freshness } from "../core/stats/workshop";
import { macroState } from "../ui/macro/macro-model";
import type { ActionPayload } from "./actions";

export const macroActions = (deps: Deps) => ({
  /** L'état de la gamme liée à cette page, ou l'absence de lien. */
  macroState: async (p: ActionPayload & { ari: string }): Promise<Result<unknown>> =>
    ok(await macroState(deps, { ari: String(p.ari ?? p.pageAri ?? "") })),

  /** La fraîcheur de l'atelier, pour l'encart « dette documentaire ». */
  macroFreshness: async (): Promise<Result<unknown>> => ok(await freshness(deps)),
});

/** Clés d'actions de ce groupe : le lot propriétaire n'édite que ce fichier. */
export const macroKeys = ["macroState", "macroFreshness"] as const;

export type MacroActions = ReturnType<typeof macroActions>;
