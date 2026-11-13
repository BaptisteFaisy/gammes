/**
 * Gammes — l'adaptateur Forge SQL : ce que la plateforme reçoit, vraiment.
 *
 * `@forge/sql` est simulé : le test vérifie les instructions émises (texte et
 * paramètres liés) et le câblage du démarrage — le schéma doit être appliqué
 * avant que le magasin ne soit rendu.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Gamme } from "../../src/core/types";
import { ENTITY_TABLES } from "../../src/platform/forge/schema";

const faux = vi.hoisted(() => ({
  requetes: [] as { texte: string; params: unknown[] }[],
  ddls: [] as string[],
  lignes: [] as unknown[],
}));

vi.mock("@forge/sql", () => ({
  sql: {
    prepare: (texte: string) => ({
      bindParams: (...params: unknown[]) => ({
        execute: async () => {
          faux.requetes.push({ texte, params });
          return { rows: faux.lignes };
        },
      }),
    }),
    executeDDL: async (texte: string) => {
      faux.ddls.push(texte);
      return { rows: [] };
    },
  },
}));

vi.mock("../../src/platform/forge/forge-hosted-llm", () => ({
  forgeHostedLlm: () => ({
    name: "faux",
    complete: async () => ({ text: "", model: "faux", tokensIn: 0, tokensOut: 0, cached: false }),
  }),
}));

vi.mock("../../src/platform/forge/atlassian-ports", () => ({
  confluencePort: () => undefined,
  graphPort: () => undefined,
  jiraPort: () => undefined,
}));

beforeEach(() => {
  vi.resetModules();
  faux.requetes.length = 0;
  faux.ddls.length = 0;
  faux.lignes = [];
});

describe("l'adaptateur Forge SQL", () => {
  it("lit les lignes que la plateforme renvoie (`rows`, pas `data`)", async () => {
    const { forgeSqlStore } = await import("../../src/platform/forge/forge-sql");
    faux.lignes = [{ id: "gam_1", doc: '{"id":"gam_1","code":"GAM-1"}' }];
    const gammes = await forgeSqlStore().gammes.list();
    expect(gammes).toHaveLength(1);
    expect(gammes[0]?.id).toBe("gam_1");
    expect(faux.requetes[0]?.texte).toBe("SELECT id, doc FROM gamme");
  });

  it("écrit une collection en ON DUPLICATE KEY UPDATE, valeurs liées", async () => {
    const { forgeSqlStore } = await import("../../src/platform/forge/forge-sql");
    const gamme = { id: "gam_1", code: "GAM-1" } as unknown as Gamme;
    await forgeSqlStore().gammes.insert(gamme);
    const requete = faux.requetes[0];
    expect(requete?.texte).toContain("INSERT INTO gamme (id, doc, updated_at)");
    expect(requete?.texte).toContain("ON DUPLICATE KEY UPDATE");
    expect(requete?.texte).not.toContain("ON CONFLICT");
    expect(requete?.params[0]).toBe("gam_1");
    expect(requete?.params[1]).toBe(JSON.stringify(gamme));
  });

  it("écrit le journal en INSERT IGNORE, sans jamais d'UPDATE ni de DELETE", async () => {
    const { forgeSqlStore } = await import("../../src/platform/forge/forge-sql");
    await forgeSqlStore().appendEvent({
      at: "2026-11-13T18:20:52.123Z",
      kind: "gamme.compiled",
      subjectRef: "gam_1",
      payload: { code: "GAM-1" },
    });
    const requete = faux.requetes[0];
    expect(requete?.texte).toContain("INSERT IGNORE INTO domain_event");
    expect(requete?.texte).not.toMatch(/\bUPDATE\b|\bDELETE\b/);
    expect(requete?.params[1]).toBe("2026-11-13T18:20:52.123Z");
  });

  it("applique le schéma une fois par instance, sans le rejouer", async () => {
    const { ensureSchema } = await import("../../src/platform/forge/forge-sql");
    await ensureSchema();
    const attendu = ENTITY_TABLES.length + 1;
    expect(faux.ddls).toHaveLength(attendu);
    expect(faux.ddls[0]).toMatch(/^CREATE TABLE IF NOT EXISTS/);
    await ensureSchema();
    expect(faux.ddls).toHaveLength(attendu);
  });

  it("applique le schéma avant de rendre le magasin (buildForgeDeps)", async () => {
    const { buildForgeDeps } = await import("../../src/platform/forge/deps");
    const deps = await buildForgeDeps();
    expect(faux.ddls.length).toBe(ENTITY_TABLES.length + 1);
    expect(deps.store).toBeDefined();
  });
});
