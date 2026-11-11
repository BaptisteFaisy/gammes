/**
 * Compilation d'une page en gamme (§ 6, GA-05, GA-11).
 *
 * Recette 3 : une compilation ne publie rien — brouillon et diff, l'état reste
 * « brouillon ».
 * Recette 5 : une étape contenant une clé n'est pas publiée ; un signalement est
 * ouvert avec l'empreinte et l'aperçu masqué.
 */

import { describe, expect, it } from "vitest";
import { agent, human, makeDeps, makePage } from "../helpers";
import { compilePage } from "../../src/core/compile/compile-page";
import { approveVersion } from "../../src/core/version/versioning";
import { compile, deployPage, fakeAwsKey, PAGE_AVEC_SECRET, PAGE_MODIFIEE } from "./fixtures";

describe("compiler une page (§ 6)", () => {
  it("recette 3 : rien n'est publié, l'état reste brouillon et un diff est produit", async () => {
    const deps = makeDeps();
    const out = await compile(deps, deployPage());
    expect(out.gamme.state).toBe("draft");
    expect(out.gamme.code).toBe("GAM-deployer-service-paiements-01");
    expect(out.version.approvedAt).toBeUndefined();
    expect(out.version.immutable).toBe(true);
    expect(out.version.version).toBe(1);
    expect(out.diff).toContain("nouvelle gamme → v1");
    expect(out.diff).toContain("+");
    expect(out.usedModel).toBe(false); // forbiddenLlm : aucun appel modèle sur une page bien formée
    expect(out.findings).toHaveLength(0);
    expect(out.droppedSteps).toBe(0);
  });

  it("les sections deviennent préconditions, repli et entrées typées — pas des étapes", async () => {
    const deps = makeDeps();
    const out = await compile(deps, deployPage());
    expect(out.version.conditions.preconditions).toEqual(["Le merge check doit être vert."]);
    expect(out.version.fallback.steps).toHaveLength(1);
    expect(out.version.fallback.steps[0]?.text).toContain("Revenir à la version précédente");
    expect(out.version.inputs.map((i) => i.name)).toEqual(["service", "version_cible"]);
    expect(out.version.inputs.every((i) => i.required)).toBe(true);
    expect(out.version.steps).toHaveLength(4);
    expect(out.version.steps.every((s) => s.source.pageAri === deployPage().ari)).toBe(true);
    expect(out.version.sourcePages).toEqual([deployPage().ari]);
    expect(out.version.contentHash).toBeTruthy();
  });

  it("l'étape de validation devient un verrou humain, le déploiement rend la gamme exclusive", async () => {
    const deps = makeDeps();
    const out = await compile(deps, deployPage());
    const validation = out.version.steps.find((s) => s.text.includes("responsable d'astreinte"));
    expect(validation?.humanOnly).toBe(true);
    expect(validation?.locks.some((l) => l.kind === "human")).toBe(true);
    expect(out.version.actorPolicy).toBe("human_or_permitted_agent");
    expect(out.version.estimatedDurationS).toBeGreaterThan(0);
  });

  it("recette 5 : une clé dans une étape empêche la publication et ouvre un signalement masqué", async () => {
    const deps = makeDeps();
    const page = makePage({ title: "Procédure : déployer", storageBody: PAGE_AVEC_SECRET });
    const out = await compile(deps, page);
    expect(out.findings.length).toBeGreaterThan(0);
    expect(out.findings[0]?.detector).toBe("aws-access-key-id");
    expect(out.droppedSteps).toBe(1);
    expect(out.version.steps.some((s) => s.text.includes(fakeAwsKey()))).toBe(false);
    expect(JSON.stringify(out.version)).not.toContain(fakeAwsKey());
    expect(await deps.store.findings.count()).toBe(out.findings.length);
    expect((await deps.store.events()).some((e) => e.kind === "secret.found")).toBe(true);

    await deps.store.gammes.update(out.gamme.id, (g) => ({ ...g, ownerRef: "ari:cloud:aaid:demo:ana" }));
    const approved = await approveVersion(deps, { versionId: out.version.id, approver: human() });
    expect(approved.ok).toBe(false);
    if (!approved.ok) {
      expect(approved.error.code).toBe("lock_secret");
      expect(approved.error.lockRefusal).toBe(true);
    }
  });

  it("compiler est un acte confirmé par un humain, et la page doit être joignable", async () => {
    const deps = makeDeps();
    const byAgent = await compilePage(deps, { page: deployPage(), confirmedBy: agent() });
    expect(byAgent.ok).toBe(false);
    if (!byAgent.ok) expect(byAgent.error.code).toBe("approval_requires_human");

    const unreachable = await compilePage(deps, {
      page: deployPage({ reachable: false }),
      confirmedBy: human(),
    });
    expect(unreachable.ok).toBe(false);
    if (!unreachable.ok) expect(unreachable.error.code).toBe("source_unavailable");
  });

  it("recompiler la même page produit une v2 de la même gamme, jamais un doublon", async () => {
    const deps = makeDeps();
    const first = await compile(deps, deployPage());
    const second = await compile(deps, makePage({ storageBody: PAGE_MODIFIEE }));
    expect(second.gamme.id).toBe(first.gamme.id);
    expect(second.version.version).toBe(2);
    expect(second.gamme.currentVersion).toBe(2); // aucune version approuvée : le brouillon porte la gamme
    expect(await deps.store.gammes.count()).toBe(1);
    expect(second.diff).toContain("v1 → v2");
    expect(second.diff).toContain("-");
    expect(second.diff).toContain("+");
  });
});
