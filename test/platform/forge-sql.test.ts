/**
 * Gammes — le schéma et les requêtes Forge SQL, vérifiés hors plateforme.
 *
 * Le SQL construit est testé **comme une chaîne** : c'est exactement ce que la
 * plateforme reçoit. Le schéma est testé **idempotent** : rejouable à
 * l'identique, comme `buildForgeDeps` le fait à chaque démarrage d'instance.
 */
import { describe, expect, it } from "vitest";
import {
  applySchema,
  ENTITY_TABLES,
  isAlreadyExists,
  SCHEMA,
  splitSchema,
  TABLES,
} from "../../src/platform/forge/schema";
import * as q from "../../src/platform/forge/sql-queries";

/** Ce que PostgreSQL accepte mais que MySQL/TiDB refuse. */
const POSTGRES_ONLY = ["jsonb", "timestamptz", "::", "GENERATED ALWAYS", "ON CONFLICT", "RETURNING", "->>"];

/** Un faux TiDB : une carte de tables, qui refuse un CREATE TABLE sans `IF NOT EXISTS`. */
const fauxTidb = () => {
  const tables = new Map<string, { corps: string }>();
  const run = async (statement: string): Promise<void> => {
    const m = /^CREATE TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*)\)$/i.exec(statement);
    if (!m) throw new Error(`instruction DDL non reconnue : ${statement.slice(0, 80)}`);
    const ifNotExists = m[1] !== undefined;
    const name = m[2] ?? "";
    if (tables.has(name)) {
      // Comme MySQL : `IF NOT EXISTS` ne fait rien, sinon c'est une erreur.
      if (ifNotExists) return;
      throw new Error(`Table '${name}' already exists`);
    }
    tables.set(name, { corps: m[3] ?? "" });
  };
  return { tables, run };
};

describe("le schéma Forge SQL", () => {
  it("est en dialecte MySQL/TiDB, sans aucune construction PostgreSQL", () => {
    for (const mot of POSTGRES_ONLY) {
      expect(SCHEMA).not.toContain(mot);
    }
  });

  it("découpe en une instruction par table, toutes idempotentes", () => {
    const statements = splitSchema(SCHEMA);
    expect(statements).toHaveLength(ENTITY_TABLES.length + 1); // + domain_event
    for (const statement of statements) {
      expect(statement).toMatch(/^CREATE TABLE IF NOT EXISTS\s+(\w+)/);
    }
  });

  it("déclare chaque table du domaine, avec une clé VARCHAR (pas TEXT/BLOB)", () => {
    const noms = splitSchema(SCHEMA).map((s) => /^CREATE TABLE IF NOT EXISTS\s+(\w+)/.exec(s)?.[1]);
    for (const table of ENTITY_TABLES) {
      expect(noms).toContain(table);
    }
    // MySQL/TiDB refuse un TEXT/BLOB en clé primaire : la clé est un VARCHAR.
    for (const statement of splitSchema(SCHEMA)) {
      expect(statement).toContain("VARCHAR(128) PRIMARY KEY");
      expect(statement).not.toMatch(/\bTEXT\s+PRIMARY\s+KEY/i);
    }
  });

  it("garde le journal append-only : ni UPDATE ni DELETE, et son index", () => {
    const journal = splitSchema(SCHEMA).find((s) => s.includes("domain_event"));
    expect(journal).toBeDefined();
    expect(journal).not.toMatch(/\bUPDATE\b|\bDELETE\b/i);
    expect(journal).toContain("kind VARCHAR(64) NOT NULL");
    expect(journal).toContain("subject_ref VARCHAR(256) NOT NULL");
    expect(journal).toContain("payload MEDIUMTEXT NOT NULL");
  });

  it("s'applique deux fois sans échec (rejouable au démarrage)", async () => {
    const tidb = fauxTidb();
    await applySchema(tidb.run);
    const premiere = tidb.tables.size;
    await applySchema(tidb.run); // le rejeu ne change rien
    expect(tidb.tables.size).toBe(premiere);
    expect(premiere).toBe(ENTITY_TABLES.length + 1);
  });

  it("tolère un DDL non idempotent : l'échec « existe déjà » ne casse rien", async () => {
    const tidb = fauxTidb();
    const nu = "CREATE TABLE gamme (id VARCHAR(128) PRIMARY KEY)";
    await applySchema(tidb.run, `${nu};`);
    await applySchema(tidb.run, `${nu};`); // « already exists » : ignoré
    expect(tidb.tables.size).toBe(1);
  });

  it("arrête l'app sur un DDL cassé, plutôt que de démarrer sans table", async () => {
    const tidb = fauxTidb();
    await expect(applySchema(tidb.run, "CREATE TABLE IF NOT EXISTS cassee (")).rejects.toThrow(
      /DDL Forge SQL refusé/,
    );
  });

  it("classe les échecs « existe déjà »", () => {
    expect(isAlreadyExists(new Error("Table 'gamme' already exists"))).toBe(true);
    expect(isAlreadyExists(new Error("Duplicate entry"))).toBe(true);
    expect(isAlreadyExists(new Error("Unknown SQL execution error"))).toBe(false);
  });
});

