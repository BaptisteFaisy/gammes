/**
 * Les 16 outils MCP (§ 18, GA-14) et le point d'entrée externe signé (GA-26).
 *
 * Recette 20 : aucun écran, export ni outil MCP ne contient de statistique par personne
 * (vérifié par parcours récursif des clés des sorties).
 */

import { describe, expect, it } from "vitest";
import { agent, human, makeDeps } from "../helpers";
import { handleTool, MCP_TOOLS } from "../../src/core/mcp/tools";
import { checkBeforeActing, findProcedure } from "../../src/core/mcp/search";
import { attestationEvidence, CODE, confluenceStub, machineEvidence, seedApproved } from "./fixtures";

const FORBIDDEN_KEY = /(actor|assignee|person|owner|user|byRef|approvedBy|decidedBy)/i;
const keysOf = (value: unknown, out: string[] = []): string[] => {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out.push(k);
      keysOf(v, out);
    }
  }
  return out;
};

describe("recherche avant action (GA-14)", () => {
  it("trouve la gamme approuvée et dit si des permis sont requis", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    const verdict = await checkBeforeActing(deps, { intendedAction: "déployer le service paiements", service: "paiements" });
    expect(verdict.found).toBe(true);
    expect(verdict.state).toBe("approved");
    expect(verdict.permitRequired).toBe(true);
    expect(verdict.code).toBe(CODE);
    const matches = await findProcedure(deps, { query: "déployer paiements", context: { service: "paiements" } });
    expect(matches[0]?.confidence).toBeGreaterThan(0.5);
    expect(matches[0]?.reasons.length).toBeGreaterThan(0);
  });

  it("sans gamme approuvée : on le dit, on n'improvise pas", async () => {
    const deps = makeDeps();
    const verdict = await checkBeforeActing(deps, { intendedAction: "redémarrer le cluster entier" });
    expect(verdict.found).toBe(false);
    expect(verdict.messageFr).toContain("Ne pas improviser");
  });

  it("une gamme approuvée sans aucun rapport avec le geste n'est pas proposée", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    const verdict = await checkBeforeActing(deps, { intendedAction: "redémarrer le routeur de secours à 3 h du matin", service: "reseau" });
    expect(verdict.found).toBe(false);
    expect(verdict.messageFr).toContain("Ne pas improviser");
    const matches = await findProcedure(deps, { query: "redémarrer le routeur de secours", context: { service: "reseau" } });
    expect(matches).toHaveLength(0);
  });

  it("une gamme non approuvée est trouvée mais signalée comme telle", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    await deps.store.gammes.update("gam_mcp", (g) => ({ ...g, state: "draft" }));
    const verdict = await checkBeforeActing(deps, { intendedAction: "déployer paiements", service: "paiements" });
    expect(verdict.found).toBe(true);
    expect(verdict.state).toBe("draft");
    expect(verdict.messageFr).toContain("non approuvée");
  });
});

