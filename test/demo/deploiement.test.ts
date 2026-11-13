/**
 * La provenance du déploiement : l'écran « 19 · Déploiement réel » doit correspondre à
 * ce qui est réellement déployé.
 *
 * Le test lit le `manifest.yml` — la source de vérité de l'identifiant de l'app — et le
 * compare à ce que la démo affiche. Si l'app est redéployée sous un autre identifiant,
 * la CI rougit : l'écran ne peut pas continuer d'annoncer une app qui n'existe plus.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { DEPLOIEMENT } from "../../web/deploiement";

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

  it("l'atelier Confluence et l'encart Jira sont deux installations distinctes", () => {
    expect(DEPLOIEMENT.urls.confluence).not.toBe(DEPLOIEMENT.urls.jira);
    expect(DEPLOIEMENT.urls.confluence).toContain("/wiki/apps/");
    expect(DEPLOIEMENT.urls.jira).toContain("/jira/apps/");
  });

  it("le relevé est daté, et l'environnement est dit tel quel", () => {
    expect(DEPLOIEMENT.releveLe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(DEPLOIEMENT.environnement).toBe("development");
    expect(DEPLOIEMENT.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("la pull request de preuve et le dépôt existent dans l'URL", () => {
    expect(DEPLOIEMENT.pullRequest).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/);
    expect(DEPLOIEMENT.depot).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
  });
});
