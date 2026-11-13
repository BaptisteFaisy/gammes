/**
 * Gammes — adaptateur Forge SQL du port `Store` (§ 20, § 21).
 *
 * Une seule implémentation de la persistance : chaque collection est une table
 * (schéma dans `schema.ts`), l'entité est stockée en JSON dans `doc`, et le
 * filtre se fait en mémoire — comme dans `src/platform/memory-store.ts`. Le
 * cœur ne voit que le port : hors Forge, le magasin mémoire joue exactement
 * le même rôle.
 *
 * Deux règles de sécurité :
 * - les noms de tables viennent de la constante `TABLES` (aucune saisie
 *   utilisateur n'est jamais interpolée dans le SQL) ;
 * - le journal `domain_event` est en append-only : ni UPDATE ni DELETE.
 *
 * Le SQL est en dialecte MySQL/TiDB — Forge SQL n'est pas PostgreSQL. Les
 * instructions sont construites par `sql-queries.ts` (module pur, testable
 * hors plateforme) ; ici on ne fait que les exécuter.
 */

import { sql } from "@forge/sql";
import type { Collection, DomainEvent, Store } from "../../core/ports";
import type {
  Amendment,
  Binding,
  BudgetDay,
  CandidatePage,
  Conflict,
  Conciliation,
  Coverage,
  Deviation,
  ExportRecord,
  Gamme,
  GammeVersion,
  GhostCandidate,
  GraphLinkProposal,
  PermitCheck,
  Publication,
  Run,
  SecretFinding,
  SpaceSettings,
  StepStat,
} from "../../core/types";
import { applySchema, TABLES, type TableName } from "./schema";
import * as q from "./sql-queries";

type Row = { readonly id: string; readonly doc: string };

/** Le journal : au plus mille traces, comme avant. */
const EVENT_LIMIT = 1000;

/**
 * Exécute un statement et rend ses lignes.
 *
 * `@forge/sql` répond `{ rows }` — et non `{ data }`, qui est la forme du SDK
 * de stockage. Lire `data` renvoyait une liste vide : l'app affichait « 0
 * gamme(s) au total » même quand la table existait. Les erreurs, elles, sont
 * levées par le SDK : on les remonte en nommant l'instruction fautive.
 */
