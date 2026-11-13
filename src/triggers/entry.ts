/**
 * Gammes — le handler des événements produit (§ 20).
 *
 * Un déclencheur n'est **pas** un resolver : la plateforme appelle la fonction avec
 * l'événement brut, sans l'enveloppe `{ call: { functionKey, payload } }` que le
 * `@forge/resolver` attend. Câbler un module `trigger`, `consumer`, `scheduledTrigger`
 * ou `webtrigger` sur la fonction du resolver fait donc échouer chaque appel avec
 * « Cannot read properties of undefined (reading 'functionKey') » — et l'app ne
 * compile jamais rien, silencieusement.
 *
 * Ce fichier est le point d'entrée de ces modules : il lit l'événement, en tire la
 * page concernée et son auteur (`entry-shape.ts`, pur et testé), et les donne aux
 * handlers du domaine.
 */

import { createSignedHook } from "../platform/webtrigger";
import { consumerHandler, nightlyHandler, pageEventHandler, triggerDeps } from "./index";
import { payloadDe, type PlatformEvent } from "./entry-shape";

export { ariDePage, auteurDe, natureDe, payloadDe } from "./entry-shape";

/** La signature d'un appel externe : en en-tête, ou dans le corps. */
const signatureDe = (event: PlatformEvent): string => {
  const entetes = (event.headers ?? {}) as Readonly<Record<string, unknown>>;
  const enTete = entetes["x-gammes-signature"] ?? entetes["X-Gammes-Signature"];
  if (typeof enTete === "string") return enTete;
  return typeof event.signature === "string" ? event.signature : "";
};

/** Le point d'entrée des événements, déclaré au manifeste (`handler: triggers/entry.handler`). */
export const handler = async (event: PlatformEvent): Promise<unknown> => {
  const brut = (event && typeof event === "object" ? event : {}) as PlatformEvent;
  // Le point d'entrée externe : corps signé, vérifié puis traité comme `check-before-acting`.
  if (typeof brut.body === "string") {
    return createSignedHook(await triggerDeps(), { secret: process.env.GAMMES_HOOK_SECRET })({
      body: brut.body,
      signature: signatureDe(brut),
    });
  }
  const charge = payloadDe(brut);
  const type = typeof brut.eventType === "string" ? brut.eventType : "";
  if (type.includes(":nightly:") || type === "scheduled") return nightlyHandler();
  if (charge.job) return consumerHandler(charge);
  if (charge.ari) return pageEventHandler(charge);
  return { handled: false, reason: "événement sans type, sans travail et sans page" };
};
