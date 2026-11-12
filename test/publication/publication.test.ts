/**
 * Publication inter-espaces (§ 16, GA-30, anciennement « C »).
 *
 * Une publication est un instantané d'une version immuable vers un autre espace
 * ou une autre organisation. Le tout en mémoire, sans réseau : le cœur ne connaît
 * ni Confluence ni Forge.
 */

import { describe, expect, it } from "vitest";
import { agent, human, makeDeps, makeGamme, makeVersion } from "../helpers";
import { decidePublication, listPublications, proposePublication, revokePublication } from "../../src/core/publish/publish";

const OWNER = "ari:cloud:aaid:demo:ana";
const TARGET = { siteAri: "ari:cloud:confluence:site/2", spaceKey: "ALLO" };

const seedApprovedGamme = async (deps: ReturnType<typeof makeDeps>, code = "GAM-deploy-01", state: "approved" | "draft" = "approved") => {
  await deps.store.gammes.insert(makeGamme({ id: "gam_1", code, state, ownerRef: state === "approved" ? OWNER : undefined }));
  await deps.store.versions.insert(makeVersion({ id: "ver_1", gammeId: "gam_1" }));
};

describe("publication inter-espaces (GA-30)", () => {
  it("la demande de publication est un acte humain", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const out = await proposePublication(deps, { code: "GAM-deploy-01", target: TARGET, reason: "Aligner les zones.", by: agent() });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("approval_requires_human");
  });

  it("une gamme non approuvée n'est pas publiable", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps, "GAM-deploy-01", "draft");
    const out = await proposePublication(deps, { code: "GAM-deploy-01", target: TARGET, reason: "…", by: human() });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("gamme_not_approved");
  });

  it("une gamme approuvée se propose : instantané d'une version, événement tracé", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const out = await proposePublication(deps, { code: "GAM-deploy-01", target: TARGET, version: 1, reason: "Aligner les zones.", by: human(OWNER) });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.state).toBe("proposed");
    expect(out.value.versionId).toBe("ver_1");
    expect(out.value.target.spaceKey).toBe("ALLO");
    expect(out.value.requestedBy.id).toBe(OWNER);
    const events = await deps.store.events();
    expect(events.some((e) => e.kind === "publication.proposed")).toBe(true);
    const listed = await listPublications(deps);
    expect(listed).toHaveLength(1);
  });

  it("accepter grave l'état et le récépissé", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const proposed = await proposePublication(deps, { code: "GAM-deploy-01", target: TARGET, reason: "…", by: human(OWNER) });
    if (!proposed.ok) throw new Error("proposition attendue");
    const out = await decidePublication(deps, { id: proposed.value.id, by: human(OWNER), accept: true, receiptRef: "ALLO/page/204" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.state).toBe("accepted");
    expect(out.value.receiptRef).toBe("ALLO/page/204");
    expect(out.value.decidedByRef).toBe(OWNER);
  });

  it("trancher deux fois est refusé", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const proposed = await proposePublication(deps, { code: "GAM-deploy-01", target: TARGET, reason: "…", by: human(OWNER) });
    if (!proposed.ok) throw new Error("proposition attendue");
    await decidePublication(deps, { id: proposed.value.id, by: human(OWNER), accept: true, receiptRef: "x" });
    const out = await decidePublication(deps, { id: proposed.value.id, by: human(OWNER), accept: false, reason: "trop tard" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("publication_state");
  });

  it("révoquer est possible après acceptation, refusé avant", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const proposed = await proposePublication(deps, { code: "GAM-deploy-01", target: TARGET, reason: "…", by: human(OWNER) });
    if (!proposed.ok) throw new Error("proposition attendue");
    const before = await revokePublication(deps, { id: proposed.value.id, by: human(OWNER), reason: "trop tôt" });
    expect(before.ok).toBe(false);
    if (!before.ok) expect(before.error.code).toBe("publication_state");

    await decidePublication(deps, { id: proposed.value.id, by: human(OWNER), accept: true, receiptRef: "ALLO/page/204" });
    const revoked = await revokePublication(deps, { id: proposed.value.id, by: human(OWNER), reason: "La cible a changé." });
    expect(revoked.ok).toBe(true);
    if (!revoked.ok) return;
    expect(revoked.value.state).toBe("revoked");
    // Rien n'est effacé : le récépissé d'origine reste lisible.
    expect(revoked.value.receiptRef).toBe("ALLO/page/204");
  });
});