/**
 * Gammes — la forme d'un point d'entrée externe (§ 18, GA-26), en module **pur**.
 *
 * Contrat web trigger **v2** de la plateforme : la fonction est appelée avec
 * `(payload, context)`, `payload.body` est le corps brut (chaîne), les en-têtes sont
 * des tableaux de chaînes, et la fonction **doit** rendre `{ statusCode, headers, body }`.
 * Un objet `Response` n'est pas sérialisé : la plateforme répond alors
 * « 424 Failed Dependency » **sans jamais appeler la fonction** — aucun log, aucun
 * verdict : c'est le silence qui a masqué le bug. D'où `urlFormat: v2` et
 * `response: { type: dynamic }` au manifeste, et ces helpers ici.
 *
 * Aucune dépendance à `@forge/api` au runtime : seuls les types sont importés (effacés
 * à la compilation), donc ce fichier se teste hors plateforme.
 */

import type { WebTriggerRequest, WebTriggerResponse } from "@forge/api";
import type { PageDigest } from "../core/types";

/** Une réponse JSON, dans la seule forme que la plateforme sait renvoyer à l'appelant. */
export const json = (statusCode: number, corps: unknown): WebTriggerResponse => ({
  statusCode,
  headers: { "Content-Type": ["application/json"] },
  body: JSON.stringify(corps),
});

/** Une chaîne du corps de requête, ou la chaîne vide — jamais `undefined`. */
export const texte = (valeur: unknown): string => (typeof valeur === "string" ? valeur : "");

/**
 * Les en-têtes à plat et en minuscules.
 *
 * La plateforme les livre en tableaux (`{ "x-gammes-signature": ["abc"] }`) et sans
 * respecter la casse de l'appelant : on aplatis et on normalise ici, une fois.
 */
export const entetesDe = (payload: WebTriggerRequest | undefined): Record<string, string> => {
  const source = (payload?.headers ?? {}) as Record<string, unknown>;
  const sortie: Record<string, string> = {};
  for (const [cle, valeur] of Object.entries(source)) {
    const clef = cle.toLowerCase();
    if (typeof valeur === "string") sortie[clef] = valeur;
    else if (Array.isArray(valeur) && typeof valeur[0] === "string") sortie[clef] = valeur[0];
  }
  return sortie;
};

/** Le contenu d'une page transmis par l'appelant, quand l'app n'a pas de jeton. */
export type PageTransmise = {
  readonly titre?: string;
  readonly corps?: string;
  readonly espace?: string;
};

/** Les trois champs de page qu'un appelant peut transmettre, lus sans les inventer. */
export const transmiseDe = (demande: Readonly<Record<string, unknown>>): PageTransmise => {
  const titre = texte(demande.title);
  const corps = texte(demande.storageBody);
  const espace = texte(demande.spaceKey);
  return {
    ...(titre ? { titre } : {}),
    ...(corps ? { corps } : {}),
    ...(espace ? { espace } : {}),
  };
};

/**
 * La page telle que l'appelant l'a envoyée.
 *
 * Ce n'est **pas** une confiance aveugle : la requête est signée (HMAC du corps, § 15),
 * l'appelant est identifié, et le contenu est empreinté comme toute version compilée —
 * le journal d'audit dit qui a confirmé. Le fallback existe parce qu'un web trigger ou
 * un déclencheur n'a ni utilisateur ni jeton utilisable : `asUser()` y échoue.
 */
export const pageDepuisRequete = (
  pageAri: string,
  transmise: PageTransmise,
): PageDigest | undefined => {
  const corps = transmise.corps;
  if (!corps) return undefined;
  return {
    ari: pageAri,
    id: pageAri.split("/").pop() ?? pageAri,
    spaceKey: transmise.espace ?? "",
    title: transmise.titre ?? "",
    storageBody: corps,
    labels: [],
    lastModifiedAt: "",
    pageVersion: 0,
    wordCount: 0,
    reachable: true,
  };
};
