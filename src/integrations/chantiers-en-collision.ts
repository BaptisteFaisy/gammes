/**
 * Gammes × chantiers-en-collision — la réservation de ressource exclusive (§ 13, § 16).
 *
 * Une gamme qui écrit du code déclare son emprise et respecte les réservations : deux
 * exécutions concurrentes d'une ressource exclusive sont un conflit, pas une coïncidence.
 * Le refus est poli, nomme le détenteur et l'heure, et ne dépend d'aucun réseau.
 */

import type { ReservationRegistry as ReservationRegistryPort } from "../core/ports";

export type Reservation = {
  readonly resource: string;
  readonly holder: string;
  readonly since: string;
};

export type ReservationRegistryOptions = { readonly now?: () => string };

export const createReservationRegistry = (options: ReservationRegistryOptions = {}): ReservationRegistryPort & {
  readonly holders: () => readonly Reservation[];
} => {
  const now = options.now ?? (() => new Date().toISOString());
  const reservations = new Map<string, Reservation>();

  return {
    holders: () => [...reservations.values()],
    tryReserve: async (resource, runId) => {
      const current = reservations.get(resource);
      if (current && current.holder !== runId) {
        return { reserved: false, holder: current.holder };
      }
      reservations.set(resource, { resource, holder: runId, since: now() });
      return { reserved: true };
    },
    release: async (resource, runId) => {
      const current = reservations.get(resource);
      if (current?.holder === runId) reservations.delete(resource);
    },
  };
};

/** Nom d'emprise d'une gamme : la clé partagée entre Gammes et `chantiers-en-collision`. */
export const reservationKey = (gammeId: string, service: string): string => `gamme:${gammeId}:${service}`;