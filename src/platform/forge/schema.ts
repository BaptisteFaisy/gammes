/**
 * Gammes — le schéma de la base Forge SQL, en dialecte MySQL/TiDB (§ 21).
 *
 * Forge SQL n'est pas PostgreSQL : c'est un MySQL/TiDB. Le schéma écrit pour
 * PostgreSQL (`jsonb`, `timestamptz`, colonnes générées `doc ->> 'x'`,
 * `ON CONFLICT`) y est refusé d'un seul bloc — « Unknown SQL execution
 * error » — et la table n'existait dans aucun environnement : l'app déployée
 * n'affichait que « 0 gamme(s) au total ».
 *
 * Trois partis pris, tous dictés par ce que Forge SQL accepte réellement :
 *
 * 1. **Aucune colonne générée.** TiDB ne prend pas
 *    `GENERATED ALWAYS AS (doc ->> 'x') STORED` sur une colonne JSON, et le
 *    code n'en a pas besoin : `forge-sql.ts` lit `id, doc` et filtre en
 *    mémoire. Les index sur colonnes générées disparaissent avec elles.
 * 2. **`doc` est un `MEDIUMTEXT`**, pas un `JSON` : la colonne reste une
 *    chaîne des deux côtés, donc `JSON.parse` est déterministe (une colonne
 *    JSON peut revenir déjà décodée, ce qui casserait la lecture).
 * 3. **`id` est un `VARCHAR`**, pas un `TEXT` : MySQL/TiDB refuse un TEXT/BLOB
 *    en clé primaire sans longueur (« BLOB/TEXT column 'id' used in key
 *    specification »). `VARCHAR(128)` passe.
 *
 * Le DDL est **idempotent** : une instruction par table, toutes en
 * `CREATE TABLE IF NOT EXISTS`, index compris (déclarés dans le CREATE TABLE).
 * Le rejouer ne peut donc pas échouer — c'est ce qui permet de l'appliquer à
 * chaque démarrage d'instance.
 *
 * Module pur : aucun import `@forge/*`. Le DDL est donc lisible et
 * vérifiable hors plateforme.
 */

/**
 * Les tables du domaine : une par entité du port `Store`.
 *
 * La clé est le nom de la collection dans le port, la valeur le nom de la
 * table : c'est le seul identifiant que le SQL porte, et il vient d'ici —
 * jamais d'une saisie.
 */
export const TABLES = {
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
  publications: "publication",
  graphLinks: "graph_link",
} as const;

/** Le nom d'une table de l'app — le seul identifiant que le SQL peut porter. */
export type TableName = (typeof TABLES)[keyof typeof TABLES];

/** Les tables du domaine, dans l'ordre de création. */
export const ENTITY_TABLES: readonly TableName[] = Object.values(TABLES);

/**
 * Le DDL d'une table du domaine.
 *
 * Une table = une clé (`id`) + le document JSON complet (`doc`) + l'instant
 * de la dernière écriture (`updated_at`). Les colonnes dénormalisées
 * (`code`, `state`, `spaceKey`…) disparaissent : le filtre se fait en
 * mémoire, comme dans `src/platform/memory-store.ts`.
 *
 * `MEDIUMTEXT` pour `doc` : une gamme/version tient largement dans les 16 Mo
 * de la colonne, là où `TEXT` (64 Ko) aurait pu tronquer un contenu.
 */
const entityDdl = (table: TableName): string =>
  `CREATE TABLE IF NOT EXISTS ${table} (
  id VARCHAR(128) PRIMARY KEY,
  doc MEDIUMTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

/**
 * Le journal append-only : aucun UPDATE, aucun DELETE (les traces ne
 * s'effacent pas).
 *
 * `at` est un `VARCHAR`, pas un `DATETIME` : l'instant y est l'ISO 8601
 * verbatim (`2026-11-13T18:20:52.123Z`), donc ni fuseau ni milliseconde ne
 * sont perdus à l'écriture, et le tri lexical est le tri chronologique (le
 * format ISO est à largeur fixe). Une colonne datetime, elle, exigerait un
 * `CAST(at AS CHAR)` à la lecture — et rendrait l'instant lu différent de
 * l'instant écrit, ce que le sceau du journal (`src/core/audit/`) refuse.
 */
const EVENT_DDL = `CREATE TABLE IF NOT EXISTS domain_event (
  id VARCHAR(128) PRIMARY KEY,
  at VARCHAR(32) NOT NULL,
  kind VARCHAR(64) NOT NULL,
  subject_ref VARCHAR(256) NOT NULL,
  actor_kind VARCHAR(32),
  payload MEDIUMTEXT NOT NULL,
  INDEX idx_event_kind (kind, at),
  INDEX idx_event_subject (subject_ref, at)
);`;

/** Le DDL complet : une instruction par table, rejouable à l'identique. */
export const SCHEMA: string = [...ENTITY_TABLES.map(entityDdl), EVENT_DDL].join("\n\n");

/**
 * Découpe le DDL en instructions.
 *
 * Les commentaires de ligne `--` sont retirés d'abord : le DDL se documente,
 * et un morceau commencé par un commentaire serait sinon perdu avec
 * l'instruction qui le suit. Le DDL ne contient aucun littéral `;` : le
 * point-virgule sépare toujours deux instructions.
 */
export const splitSchema = (schema: string): string[] =>
  schema
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "");

/** Exécute une instruction de DDL — injecté pour tester hors plateforme. */
export type DdlRunner = (statement: string) => Promise<void>;

/** Vrai quand l'échec ne signifie que « l'objet existe déjà ». */
export const isAlreadyExists = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return lower.includes("already exists") || lower.includes("duplicate");
};

/** Le détail d'une erreur, lisible dans les logs de production. */
const detail = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

/**
 * Applique le DDL, instruction par instruction.
 *
 * Idempotent par construction : toutes les instructions sont en
 * `CREATE TABLE IF NOT EXISTS`, donc le rejeu ne peut pas échouer. Un échec
 * qui dit « existe déjà » est ignoré ; tout autre échec est relancé, en
 * nommant l'instruction fautive — mieux vaut une app qui refuse de démarrer
 * qu'une app qui affiche « 0 gamme(s) » sans le dire.
 */
export const applySchema = async (run: DdlRunner, schema: string = SCHEMA): Promise<string[]> => {
  const statements = splitSchema(schema);
  for (const statement of statements) {
    try {
      await run(statement);
    } catch (error) {
      if (isAlreadyExists(error)) continue;
      throw new Error(`DDL Forge SQL refusé :: ${statement.slice(0, 200)} :: ${detail(error)}`);
    }
  }
  return statements;
};
