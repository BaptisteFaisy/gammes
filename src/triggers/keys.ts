/**
 * Gammes — les clés d'événements (§ 20), en constantes pures.
 *
 * Le manifeste déclare des déclencheurs (`trigger`), un planifié
 * (`scheduledTrigger`), des consommateurs (`consumer`) et un point d'entrée externe
 * (`webtrigger`). Chacun appelle une fonction **avec la clé du module** ; si le
 * resolver n'a pas de définition pour cette clé, l'appel est refusé par la
 * plateforme (« Resolver has no definition for … ») et l'événement ne produit rien.
 *
 * Ce fichier ne contient que les clés et leurs types, **sans aucune dépendance à
 * Forge** : le test `test/surfaces/trigger-keys.test.ts` le lit contre le manifeste
 * sans toucher au runtime. Le câblage vers les handlers vit dans le resolver.
 */

/** Les clés déclarées par les modules `trigger` et `scheduledTrigger`. */
export type TriggerKey = "gammes-page-events" | "gammes-nightly";

/** Les clés déclarées par les modules `consumer`. */
export type ConsumerKey =
  | "gammes-consumer-compile"
  | "gammes-consumer-stats"
  | "gammes-consumer-ghosts"
  | "gammes-consumer-conflicts";

/** La clé du point d'entrée externe signé. */
export type WebtriggerKey = "gammes-hook";

export const TRIGGER_KEYS: readonly TriggerKey[] = ["gammes-page-events", "gammes-nightly"];

export const CONSUMER_KEYS: readonly ConsumerKey[] = [
  "gammes-consumer-compile",
  "gammes-consumer-stats",
  "gammes-consumer-ghosts",
  "gammes-consumer-conflicts",
];

export const WEBTRIGGER_KEYS: readonly WebtriggerKey[] = ["gammes-hook"];

/** Toutes les clés d'événements que le resolver doit définir. */
export const EVENT_KEYS: readonly string[] = [
  ...TRIGGER_KEYS,
  ...CONSUMER_KEYS,
  ...WEBTRIGGER_KEYS,
];

/** Le corps qu'un déclencheur ou un consommateur reçoit : la charge utile de l'événement. */
export type EventPayload = {
  readonly ari?: string;
  readonly page?: { readonly ari?: string };
  readonly kind?: string;
  readonly accountId?: string;
  readonly job?: string;
  readonly pageAri?: string;
  readonly confirmedById?: string;
  readonly code?: string;
};

/** Le corps d'un appel signé : le texte signé, et sa signature. */
export type SignedPayload = { readonly body?: string; readonly signature?: string };