describe("handleTool : le dispatch des 16 outils", () => {
  it("expose exactement les 16 outils du cahier des charges", () => {
    expect(MCP_TOOLS).toHaveLength(16);
    const keys = MCP_TOOLS.map((t) => t.key);
    for (const expected of ["find-procedure", "check-before-acting", "start-run", "record-step", "export-skill", "get-conflicts"]) {
      expect(keys).toContain(expected);
    }
    expect(MCP_TOOLS.every((t) => t.description.length > 10)).toBe(true);
  });

  it("outil inconnu : refus explicite", async () => {
    const deps = makeDeps();
    const res = await handleTool(deps, "outil-inexistant" as never, {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("input_invalid");
  });

  it("get-procedure rend étapes, verrous, provenance et versions", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    const res = await handleTool(deps, "get-procedure", { code: CODE });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const value = res.value as { version: { steps: unknown[]; sourcePages: string[] }; versions: number[] };
    expect(value.version.steps).toHaveLength(3);
    expect(value.version.sourcePages[0]).toContain("page/1001");
    expect(value.versions).toEqual([1]);
  });

  it("list-procedures filtre par état", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    const res = await handleTool(deps, "list-procedures", { state: "approved" });
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.value as unknown[]).length).toBe(1);
  });

  it("parcours complet via les outils : start-run → get-current-step → record-step → finish-run → get-run-trace", async () => {
    const deps = makeDeps({ permits: { check: async (_a, _k, permitClass) => ({ id: "p", stepId: "", permitClass, checkedAt: "2026-11-11T09:00:00.000Z", result: "granted" as const }), requestUrl: () => "https://permis/x" } });
    await seedApproved(deps);
    const started = await handleTool(deps, "start-run", { code: CODE, inputs: {}, actorId: "ari:cloud:aaid:demo:ana", actorKind: "human" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const runId = (started.value as { run: { id: string } }).run.id;
    const current = await handleTool(deps, "get-current-step", { runId });
    expect(current.ok).toBe(true);
    await handleTool(deps, "record-step", { runId, stepId: "stp_1", outcome: "done", evidence: machineEvidence(), actorKind: "human", actorId: "ari:cloud:aaid:demo:ana" });
    await handleTool(deps, "record-step", { runId, stepId: "stp_2", outcome: "done", evidence: machineEvidence(), actorKind: "human", actorId: "ari:cloud:aaid:demo:ana" });
    await handleTool(deps, "record-step", { runId, stepId: "stp_3", outcome: "done", evidence: attestationEvidence(), actorKind: "human", actorId: "ari:cloud:aaid:demo:ana" });
    const finished = await handleTool(deps, "finish-run", { runId, outcome: "succeeded" });
    expect(finished.ok).toBe(true);
    const trace = await handleTool(deps, "get-run-trace", { runId });
    expect(trace.ok).toBe(true);
    if (trace.ok) expect((trace.value as { citation: string }).citation).toContain(`${CODE}@v1`);
  });

  it("record-step par un agent sur une étape humaine : le refus est un résultat, pas une erreur", async () => {
    const deps = makeDeps({ permits: { check: async (_a, _k, permitClass) => ({ id: "p", stepId: "", permitClass, checkedAt: "2026-11-11T09:00:00.000Z", result: "granted" as const }), requestUrl: () => "https://permis/x" } });
    await seedApproved(deps);
    const started = await handleTool(deps, "start-run", { code: CODE, inputs: {}, actorId: "agent:x", actorKind: "agent" });
    if (!started.ok) throw new Error("démarrage refusé");
    const runId = (started.value as { run: { id: string } }).run.id;
    await handleTool(deps, "record-step", { runId, stepId: "stp_1", outcome: "done", evidence: machineEvidence(), actorKind: "agent", actorId: "agent:x" });
    await handleTool(deps, "record-step", { runId, stepId: "stp_2", outcome: "done", evidence: machineEvidence(), actorKind: "agent", actorId: "agent:x" });
    const refused = await handleTool(deps, "record-step", { runId, stepId: "stp_3", outcome: "done", evidence: attestationEvidence(), actorKind: "agent", actorId: "agent:x" });
    expect(refused.ok).toBe(true);
    if (refused.ok) {
      const outcome = refused.value as { accepted: boolean; refusal?: { code: string } };
      expect(outcome.accepted).toBe(false);
      expect(outcome.refusal?.code).toBe("lock_human_only");
    }
  });

  it("compile-page sans port Confluence est refusé, avec le port il produit un brouillon", async () => {
    const noCf = makeDeps();
    const refused = await handleTool(noCf, "compile-page", { pageAri: "ari:p/1", confirmedById: "ari:cloud:aaid:demo:ana" });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("source_unavailable");

    const deps = makeDeps({ confluence: confluenceStub() });
    const res = await handleTool(deps, "compile-page", { pageAri: "ari:cloud:confluence:demo:page/2002", confirmedById: "ari:cloud:aaid:demo:ana" });
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.value as { gamme: { state: string } }).gamme.state).toBe("draft");
  });

  it("get-missing-procedures et get-conflicts répondent (vides sans données), get-procedure-stats aussi", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    expect((await handleTool(deps, "get-missing-procedures", {})).ok).toBe(true);
    expect((await handleTool(deps, "get-conflicts", {})).ok).toBe(true);
    const stats = await handleTool(deps, "get-procedure-stats", { code: CODE });
    expect(stats.ok).toBe(true);
  });

  it("propose-amendment crée une proposition (jamais appliquée)", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    const res = await handleTool(deps, "propose-amendment", { code: CODE, proposal: "Clarifier l'étape 2", rationale: "échecs répétés" });
    expect(res.ok).toBe(true);
    expect(await deps.store.amendments.count()).toBe(1);
  });
});

describe("recette 20 : aucune statistique par personne dans les sorties MCP", () => {
  it("les sorties statistiques ne portent aucune clé nommant une personne", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    // Les sorties d'audit (get-procedure) portent approvedByRef à dessein : la recette 20
    // vise les STATISTIQUES, pas les références d'audit. On contrôle les agrégats.
    const outputs = [
      await handleTool(deps, "get-procedure-stats", { code: CODE }),
      await handleTool(deps, "get-conflicts", {}),
      await handleTool(deps, "get-missing-procedures", {}),
    ];
    for (const res of outputs) {
      expect(res.ok).toBe(true);
      if (!res.ok) continue;
      const forbidden = keysOf(res.value).filter((k) => FORBIDDEN_KEY.test(k));
      expect(forbidden, JSON.stringify(forbidden)).toHaveLength(0);
    }
  });
});