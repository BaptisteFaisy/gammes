/**
 * Les clients Atlassian réels (idées de consolidation n° 2 et 3) : transport,
 * normalisation des erreurs, quota, reprises, et lecture d'une page et d'un
 * ticket. Aucun réseau : le transport est injecté.
 */
import { describe, expect, it } from "vitest";
import { atlassianClient, type HttpRequest, type HttpResponse, type Transport } from "../../src/platform/forge/atlassian-http";
import { confluenceClient } from "../../src/platform/forge/confluence-client";
import { jiraClient } from "../../src/platform/forge/jira-client";

/** Un transport qui répond ce qu'on lui demande et compte les appels. */
const transportFaux = (reponses: readonly HttpResponse[]): { transport: Transport; appels: HttpRequest[] } => {
  const appels: HttpRequest[] = [];
  let i = 0;
  const transport: Transport = async (req) => {
    appels.push(req);
    const reponse = reponses[Math.min(i, reponses.length - 1)];
    i += 1;
    if (!reponse) throw new Error("réponse manquante");
    return reponse;
  };
  return { transport, appels };
};

const ok = (body: unknown): HttpResponse => ({ status: 200, body });

describe("couche HTTP Atlassian", () => {
  it("normalise les erreurs : 404 et 403 ne se confondent pas", async () => {
    const { transport } = transportFaux([{ status: 404, body: {} }]);
    const client = atlassianClient({ transport, baseUrl: "https://api.test", parMinute: 1000 });
    const res = await client.get("/x");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("not_found");
    const { transport: t2 } = transportFaux([{ status: 403, body: {} }]);
    const client2 = atlassianClient({ transport: t2, baseUrl: "https://api.test", parMinute: 1000 });
    const res2 = await client2.get("/x");
    expect(res2.ok).toBe(false);
    if (res2.ok) return;
    expect(res2.error.code).toBe("forbidden");
  });

  it("rejoue un GET en 429, jamais un POST", async () => {
    const { transport, appels } = transportFaux([
      { status: 429, body: {}, headers: { "retry-after": "0" } },
      ok({ valeur: 1 }),
    ]);
    const client = atlassianClient({ transport, baseUrl: "https://api.test", parMinute: 1000, pause: async () => {} });
    const res = await client.get("/x");
    expect(res.ok).toBe(true);
    expect(appels).toHaveLength(2);

    const { transport: t2, appels: a2 } = transportFaux([{ status: 429, body: {}, headers: { "retry-after": "0" } }]);
    const client2 = atlassianClient({ transport: t2, baseUrl: "https://api.test", parMinute: 1000, pause: async () => {} });
    const res2 = await client2.post("/x", {});
    expect(res2.ok).toBe(false);
    expect(a2).toHaveLength(1);
  });

  it("une panne réseau devient une erreur normalisée, pas une exception", async () => {
    const transport: Transport = async () => {
      throw new Error("socket fermé");
    };
    const client = atlassianClient({ transport, baseUrl: "https://api.test", parMinute: 1000 });
    const res = await client.get("/x");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("network");
  });

  it("la pagination s'arrête quand la page suivante manque", async () => {
    const { transport, appels } = transportFaux([ok({ items: [1], next: "t2" }), ok({ items: [2] })]);
    const client = atlassianClient({ transport, baseUrl: "https://api.test", parMinute: 1000 });
    const res = await client.paginate<number>("/x", {}, (corps) => {
      const p = corps as { items?: number[]; next?: string };
      return { items: p.items ?? [], ...(p.next ? { next: p.next } : {}) };
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual([1, 2]);
    expect(appels).toHaveLength(2);
  });
});

describe("client Confluence", () => {
  const pageApi = {
    id: "12345",
    title: "Procédure : déployer les paiements",
    spaceId: "SRE",
    version: { number: 7, createdAt: "2026-11-01T10:00:00.000Z" },
    body: { storage: { value: "<p>Déployer</p>" } },
    labels: { results: [{ name: "runbook" }, { name: "deploiement" }] },
  };

  it("lit une page : titre, corps, labels, version", async () => {
    const { transport, appels } = transportFaux([ok(pageApi)]);
    const port = confluenceClient({ client: atlassianClient({ transport, baseUrl: "https://api.test", parMinute: 1000 }) });
    const page = await port.getPage("ari:cloud:confluence:site:page/12345");
    expect(page.reachable).toBe(true);
    expect(page.title).toBe("Procédure : déployer les paiements");
    expect(page.storageBody).toBe("<p>Déployer</p>");
    expect(page.labels).toEqual(["runbook", "deploiement"]);
    expect(page.pageVersion).toBe(7);
    expect(appels[0]?.path).toContain("/wiki/api/v2/pages/12345");
  });

  it("une page absente donne une page injoignable, pas une page vide qui ferait croire", async () => {
    const { transport } = transportFaux([{ status: 404, body: {} }]);
    const port = confluenceClient({ client: atlassianClient({ transport, baseUrl: "https://api.test", parMinute: 1000 }) });
    const page = await port.getPage("ari:cloud:confluence:site:page/999");
    expect(page.reachable).toBe(false);
    expect(page.storageBody).toBe("");
  });

  it("la recherche par CQL est paginée", async () => {
    const { transport, appels } = transportFaux([ok({ results: [pageApi], _links: { next: "/next" } }), ok({ results: [] })]);
    const port = confluenceClient({ client: atlassianClient({ transport, baseUrl: "https://api.test", parMinute: 1000 }) });
    const pages = await port.listPages("SRE");
    expect(pages.length).toBe(1);
    expect(appels[0]?.path).toContain("cql=");
  });
});

describe("client Jira", () => {
  const issueApi = {
    id: "10001",
    key: "PAY-412",
    fields: {
      summary: "Déployer la version 1.8.2",
      project: { key: "PAY" },
      labels: ["deploiement"],
      components: [{ name: "paiements" }],
      created: "2026-11-01T09:00:00.000Z",
      resolutiondate: "2026-11-01T10:00:00.000Z",
      comment: { comments: [{ body: "déployé" }] },
      assignee: { accountId: "abc" },
    },
  };

  it("lit un ticket et ses transitions", async () => {
    const { transport, appels } = transportFaux([ok(issueApi), ok({ transitions: [{ name: "Terminé" }, { name: "En cours" }] })]);
    const port = jiraClient({ client: atlassianClient({ transport, baseUrl: "https://api.test", parMinute: 1000 }) });
    const ticket = await port.getIssue("PAY-412");
    expect(ticket.key).toBe("PAY-412");
    expect(ticket.projectKey).toBe("PAY");
    expect(ticket.summary).toBe("Déployer la version 1.8.2");
    expect(ticket.components).toEqual(["paiements"]);
    expect(ticket.labels).toEqual(["deploiement"]);
    expect(ticket.transitions).toEqual(["Terminé", "En cours"]);
    expect(ticket.commentBodies).toEqual(["déployé"]);
    expect(ticket.assigneeCount).toBe(1);
    expect(appels[1]?.path).toContain("/transitions");
  });

  it("la recherche JQL renvoie des tickets", async () => {
    const { transport, appels } = transportFaux([ok({ issues: [issueApi] })]);
    const port = jiraClient({ client: atlassianClient({ transport, baseUrl: "https://api.test", parMinute: 1000 }) });
    const tickets = await port.searchIssues("PAY", 10);
    expect(tickets).toHaveLength(1);
    expect(tickets[0]?.key).toBe("PAY-412");
    expect(appels[0]?.path).toContain("jql=");
  });
});
