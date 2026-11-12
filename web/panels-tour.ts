/**
 * Gammes — site public : l'écran « Démo complète ».
 *
 * Le catalogue des étapes, ce qu'il faut constater à chacune, et les exigences du
 * cahier des charges qu'elles couvrent. Le bouton lance la démo : l'écran change tout
 * seul, l'encart en bas à droite narre.
 */

import { badge, button, h, kv, line, list, note, panel } from "./dom";
import { tourCoverage, type TourStep } from "./tour";
import { TOUR_STEPS } from "./tour-steps";
import type { Rerender } from "./types";

const screenLabels: Record<string, string> = {
  detecter: "Détecter",
  compiler: "Compiler",
  gamme: "Fiche de gamme",
  "avant-agir": "Avant d'agir",
  derouler: "Dérouler",
  liaison: "Liaison page ↔ gamme",
  mesures: "Mesures",
  amendements: "Amendements",
  conflits: "Conflits",
  fantomes: "Fantômes",
  mcp: "Outils MCP",
  skill: "SKILL.md & agent",
  encarts: "Encarts Jira/Confluence",
  journal: "Journal d'audit",
  atelier: "Vue d'ensemble",
  reglages: "Réglages",
};

const stepLine = (index: number, step: TourStep): HTMLElement =>
  h(
    "div",
    { class: "tourcat" },
    h("span", { class: "tourcatnum" }, String(index + 1)),
    h(
      "div",
      { class: "tourcatbody" },
      h("strong", {}, step.title),
      h("span", { class: "muted" }, ` · écran : ${screenLabels[step.screen] ?? step.screen}`),
      h("div", { class: "muted" }, step.expect),
      h("div", { class: "tourgachips" }, ...step.ga.map((ga) => badge(ga, "idle"))),
    ),
  );

export const tourPanel = (start: () => void, rerender: Rerender): HTMLElement => {
  const coverage = tourCoverage();
  const root = panel("Démo complète — le produit entier, étape par étape");
  root.append(
    note(
      "Chaque étape appelle les vraies fonctions du cœur sur le vrai état du site : rien n'est simulé, " +
        "et ce qui est produit reste dans l'atelier ensuite. L'écran change tout seul, l'encart en bas " +
        "à droite dit quoi regarder.",
    ),
    line(
      button("▶ Lancer la démo complète", start, "primary"),
      button("Rejouer depuis le début (atelier neuf)", start),
    ),
    kv("étapes", String(coverage.steps)),
    kv("exigences couvertes", coverage.ga.join(", ")),
    h("h3", {}, "Le programme"),
    ...TOUR_STEPS.map((step, index) => stepLine(index, step)),
    h("h3", {}, "Ce que la démo ne fait pas"),
    list([
      "elle n'invente aucune donnée : pages, tickets et traces sont semés par le dépôt",
      "elle ne contourne aucun verrou : les refus du produit sont la démonstration",
      "elle ne publie rien : chaque approbation reste un acte humain daté",
    ]),
  );
  return root;
};
