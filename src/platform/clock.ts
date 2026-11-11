/**
 * Gammes — horloges. Le cœur ne lit jamais `Date.now()` directement : l'heure
 * vient d'ici, ce qui rend les tests de fraîcheur (§ 10) et de poussière (§ 19)
 * déterministes.
 */

import type { Clock } from "../core/ports";

export const systemClock = (): Clock => ({ now: () => new Date().toISOString() });

const addDays = (iso: string, days: number): string =>
  new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();

const addMinutes = (iso: string, minutes: number): string =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

/** Horloge fixe : `now()` ne bouge pas, `plusDays` décale la référence. */
export const fixedClock = (startIso: string): Clock & { advanceDays(d: number): void } => {
  let current = startIso;
  return {
    now: () => current,
    plusDays: (days: number) => (current = addDays(current, days)),
    advanceDays: (days: number) => {
      current = addDays(current, days);
    },
  };
};

/** Horloge de test qui avance d'un pas fixe à chaque lecture. */
export const steppingClock = (startIso: string, stepMinutes = 1): Clock => {
  let current = startIso;
  return {
    now: () => {
      const out = current;
      current = addMinutes(current, stepMinutes);
      return out;
    },
  };
};

export const shiftDays = addDays;
export const shiftMinutes = addMinutes;

export const daysBetween = (fromIso: string, toIso: string): number =>
  Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000);

/** Durée en secondes entre deux horodatages ISO — utilisé par les traces, jamais par Date dans le cœur. */
export const secondsBetween = (fromIso: string, toIso: string): number =>
  Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000));
