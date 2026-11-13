/**
 * Gammes — l'action d'approbation du resolver : l'acte humain qui rend une
 * gamme invocable.
 *
 * Compiler ne publie rien (`src/core/compile/compile-page.ts`) : l'approbation
 * est un acte **séparé**, daté et signé par une personne identifiée. Le cœur le
 * sait depuis toujours (`approveVersion`, `src/core/version/versioning.ts`) mais
 * l'app déployée ne l'exposait nulle part : le registre ne montrait que des
 * brouillons, et l'encart Jira (`isInvocable`) ne pouvait rien proposer. Cette
 * action est le chemin unique qui rend l'acte accessible — c'est elle que la
 * macro de la page appelle quand l'auteur de la procédure approuve.
 *
 * Trois règles tiennent ici :
 * - **un seul chemin** : la charge utile est `{ code }`, le code de la gamme ;
 * - **un humain identifié** : sans `accountId`, la demande est refusée ;
 * - **aucune garde contournée** : les refus du cœur sont renvoyés tels quels.
 *   Un refus est une réponse, jamais une exception.
 */

import type { Deps } from "../core/ports";
import { fail, ok, type Result } from "../core/result";
import type { Gamme } from "../core/types";
import { approveVersion, getVersion } from "../core/version/versioning";
import { actorFromRequest, type ActionPayload, type ForgeRequest } from "./actions";

/** Charge utile de l'action `approve` : le code de la gamme à approuver. */
export type ApprovePayload = ActionPayload & { readonly code: string };

/** Ce que l'approbation a changé — rendu tel quel à l'écran. */
export type ApproveOutcome = {
  /** Le code de la gamme approuvée. */
  readonly code: string;
  /** Le numéro de la version approuvée. */
  readonly version: number;
  /** L'état de la gamme après approbation (`approved`). */
  readonly state: string;
  /** L'accountId de la personne qui a approuvé. */
  readonly approvedBy: string;
};

/** Sans compte identifié, personne n'approuve : le motif est dit, pas deviné. */
const refusSansCompte = (code: string): Result<ApproveOutcome> =>
  fail(
    "approval_requires_human",
    "L'approbation exige un compte identifié : reconnectez-vous pour approuver cette version.",
    "Approval requires an identified account: sign in to approve this version.",
    { code },
    true,
  );

/** Une version approuvée est immuable : on ne l'approuve pas deux fois. */
const refusDejaApprouvee = (code: string, version: number): Result<ApproveOutcome> =>
  fail(
    "version_immutable",
    `Version v${version} de ${code} déjà approuvée : une version approuvée est immuable, elle ne s'approuve pas deux fois.`,
    `Version v${version} of ${code} is already approved: an approved version is immutable, it is not approved twice.`,
    { code, version },
  );

/** Ce que l'approbation a changé, lu dans la gamme rendue par le cœur. */
const outcome = (gamme: Gamme, approverId: string): ApproveOutcome => ({
  code: gamme.code,
  version: gamme.currentVersion,
  state: gamme.state,
  approvedBy: gamme.approvedByRef ?? approverId,
});

/**
 * Approuver la version courante d'une gamme (`getVersion` : celle que la macro
 * affiche). Le refus du noyau — secret ouvert, gamme sans propriétaire, acteur
 * non humain — est rendu tel quel : l'action ne contourne aucune garde.
 */
export const approveActions = (deps: Deps) => ({
  approve: async (p: ApprovePayload, request?: ForgeRequest): Promise<Result<ApproveOutcome>> => {
    const code = String(p.code ?? "").trim();
    if (!code) {
      return fail("unknown_gamme", "Aucun code de gamme : rien à approuver.", "No gamme code: nothing to approve.");
    }
    if (!request?.accountId) return refusSansCompte(code);
    const approver = actorFromRequest({ accountId: request.accountId });
    const current = await getVersion(deps, code);
    if (!current.ok) return current;
    const version = current.value;
    if (version.approvedAt) return refusDejaApprouvee(code, version.version);
    const approved = await approveVersion(deps, { versionId: version.id, approver });
    if (!approved.ok) return approved;
    return ok(outcome(approved.value, approver.id));
  },
});

/** Clés d'actions de ce groupe : le lot propriétaire n'édite que ce fichier. */
export const approveKeys = ["approve"] as const;

export type ApproveActions = ReturnType<typeof approveActions>;
