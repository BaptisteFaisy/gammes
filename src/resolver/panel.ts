/**
 * Actions de l'encart Jira (GA-16) — propriétaire : lot K.
 * Le resolver reste un point de montage : aucune logique métier ici, seulement
 * des appels aux services du cœur.
 */
import type { Deps } from "../core/ports";
import { ok, type Result } from "../core/result";
import { findProcedure } from "../core/mcp/search";
import { buildTrace } from "../core/trace/trace";
import type { Trace } from "../core/types";
import type { ActionPayload } from "./actions";

/** Ce que l'encart affiche : les gammes candidates pour ce ticket, et leurs traces. */
export const panelActions = (deps: Deps) => ({
  issuePanel: async (p: ActionPayload): Promise<Result<unknown>> =>
    ok(await findProcedure(deps, {
      query: String(p.summary ?? p.issueKey ?? ""),
      context: { service: p.service ? String(p.service) : undefined },
    })),

  /** Les traces déjà liées à ce ticket (le passé, cité). */
  issuePanelTraces: async (p: ActionPayload & { issueKey: string }): Promise<Result<unknown>> => {
    const runs = await deps.store.runs.list((r) => r.ticketRef === p.issueKey);
    const traces: Trace[] = [];
    for (const run of runs.slice(0, 10)) traces.push(await buildTrace(deps, run));
    return ok({ issueKey: p.issueKey, traces });
  },
});

/** Clés d'actions de ce groupe : le lot propriétaire n'édite que ce fichier. */
export const panelKeys = ["issuePanel", "issuePanelTraces"] as const;

export type PanelActions = ReturnType<typeof panelActions>;
