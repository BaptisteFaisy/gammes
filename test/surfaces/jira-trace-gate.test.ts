/**
 * GA-25 — le validateur de transition exige une trace, et le flux Jira de la
 * version humaine est généré depuis la gamme (jamais une seconde source).
 */
import { describe, expect, it } from "vitest";
import { agent, human, makeDeps } from "../helpers";
import { seedApprovedGamme, validInputs } from "../moteur-execution/fixtures";
import { finishRun, startRun } from "../../src/core/run/runs";
import { humanWorkflow, tracesOfIssue, validateTransition } from "../../src/jira/trace-gate";
import { issueKeyOf } from "../../src/jira/validator-payload";

const CODE = "GAM-deploy-01";

/** Une exécution liée à un ticket, close ou non. */
const runLinked = async (deps: ReturnType<typeof makeDeps>, issueKey: string, close: boolean) => {
  const started = await startRun(deps, { code: CODE, inputs: validInputs(), actor: human(), ticketRef: issueKey });
  if (!started.ok) throw new Error(started.error.code);
  if (close) await finishRun(deps, { runId: started.value.run.id, outcome: "succeeded" });
  return started.value.run;
};

describe("validateur de transition (GA-25)", () => {
  it("sans aucune trace liée, la transition est refusée et dit ce qui manque", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const verdict = await validateTransition(deps, { issueKey: "PAY-123" });
    expect(verdict.allowed).toBe(false);
    if (verdict.allowed) return;
    expect(verdict.reason).toBe("no_trace");
    expect(verdict.message).toContain("PAY-123");
    expect(verdict.messageEn).toContain("start-run");
  });

  it("une exécution ouverte ne suffit pas : il faut une trace close", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    await runLinked(deps, "PAY-124", false);
    const verdict = await validateTransition(deps, { issueKey: "PAY-124" });
    expect(verdict.allowed).toBe(false);
    if (verdict.allowed) return;
    expect(verdict.reason).toBe("no_closed_trace");
    expect(verdict.message).toContain("finish-run");
  });

  it("une trace close autorise la transition et cite la version épinglée", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const run = await runLinked(deps, "PAY-125", true);
    const verdict = await validateTransition(deps, { issueKey: "PAY-125" });
    expect(verdict.allowed).toBe(true);
    if (!verdict.allowed) return;
    expect(verdict.traces).toHaveLength(1);
    expect(verdict.traces[0]?.code).toBe(CODE);
    expect(verdict.traces[0]?.version).toBe(run.pinnedVersion);
    expect(verdict.traces[0]?.outcome).toBe("succeeded");
  });

  it("un ticket sans clé est refusé, pas autorisé par défaut", async () => {
    const deps = makeDeps();
    const verdict = await validateTransition(deps, { issueKey: "" });
    expect(verdict.allowed).toBe(false);
  });

  it("aucune identité d'acteur ne sort (GA-21) : la nature seulement", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    await startRun(deps, { code: CODE, inputs: validInputs(), actor: agent(), ticketRef: "PAY-126" });
    const traces = await tracesOfIssue(deps, "PAY-126");
    expect(traces).toHaveLength(1);
    expect(traces[0]?.actorKind).toBe("agent");
    expect(JSON.stringify(traces)).not.toContain("ari:cloud:rovo:agent:compagnon");
  });
});

describe("flux Jira de la version humaine (GA-25)", () => {
  it("une transition par étape, dans l'ordre, avec ses exigences", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const flux = await humanWorkflow(deps, CODE);
    expect(flux).toBeDefined();
    expect(flux?.steps.length).toBeGreaterThan(1);
    expect(flux?.steps.map((s) => s.ord)).toEqual([...(flux?.steps ?? [])].sort((a, b) => a.ord - b.ord).map((s) => s.ord));
    expect(flux?.steps[0]?.transition).toContain(`Gammes ${flux?.version}.1`);
    expect(flux?.steps.some((s) => s.evidenceRequired)).toBe(true);
  });

  it("une gamme inconnue ne produit pas de flux inventé", async () => {
    const deps = makeDeps();
    expect(await humanWorkflow(deps, "GAM-absente")).toBeUndefined();
  });
});

describe("payload du validateur Forge", () => {
  it("lit la clé de ticket dans un payload de forme libre", () => {
    expect(issueKeyOf({ issueKey: "PAY-1" })).toBe("PAY-1");
    expect(issueKeyOf({ transition: { issueKey: "PAY-2" } })).toBe("PAY-2");
    expect(issueKeyOf(undefined)).toBe("");
    expect(issueKeyOf({ issueKey: 42 })).toBe("");
  });

  it("échoue fermé : une clé illisible devient une absence, donc un refus", async () => {
    const deps = makeDeps();
    expect(issueKeyOf({})).toBe("");
    const verdict = await validateTransition(deps, { issueKey: issueKeyOf({}) });
    expect(verdict.allowed).toBe(false);
  });
});
