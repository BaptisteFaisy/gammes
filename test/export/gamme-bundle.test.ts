/**
 * Le paquet portable (idée de consolidation n° 9) : une gamme sort de l'app,
 * transportable, et **scellée** — un paquet altéré est refusé à la lecture.
 */
import { describe, expect, it } from "vitest";
import { human, makeHasherDeps } from "../helpers";
import { PAGES, seedAtelier } from "../../seed/atelier";
import { compilePage } from "../../src/core/compile/compile-page";
import { buildBundle, BUNDLE_FORMAT, bundleDigest, readBundle } from "../../src/core/export/gamme-bundle";

const OWNER = "ari:cloud:aaid:demo:ana";

const compiler = async () => {
  const { deps } = seedAtelier();
  const compiled = await compilePage(deps, { page: PAGES["ari:page/deploy"]!, confirmedBy: human(OWNER) });
  if (!compiled.ok) throw new Error(compiled.error.messageFr);
  return { deps, compiled };
};

describe("paquet portable d'une gamme (GA-13, § 33.1)", () => {
  it("le paquet décrit la gamme : format, version, entrées, étapes et SKILL.md", async () => {
    const { deps, compiled } = await compiler();
    const paquet = await buildBundle(deps, { code: compiled.value.gamme.code, version: compiled.value.version.version });
    expect(paquet.ok).toBe(true);
    if (!paquet.ok) return;
    expect(paquet.value.format).toBe(BUNDLE_FORMAT);
    expect(paquet.value.code).toBe(compiled.value.gamme.code);
    expect(paquet.value.version).toBe(compiled.value.version.version);
    expect(paquet.value.steps.length).toBe(compiled.value.version.steps.length);
    expect(paquet.value.skillMd).toContain("version v1");
    expect(paquet.value.hash).toBeTruthy();
  });

  it("un paquet relu tel quel est conforme", async () => {
    const { deps, compiled } = await compiler();
    const paquet = await buildBundle(deps, { code: compiled.value.gamme.code });
    expect(paquet.ok).toBe(true);
    if (!paquet.ok) return;
    const relu = readBundle(makeHasherDeps(), JSON.parse(JSON.stringify(paquet.value)));
    expect(relu.ok).toBe(true);
  });

  it("un paquet altéré est refusé : l'empreinte ne correspond plus", async () => {
    const { deps, compiled } = await compiler();
    const paquet = await buildBundle(deps, { code: compiled.value.gamme.code });
    expect(paquet.ok).toBe(true);
    if (!paquet.ok) return;
    const altere = JSON.parse(JSON.stringify(paquet.value)) as { steps: { text: string }[] };
    altere.steps[0]!.text = "Supprimer la production et ne rien dire";
    const relu = readBundle(makeHasherDeps(), altere);
    expect(relu.ok).toBe(false);
    if (relu.ok) return;
    expect(relu.error.messageFr).toContain("altéré");
  });

  it("un format inconnu ou un champ manquant est refusé", () => {
    const relu = readBundle(makeHasherDeps(), { format: "autre/1", code: "GAM-x" });
    expect(relu.ok).toBe(false);
    const incomplet = readBundle(makeHasherDeps(), { format: BUNDLE_FORMAT, code: "GAM-x" });
    expect(incomplet.ok).toBe(false);
  });

  it("l'empreinte ne porte pas sur le hash lui-même : elle est stable", () => {
    const hasher = makeHasherDeps();
    const sansHash = { format: BUNDLE_FORMAT, code: "GAM-x", title: "t", version: 1, compiledAt: "2026-11-12T00:00:00.000Z", inputs: [], steps: [], skillMd: "# s" };
    expect(bundleDigest(hasher, sansHash)).toBe(bundleDigest(hasher, sansHash));
    expect(bundleDigest(hasher, { ...sansHash, title: "autre" })).not.toBe(bundleDigest(hasher, sansHash));
  });
});
