/**
 * Export `SKILL.md` (§ 15, § 18, GA-13) et point d'entrée externe signé (GA-26).
 *
 * Recette 17 : `export-skill` produit un `SKILL.md` qui ne contient aucun secret et cite
 * la version.
 */

import { describe, expect, it } from "vitest";
import { makeDeps, makeGamme, makeStep, makeVersion, T0 } from "../helpers";
import { exportSkillMd } from "../../src/core/export/skill-md";
import { createSignedHook, signBody } from "../../src/platform/webtrigger";
import { CODE, seedApproved } from "./fixtures";

const fakeKey = (): string => `AKI${"AI"}OSFODNN7EXAMPLE`;

describe("export SKILL.md (GA-13, recette 17)", () => {
  it("produit un SKILL.md qui cite la version, les étapes, les verrous et les preuves", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    const res = await exportSkillMd(deps, { code: CODE });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const md = res.value.skillMd;
    expect(md).toContain("version v1");
    expect(md).toContain("Vérifier que le pipeline est vert");
    expect(md).toContain("```sh");
    expect(md).toContain("kubectl apply");
    expect(md).toContain("humain");
    expect(md).toContain("permis");
    expect(md).toContain("machine");
    expect(res.value.files["SKILL.md"]).toBe(md);
    expect(res.value.hash).toBe(deps.hasher.hash(md));
    expect(res.value.record.downloads).toBe(0);
    expect(await deps.store.exports.count()).toBe(1);
    expect((await deps.store.events()).some((e) => e.kind === "skill.exported")).toBe(true);
  });

  it("recette 17 : aucun secret ne passe dans l'export, même par accident", async () => {
    const deps = makeDeps();
    await deps.store.gammes.insert(makeGamme({ id: "gam_secret", code: "GAM-secret-01", state: "approved", currentVersion: 1, ownerRef: "ari:cloud:aaid:demo:ana" }));
    await deps.store.versions.insert(
      makeVersion({
        id: "ver_secret",
        gammeId: "gam_secret",
        version: 1,
        steps: [makeStep({ id: "stp_k", text: `Exporter la clé ${fakeKey()} puis continuer` })],
        sourcePages: ["ari:p/9"],
      }),
    );
    const res = await exportSkillMd(deps, { code: "GAM-secret-01" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("lock_secret");
    expect(await deps.store.exports.count()).toBe(0);
  });

  it("export en anglais, et gamme inconnue refusée", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    const en = await exportSkillMd(deps, { code: CODE, lang: "en" });
    expect(en.ok).toBe(true);
    if (en.ok) expect(/Inputs|Steps|Fallback/.test(en.value.skillMd)).toBe(true);
    const missing = await exportSkillMd(deps, { code: "GAM-absent-01" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("unknown_gamme");
  });
});

describe("point d'entrée externe signé (GA-26)", () => {
  const body = JSON.stringify({ intendedAction: "déployer le service paiements", service: "paiements" });

  it("sans secret configuré : échec fermé", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    const hook = createSignedHook(deps, {});
    const res = await hook({ body, signature: "x" });
    expect(res.ok).toBe(false);
  });

  it("signature invalide : refusée", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    const hook = createSignedHook(deps, { secret: "s3cret" });
    const res = await hook({ body, signature: "mauvaise-signature" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("lock_permit_missing");
  });

  it("corps invalide : refusé", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    const verify = () => true;
    const hook = createSignedHook(deps, { secret: "s3cret", verify });
    const res = await hook({ body: "{ pas du json", signature: "ok" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("input_invalid");
  });

  it("signature valide : rend le verdict de check-before-acting", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    const secret = "s3cret-de-demo";
    const hook = createSignedHook(deps, { secret });
    const signature = signBody(body, secret);
    const res = await hook({ body, signature });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.found).toBe(true);
    expect(res.value.code).toBe(CODE);
    expect(res.value.permitRequired).toBe(true);
  });

  it("le vérificateur injectable permet de tester sans crypto réelle", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    const hook = createSignedHook(deps, { secret: "x", verify: (_b, sig) => sig === "bon" });
    expect((await hook({ body, signature: "bon" })).ok).toBe(true);
    expect((await hook({ body, signature: "mauvais" })).ok).toBe(false);
    expect(T0).toBeTruthy();
  });
});