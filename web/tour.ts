/**
 * Gammes — site public : le moteur de la démo guidée.
 *
 * La démo ne simule rien : chaque étape appelle **les vraies fonctions du cœur** sur le
 * vrai état du site, puis emmène le visiteur sur l'écran où le résultat est visible. Ce
 * qui est produit pendant la démo reste ensuite dans l'atelier — on peut le retrouver,
 * le rejouer, le contredire.
 */

import type { AppState } from "./state";
import { TOUR_STEPS } from "./tour-steps";

export type TourStep = {
  readonly id: string;
  readonly title: string;
  /** Écran où le résultat est visible. */
  readonly screen: string;
  /** Ce que le visiteur doit constater. */
  readonly expect: string;
  /** Exigence du cahier des charges couverte, pour le bilan final. */
  readonly ga: readonly string[];
  /** Joue l'étape et rend la preuve en une ligne. */
  readonly run: (state: AppState) => Promise<string>;
  /**
   * Sélecteur CSS de l'élément qui **prouve** le résultat sur l'écran (dans le panneau
   * courant). L'élément est mis en avant après l'étape ; s'il n'existe pas, la preuve
   * reste dans la carte affichée en haut de l'écran.
   */
  readonly highlight?: string;
};

/** Élément qui sert de preuve sur chaque écran, par défaut ; une étape peut le surcharger. */
export const HIGHLIGHT_BY_SCREEN: Readonly<Record<string, string>> = {
  detecter: ".panel .out .table",
  compiler: ".panel .out h3",
  gamme: ".panel details",
  "avant-agir": ".panel .out",
  derouler: ".panel .current",
  liaison: ".panel .out",
  mesures: ".panel .out .table",
  amendements: ".panel .out",
  conflits: ".panel .out",
  fantomes: ".panel .out",
  mcp: ".panel .out .table",
  skill: ".panel .out",
  encarts: ".panel .out",
  journal: ".panel .out .table",
  atelier: ".panel .out",
  reglages: ".panel .out",
};

export type TourHooks = {
  readonly go: (screen: string) => void;
  readonly onStep: (index: number, step: TourStep) => void;
  readonly onProof: (index: number, step: TourStep, proof: string, failed: boolean) => void;
  readonly onResult: (index: number, step: TourStep, proof: string, failed: boolean) => void;
  readonly onDone: (done: number, failed: number) => void;
};

export type TourOptions = {
  readonly delayMs?: number;
  /** Le visiteur peut arrêter ou mettre en pause à tout moment. */
  readonly control: { stopped: boolean; paused: boolean };
};

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const waitWhilePaused = async (control: TourOptions["control"]): Promise<void> => {
  while (control.paused && !control.stopped) await pause(150);
};

/** Une étape qui échoue ne bloque pas la suite : elle est dite, pas masquée. */
const runStep = async (state: AppState, step: TourStep): Promise<{ proof: string; failed: boolean }> => {
  try {
    const proof = await step.run(state);
    return { proof, failed: false };
  } catch (error) {
    return { proof: `échec — ${(error as Error).message.slice(0, 180)}`, failed: true };
  }
};

export const runTour = async (state: AppState, hooks: TourHooks, options: TourOptions): Promise<void> => {
  const steps = TOUR_STEPS;
  const delay = options.delayMs ?? 900;
  let done = 0;
  let failed = 0;
  for (let i = 0; i < steps.length; i += 1) {
    if (options.control.stopped) break;
    await waitWhilePaused(options.control);
    if (options.control.stopped) break;
    const step = steps[i]!;
    hooks.onStep(i, step);
    hooks.go(step.screen);
    await pause(260);
    const result = await runStep(state, step);
    if (result.failed) failed += 1;
    else done += 1;
    // On re-rend l'écran : sans ça le résultat existe dans l'état mais pas à l'écran.
    hooks.go(step.screen);
    await pause(220);
    hooks.onProof(i, step, result.proof, result.failed);
    hooks.onResult(i, step, result.proof, result.failed);
    await pause(delay);
  }
  hooks.onDone(done, failed);
};

/** Bilan lisible : ce qui a été démontré, et quelles exigences cela couvre. */
export const tourCoverage = (): { steps: number; ga: readonly string[] } => ({
  steps: TOUR_STEPS.length,
  ga: [...new Set(TOUR_STEPS.flatMap((s) => s.ga))].sort(),
});
