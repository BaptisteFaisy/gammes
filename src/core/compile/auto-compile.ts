/**
 * Gammes — la compilation automatique d'une page de procédure (§ 6, GA-05).
 *
 * Le déclencheur `avi:confluence:page:added` ne se contente pas de synchroniser les
 * gammes déjà liées : quand une page **nouvelle** arrive et que son titre annonce une
 * procédure, l'app la compile en **brouillon**. Rien n'est publié — l'approbation reste
 * un acte humain séparé (`src/core/version/versioning.ts`).
 *
 * Trois règles tiennent ici :
 * - une page dont le titre n'annonce pas une procédure n'est pas touchée (le tenant
 *   contient des comptes rendus, des politiques : ce ne sont pas des gammes) ;
 * - la compilation reste **une compilation** : même extracteur, même qualification,
 *   même détection de secrets que le chemin manuel — un seul code, jamais deux ;
 * - un refus est dit, pas avalé : la fonction renvoie ce qui a empêché la compilation.
 */

import type { Deps } from "../ports";
import { ok, type Result } from "../result";
import type { ActorRef, PageDigest } from "../types";
import { compilePage } from "./compile-page";

/** Les titres qui annoncent une procédure : « Procédure : … », « Mode opératoire : … », runbook, SOP, checklist. */
const PROCEDURE_TITLE_RE = /proc[ée]dure|mode\s*op[ée]ratoire|runbook|\bsop\b|checklist/i;

/** Le titre annonce-t-il une procédure ? */
export const annonceUneProcedure = (title: string): boolean => PROCEDURE_TITLE_RE.test(title);

/** Ce qu'une compilation automatique a produit — ou pourquoi elle n'a rien produit. */
export type AutoCompileOutcome = {
  /** La page a-t-elle été compilée ? */
  readonly compiled: boolean;
  /** Le code de la gamme produite (si elle l'a été). */
  readonly code?: string;
  /** Le nombre d'étapes retenues. */
  readonly steps?: number;
  /** Pourquoi rien n'a été compilé. */
  readonly reason?: string;
};

/**
 * Compile une page si son titre annonce une procédure.
 *
 * Le confirmant est l'auteur de la page : c'est lui qui vient d'écrire la procédure,
 * donc c'est lui qui demande qu'elle soit compilée. La compilation ne publie rien.
 */
export const compileIfProcedure = async (
  deps: Deps,
  args: { readonly page: PageDigest; readonly confirmedBy: ActorRef },
): Promise<Result<AutoCompileOutcome>> => {
  if (!args.page.reachable) {
    return ok({ compiled: false, reason: "page inaccessible" });
  }
  if (!annonceUneProcedure(args.page.title)) {
    return ok({ compiled: false, reason: "le titre n'annonce pas une procédure" });
  }
  const outcome = await compilePage(deps, { page: args.page, confirmedBy: args.confirmedBy });
  if (!outcome.ok) return outcome;
  return ok({
    compiled: true,
    code: outcome.value.gamme.code,
    steps: outcome.value.version.steps.length,
  });
};
