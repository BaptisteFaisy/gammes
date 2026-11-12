/**
 * La route des surfaces (GA-16, GA-17) : une seule ressource pour six modules,
 * donc c'est la clé de module qui décide. Pur, sans Forge ni réseau.
 */
import { describe, expect, it } from "vitest";
import { extensionFacts, routeSurface, SURFACE_PAR_MODULE } from "../../src/frontend/route";

describe("route des surfaces", () => {
  it("chaque module du manifeste a sa surface", () => {
    expect(SURFACE_PAR_MODULE["gammes-issue-panel"]).toBe("issuePanel");
    expect(SURFACE_PAR_MODULE["gammes-macro"]).toBe("macro");
    expect(SURFACE_PAR_MODULE["gammes-atelier"]).toBe("atelier");
    expect(SURFACE_PAR_MODULE["gammes-registre-jira"]).toBe("registre");
    expect(SURFACE_PAR_MODULE["gammes-settings"]).toBe("reglages");
    expect(SURFACE_PAR_MODULE["gammes-page-action"]).toBe("contentAction");
  });

  it("un contexte absent ou inconnu ne casse jamais le rendu", () => {
    expect(routeSurface(undefined)).toBe("inconnue");
    expect(routeSurface({})).toBe("inconnue");
    expect(routeSurface({ moduleKey: "autre-chose" })).toBe("inconnue");
  });

  it("à défaut de clé de module, le type de contexte décide", () => {
    expect(routeSurface({ extension: { type: "issuePanel" } })).toBe("issuePanel");
    expect(routeSurface({ extension: { type: "macro" } })).toBe("macro");
    expect(routeSurface({ extension: { contextType: "spaceSettings" } })).toBe("reglages");
  });

  it("les faits d'extension sont lus sans supposer une forme précise", () => {
    expect(extensionFacts({ extension: { issueKey: "PAY-123" } }).issueKey).toBe("PAY-123");
    expect(extensionFacts({ extension: { context: { issueKey: "PAY-9" } } }).issueKey).toBe("PAY-9");
    expect(extensionFacts({ extension: { ari: "ari:cloud:x" } }).pageAri).toBe("ari:cloud:x");
    expect(extensionFacts(undefined)).toEqual({});
  });

  it("aucun fait inventé : une valeur non textuelle est ignorée", () => {
    const faits = extensionFacts({ extension: { issueKey: 42, pageAri: null } });
    expect(faits.issueKey).toBeUndefined();
    expect(faits.pageAri).toBeUndefined();
  });
});
