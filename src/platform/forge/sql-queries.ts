/**
 * Gammes — les requêtes Forge SQL, construites hors plateforme (§ 21).
 *
 * Module pur : aucun import `@forge/*`, aucune valeur concaténée dans le SQL.
 * Chaque fonction renvoie le texte exact que la plateforme reçoit et ses
 * paramètres — donc testable sans base, comme des chaînes.
 *
 * Dialecte MySQL/TiDB (Forge SQL n'est pas PostgreSQL) :
 *
 * - l'upsert est `ON DUPLICATE KEY UPDATE`, pas `ON CONFLICT … DO UPDATE` ;
 * - le `?` de PostgreSQL n'existe pas : les valeurs sont liées
 *   positionnellement (`bindParams`) ;
 * - `LIMIT` est un littéral, jamais un paramètre — Forge SQL refuse un
 *   paramètre là (« Incorrect arguments to LIMIT ») et ne répond que par le
 *   message générique « Unknown SQL execution error » ;
 * - les noms de table viennent de `schema.ts` : le seul identifiant que le
 *   SQL porte est un littéral du code, jamais une saisie.
 */

import type { TableName } from "./schema";

/** Un statement et ses paramètres : le texte est lié, jamais interpolé. */
export interface SqlStatement {
  readonly text: string;
  readonly params: unknown[];
}

/** Ce qu'une trace de journal porte à l'écriture. */
export interface EventWrite {
  readonly id: string;
  readonly at: string;
  readonly kind: string;
  readonly subjectRef: string;
  readonly actorKind?: string | undefined;
  readonly payload: string;
}

/**
 * L'upsert d'un document : la clé primaire porte l'id, `doc` le document.
 *
 * `ON DUPLICATE KEY UPDATE doc = VALUES(doc)` est la forme MySQL/TiDB de
 * l'upsert ; `ON CONFLICT (id) DO UPDATE` y est refusé. `updated_at` est
 * réécrit dans les deux branches : la valeur par défaut ne s'applique qu'à
 * l'insertion.
 */
export const upsertDoc = (
  table: TableName,
  id: string,
  doc: string,
): SqlStatement => ({
  text:
    `INSERT INTO ${table} (id, doc, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ` +
    `ON DUPLICATE KEY UPDATE doc = VALUES(doc), updated_at = CURRENT_TIMESTAMP`,
  params: [id, doc],
});

/** Tous les documents d'une table. */
export const selectAllDocs = (table: TableName): SqlStatement => ({
  text: `SELECT id, doc FROM ${table}`,
  params: [],
});

/** Un document par identifiant. */
export const selectDocById = (table: TableName, id: string): SqlStatement => ({
  text: `SELECT id, doc FROM ${table} WHERE id = ?`,
  params: [id],
});

/**
 * L'écriture d'une trace de journal : append-only, donc jamais d'UPDATE.
 *
 * `INSERT IGNORE` est l'équivalent MySQL/TiDB de `ON CONFLICT DO NOTHING` :
 * un identifiant déjà présent est ignoré, aucune ligne existante n'est
 * touchée. Le journal garde ainsi son contrat — pas d'UPDATE, pas de DELETE.
 */
export const insertEvent = (event: EventWrite): SqlStatement => ({
  text:
    "INSERT IGNORE INTO domain_event (id, at, kind, subject_ref, actor_kind, payload) " +
    "VALUES (?, ?, ?, ?, ?, ?)",
  params: [event.id, event.at, event.kind, event.subjectRef, event.actorKind ?? null, event.payload],
});

/**
 * Les traces du journal, de la plus ancienne à la plus récente.
 *
 * La borne est un littéral : Forge SQL refuse un paramètre dans `LIMIT`. Le
 * tri est `(at, id)` : `at` est l'ISO 8601 à largeur fixe (tri lexical = tri
 * chronologique), `id` départage les traces de la même milliseconde, donc
 * l'ordre est stable — le sceau du journal en dépend.
 */
export const selectEvents = (limit: number): SqlStatement => {
  const borne = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return {
    text:
      "SELECT id, at, kind, subject_ref, actor_kind, payload FROM domain_event " +
      `ORDER BY at ASC, id ASC LIMIT ${borne}`,
    params: [],
  };
};
