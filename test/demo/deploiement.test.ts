/**
 * La provenance du déploiement : l'écran « 19 · Déploiement réel » doit correspondre à
 * ce qui est réellement déployé.
 *
 * Le test lit le `manifest.yml` — la source de vérité de l'identifiant de l'app — et le
 * compare à ce que la démo affiche. Si l'app est redéployée sous un autre identifiant,
 * la CI rougit : l'écran ne peut pas continuer d'annoncer une app qui n'existe plus.
 *
 * Il vérifie aussi la chose qui change tout pour un jury : les URL installées portent
 * l'identifiant de l'environnement **production**, pas celui de développement. Une
 * version de développement n'est visible que de son développeur ; une version de
 * production est visible par tous les utilisateurs du site.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { DEPLOIEMENT, ENVIRONNEMENT_VISIBLE } from "../../web/deploiement";

const manifest = parse(readFileSync("manifest.yml", "utf8")) as {
  app?: { id?: string; version?: string };
};

describe("provenance du déploiement : la démo annonce l'app réellement déployée", () => {
  it("l'ARI affiché est celui du manifeste", () => {
    expect(DEPLOIEMENT.appId).toBe(manifest.app?.id);
    expect(DEPLOIEMENT.appId).toContain(DEPLOIEMENT.appIdCourt);
  });

  it("les deux URL d'installation sont sur le site déclaré et portent l'identifiant court", () => {
    for (const url of [DEPLOIEMENT.urls.confluence, DEPLOIEMENT.urls.jira]) {
      expect(url.startsWith("https://")).toBe(true);
      expect(url).toContain(DEPLOIEMENT.site);
      expect(url).toContain(DEPLOIEMENT.appIdCourt);
    }
  });

  it("les URL installées portent l'environnement production, pas celui de développement", () => {
    expect(DEPLOIEMENT.environnement).toBe("production");
    expect(ENVIRONNEMENT_VISIBLE).toBeDefined();
    expect(ENVIRONNEMENT_VISIBLE?.installe).toBe(true);
    for (const url of [DEPLOIEMENT.urls.confluence, DEPLOIEMENT.urls.jira]) {
      expect(url).toContain(ENVIRONNEMENT_VISIBLE?.id);
    }
    const developpement = DEPLOIEMENT.environnements.find((e) => e.nom === "development");
    expect(developpement).toBeDefined();
    for (const url of [DEPLOIEMENT.urls.confluence, DEPLOIEMENT.urls.jira]) {
      expect(url).not.toContain(developpement?.id);
    }
  });

  it("les trois environnements Forge sont déclarés, avec des identifiants distincts", () => {
    const noms = DEPLOIEMENT.environnements.map((e) => e.nom);
    expect(noms).toEqual(["production", "staging", "development"]);
    const ids = DEPLOIEMENT.environnements.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("l'atelier Confluence et l'encart Jira sont deux installations distinctes", () => {
    expect(DEPLOIEMENT.urls.confluence).not.toBe(DEPLOIEMENT.urls.jira);
    expect(DEPLOIEMENT.urls.confluence).toContain("/wiki/apps/");
    expect(DEPLOIEMENT.urls.jira).toContain("/jira/apps/");
  });

  it("le relevé est daté, et l'environnement est dit tel quel", () => {
    expect(DEPLOIEMENT.releveLe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(DEPLOIEMENT.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(DEPLOIEMENT.portee).toContain("tous les utilisateurs");
  });

  it("la pull request de preuve et le dépôt existent dans l'URL", () => {
    expect(DEPLOIEMENT.pullRequest).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/);
    expect(DEPLOIEMENT.depot).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
  });
});
