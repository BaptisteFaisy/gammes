/**
 * Gammes — site public : le catalogue de la démo guidée.
 *
 * La démo est une liste d'étapes, pas un film : chaque étape est une fonction du cœur,
 * et le visiteur peut la lire avant de la lancer. Rien n'est simulé.
 */

import type { TourStep } from "./tour";
import { TOUR_PART1 } from "./tour-part1";
import { TOUR_PART2 } from "./tour-part2";

export const TOUR_STEPS: readonly TourStep[] = [...TOUR_PART1, ...TOUR_PART2];
