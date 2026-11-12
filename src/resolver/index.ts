/**
 * Gammes — le resolver Forge (§ 20).
 *
 * Un seul point de montage : chaque clé du manifeste (`resolver`, `rovo:mcp`, les surfaces
 * Confluence/Jira, les déclencheurs) arrive ici et repart vers une action de `createActions`.
 * Aucune logique métier dans ce fichier — seulement le câblage et la construction paresseuse
 * du `Deps` de production. Le callback Forge reçoit une `Request` (payload + accountId).
 */

import Resolver from "@forge/resolver";
import type { Deps } from "../core/ports";
import { createActions, type ActionKey, type ActionPayload, type ForgeRequest } from "./actions";
import { buildForgeDeps } from "../platform/forge/deps";

let depsPromise: Promise<Deps> | undefined;
const deps = (): Promise<Deps> => (depsPromise ??= buildForgeDeps());

/** Les clés d'actions, alignées sur `createActions`. */
const ACTION_KEYS: readonly ActionKey[] = [
  "mcp", "atelier", "gamme", "run", "stats", "conflicts", "ghosts", "nightly", "pageEvent",
  // surfaces (un groupe par lot) : encart Jira, macro Confluence, Jira hors encart
  "issuePanel", "issuePanelTraces", "macroState", "macroFreshness", "issueTraces",
];

type AnyAction = (payload: ActionPayload, request: ForgeRequest) => Promise<unknown>;
type ForgeReq = { readonly payload?: unknown; readonly accountId?: string };

const resolver = new Resolver();
for (const key of ACTION_KEYS) {
  resolver.define(key, async (request: ForgeReq) => {
    const d = await deps();
    const fn = createActions(d)[key] as unknown as AnyAction;
    return fn((request.payload ?? {}) as ActionPayload, { accountId: request.accountId });
  });
}

/** Le handler exporté au manifeste (`function: gammes-fn` → `index.handler`). */
export const handler = resolver.getDefinitions();

/** Pour les tests et le harness : construit les actions sur un `Deps` fourni. */
export const actionsFor = (d: Deps) => createActions(d);
