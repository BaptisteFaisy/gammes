/**
 * Connecteur de graphe, app jumelle (§ 16, GA-31, anciennement « C »).
 *
 * Le cœur propose et enregistre la gravure ; il n'écrit jamais lui-même dans le
 * graphe (GA-27 lit, l'app jumelle écrit). Tout en mémoire, sans réseau.
 */

import { describe, expect, it } from "vitest";
import { agent, human, makeDeps, makeGamme, makeVersion } from "../helpers";
import { dismissGraphLink, listGraphLinks, proposeGraphLink, recordGraphLink } from "../../src/core/graph-connect/graph-connector";

const OWNER = "ari:cloud:aaid:demo:ana";
const TWIN = "ari:cloud:ecosystem::app/baptistefaisy.gammes-twin/1";

const seedApprovedGamme = async (deps: ReturnType<typeof makeDeps>, code = "GAM-deploy-01", state: "approved" | "draft" = "approved") => {
  await deps.store.gammes.insert(makeGamme({ id: "gam_1", code, state, ownerRef: state === "approved" ? OWNER : undefined }));
  await deps.store.versions.insert(makeVersion({ id: "ver_1", gammeId: "gam_1" }));
};

describe("connecteur de graphe (GA-31)", () => {
  it("proposer un lien est un acte humain", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const out = await proposeGraphLink(deps, {
      code: "GAM-deploy-01",
      linkKind: "software-service",
      targetRef: "ari:cloud:graph:software-service/paiements",
      reason: "Relier la gamme à son service.",
      by: agent(),
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("approval_requires_human");
  });

  it("une gamme non approuvée ne se grave pas", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps, "GAM-deploy-01", "draft");
    const out = await proposeGraphLink(deps, {
      code: "GAM-deploy-01",
      linkKind: "software-service",
      targetRef: "ari:cloud:graph:software-service/paiements",
      reason: "…",
      by: human(OWNER),
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("gamme_not_approved");
  });

  it("proposer puis enregistrer la gravure porte le récépissé de l'app jumelle", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const proposed = await proposeGraphLink(deps, {
      code: "GAM-deploy-01",
      linkKind: "software-service",
      targetRef: "ari:cloud:graph:software-service/paiements",
      reason: "Relier la gamme à son service.",
      by: human(OWNER),
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(proposed.value.state).toBe("proposed");
    const events = await deps.store.events();
    expect(events.some((e) => e.kind === "graph.link_proposed")).toBe(true);

    const engraved = await recordGraphLink(deps, { id: proposed.value.id, receiptRef: "link/42", by: { id: TWIN, kind: "agent" } });
    expect(engraved.ok).toBe(true);
    if (!engraved.ok) return;
    expect(engraved.value.state).toBe("engraved");
    expect(engraved.value.receiptRef).toBe("link/42");
    expect(engraved.value.engravedBy).toBe(TWIN);
    const after = await deps.store.events();
    expect(after.some((e) => e.kind === "graph.link_engraved")).toBe(true);
    expect(await listGraphLinks(deps)).toHaveLength(1);
  });

  it("graver deux fois, ou rejeter une gravure faite, est refusé", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const proposed = await proposeGraphLink(deps, {
      code: "GAM-deploy-01",
      linkKind: "project",
      targetRef: "ari:cloud:graph:project/PAY",
      reason: "…",
      by: human(OWNER),
    });
    if (!proposed.ok) throw new Error("proposition attendue");
    const id = proposed.value.id;
    await recordGraphLink(deps, { id, receiptRef: "link/42", by: { id: TWIN, kind: "agent" } });
    const twice = await recordGraphLink(deps, { id, receiptRef: "link/43", by: { id: TWIN, kind: "agent" } });
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.error.code).toBe("graph_link_state");

    const dismiss = await dismissGraphLink(deps, { id, by: human(OWNER), reason: "Gravé, rien à rejeter." });
    expect(dismiss.ok).toBe(false);
    if (!dismiss.ok) expect(dismiss.error.code).toBe("graph_link_state");
  });

  it("rejeter avant gravure referme la proposition, jamais le graphe", async () => {
    const deps = makeDeps();
    await seedApprovedGamme(deps);
    const proposed = await proposeGraphLink(deps, {
      code: "GAM-deploy-01",
      linkKind: "parent-gamme",
      targetRef: "ari:cloud:graph:document/gam-tronc",
      reason: "…",
      by: human(OWNER),
    });
    if (!proposed.ok) throw new Error("proposition attendue");
    const dismissed = await dismissGraphLink(deps, { id: proposed.value.id, by: human(OWNER), reason: "Tronc déprécié." });
    expect(dismissed.ok).toBe(true);
    if (!dismissed.ok) return;
    expect(dismissed.value.state).toBe("dismissed");
  });
});