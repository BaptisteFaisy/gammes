/**
 * Recette de bout en bout (§ 25) — points 12 à 20.
 *
 * Désynchronisation, statistiques et amendements, comparaison de versions, export SKILL.md,
 * fantômes, conflits et l'interdiction absolue de toute statistique par personne. Le tout
 * sur l'espace de démonstration, en mémoire, sans réseau.
 */

import { describe, expect, it } from "vitest";
import { agent, human, makePage, makeVersion, T0 } from "../helpers";
import { PAGES, seedAtelier, seedSettings, seedTraces } from "../../seed/atelier";
import { compilePage } from "../../src/core/compile/compile-page";
import { approveVersion } from "../../src/core/version/versioning";
import { checkSync } from "../../src/core/binding/binding";
import { computeStepStats, compareVersions } from "../../src/core/stats/step-stats";
import { proposeFromTraces } from "../../src/core/amendments/amendments";
import { exportSkillMd } from "../../src/core/export/skill-md";
import { detectGhosts } from "../../src/core/ghosts/ghosts";
import { detectConflicts } from "../../src/core/conflicts/detect";
import { handleTool } from "../../src/core/mcp/tools";

const OWNER = "ari:cloud:aaid:demo:ana";

const compileAndApprove = async (deps: ReturnType<typeof seedAtelier>["deps"], ari: string) => {
  const compiled = await compilePage(deps, { page: PAGES[ari]!, confirmedBy: human(OWNER) });
  if (!compiled.ok) throw new Error(compiled.error.messageFr);
  await deps.store.gammes.update(compiled.value.gamme.id, (g) => ({ ...g, ownerRef: OWNER }));
  const approved = await approveVersion(deps, { versionId: compiled.value.version.id, approver: human(OWNER) });
  if (!approved.ok) throw new Error(approved.error.messageFr);
  return compiled.value;
};

describe("recette 12 : désynchronisation", () => {
  it("la page modifiée marque la gamme désynchronisée, avec l'âge de l'écart", async () => {
    const { deps, clock } = seedAtelier();
    await seedSettings(deps);
    const out = await compileAndApprove(deps, "ari:page/deploy");
    const modifiee = makePage({ ...PAGES["ari:page/deploy"]!, storageBody: PAGES["ari:page/deploy"]!.storageBody.replace("5 minutes", "20 minutes") });
    const first = await checkSync(deps, out.gamme.id, modifiee); // marque stale, âge 0
    expect(first.ok).toBe(true);
    clock.advanceDays(100);
    const sync = await checkSync(deps, out.gamme.id, modifiee); // mesure l'âge de l'écart
    expect(sync.ok).toBe(true);
    if (!sync.ok) return;
    expect(sync.value.sync).toBe("stale");
    expect(sync.value.ageDays).toBe(100);
    // La gamme approuvée reste exécutable malgré l'écart.
    expect((await deps.store.gammes.get(out.gamme.id))?.sync).toBe("stale");
  });
});

describe("recette 14–16 : mesurer, amender, comparer", () => {
  it("14. une étape en échec 6/10 sur 40 exécutions ⇒ amendement proposé avec ses preuves", async () => {
    const { deps } = seedAtelier();
    const out = await compileAndApprove(deps, "ari:page/deploy");
    const failingStep = out.version.steps[1]!;
    await seedTraces(deps, { gammeId: out.gamme.id, code: out.gamme.code, versionId: out.version.id, n: 40, failures: 24, stepId: failingStep.id });
    const amended = await proposeFromTraces(deps, { code: out.gamme.code });
    expect(amended.ok).toBe(true);
    if (!amended.ok) return;
    expect(amended.value.length).toBeGreaterThan(0);
    const amd = amended.value.find((a) => a.stepId === failingStep.id);
    expect(amd).toBeDefined();
    expect(amd?.rationale).toContain("60 %");
    expect(amd?.evidenceRefs.length).toBeGreaterThan(5);
  });

  it("15. un taux sur trois exécutions ⇒ « pas assez de recul », aucun pourcentage", async () => {
    const { deps } = seedAtelier();
    const out = await compileAndApprove(deps, "ari:page/deploy");
    await seedTraces(deps, { gammeId: out.gamme.id, code: out.gamme.code, versionId: out.version.id, n: 3, failures: 2, stepId: out.version.steps[1]!.id });
    const stats = await computeStepStats(deps, { code: out.gamme.code });
    const small = stats.find((s) => s.stepId === out.version.steps[1]!.id)!;
    expect(small.failRate.value).toBeUndefined();
    expect(small.failRate.cohort.enoughHistory).toBe(false);
  });

  it("16. comparaison v1/v2 : les deux taux avec leurs effectifs", async () => {
    const { deps } = seedAtelier();
    const out = await compileAndApprove(deps, "ari:page/deploy");
    const step = out.version.steps[1]!;
    await seedTraces(deps, { gammeId: out.gamme.id, code: out.gamme.code, versionId: out.version.id, n: 40, failures: 24, stepId: step.id });
    await deps.store.versions.insert(makeVersion({ id: "ver_v2", gammeId: out.gamme.id, version: 2, steps: out.version.steps, approvedAt: T0 }));
    await seedTraces(deps, { gammeId: out.gamme.id, code: out.gamme.code, versionId: "ver_v2", n: 40, failures: 8, stepId: step.id });
    const comparison = await compareVersions(deps, out.gamme.code, 1, 2);
    expect(comparison.left.failRate.cohort.n).toBeGreaterThan(0);
    expect(comparison.right.failRate.cohort.n).toBeGreaterThan(0);
    expect(comparison.verdict).toBe("improved");
  });
});

