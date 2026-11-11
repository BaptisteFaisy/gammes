/**
 * Gammes — le domaine, en un seul point d'entrée.
 *
 * C'est LE contrat partagé du dépôt : tout module importe ses types d'ici, jamais
 * d'un fichier voisin. Le domaine est découpé en quatre fichiers pour rester sous
 * la limite de 500 lignes (règle de la maison) :
 *
 * - `types/common.ts`  : acteurs, natures, états, provenance, preuves et verrous ;
 * - `types/gamme.ts`   : étapes, entrées, versions immuables, gammes ;
 * - `types/run.ts`     : exécutions, traces, déviations ;
 * - `types/atelier.ts` : liaison page ↔ gamme, amendements, statistiques,
 *                        fantômes, conflits, conciliation, permis, exports,
 *                        couverture, budget, candidates, réglages, tickets.
 *
 * Vocabulaire du cahier des charges § 4. Rien n'est décoratif : chaque champ porte
 * une donnée du produit. Deux invariants absolus :
 * - aucune donnée par personne (`actorRef` sert l'audit, jamais un classement) ;
 * - aucun secret dans aucun type (une clé détectée devient un `SecretFinding`).
 */

export type * from "./types/common";
export type * from "./types/gamme";
export type * from "./types/run";
export type * from "./types/atelier";
