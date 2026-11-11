/**
 * Versions immuables et cycle de vie (§ 14, GA-05 et GA-06).
 *
 * Recette 6 : une gamme approuvée passe en version immuable ; l'approbation porte
 * une date et un nom.
 */

import { describe, expect, it } from "vitest";
import { agent, human, makeClock, makeDeps, makeGamme, makePage, T0 } from "../helpers";
import {
  approveVersion,
  canTransition,
  createVersion,
  deprecateGamme,
  getVersion,
  isInvocable,
  listVersions,
  nextCode,
  slugify,
  type VersionDraft,
} from "../../src/core/version/versioning";
import { shiftDays } from "../../src/platform/clock";
import { compile, deployPage, PAGE_MODIFIEE } from "./fixtures";

const OWNER = "ari:cloud:aaid:demo:ana";

const withOwner = async (deps: ReturnType<typeof makeDeps>, gammeId: string): Promise<void> => {
  await deps.store.gammes.update(gammeId, (g) => ({ ...g, ownerRef: OWNER }));
};

describe("approbation (GA-06, recette 6)", () => {
  it("l'approbation est un acte humain daté, nommé, avec une date de révision", async () => {
    const deps = makeDeps();
    const out = await compile(deps, deployPage());
    await withOwner(deps, out.gamme.id);
    const res = await approveVersion(deps, { versionId: out.version.id, approver: human(OWNER) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.state).toBe("approved");
    expect(res.value.approvedAt).toBe(T0);
    expect(res.value.approvedByRef).toBe(OWNER);
    expect(res.value.reviewDueAt).toBe(shiftDays(T0, 365));
    expect(res.value.currentVersion).toBe(1);
    const version = await deps.store.versions.get(out.version.id);
    expect(version?.approvedAt).toBe(T0);
    expect(version?.approvedByRef).toBe(OWNER);
    expect(version?.immutable).toBe(true);
    expect(isInvocable(res.value)).toBe(true);
    expect((await deps.store.events()).some((e) => e.kind === "gamme.approved")).toBe(true);
  });

  it("un agent ne peut pas approuver", async () => {
    const deps = makeDeps();
    const out = await compile(deps, deployPage());
    await withOwner(deps, out.gamme.id);
    const res = await approveVersion(deps, { versionId: out.version.id, approver: agent() });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("approval_requires_human");
    expect((await deps.store.gammes.get(out.gamme.id))?.state).toBe("draft");
  });

  it("une gamme sans propriétaire passe par la file d'adoption avant approbation", async () => {
    const deps = makeDeps();
    const out = await compile(deps, deployPage());
    const res = await approveVersion(deps, { versionId: out.version.id, approver: human(OWNER) });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("gamme_without_owner");
  });

  it("la date de révision suit les réglages de l'espace", async () => {
    const deps = makeDeps();
    await deps.store.settings.insert({
      spaceKey: "SRE",
      riskMotifs: [],
      policyPages: [],
      statThreshold: 30,
      lockPolicy: "human_or_permitted_agent",
      reviewAfterDays: 90,
      dustAfterDays: 30,
      lang: "fr",
    });
    const out = await compile(deps, deployPage());
    await withOwner(deps, out.gamme.id);
    const res = await approveVersion(deps, { versionId: out.version.id, approver: human(OWNER) });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.reviewDueAt).toBe(shiftDays(T0, 90));
  });
});

