/**
 * Gammes — la forme de l'événement produit (§ 20).
 *
 * Module **pur** : aucune dépendance à Forge, donc lisible et testable hors plateforme.
 * L'événement que la plateforme livre pour une page est :
 * `{ atlassianId, updateTrigger, content: { id, title, space: { ari, key } } }` —
 * **sans l'ARI de la page** : il est reconstruit ici depuis l'ARI de l'espace.
 *
 *
 * Un déclencheur n'est **pas** un resolver : la plateforme appelle la fonction avec
 * l'événement brut, sans l'enveloppe `{ call: { functionKey, payload } }` que le
 * `@forge/resolver` attend. Câbler un module `trigger`, `consumer`, `scheduledTrigger`
 * ou `webtrigger` sur la fonction du resolver fait donc échouer chaque appel avec
 * « Cannot read properties of undefined (reading 'functionKey') » — et l'app ne
 * compile jamais rien, silencieusement.
 *
 * Ce fichier est le point d'entrée de ces modules : il lit l'événement, en tire la
 * page concernée et son auteur, et les donne aux handlers du domaine.
 */

import type { EventPayload } from "./keys";

/** L'événement tel que la plateforme le livre (forme défensive : tout peut manquer). */
export type PlatformEvent = Readonly<Record<string, unknown>>;

/** Une sous-valeur objet, ou rien. */
const objet = (valeur: unknown): PlatformEvent =>
  typeof valeur === "object" && valeur !== null ? (valeur as PlatformEvent) : {};

/** Une chaîne, ou rien. */
const texte = (valeur: unknown): string | undefined =>
  typeof valeur === "string" && valeur ? valeur : undefined;

/**
 * L'ARI de la page, reconstruit depuis l'événement.
 *
 * L'événement produit ne donne **pas** l'ARI de la page : il donne son `id` et l'ARI
 * de son espace. L'ARI de la page a la même forme, avec `page` et l'id de la page :
 * `ari:cloud:confluence:<site>:page/<id>` contre `…:space/<id>` pour l'espace.
 */
export const ariDePage = (event: PlatformEvent): string | undefined => {
  const direct =
    texte(event.ari) ??
    texte(objet(event.page).ari) ??
    texte(objet(event.event).ari) ??
    texte(objet(objet(event.event).page).ari) ??
    texte(objet(event.content).ari);
  if (direct) return direct;
  const content = objet(event.content);
  const idPage = texte(content.id);
  const ariEspace = texte(objet(content.space).ari);
  if (!idPage || !ariEspace) return undefined;
  return ariEspace.replace(/:space\/[^/]+$/, `:page/${idPage}`);
};

/** Le type d'événement, tel que déclaré au manifeste. */
export const typeDevenement = (event: PlatformEvent): string | undefined =>
  texte(event.eventType) ?? texte(event.type) ?? texte(objet(event.event).eventType);

/** L'auteur de l'événement : c'est lui qui confirme la compilation. */
export const auteurDe = (event: PlatformEvent): string | undefined =>
  texte(event.atlassianId) ??
  texte(event.accountId) ??
  texte(objet(event.event).atlassianId) ??
  texte(objet(event.event).accountId) ??
  texte(objet(event.actor).accountId);

/** La nature de la mutation (créée, modifiée, supprimée), lisible depuis le type d'événement. */
export const natureDe = (event: PlatformEvent): string => {
  const type = typeDevenement(event) ?? "";
  if (type.includes(":created:") || type.endsWith("added")) return "added";
  if (type.includes(":deleted:") || type.includes(":trashed:") || type.endsWith("deleted")) return "deleted";
  const declencheur = texte(event.updateTrigger) ?? texte(objet(event.event).updateTrigger) ?? "";
  if (declencheur.includes("create")) return "added";
  if (declencheur.includes("delete") || declencheur.includes("trash")) return "deleted";
  return "updated";
};

/** La charge utile que les handlers du domaine attendent, quelle que soit la forme livrée. */
export const payloadDe = (event: PlatformEvent): EventPayload => {
  const ari = ariDePage(event);
  const auteur = auteurDe(event);
  return {
    ...(ari ? { ari } : {}),
    kind: natureDe(event),
    ...(auteur ? { accountId: auteur } : {}),
    ...(texte(objet(event.payload).job) ? { job: texte(objet(event.payload).job) } : {}),
    ...(texte(objet(event.payload).pageAri) ? { pageAri: texte(objet(event.payload).pageAri) } : {}),
    ...(texte(objet(event.job).job) ? { job: texte(objet(event.job).job) } : {}),
    ...(texte(event.job) ? { job: texte(event.job) } : {}),
    ...(texte(objet(event.payload).code) ? { code: texte(objet(event.payload).code) } : {}),
    ...(texte(event.code) ? { code: texte(event.code) } : {}),
  };
};

