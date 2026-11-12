/**
 * Handler Forge du validateur de transition Jira (GA-25).
 *
 * Module `jira:workflowValidator` du manifeste, fonction `gammes-validator-fn` :
 * Jira appelle ce handler avant d'autoriser la transition. Aucune logique
 * métier ici — la décision est dans `src/jira/trace-gate.ts`, ce fichier ne fait
 * que lire le payload, appeler le cœur, et rendre le verdict au format attendu.
 *
 * Il **échoue fermé** : si le payload est illisible ou si les dépendances Forge
 * ne peuvent pas être construites, la transition est refusée avec la raison,
 * jamais autorisée par défaut.
 */

import type { Deps } from "./core/ports";
import { buildForgeDeps } from "./platform/forge/deps";
import { validateTransition } from "./jira/trace-gate";
import { issueKeyOf, type ValidatorPayload } from "./jira/validator-payload";

/** Le contrat de sortie du validateur Forge. */
export type ValidatorResult = { readonly isValid: boolean; readonly errorMessage?: string };

let depsPromise: Promise<Deps> | undefined;
const deps = (): Promise<Deps> => (depsPromise ??= buildForgeDeps());

const refuse = (errorMessage: string): ValidatorResult => ({ isValid: false, errorMessage });

/** Le handler déclaré au manifeste. */
export const handler = async (payload: ValidatorPayload): Promise<ValidatorResult> => {
  const issueKey = issueKeyOf(payload);
  if (!issueKey) return refuse("Gammes : ticket illisible, transition refusée par prudence.");
  try {
    const verdict = await validateTransition(await deps(), { issueKey });
    if (verdict.allowed) return { isValid: true };
    return refuse(verdict.message);
  } catch {
    return refuse("Gammes : dépendances indisponibles, transition refusée par prudence.");
  }
};
