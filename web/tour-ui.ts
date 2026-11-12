/**
 * Gammes — site public : l'habillage de la démo guidée.
 *
 * Un encart fixe qui suit le visiteur d'un écran à l'autre : l'étape en cours, ce
 * qu'il doit constater, et la preuve obtenue. La démo change d'écran tout seule — sans
 * l'habillage, on verrait le produit bouger sans comprendre pourquoi.
 */

import { badge, button, clear, h } from "./dom";
import type { TourStep } from "./tour";

export type TourOverlay = {
  readonly element: HTMLElement;
  readonly onStep: (index: number, step: TourStep) => void;
  readonly onResult: (index: number, step: TourStep, proof: string, failed: boolean) => void;
  readonly onDone: (done: number, failed: number) => void;
  readonly setRunning: (running: boolean) => void;
  readonly reset: () => void;
};

const MAX_LINES = 40;

type OverlayParts = {
  readonly panel: HTMLElement;
  readonly progress: HTMLElement;
  readonly log: HTMLElement;
  readonly status: HTMLElement;
};

const buildOverlay = (): OverlayParts => {
  const progress = h("div", { class: "tourprogress" });
  const log = h("div", { class: "tourlog" });
  const status = h("span", { class: "tourstatus" }, "inactif");
  const panel = h(
    "aside",
    { class: "tour" },
    h("div", { class: "tourhead" }, h("strong", {}, "Démo guidée"), status),
    progress,
    log,
  );
  return { panel, progress, log, status };
};

export const createTourOverlay = (): TourOverlay => {
  const { panel, progress, log, status } = buildOverlay();

  const push = (line: HTMLElement): void => {
    log.append(line);
    while (log.children.length > MAX_LINES) log.firstElementChild?.remove();
    log.scrollTop = log.scrollHeight;
  };

  const overlay: TourOverlay = {
    element: panel,
    onStep: (index, step) => {
      clear(progress);
      progress.append(
        h("div", { class: "tourbar" }, h("span", { class: "tourfill", style: `width:${Math.round((index / 28) * 100)}%` })),
        h("div", { class: "tourstep" }, badge(`étape ${index + 1}`, "idle"), h("strong", {}, step.title)),
        h("div", { class: "tourexpect" }, step.expect),
      );
    },
    onResult: (index, step, proof, failed) => {
      push(
        h(
          "div",
          { class: failed ? "tourline ko" : "tourline" },
          h("span", { class: "tourmark" }, failed ? "✗" : "✓"),
          h("div", {}, h("strong", {}, step.title), h("span", { class: "tourproof" }, proof)),
        ),
      );
    },
    onDone: (done, failed) => {
      status.textContent = failed === 0 ? `terminé — ${done} étapes` : `terminé — ${done} réussies, ${failed} en échec`;
      status.className = failed === 0 ? "tourstatus ok" : "tourstatus ko";
      push(h("div", { class: "tourline" }, h("span", { class: "tourmark" }, "■"), h("div", {}, h("strong", {}, "Bilan"), h("span", { class: "tourproof" }, `${done} étape(s) démontrée(s), ${failed} en échec.`))));
    },
    setRunning: (running) => {
      status.textContent = running ? "en cours" : "inactif";
      status.className = running ? "tourstatus run" : "tourstatus";
      if (!running) clear(progress);
    },
    reset: () => {
      clear(log);
      clear(progress);
      status.textContent = "inactif";
      status.className = "tourstatus";
    },
  };
  return overlay;
};

/** Bouton de lancement — le même que dans l'en-tête et sur l'écran de démo. */
export const tourStartButton = (onStart: () => void): HTMLElement =>
  button("▶ Lancer la démo complète", onStart, "primary");
