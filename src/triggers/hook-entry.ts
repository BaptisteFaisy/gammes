/**
 * Gammes — le câblage du point d'entrée externe signé au runtime Forge.
 *
 * Ce fichier est le **seul** à importer `triggerDeps` (qui tire `@forge/api`) : le
 * gestionnaire vit dans `hook.ts`, pur, et se teste donc sans plateforme. Même
 * séparation que `entry-shape.ts` (pur) / `entry.ts` (câblage).
 *
 * Déclaré au manifeste par `handler: triggers/hook-entry.handler`.
 */

import type { WebTriggerRequest, WebTriggerResponse } from "@forge/api";
import { createHookHandler } from "./hook";
import { triggerDeps } from "./index";

/** Le handler du web trigger : la plateforme appelle `(payload)` en format v2. */
export const handler = async (
  payload: WebTriggerRequest | undefined,
): Promise<WebTriggerResponse> =>
  createHookHandler(await triggerDeps(), process.env.GAMMES_HOOK_SECRET ?? "")(payload);
