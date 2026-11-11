/**
 * Gammes — magasin en mémoire.
 *
 * Implémentation du port `Store` utilisée par le harness local, la démo et la
 * recette (§ 25) : on peut dérouler une gamme complète sans Forge, sans
 * Confluence, sans Jira. Le même port est implémenté par `src/platform/forge/`
 * pour le SQL de Forge (le cœur ne fait pas la différence).
 */

import type { Collection, DomainEvent, Store } from "../core/ports";
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
} from "../core/types";

const makeKeyedCollection = <T>(keyOf: (item: T) => string): Collection<T> => {
  const rows = new Map<string, T>();
  const matches = (filter?: (item: T) => boolean): T[] =>
    [...rows.values()].filter((item) => (filter ? filter(item) : true));
  return {
    list: async (filter) => matches(filter),
    get: async (id) => rows.get(id),
    insert: async (item) => {
      rows.set(keyOf(item), item);
      return item;
    },
    update: async (id, patch) => {
      const current = rows.get(id);
      if (!current) return undefined;
      const next = patch(current);
      rows.set(keyOf(next), next);
      return next;
    },
    count: async (filter) => matches(filter).length,
  };
};

const makeCollection = <T extends { readonly id: string }>(): Collection<T> =>
  makeKeyedCollection<T>((item) => item.id);

export const memoryStore = (): Store => {
  const events: DomainEvent[] = [];
  let eventSeq = 0;

  const settings = makeKeyedCollection<SpaceSettings>((s) => s.spaceKey);
  const budget = makeKeyedCollection<BudgetDay>((b) => b.day);

  return {
    gammes: makeCollection<Gamme>(),
    versions: makeCollection<GammeVersion>(),
    runs: makeCollection<Run>(),
    bindings: makeCollection<Binding>(),
    amendments: makeCollection<Amendment>(),
    stepStats: makeCollection<StepStat>(),
    conflicts: makeCollection<Conflict>(),
    conciliations: makeCollection<Conciliation>(),
    ghosts: makeCollection<GhostCandidate>(),
    permits: makeCollection<PermitCheck>(),
    exports: makeCollection<ExportRecord>(),
    coverage: makeCollection<Coverage>(),
    budget,
    findings: makeCollection<SecretFinding>(),
    candidates: makeCollection<CandidatePage>(),
    settings,
    deviations: makeCollection<Deviation>(),
    appendEvent: async (event) => {
      eventSeq += 1;
      const full: DomainEvent = { ...event, id: `evt_${eventSeq.toString(36)}` };
      events.push(full);
      return full;
    },
    events: async (filter) => (filter ? events.filter(filter) : [...events]),
  };
};