const query = async <T>(statement: q.SqlStatement): Promise<T[]> => {
  try {
    const result = await sql.prepare<T>(statement.text).bindParams(...statement.params).execute();
    return (result.rows ?? []) as T[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Forge SQL en échec :: ${statement.text.slice(0, 160)} :: ${message}`);
  }
};

const parse = <T>(row: Row): T => JSON.parse(row.doc) as T;

/** Collection générique : une table, une clé, un document JSON. */
const sqlCollection = <T>(table: TableName, keyOf: (item: T) => string): Collection<T> => {
  const readAll = async (): Promise<T[]> =>
    (await query<Row>(q.selectAllDocs(table))).map((row) => parse<T>(row));

  const readOne = async (id: string): Promise<T | undefined> => {
    const rows = await query<Row>(q.selectDocById(table, id));
    const first = rows[0];
    return first ? parse<T>(first) : undefined;
  };

  const write = async (item: T): Promise<void> => {
    await query(q.upsertDoc(table, keyOf(item), JSON.stringify(item)));
  };

  return {
    list: async (filter) => {
      const items = await readAll();
      return filter ? items.filter(filter) : items;
    },
    get: readOne,
    insert: async (item) => {
      await write(item);
      return item;
    },
    update: async (id, patch) => {
      const current = await readOne(id);
      if (!current) return undefined;
      const next = patch(current);
      await write(next);
      return next;
    },
    count: async (filter) => {
      const items = await readAll();
      return filter ? items.filter(filter).length : items.length;
    },
  };
};

/** Les collections du port `Store` : une table par entité du domaine. */
const collections = () => ({
  gammes: sqlCollection<Gamme>(TABLES.gammes, (g) => g.id),
  versions: sqlCollection<GammeVersion>(TABLES.versions, (v) => v.id),
  runs: sqlCollection<Run>(TABLES.runs, (r) => r.id),
  bindings: sqlCollection<Binding>(TABLES.bindings, (b) => b.id),
  amendments: sqlCollection<Amendment>(TABLES.amendments, (a) => a.id),
  stepStats: sqlCollection<StepStat>(TABLES.stepStats, (s) => s.id),
  conflicts: sqlCollection<Conflict>(TABLES.conflicts, (c) => c.id),
  conciliations: sqlCollection<Conciliation>(TABLES.conciliations, (c) => c.id),
  ghosts: sqlCollection<GhostCandidate>(TABLES.ghosts, (g) => g.id),
  permits: sqlCollection<PermitCheck>(TABLES.permits, (p) => p.id),
  exports: sqlCollection<ExportRecord>(TABLES.exports, (e) => e.id),
  coverage: sqlCollection<Coverage>(TABLES.coverage, (c) => c.id),
  budget: sqlCollection<BudgetDay>(TABLES.budget, (b) => b.day),
  findings: sqlCollection<SecretFinding>(TABLES.findings, (f) => f.id),
  candidates: sqlCollection<CandidatePage>(TABLES.candidates, (c) => c.id),
  settings: sqlCollection<SpaceSettings>(TABLES.settings, (s) => s.spaceKey),
  deviations: sqlCollection<Deviation>(TABLES.deviations, (d) => d.id),
  publications: sqlCollection<Publication>(TABLES.publications, (p) => p.id),
  graphLinks: sqlCollection<GraphLinkProposal>(TABLES.graphLinks, (l) => l.id),
});

const eventId = (kind: string, at: string): string =>
  `evt_${at.replace(/\D/g, "").slice(-10)}_${kind.replace(/\W/g, "")}_${Math.random().toString(36).slice(2, 8)}`;

type EventRow = {
  readonly id: string;
  readonly at: string;
  readonly kind: DomainEvent["kind"];
  readonly subject_ref: string;
  readonly actor_kind?: string;
  readonly payload: string;
};

const eventOf = (row: EventRow): DomainEvent => ({
  id: row.id,
  at: row.at,
  kind: row.kind,
  subjectRef: row.subject_ref,
  ...(row.actor_kind ? { actorKind: row.actor_kind as DomainEvent["actorKind"] } : {}),
  payload: JSON.parse(row.payload) as Record<string, unknown>,
});

/** Le magasin complet : à câbler dans le resolver Forge (`src/resolver/index.ts`). */
export const forgeSqlStore = (): Store => ({
  ...collections(),
  appendEvent: async (event) => {
    const full: DomainEvent = { ...event, id: eventId(event.kind, event.at) };
    await query(
      q.insertEvent({
        id: full.id,
        at: full.at,
        kind: full.kind,
        subjectRef: full.subjectRef,
        actorKind: full.actorKind,
        payload: JSON.stringify(full.payload),
      }),
    );
    return full;
  },
  events: async (filter) => {
    const rows = await query<EventRow>(q.selectEvents(EVENT_LIMIT));
    const events = rows.map(eventOf);
    return filter ? events.filter(filter) : events;
  },
});

/** Exécute une instruction de DDL, sur la route DDL de la plateforme. */
const runDdl = async (statement: string): Promise<void> => {
  await sql.executeDDL<unknown>(statement);
};

let migration: Promise<void> | undefined;

/**
 * Applique le schéma une fois par instance.
 *
 * Le DDL est idempotent (toutes les instructions sont en
 * `CREATE TABLE IF NOT EXISTS`) : le rejeu ne peut pas échouer. La
 * migration est mémoïsée au niveau du module, donc une fois par instance
 * Forge warm ; un échec n'est pas mémorisé, il sera rejoué à l'appel suivant.
 */
export const ensureSchema = (): Promise<void> => {
  if (migration) return migration;
  const current: Promise<void> = applySchema(runDdl)
    .then(() => undefined)
    .catch((error: unknown) => {
      migration = undefined;
      throw error;
    });
  migration = current;
  return current;
};
