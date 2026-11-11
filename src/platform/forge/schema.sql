-- Gammes — schéma Forge SQL (§ 21 du cahier des charges)
--
-- Exécuté par `migrationRunner` de @forge/sql au premier déploiement.
-- Principe : une table par entité du domaine, une colonne `doc` JSON pour l'entité
-- complète (le port `Store` lit/écrit des entités), et des colonnes générées indexées
-- pour les filtres chauds (code, état, version, service, période). Le contenu métier
-- reste ainsi interrogeable en SQL sans dupliquer la logique de mapping.
--
-- Aucune table ne contient de secret : les signalements ne gardent qu'une empreinte
-- et un aperçu masqué. Aucune colonne ne porte de mesure par personne (GA-21) :
-- actor_ref et approved_by_ref servent l'audit, jamais un classement.

CREATE TABLE IF NOT EXISTS gamme (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  code text GENERATED ALWAYS AS (doc ->> 'code') STORED,
  state text GENERATED ALWAYS AS (doc ->> 'state') STORED,
  space_key text GENERATED ALWAYS AS (doc ->> 'spaceKey') STORED,
  sync text GENERATED ALWAYS AS (doc ->> 'sync') STORED,
  current_version integer GENERATED ALWAYS AS ((doc ->> 'currentVersion')::integer) STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gamme_code ON gamme (code);
CREATE INDEX IF NOT EXISTS idx_gamme_state ON gamme (state, space_key);

CREATE TABLE IF NOT EXISTS gamme_version (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  gamme_id text GENERATED ALWAYS AS (doc ->> 'gammeId') STORED,
  version integer GENERATED ALWAYS AS ((doc ->> 'version')::integer) STORED,
  content_hash text GENERATED ALWAYS AS (doc ->> 'contentHash') STORED,
  approved_at timestamptz GENERATED ALWAYS AS (
    CASE WHEN doc ->> 'approvedAt' IS NULL THEN NULL ELSE (doc ->> 'approvedAt')::timestamptz END
  ) STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Une version est immuable en application : aucun UPDATE n'est émis après approbation.
CREATE INDEX IF NOT EXISTS idx_version_gamme ON gamme_version (gamme_id, version);

CREATE TABLE IF NOT EXISTS run (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  gamme_id text GENERATED ALWAYS AS (doc ->> 'gammeId') STORED,
  version_id text GENERATED ALWAYS AS (doc ->> 'versionId') STORED,
  pinned_version integer GENERATED ALWAYS AS ((doc ->> 'pinnedVersion')::integer) STORED,
  actor_kind text GENERATED ALWAYS AS (doc -> 'actor' ->> 'kind') STORED,
  outcome text GENERATED ALWAYS AS (doc ->> 'outcome') STORED,
  started_at timestamptz GENERATED ALWAYS AS ((doc ->> 'startedAt')::timestamptz) STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_run_version ON run (version_id, started_at);
CREATE INDEX IF NOT EXISTS idx_run_gamme ON run (gamme_id, outcome);

CREATE TABLE IF NOT EXISTS binding (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  gamme_id text GENERATED ALWAYS AS (doc ->> 'gammeId') STORED,
  page_ari text GENERATED ALWAYS AS (doc ->> 'pageAri') STORED,
  sync text GENERATED ALWAYS AS (doc ->> 'sync') STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_binding_gamme ON binding (gamme_id);
CREATE INDEX IF NOT EXISTS idx_binding_page ON binding (page_ari);

CREATE TABLE IF NOT EXISTS amendment (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  gamme_id text GENERATED ALWAYS AS (doc ->> 'gammeId') STORED,
  state text GENERATED ALWAYS AS (doc ->> 'state') STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amendment_gamme ON amendment (gamme_id, state);

CREATE TABLE IF NOT EXISTS step_stat (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  version_id text GENERATED ALWAYS AS (doc ->> 'versionId') STORED,
  step_id text GENERATED ALWAYS AS (doc ->> 'stepId') STORED,
  period text GENERATED ALWAYS AS (doc ->> 'period') STORED,
  n integer GENERATED ALWAYS AS ((doc ->> 'n')::integer) STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stat_version ON step_stat (version_id, step_id, period);

CREATE TABLE IF NOT EXISTS conflict (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  kind text GENERATED ALWAYS AS (doc ->> 'kind') STORED,
  state text GENERATED ALWAYS AS (doc ->> 'state') STORED,
  service text GENERATED ALWAYS AS (doc ->> 'service') STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conflict_state ON conflict (state, service);

CREATE TABLE IF NOT EXISTS conciliation (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  conflict_id text GENERATED ALWAYS AS (doc ->> 'conflictId') STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conciliation_conflict ON conciliation (conflict_id);

CREATE TABLE IF NOT EXISTS ghost_candidate (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  cluster_key text GENERATED ALWAYS AS (doc ->> 'clusterKey') STORED,
  state text GENERATED ALWAYS AS (doc ->> 'state') STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ghost_state ON ghost_candidate (state);

CREATE TABLE IF NOT EXISTS deviation (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  run_id text GENERATED ALWAYS AS (doc ->> 'runId') STORED,
  origin text GENERATED ALWAYS AS (doc ->> 'origin') STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deviation_run ON deviation (run_id);

CREATE TABLE IF NOT EXISTS permit_check (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  step_id text GENERATED ALWAYS AS (doc ->> 'stepId') STORED,
  permit_class text GENERATED ALWAYS AS (doc ->> 'permitClass') STORED,
  result text GENERATED ALWAYS AS (doc ->> 'result') STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS secret_finding (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  detector text GENERATED ALWAYS AS (doc ->> 'detector') STORED,
  state text GENERATED ALWAYS AS (doc ->> 'state') STORED,
  fingerprint text GENERATED ALWAYS AS (doc ->> 'fingerprint') STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finding_state ON secret_finding (state);

CREATE TABLE IF NOT EXISTS candidate_page (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  page_ari text GENERATED ALWAYS AS (doc ->> 'pageAri') STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_page ON candidate_page (page_ari);

CREATE TABLE IF NOT EXISTS export_record (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  gamme_id text GENERATED ALWAYS AS (doc ->> 'gammeId') STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coverage (
  id text PRIMARY KEY,
  doc jsonb NOT NULL,
  scope text GENERATED ALWAYS AS (doc ->> 'scope') STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_day (
  id text PRIMARY KEY, -- la clé est le jour (`day`)
  doc jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS space_settings (
  id text PRIMARY KEY, -- la clé est `spaceKey`
  doc jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Journal append-only : aucun UPDATE, aucun DELETE (les traces ne s'effacent pas).
CREATE TABLE IF NOT EXISTS domain_event (
  id text PRIMARY KEY,
  at timestamptz NOT NULL,
  kind text NOT NULL,
  subject_ref text NOT NULL,
  actor_kind text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_event_kind ON domain_event (kind, at);
CREATE INDEX IF NOT EXISTS idx_event_subject ON domain_event (subject_ref, at);
