/**
 * Actions de l'encart Jira (GA-16) — propriétaire : lot K.
 *
 * Le resolver reste un point de montage : aucune logique métier ici, seulement
 * des appels aux services (`src/ui/issue-panel/panel-model.ts`).
 */
import type { Deps } from "../core/ports";
import { ok, type Result } from "../core/result";
import { buildTrace } from "../core/trace/trace";
import { startRun } from "../core/run/runs";
import { findProcedure } from "../core/mcp/search";
import { panelState, panelSteps, panelTraces } from "../ui/issue-panel/panel-model";
import type { ActorKind } from "../core/types";
import type { ActionPayload } from "./actions";

/** Ce que l'encart affiche : les gammes candidates pour ce ticket, et leurs traces. */
export const panelActions = (deps: Deps) => ({
  /** Les gammes qui correspondent au ticket (le contrat historique de l'encart). */
  issuePanel: async (p: ActionPayload): Promise<Result<unknown>> =>
    ok(await findProcedure(deps, {
      query: String(p.summary ?? p.issueKey ?? ""),
      context: { service: p.service ? String(p.service) : undefined },
    })),

  /** L'état complet de l'encart : candidats, entrées manquantes, traces liées. */
  issuePanelState: async (p: ActionPayload): Promise<Result<unknown>> =>
    ok(await panelState(deps, {
      issueKey: String(p.issueKey ?? p.summary ?? ""),
      summary: p.summary ? String(p.summary) : undefined,
      service: p.service ? String(p.service) : undefined,
    })),

  /** Les traces déjà liées à ce ticket (le passé, cité). */
  issuePanelTraces: async (p: ActionPayload & { issueKey: string }): Promise<Result<unknown>> => {
    const runs = await deps.store.runs.list((r) => r.ticketRef === p.issueKey);
    const traces = [];
    for (const run of runs.slice(0, 10)) traces.push(await buildTrace(deps, run));
    return ok({ issueKey: p.issueKey, traces });
  },

  /** Les étapes de la gamme : preuve attendue et preuve acquittée, étape par étape. */
  issuePanelSteps: async (p: ActionPayload & { code: string }): Promise<Result<unknown>> =>
    ok({ code: p.code, steps: await panelSteps(deps, { code: p.code, runId: p.runId ? String(p.runId) : undefined }) }),

  /** Les traces résumées (sans identité d'acteur) : la liste courte de l'encart. */
  issuePanelHistory: async (p: ActionPayload & { issueKey: string }): Promise<Result<unknown>> =>
    ok({ issueKey: p.issueKey, traces: await panelTraces(deps, p.issueKey) }),

  /**
   * Démarrer une exécution depuis l'encart. L'exécution est **liée au ticket**
   * (`ticketRef`) : c'est ce lien qui fera la preuve exigée par le validateur de
   * transition (GA-25). Un refus de verrou remonte tel quel — l'agent qui
   * tente d'acquitter une étape réservée à l'humain doit l'apprendre.
   */
  issuePanelStart: async (
    p: ActionPayload & { code: string; issueKey: string },
  ): Promise<Result<unknown>> => {
    const actorKind: ActorKind = p.actorKind === "agent" ? "agent" : "human";
    const actor = { id: String(p.actorId ?? `jira:${p.issueKey}`), kind: actorKind };
    const inputs = (p.inputs ?? {}) as Record<string, unknown>;
    return startRun(deps, { code: p.code, inputs, actor, ticketRef: p.issueKey });
  },
});

/** Clés d'actions de ce groupe : le lot propriétaire n'édite que ce fichier. */
export const panelKeys = [
  "issuePanel",
  "issuePanelState",
  "issuePanelSteps",
  "issuePanelTraces",
  "issuePanelHistory",
  "issuePanelStart",
] as const;

export type PanelActions = ReturnType<typeof panelActions>;
