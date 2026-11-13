/**
 * Gammes — le resolver Forge (§ 20).
 *
 * Un seul point de montage : chaque clé du manifeste (`rovo:mcp`, les surfaces
 * Confluence/Jira, les déclencheurs) arrive ici et repart vers une action de
 * `createActions`. Le manifeste n'a pas de module `resolver` : le `function`
 * `gammes-fn` appelle ce handler, et lui seul.
 * Aucune logique métier dans ce fichier — seulement le câblage et la construction paresseuse
 * du `Deps` de production. Le callback Forge reçoit une `Request` (payload + accountId).
 */

import Resolver from "@forge/resolver";
import type { Deps } from "../core/ports";
import { ACTION_KEYS, createActions, type ActionPayload, type ForgeRequest } from "./actions";
import { handleTool, MCP_TOOLS, type Args } from "../core/mcp/tools";
import { buildForgeDeps } from "../platform/forge/deps";

let depsPromise: Promise<Deps> | undefined;
const deps = (): Promise<Deps> => (depsPromise ??= buildForgeDeps());

// Les clés d'actions viennent de `actions.ts` : elles sont composées depuis les
// trois groupes de surfaces, donc un lot n'édite jamais ce fichier.

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

// Les 16 actions Rovo (une par outil MCP du § 18) : le runtime Forge appelle la
// fonction avec la clé de l'action, le resolver dispatche donc sur le nom de
// l'outil. La liste vit dans `src/core/mcp/tools.ts` — le manifeste n'en est
// qu'un mirror, vérifié par `tools/check-manifest.mjs`.
for (const tool of MCP_TOOLS) {
  resolver.define(tool.key, async (request: ForgeReq) => {
    const d = await deps();
    return handleTool(d, tool.key, (request.payload ?? {}) as Args);
  });
}

/** Le handler exporté au manifeste (`function: gammes-fn` → `index.handler`). */
export const handler = resolver.getDefinitions();

/** Pour les tests et le harness : construit les actions sur un `Deps` fourni. */
export const actionsFor = (d: Deps) => createActions(d);
