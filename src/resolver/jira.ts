/**
 * Actions Jira hors encart (GA-25) — le flux de la version humaine d'une gamme
 * et le verdict du validateur de transition.
 *
 * Le validateur Forge lui-même est un handler à part (`src/validator.ts`, clé de
 * fonction `gammes-validator-fn`) : Jira l'appelle directement, il ne passe pas
 * par le resolver. Les actions ci-dessous servent aux surfaces et aux agents.
 */
import type { Deps } from "../core/ports";
import { ok, type Result } from "../core/result";
import { humanWorkflow, tracesOfIssue, validateTransition } from "../jira/trace-gate";
import type { ActionPayload } from "./actions";

export const jiraActions = (deps: Deps) => ({
  /** Les traces liées à un ticket : la matière du validateur et de l'encart. */
  issueTraces: async (p: ActionPayload & { issueKey: string }): Promise<Result<unknown>> => {
    const traces = await tracesOfIssue(deps, p.issueKey);
    return ok({ issueKey: p.issueKey, count: traces.length, traces });
  },

  /** Le verdict de transition, rendu tel quel à l'appelant (jamais tranché en silence). */
  transitionVerdict: async (p: ActionPayload & { issueKey: string }): Promise<Result<unknown>> =>
    ok(await validateTransition(deps, { issueKey: p.issueKey })),

  /** Le flux Jira de la version humaine : une transition par étape de la gamme. */
  workflow: async (p: ActionPayload & { code: string }): Promise<Result<unknown>> => {
    const flux = await humanWorkflow(deps, p.code);
    return ok(flux ?? { code: p.code, found: false as const });
  },
});

/** Clés d'actions de ce groupe : le lot propriétaire n'édite que ce fichier. */
export const jiraKeys = ["issueTraces", "transitionVerdict", "workflow"] as const;

export type JiraActions = ReturnType<typeof jiraActions>;
