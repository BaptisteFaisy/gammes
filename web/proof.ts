/**
 * Gammes — site public : la preuve affichée à l'écran.
 *
 * Une étape qui « marche » sans élément qui le montre ne prouve rien. Après chaque
 * étape, la démo affiche **en haut de l'écran** ce qui a été constaté, ce qu'il fallait
 * regarder, et elle met en avant l'élément qui sert de preuve (le tableau des étapes, le
 * refus affiché, la trace…). L'élément qui n'existe pas ne fait pas échouer l'étape : la
 * preuve reste dans la carte.
 */

import { h } from "./dom";
import { HIGHLIGHT_BY_SCREEN, type TourStep } from "./tour";

const MARK = (failed: boolean): string => (failed ? "✗" : "✓");

/** Met en avant l'élément qui prouve le résultat : contour animé, puis retour au calme. */
const highlight = (panel: Element, selector: string): void => {
  const target = panel.querySelector(selector);
  if (!target) return;
  target.classList.add("prouve");
  setTimeout(() => target.classList.remove("prouve"), 4500);
};

export const showProof = (step: TourStep, proof: string, failed: boolean): void => {
  const panel = document.querySelector(".panel");
  if (!panel) return;
  const selector = step.highlight ?? HIGHLIGHT_BY_SCREEN[step.screen];
  document.querySelector(".preuve")?.remove();
  const card = h(
    "div",
    { class: failed ? "preuve ko" : "preuve" },
    h(
      "div",
      { class: "preuvehead" },
      h("span", { class: "preuvemark" }, MARK(failed)),
      h("strong", {}, step.title),
      h("span", { class: "preuveetape" }, failed ? "non concluant" : "prouvé"),
    ),
    h(
      "div",
      { class: "preuveligne" },
      h("span", { class: "preuvecle" }, "à regarder"),
      h("span", {}, step.expect),
    ),
    h(
      "div",
      { class: "preuveligne" },
      h("span", { class: "preuvecle" }, "constaté"),
      h("span", { class: "preuvevaleur" }, proof),
    ),
    selector
      ? h(
          "div",
          { class: "preuveligne" },
          h("span", { class: "preuvecle" }, "élément mis en avant"),
          h("code", {}, selector),
        )
      : null,
  );
  panel.prepend(card);
  if (selector) highlight(panel, selector);
};
