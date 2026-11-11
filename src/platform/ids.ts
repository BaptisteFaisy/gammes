/**
 * Gammes — générateurs d'identifiants.
 *
 * `seqIds` donne des ids lisibles et stables en test (`gam_1`, `run_3`…) :
 * une trace de démonstration doit être reconnaissable à l'œil.
 */

import type { IdGen } from "../core/ports";

export const seqIds = (start = 0): IdGen => {
  let n = start;
  return { next: (prefix: string) => `${prefix}_${(++n).toString(36)}` };
};

export const randomIds = (): IdGen => ({
  next: (prefix: string) =>
    `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`,
});

/** Ids prévisibles à partir d'une liste : utile pour les fixtures de recette. */
export const listIds = (values: readonly string[]): IdGen => {
  let n = 0;
  return {
    next: (prefix: string) => {
      const given = values[n++ % Math.max(values.length, 1)];
      return given ?? `${prefix}_${n}`;
    },
  };
};
