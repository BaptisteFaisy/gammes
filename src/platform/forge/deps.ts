/**
 * Gammes — construction du `Deps` de production (§ 20).
 *
 * Un seul endroit assemble le monde Forge : Forge SQL pour le magasin, LLM hébergé pour
 * le modèle, ports Atlassian pour Confluence/Jira/graphe, et les adaptateurs du portefeuille
 * (§ 16) pour les réservations et les signatures d'échec. Le cœur ne voit que le port `Deps`.
 *
 * Le verrou de permis (`permits`) est branché sur l'app sœur `permis-forge` via son resolver
 * en production ; tant qu'il n'est pas configuré, il reste absent et le cœur **refuse par
 * prudence** toute étape à risque pour un agent (jamais d'accord par défaut).
 */

import type { Deps } from "../../core/ports";
import { ensureSchema, forgeSqlStore } from "./forge-sql";
import { forgeHostedLlm } from "./forge-hosted-llm";
import { confluencePort, graphPort, jiraPort } from "./atlassian-ports";
import { systemClock } from "../clock";
import { randomIds } from "../ids";
import { makeHasher } from "../hash";
import { memoryBudget } from "../llm/budget";
import { createReservationRegistry } from "../../integrations/chantiers-en-collision";
import { createFailureSignatures } from "../../integrations/deja-vu-ci";

export const buildForgeDeps = async (): Promise<Deps> => {
  // Le schéma d'abord : sans table, l'app ne lit rien et affiche « 0
  // gamme(s) au total ». Le DDL est idempotent et n'est appliqué qu'une fois
  // par instance (mémoïsé dans `forge-sql.ts`).
  await ensureSchema();
  const budget = memoryBudget(new Date().toISOString().slice(0, 10));
  return {
    store: forgeSqlStore(),
    clock: systemClock(),
    ids: randomIds(),
    hasher: makeHasher(),
    llm: forgeHostedLlm({ budget }),
    budget,
    confluence: confluencePort(),
    jira: jiraPort(),
    graph: graphPort(),
    reservations: createReservationRegistry(),
    signatures: createFailureSignatures(),
    // permits: branché sur permis-forge en production ; absent ⇒ refus prudent des étapes à risque.
  };
};
