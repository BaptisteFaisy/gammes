/**
 * Gammes — adaptateur Forge SQL du port `Store` (§ 20, § 21).
 *
 * Une seule implémentation de la persistance : chaque collection est une table
 * (schéma dans `schema.sql`), l'entité est stockée en JSON dans `doc`, et les
 * colonnes générées indexées portent les filtres chauds. Le cœur ne voit que le
 * port : hors Forge, `memory-store.ts` joue exactement le même rôle.
 *
 * Deux règles de sécurité :
 * - les noms de tables viennent de la constante `TABLES` (aucune saisie utilisateur
 *   n'est jamais interpolée dans le SQL) ;
 * - le journal `domain_event` est en append-only : ni UPDATE ni DELETE.
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
  PermitCheck,
  Run,
  SecretFinding,
  SpaceSettings,
  StepStat,
} from "../../core/types";

type Row = { readonly id: string; readonly doc: string };
type SqlResult<T> = { readonly success?: boolean; readonly data?: T; readonly error?: unknown };

const TABLES = {
  gammes: "gamme",
  versions: "gamme_version",
  runs: "run",
  bindings: "binding",
  amendments: "amendment",
  stepStats: "step_stat",
  conflicts: "conflict",
  conciliations: "conciliation",
  ghosts: "ghost_candidate",
  permits: "permit_check",
  exports: "export_record",
  coverage: "coverage",
  budget: "budget_day",
  findings: "secret_finding",
  candidates: "candidate_page",
  settings: "space_settings",
  deviations: "deviation",
} as const;

const query = async <T>(statement: string, params: readonly unknown[] = []): Promise<T> => {
  const res = (await sql.prepare<SqlResult<T>>(statement).bindParams(...params).execute()) as SqlResult<T>;
  if (res && res.success === false) {
    throw new Error(`Forge SQL en échec : ${JSON.stringify(res.error ?? res).slice(0, 200)}`);
  }
  return (res?.data ?? ([] as unknown)) as T;
};

const parse = <T>(row: Row): T => JSON.parse(row.doc) as T;

const upsertSql = (table: string): string =>
  `INSERT INTO ${table} (id, doc, updated_at) VALUES (?, ?::jsonb, now()) ` +
  `ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`;

/** Collection générique : une table, une clé, un document JSON. */
const sqlCollection = <T>(table: string, keyOf: (item: T) => string): Collection<T> => {
  const readAll = async (): Promise<T[]> =>
    (await query<Row[]>(`SELECT id, doc FROM ${table}`)).map((row) => parse<T>(row));

  const readOne = async (id: string): Promise<T | undefined> => {
    const rows = await query<Row[]>(`SELECT id, doc FROM ${table} WHERE id = ?`, [id]);
    const first = rows[0];
    return first ? parse<T>(first) : undefined;
  };

  const write = async (item: T): Promise<void> => {
    await query(upsertSql(table), [keyOf(item), JSON.stringify(item)]);
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

const EVENT_INSERT =
  "INSERT INTO domain_event (id, at, kind, subject_ref, actor_kind, payload) " +
  "VALUES (?, ?::timestamptz, ?, ?, ?, ?::jsonb) ON CONFLICT (id) DO NOTHING";

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
  appendEvent: async (event) => {
    const at = event.at;
    const full: DomainEvent = { ...event, id: eventId(event.kind, at) };
    await query(EVENT_INSERT, [
      full.id,
      at,
      full.kind,
      full.subjectRef,
      full.actorKind ?? null,
      JSON.stringify(full.payload),
    ]);
    return full;
  },
  events: async (filter) => {
    const rows = await query<EventRow[]>(
      "SELECT id, at::text AS at, kind, subject_ref, actor_kind, payload::text AS payload " +
        "FROM domain_event ORDER BY at ASC LIMIT 1000",
    );
    const events = rows.map(eventOf);
    return filter ? events.filter(filter) : events;
  },
});

/** Applique `schema.sql` au premier déploiement (DDL idempotent : IF NOT EXISTS). */
export const applySchema = async (schema: string): Promise<void> => {
  await sql.executeDDL(schema);
};
