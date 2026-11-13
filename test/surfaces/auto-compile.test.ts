/**
 * La compilation automatique : une page de procédure qui arrive dans le tenant devient
 * une vraie gamme, en brouillon.
 *
 * Le test vérifie les trois règles qui tiennent l'ensemble :
 * - une page dont le titre annonce une procédure **est** compilée ;
 * - une page qui n'est pas une procédure n'est **pas** touchée (le tenant contient des
 *   comptes rendus et des politiques : ce ne sont pas des gammes) ;
 * - la compilation ne publie rien : la gamme sort en brouillon, comme le chemin manuel.
 */

import { describe, expect, it } from "vitest";
import { annonceUneProcedure, compileIfProcedure } from "../../src/core/compile/auto-compile";
import { createActions } from "../../src/resolver/actions";
import { human, makeDeps, makePage } from "../helpers";
import type { ConfluencePort } from "../../src/core/ports";
import type { PageDigest } from "../../src/core/types";

const ARI = "ari:cloud:confluence:demo:page/7001";

const page = (over: Partial<PageDigest> = {}): PageDigest =>
  makePage({
    ari: ARI,
    title: "Procédure : sauvegarder la base paiements",
    storageBody: [
      "<h1>Procédure : sauvegarder la base paiements</h1>",
      "<h2>Avant de commencer</h2><ul><li>La fenêtre de sauvegarde est ouverte.</li></ul>",
      "<h2>Étapes</h2><ol>",
      "<li>Vérifier que la réplication est en avance de moins de 30 secondes.</li>",
      "<li>Lancer la sauvegarde :",
      '<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[pg_dump -Fc paiements > /backups/paiements.dump]]></ac:plain-text-body></ac:structured-macro>',
      "</li>",
      "<li>Faire valider la sauvegarde par le responsable d'astreinte.</li>",
      "</ol>",
      "<h2>Si ça tourne mal</h2><ol><li>Repasser sur la réplication secondaire.</li></ol>",
    ].join("\n"),
    ...over,
  });

const confluence = (pages: readonly PageDigest[]): ConfluencePort => ({
  getPage: async (ari: string) => {
    const found = pages.find((p) => p.ari === ari);
    if (!found) throw new Error(`page inconnue ${ari}`);
    return found;
  },
  listPages: async () => pages,
  isReachable: async () => true,
});

describe("compilation automatique d'une page de procédure", () => {
  it("un titre qui annonce une procédure est reconnu", () => {
    expect(annonceUneProcedure("Procédure : sauvegarder la base paiements")).toBe(true);
    expect(annonceUneProcedure("Mode opératoire : intégrer un collaborateur")).toBe(true);
    expect(annonceUneProcedure("Runbook — restoration du cluster")).toBe(true);
  });

  it("un titre qui n'annonce pas une procédure ne l'est pas", () => {
    expect(annonceUneProcedure("Compte rendu du comité du 3 mars")).toBe(false);
    expect(annonceUneProcedure("Politique de déploiement")).toBe(false);
  });

  it("une page de procédure sans gamme liée est compilée en brouillon", async () => {
    const deps = makeDeps({ confluence: confluence([page()]) });
    const res = await createActions(deps).pageEvent({ ari: ARI, kind: "added" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const value = res.value as { handled: boolean; compiled: boolean; code?: string; steps?: number };
    expect(value.handled).toBe(true);
    expect(value.compiled).toBe(true);
    expect(value.code).toBeDefined();
    expect(value.steps).toBeGreaterThanOrEqual(2);

    const gammes = await deps.store.gammes.list();
    expect(gammes.length).toBe(1);
    expect(gammes[0]?.state).toBe("draft");
  });

  it("une page qui n'est pas une procédure n'est pas compilée", async () => {
    const compteRendu = page({ title: "Compte rendu du comité du 3 mars" });
    const deps = makeDeps({ confluence: confluence([compteRendu]) });
    const res = await createActions(deps).pageEvent({ ari: ARI, kind: "added" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const value = res.value as { handled: boolean; compiled: boolean; reason?: string };
    expect(value.handled).toBe(false);
    expect(value.compiled).toBe(false);
    expect(await deps.store.gammes.list()).toHaveLength(0);
  });

  it("une page inaccessible ne fait rien et ne casse rien", async () => {
    const deps = makeDeps({ confluence: confluence([]) });
    const res = await createActions(deps).pageEvent({ ari: ARI, kind: "added" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const value = res.value as { handled: boolean };
    expect(value.handled).toBe(false);
    expect(await deps.store.gammes.list()).toHaveLength(0);
  });

  it("la compilation passe par le même code que le chemin manuel", async () => {
    const deps = makeDeps({ confluence: confluence([page()]) });
    const outcome = await compileIfProcedure(deps, { page: page(), confirmedBy: human("ari:cloud:aaid:demo:ana") });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.compiled).toBe(true);
    expect(outcome.value.code).toBeDefined();
  });
});