describe("recette 17 : export SKILL.md", () => {
  it("le SKILL.md cite la version et ne contient aucun secret", async () => {
    const { deps } = seedAtelier();
    const out = await compileAndApprove(deps, "ari:page/deploy");
    const res = await exportSkillMd(deps, { code: out.gamme.code });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.skillMd).toContain("version v1");
    expect(res.value.skillMd).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(res.value.files["SKILL.md"]).toBe(res.value.skillMd);
  });
});

describe("recette 18 : gammes fantômes", () => {
  it("40 tickets semblables sans gamme ⇒ fantôme avec preuves et coût", async () => {
    const { deps } = seedAtelier();
    const ghosts = await detectGhosts(deps, { projectKey: "PAY" });
    expect(ghosts.length).toBeGreaterThan(0);
    const ghost = ghosts[0]!;
    expect(ghost.n).toBe(40);
    expect(ghost.spanDays).toBeGreaterThan(0);
    expect(ghost.costDays).toBeGreaterThan(0);
    expect(ghost.peopleCount).toBeGreaterThan(0);
    expect(JSON.stringify(ghost)).not.toMatch(/assignee|actor/i);
  });
});

describe("recette 19 : conflits", () => {
  it("deux gammes aux approbations incompatibles sur le même service ⇒ conflit cité", async () => {
    const { deps } = seedAtelier();
    await seedSettings(deps);
    await compileAndApprove(deps, "ari:page/deploy");
    await compileAndApprove(deps, "ari:page/deploy-b");
    const conflicts = await detectConflicts(deps, { service: "paiements" });
    const mismatch = conflicts.find((c) => c.kind === "requirement_mismatch");
    expect(mismatch).toBeDefined();
    expect(mismatch?.facts.some((f) => f.subject.startsWith("approbations:"))).toBe(true);
    expect(mismatch?.facts.every((f) => f.leftSpan && f.rightSpan)).toBe(true);
  });
});

describe("recette 20 : aucune statistique par personne", () => {
  const FORBIDDEN = /(assignee|byRef|approvedBy|decidedBy|personName|userLogin)/i;
  const keysOf = (value: unknown, out: string[] = []): string[] => {
    if (Array.isArray(value)) value.forEach((v) => keysOf(v, out));
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value as Record<string, unknown>)) { out.push(k); keysOf(v, out); }
    return out;
  };

  it("ni les outils MCP, ni les exports, ni les fantômes ne portent de mesure par personne", async () => {
    const { deps } = seedAtelier();
    await seedSettings(deps);
    const out = await compileAndApprove(deps, "ari:page/deploy");
    await seedTraces(deps, { gammeId: out.gamme.id, code: out.gamme.code, versionId: out.version.id, n: 40, failures: 24, stepId: out.version.steps[1]!.id });
    const ghosts = await detectGhosts(deps, { projectKey: "PAY" });
    const stats = await handleTool(deps, "get-procedure-stats", { code: out.gamme.code });
    const skill = await exportSkillMd(deps, { code: out.gamme.code });

    const outputs = [ghosts, stats.ok ? stats.value : [], skill.ok ? skill.value.record : null];
    for (const o of outputs) {
      const forbidden = keysOf(o).filter((k) => FORBIDDEN.test(k));
      expect(forbidden, JSON.stringify(forbidden)).toHaveLength(0);
    }
    // Le SKILL.md lui-même ne nomme aucun acteur.
    if (skill.ok) expect(skill.value.skillMd).not.toMatch(/ari:cloud:aaid/);
    expect(agent("x").kind).toBe("agent");
  });
});
