/**
 * Socle : le contrat partagé est utilisable tel quel, sans Forge ni réseau.
 * Ce test est la preuve que le harness tourne — les modules métier ajoutent les leurs.
 */

import { describe, expect, it } from "vitest";
import { makeDeps, makeGamme, makePage, makeStep, makeVersion, T0 } from "./helpers";
import { contentFingerprint, maskSecret } from "../src/platform/hash";
import { ok, refusals, unwrap } from "../src/core/result";

describe("socle", () => {
  it("construit une gamme et sa version immuable", () => {
    const gamme = makeGamme();
    const version = makeVersion({ steps: [makeStep({ ord: 1 }), makeStep({ id: "stp_2", ord: 2 })] });
    expect(gamme.code).toBe("GAM-deploy-01");
    expect(version.immutable).toBe(true);
    expect(version.steps).toHaveLength(2);
  });

  it("empreinte de contenu : stable au formatage près, sensible au fond", () => {
    const a = contentFingerprint("<p>  Déployer   la version </p>");
    const b = contentFingerprint("<p>Déployer la version</p>");
    const c = contentFingerprint("<p>Déployer la version candidate</p>");
    expect(b).not.toBe(a);
    expect(c).not.toBe(a);
  });

  it("masque un secret sans le recopier", () => {
    // gammes-allow-secret-fixture — fausse clé de démonstration, jamais un secret réel
    expect(maskSecret("AKIAIOSFODNN7EXAMPLE")).toBe("AKI…[20]");
  });

  it("un refus de verrou est explicite et marqué comme tel", () => {
    const r = refusals.humanOnly("stp_4", "agent:compagnon");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("lock_human_only");
      expect(r.error.lockRefusal).toBe(true);
      expect(r.error.messageEn).toContain("human-only");
    }
  });

  it("le magasin en mémoire persiste et journalise", async () => {
    const deps = makeDeps();
    await deps.store.gammes.insert(makeGamme());
    await deps.store.versions.insert(makeVersion());
    await deps.store.appendEvent({
      at: T0,
      kind: "gamme.compiled",
      subjectRef: "gam_1",
      actorKind: "human",
      payload: { version: 1 },
    });
    expect(await deps.store.gammes.count()).toBe(1);
    expect((await deps.store.events()).map((e) => e.kind)).toEqual(["gamme.compiled"]);
    expect(unwrap(ok(1))).toBe(1);
  });

  it("une page de démonstration compile en candidats d'étapes", () => {
    const page = makePage();
    expect(page.storageBody).toContain("<ol>");
    expect(page.storageBody).toContain("kubectl rollout status");
    expect(page.reachable).toBe(true);
  });
});