describe("versions immuables (GA-05)", () => {
  it("une nouvelle compilation crée une version, et la courante reste la dernière approuvée", async () => {
    const deps = makeDeps();
    const v1 = await compile(deps, deployPage());
    await withOwner(deps, v1.gamme.id);
    await approveVersion(deps, { versionId: v1.version.id, approver: human(OWNER) });
    const v2 = await compile(deps, makePage({ storageBody: PAGE_MODIFIEE }));
    expect(v2.version.version).toBe(2);
    const gamme = await deps.store.gammes.get(v1.gamme.id);
    expect(gamme?.currentVersion).toBe(1); // la v2 n'est qu'un brouillon
    const current = await getVersion(deps, gamme!.code);
    expect(current.ok).toBe(true);
    if (current.ok) expect(current.value.version).toBe(1);
    const versions = await listVersions(deps, gamme!.id);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
    expect(versions[0]?.id).not.toBe(versions[1]?.id);
  });

  it("une version précise reste lisible après amendement, et les inconnues sont refusées", async () => {
    const deps = makeDeps();
    const out = await compile(deps, deployPage());
    const v1 = await getVersion(deps, out.gamme.code, 1);
    expect(v1.ok).toBe(true);
    const missing = await getVersion(deps, out.gamme.code, 99);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("unknown_version");
    const noGamme = await getVersion(deps, "GAM-inexistant-01");
    expect(noGamme.ok).toBe(false);
    if (!noGamme.ok) expect(noGamme.error.code).toBe("unknown_gamme");
  });

  it("createVersion refuse d'amender une gamme dépréciée", async () => {
    const deps = makeDeps();
    const gamme = makeGamme({ state: "deprecated", deprecatedAt: T0, replacedBy: "GAM-deploy-02" });
    await deps.store.gammes.insert(gamme);
    const draft: VersionDraft = {
      title: "Version de trop",
      compiledAt: T0,
      compiledBy: "gammes:compiler",
      inputs: [],
      steps: [],
      conditions: { preconditions: [], postconditions: [] },
      fallback: { steps: [] },
      actorPolicy: "human_only",
      exclusive: false,
      sourcePages: [],
    };
    const res = await createVersion(deps, gamme.id, draft);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("gamme_deprecated");
  });
});

describe("dépréciation et transitions (§ 14)", () => {
  it("déprécier est humain, daté, et ne supprime rien", async () => {
    const deps = makeDeps();
    const out = await compile(deps, deployPage());
    await withOwner(deps, out.gamme.id);
    await approveVersion(deps, { versionId: out.version.id, approver: human(OWNER) });
    const byAgent = await deprecateGamme(deps, { gammeId: out.gamme.id, by: agent() });
    expect(byAgent.ok).toBe(false);
    const res = await deprecateGamme(deps, {
      gammeId: out.gamme.id,
      by: human(OWNER),
      replacedBy: "GAM-deployer-service-paiements-02",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.state).toBe("deprecated");
    expect(res.value.deprecatedAt).toBe(T0);
    expect(res.value.replacedBy).toContain("-02");
    expect(isInvocable(res.value)).toBe(false);
    // Rien n'est effacé : la version et son contenu restent lisibles.
    expect(await deps.store.versions.count()).toBe(1);
    const stillReadable = await getVersion(deps, out.gamme.code, 1);
    expect(stillReadable.ok).toBe(true);
  });

  it("le graphe de transitions est fermé", () => {
    expect(canTransition("draft", "in_review")).toBe(true);
    expect(canTransition("in_review", "approved")).toBe(true);
    expect(canTransition("approved", "deprecated")).toBe(true);
    expect(canTransition("deprecated", "approved")).toBe(false);
    expect(canTransition("draft", "deprecated")).toBe(false);
  });
});

describe("codes et slugs", () => {
  it("le code est lisible et incrémenté par famille", async () => {
    expect(slugify("Procédure : déployer le service paiements")).toBe("deployer-service-paiements");
    expect(slugify("Runbook — Rotation des clés API")).toBe("rotation-cles-api");
    expect(slugify("???")).toBe("gamme");
    const deps = makeDeps();
    await deps.store.gammes.insert(makeGamme({ code: "GAM-rotation-cles-01" }));
    expect(await nextCode(deps, "SRE", "Rotation des clés")).toBe("GAM-rotation-cles-02");
    expect(await nextCode(deps, "SRE", "Intégrer un collaborateur")).toBe("GAM-integrer-collaborateur-01");
  });

  it("l'horloge de test ne déborde pas : les échéances sont calculées, pas devinées", () => {
    const clock = makeClock(T0);
    expect(clock.plusDays(7)).toBe(shiftDays(T0, 7));
    expect(clock.now()).toBe(T0);
  });
});
