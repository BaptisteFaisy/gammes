/**
 * Gammes — recompilation proposée (§ 10, GA-10).
 *
 * La page a changé : l'app ne republie rien d'elle-même. Elle recompile en
 * brouillon, calcule le diff, le conserve dans le lien page ↔ gamme, et laisse la
 * gamme **désynchronisée** jusqu'à l'approbation humaine de la nouvelle version.
 */

import type { Deps } from "../ports";
import { fail, type Result } from "../result";
import type { ActorRef, PageDigest } from "../types";
import { compilePage, type CompileOutcome } from "./compile-page";

export type RecompileArgs = {
  readonly gammeId: string;
  readonly page: PageDigest;
  readonly confirmedBy: ActorRef;
};

export const proposeRecompile = async (deps: Deps, args: RecompileArgs): Promise<Result<CompileOutcome>> => {
  const gamme = await deps.store.gammes.get(args.gammeId);
  if (!gamme) {
    return fail("unknown_gamme", `Gamme ${args.gammeId} introuvable.`, `Gammes ${args.gammeId} not found.`, {
      gammeId: args.gammeId,
    });
  }
  const outcome = await compilePage(deps, {
    page: args.page,
    confirmedBy: args.confirmedBy,
    spaceKey: gamme.spaceKey,
  });
  if (!outcome.ok) return outcome;
  if (outcome.value.gamme.id !== gamme.id) {
    return fail(
      "internal",
      `La page ${args.page.ari} est liée à une autre gamme (${outcome.value.gamme.code}) : recompilation refusée.`,
      `Page ${args.page.ari} is bound to another gammes (${outcome.value.gamme.code}): recompilation refused.`,
      { pageAri: args.page.ari, boundTo: outcome.value.gamme.code },
    );
  }
  return outcome;
};
