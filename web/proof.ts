/**
 * Gammes — site public : la preuve affichée à l'écran.
 *
 * Une étape qui « marche » sans élément qui le montre ne prouve rien. Après chaque
 * étape, la démo affiche **en haut de l'écran** :
 * - ce qu'il fallait constater ;
 * - ce qui a été constaté (les valeurs réelles) ;
 * - **le test qui le prouve, et son statut** — vert si la suite est passée, rouge sinon ;
 * - l'élément mis en avant (le tableau des étapes, le refus affiché, la trace…).
 *
 * L'élément qui n'existe pas ne fait pas échouer l'étape : la preuve reste dans la carte.
 */

import { badge, h } from "./dom";
import { HIGHLIGHT_BY_SCREEN, type TourStep } from "./tour";
import { TOUR_TESTS, commandFor } from "./tour-steps";
import { statusFor } from "./preuves";

const MARK = (failed: boolean): string => (failed ? "✗" : "✓");

const statusBadge = (stepId: string) => {
  const status = statusFor(stepId);
  if (status === "passed") return badge("test passé", "ok");
  if (status === "failed") return badge("test en échec", "ko");
  return badge("test à vérifier", "warn");
};

/** Met en avant l'élément qui prouve le résultat : contour animé, puis retour au calme. */
const highlight = (panel: Element, selector: string): void => {
  const target = panel.querySelector(selector);
  if (!target) return;
  target.classList.add("prouve");
  setTimeout(() => target.classList.remove("prouve"), 4500);
};

const testLine = (step: TourStep): HTMLElement | null => {
  const test = TOUR_TESTS[step.id];
  if (!test) return null;
  const command = commandFor(step.id);
  return h(
    "div",
    { class: "preuveligne" },
    h("span", { class: "preuvecle" }, "prouvé par le test"),
    h("span", { class: "preuvevaleur" }, test.name),
    statusBadge(step.id),
    h(
      "div",
      { class: "preuvecommande" },
      h("code", {}, command ?? test.file),
    ),
  );
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
    testLine(step),
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
