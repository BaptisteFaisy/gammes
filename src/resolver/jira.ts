/**
 * Actions Jira hors encart (GA-25) — propriétaire : lot M.
 * Le validateur de transition refuse un passage à « Terminé » tant qu'aucune
 * trace d'exécution n'est liée au ticket ; l'app ne ment jamais sur ce point.
 */
import type { Deps } from "../core/ports";
import { ok, type Result } from "../core/result";
import type { ActionPayload } from "./actions";

export const jiraActions = (deps: Deps) => ({
  /** Les traces liées à un ticket : la matière du validateur et de l'encart. */
  issueTraces: async (p: ActionPayload & { issueKey: string }): Promise<Result<unknown>> => {
    const runs = await deps.store.runs.list((r) => r.ticketRef === p.issueKey);
    return ok({
      issueKey: p.issueKey,
      count: runs.length,
      closed: runs.filter((r) => r.finishedAt !== undefined).length,
      runs: runs.map((r) => ({ id: r.id, code: r.code, version: r.pinnedVersion, outcome: r.outcome })),
    });
  },
});

export type JiraActions = ReturnType<typeof jiraActions>;