describe("les requêtes Forge SQL", () => {
  it("l'upsert d'un document est un ON DUPLICATE KEY UPDATE, jamais un ON CONFLICT", () => {
    const s = q.upsertDoc(TABLES.gammes, "gam_1", '{"code":"GAM-1"}');
    expect(s.text).toContain("INSERT INTO gamme (id, doc, updated_at)");
    expect(s.text).toContain("ON DUPLICATE KEY UPDATE doc = VALUES(doc)");
    expect(s.text).not.toContain("ON CONFLICT");
    expect(s.params).toEqual(["gam_1", '{"code":"GAM-1"}']);
  });

  it("lie les valeurs, ne les concatène jamais dans le texte", () => {
    const id = "x' OR 1=1 --";
    const s = q.upsertDoc(TABLES.candidates, id, "{}");
    expect(s.text).not.toContain(id);
    expect(s.params).toEqual([id, "{}"]);
  });

  it("la lecture d'une collection est un SELECT simple, filtré en mémoire", () => {
    expect(q.selectAllDocs(TABLES.versions).text).toBe("SELECT id, doc FROM gamme_version");
    expect(q.selectDocById(TABLES.runs, "run_1")).toEqual({
      text: "SELECT id, doc FROM run WHERE id = ?",
      params: ["run_1"],
    });
  });

  it("le journal est écrit en INSERT IGNORE : aucun UPDATE, aucun DELETE", () => {
    const s = q.insertEvent({
      id: "evt_1", at: "2026-11-13T18:20:52.123Z", kind: "gamme.compiled",
      subjectRef: "gam_1", actorKind: "human", payload: "{}",
    });
    expect(s.text).toContain("INSERT IGNORE INTO domain_event");
    expect(s.text).not.toMatch(/\bUPDATE\b|\bDELETE\b/);
    expect(s.params).toHaveLength(6);
  });

  it("borne le journal par un LIMIT littéral, jamais un paramètre", () => {
    const s = q.selectEvents(1000);
    expect(s.text).toContain("ORDER BY at ASC, id ASC LIMIT 1000");
    expect(s.text).not.toContain("?");
    expect(s.params).toEqual([]);
  });

  it("réduit une borne absurde à zéro, sans la lier", () => {
    for (const [borne, attendu] of [[-5, 0], [1.7, 1], [Number.NaN, 0]] as const) {
      expect(q.selectEvents(borne).text).toContain(`LIMIT ${attendu}`);
    }
  });

  it("ne produit jamais de construction PostgreSQL, quelle que soit la requête", () => {
    const statements = [
      q.upsertDoc(TABLES.gammes, "a", "{}"),
      q.selectAllDocs(TABLES.gammes),
      q.selectDocById(TABLES.gammes, "a"),
      q.insertEvent({ id: "a", at: "2026-11-13T18:20:52.123Z", kind: "run.finished", subjectRef: "r", payload: "{}" }),
      q.selectEvents(1000),
    ];
    for (const statement of statements) {
      for (const mot of POSTGRES_ONLY) {
        expect(statement.text).not.toContain(mot);
      }
    }
  });
});