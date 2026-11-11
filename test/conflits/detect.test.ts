/**
 * Recette 19 et § 13 : détection des conflits entre gammes et avec une page de
 * politique. Aucune détection ne dépend d'un modèle : `makeDeps()` fournit
 * `forbiddenLlm()`, qui ferait échouer le test au premier appel.
 */

import { describe, expect, it } from "vitest";
import { agent, human, makeDeps } from "../helpers";
import { acknowledgeConflict, detectConflicts, resolveConflict } from "../../src/core/conflicts/detect";
import { factsOf } from "../../src/core/conflicts/facts";
import { POLICY_BODY, seedExclusivePair, seedSettings, seedTwoGammes, SERVICE, stubConfluence } from "./fixtures";

describe("détection des conflits (§ 13, GA-23)", () => {
  it("19. deux gammes aux approbations incompatibles déclenchent un conflit, passages cités", async () => {
    const deps = makeDeps();
    await seedTwoGammes(deps);
    const conflicts = await detectConflicts(deps);
    const mismatch = conflicts.find((c) => c.kind === "requirement_mismatch");
    expect(mismatch).toBeDefined();
    expect(mismatch?.service).toBe(SERVICE);
    const fact = mismatch?.facts.find((f) => f.subject === `approbations:${SERVICE}`);
    expect(fact).toBeDefined();
    expect(fact?.left).toContain("GAM-deploy-01");
    expect(fact?.right).toContain("GAM-deploy-02");
    expect(fact?.leftSpan?.quote).toContain("validation");
    expect(fact?.rightSpan?.quote).toContain("validation");
  });

  it("des exigences concordantes ne produisent aucun conflit", async () => {
    const deps = makeDeps();
    await seedTwoGammes(deps, 2);
    const conflicts = await detectConflicts(deps);
    expect(conflicts.filter((c) => c.kind === "requirement_mismatch")).toHaveLength(0);
  });

  it("deux gammes exclusives sur le même service signalent la concurrence", async () => {
    const deps = makeDeps();
    await seedExclusivePair(deps);
    const conflicts = await detectConflicts(deps);
    const exclusive = conflicts.find((c) => c.kind === "exclusive_resource");
    expect(exclusive).toBeDefined();
    expect(exclusive?.gammeA).toBe("GAM-rotate-01");
    expect(exclusive?.gammeB).toBe("GAM-rotate-02");
  });

  it("une gamme qui contredit une page de politique produit un conflit cité des deux côtés", async () => {
    const deps = makeDeps({ confluence: stubConfluence() });
    await seedTwoGammes(deps);
    await seedSettings(deps);
    const conflicts = await detectConflicts(deps);
    const policy = conflicts.find((c) => c.kind === "policy_contradiction");
    expect(policy).toBeDefined();
    expect(policy?.facts[0]?.left).toContain("3 approbation");
    expect(policy?.facts[0]?.leftSpan?.quote).toContain("3 approbations");
    expect(policy?.facts[0]?.rightSpan?.quote).toContain("validation");
    expect(POLICY_BODY).toContain("Politique de déploiement");
  });

  it("politique injoignable : aucune détection inventée, aucun crash", async () => {
    const deps = makeDeps({
      confluence: {
        getPage: async () => {
          throw new Error("confluence injoignable");
        },
        listPages: async () => [],
        isReachable: async () => false,
      },
    });
    await seedTwoGammes(deps);
    await seedSettings(deps);
    const conflicts = await detectConflicts(deps);
    expect(conflicts.filter((c) => c.kind === "policy_contradiction")).toHaveLength(0);
    expect(conflicts.filter((c) => c.kind === "requirement_mismatch")).toHaveLength(1);
  });

  it("un conflit déjà gravé ne l'est pas deux fois", async () => {
    const deps = makeDeps();
    await seedTwoGammes(deps);
    const first = await detectConflicts(deps);
    const second = await detectConflicts(deps);
    expect(second).toHaveLength(first.length);
    expect(await deps.store.conflicts.count()).toBe(first.length);
  });

  it("les faits d'une gamme sont déterministes et citent leurs sources", async () => {
    const deps = makeDeps();
    const { a } = await seedTwoGammes(deps);
    const version = (await deps.store.versions.list()).find((v) => v.gammeId === a.id);
    expect(version).toBeDefined();
    const facts = factsOf(a, version!);
    expect(facts.some((f) => f.kind === "approvals")).toBe(true);
    expect(facts.every((f) => f.spans.length > 0)).toBe(true);
    expect(factsOf(a, version!)).toEqual(facts);
  });

  it("trancher un conflit est un acte humain : refus à un agent, décision tracée pour un humain", async () => {
    const deps = makeDeps();
    await seedTwoGammes(deps);
    const [conflict] = await detectConflicts(deps);
    expect(conflict).toBeDefined();

    const refused = await resolveConflict(deps, conflict!.id, agent(), "on tranche pour la gamme A");
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("approval_requires_human");

    const ack = await acknowledgeConflict(deps, conflict!.id, human());
    expect(ack.ok).toBe(true);
    if (ack.ok) expect(ack.value.state).toBe("acknowledged");

    const resolved = await resolveConflict(deps, conflict!.id, human(), "la gamme B s'aligne sur A");
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.state).toBe("resolved");
      expect(resolved.value.resolvedAt).toBeDefined();
      expect(resolved.value.resolutionNote).toContain("s'aligne");
    }
    const kinds = (await deps.store.events()).map((e) => e.kind);
    expect(kinds).toContain("conflict.raised");
    expect(kinds).toContain("conflict.resolved");
  });

  it("conflit introuvable : refus explicite, pas d'exception", async () => {
    const deps = makeDeps();
    const res = await resolveConflict(deps, "cfl_inconnu", human(), "note");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("unknown_conflict");
  });
});
