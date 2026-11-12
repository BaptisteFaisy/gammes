/**
 * Le client Teamwork Graph (idée de consolidation n° 4) : la lecture se fait au
 * nom d'un utilisateur, et **un droit manquant donne un résultat vide**, jamais
 * une erreur.
 */
import { describe, expect, it } from "vitest";
import { atlassianClient, type HttpResponse, type Transport } from "../../src/platform/forge/atlassian-http";
import { graphClient } from "../../src/platform/forge/graph-client";

const transportFaux = (reponses: readonly HttpResponse[]): Transport => {
  let i = 0;
  return async () => {
    const reponse = reponses[Math.min(i, reponses.length - 1)];
    i += 1;
    if (!reponse) throw new Error("réponse manquante");
    return reponse;
  };
};

const noeud = (corps: unknown): unknown => ({ data: { nodes: [corps] } });

describe("client Teamwork Graph", () => {
  it("lit les services, les projets et le propriétaire d'un document", async () => {
    const transport = transportFaux([
      { status: 200, body: noeud({ relatedSoftwareServices: { nodes: [{ id: "s1", name: "paiements" }] } }) },
      { status: 200, body: noeud({ relatedProjects: { nodes: [{ id: "p1", name: "PAY" }] } }) },
      { status: 200, body: noeud({ ownedBy: { id: "u1", name: "Ana" } }) },
    ]);
    const port = graphClient({ client: atlassianClient({ transport, baseUrl: "https://api.test", parMinute: 1000 }) });
    expect(await port.servicesFor("doc-1")).toEqual(["paiements"]);
    expect(await port.projectsFor("doc-1")).toEqual(["PAY"]);
    expect(await port.ownerOf("doc-1")).toBe("Ana");
  });

  it("un droit manquant donne un résultat vide, pas une erreur", async () => {
    const transport = transportFaux([{ status: 403, body: {} }]);
    const port = graphClient({ client: atlassianClient({ transport, baseUrl: "https://api.test", parMinute: 1000 }) });
    expect(await port.servicesFor("doc-1")).toEqual([]);
    expect(await port.projectsFor("doc-1")).toEqual([]);
    expect(await port.ownerOf("doc-1")).toBeUndefined();
  });

  it("aucune requête libre n'est émise : seulement des fragments de lecture", async () => {
    const vues: string[] = [];
    const transport: Transport = async (req) => {
      vues.push(JSON.stringify(req.body ?? {}));
      return { status: 200, body: noeud({}) };
    };
    const port = graphClient({ client: atlassianClient({ transport, baseUrl: "https://api.test", parMinute: 1000 }) });
    await port.servicesFor("doc-1");
    expect(vues).toHaveLength(1);
    expect(vues[0]).toContain("relatedSoftwareServices");
    expect(vues[0]).not.toContain("Cypher");
  });
});
