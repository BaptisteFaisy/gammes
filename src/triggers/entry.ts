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

import { consumerHandler, nightlyHandler, pageEventHandler } from "./index";
import { payloadDe, type PlatformEvent } from "./entry-shape";

export { ariDePage, auteurDe, natureDe, payloadDe } from "./entry-shape";

/**
 * Le point d'entrée des événements, déclaré au manifeste (`handler: triggers/entry.handler`).
 *
 * Il ne traite **que** les événements produit, le planifié et les consommateurs :
 * l'appel externe signé a sa propre fonction (`triggers/hook.handler`), parce que le
 * contrat d'un web trigger n'est pas celui d'un événement.
 */
export const handler = async (event: PlatformEvent): Promise<unknown> => {
  const brut = (event && typeof event === "object" ? event : {}) as PlatformEvent;
  const charge = payloadDe(brut);
  const type = typeof brut.eventType === "string" ? brut.eventType : "";
  if (type.includes(":nightly:") || type === "scheduled") return nightlyHandler();
  if (charge.job) return consumerHandler(charge);
  if (charge.ari) return pageEventHandler(charge);
  return { handled: false, reason: "événement sans type, sans travail et sans page" };
};
