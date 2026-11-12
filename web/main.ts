/**
 * Gammes — site public : point d'entrée et navigation.
 *
 * Un démonstrateur interactif du produit **complet**, qui tourne dans le navigateur sur le
 * vrai cœur TypeScript (`src/core`) avec le magasin en mémoire : exactement ce que fait
 * l'app dans Forge, sans Forge, sans réseau, sans donnée réelle.
 *
 * Les écrans suivent le parcours du produit : repérer → compiler → approuver → dérouler →
 * relier → mesurer → amender → outiller les agents.
 */

import { createState, type AppState } from "./state";
import { clear, h } from "./dom";
import { atelierPanel, detectPanel } from "./panels-overview";
import { compilePanel } from "./panels-compile";
import { gammePanel } from "./panels-gamme";
import { beforeActingPanel } from "./panels-agent";
import { runPanel } from "./panels-run";
import { bindingPanel } from "./panels-binding";
import { mesuresPanel, amendementsPanel } from "./panels-measures";
import { conflitsPanel, fantomesPanel } from "./panels-conflicts";
import { mcpPanel } from "./panels-tools";
import { skillPanel } from "./panels-skill";
import { encartsPanel, journalPanel, reglagesPanel } from "./panels-surfaces";
import type { Rerender } from "./types";

type Screen =
  | "atelier" | "detecter" | "compiler" | "gamme" | "avant-agir" | "derouler"
  | "liaison" | "mesures" | "amendements" | "conflits" | "fantomes"
  | "mcp" | "skill" | "encarts" | "journal" | "reglages";

type Group = { readonly title: string; readonly items: readonly { id: Screen; label: string }[] };

const GROUPS: readonly Group[] = [
  {
    title: "Atelier",
    items: [
      { id: "atelier", label: "Vue d'ensemble" },
      { id: "detecter", label: "1 · Détecter" },
      { id: "compiler", label: "2 · Compiler" },
      { id: "gamme", label: "3 · Fiche de gamme" },
    ],
  },
  {
    title: "Exécution",
    items: [
      { id: "avant-agir", label: "4 · Avant d'agir" },
      { id: "derouler", label: "5 · Dérouler" },
      { id: "liaison", label: "6 · Liaison page ↔ gamme" },
    ],
  },
  {
    title: "Boucle d'amélioration",
    items: [
      { id: "mesures", label: "7 · Mesures" },
      { id: "amendements", label: "8 · Amendements" },
      { id: "conflits", label: "9 · Conflits" },
      { id: "fantomes", label: "10 · Fantômes" },
    ],
  },
  {
    title: "Pour les agents",
    items: [
      { id: "mcp", label: "11 · Outils MCP" },
      { id: "skill", label: "12 · SKILL.md & agent" },
      { id: "encarts", label: "13 · Encarts Jira/Confluence" },
    ],
  },
  {
    title: "Gouvernance",
    items: [
      { id: "journal", label: "14 · Journal d'audit" },
      { id: "reglages", label: "15 · Réglages" },
    ],
  },
];

const header = (): HTMLElement =>
  h(
    "header",
    { class: "head" },
    h("h1", {}, "Gammes", h("span", { class: "sub" }, " — your runbooks, as tools")),
    h("p", { class: "pitch" }, "Le wiki sait déjà tout faire. Les agents, non. Gammes compile une page de procédure en outil exécutable, verrouillé et tracé — et refuse l'improvisation."),
    h(
      "p",
      { class: "note" },
      "Démonstration publique : le vrai cœur du produit tourne dans votre navigateur, sur un magasin en mémoire. Aucun réseau, aucun secret, aucune donnée réelle. ",
      h("a", { href: "https://github.com/BaptisteFaisy/gammes" }, "Code source"),
      " · ",
      h("a", { href: "https://github.com/BaptisteFaisy/gammes/blob/main/docs/SPEC-EN.md" }, "Spec (EN)"),
    ),
  );

const build = async (state: AppState, screen: Screen): Promise<HTMLElement> => {
  const rerender: Rerender = () => void mount(state, screen);
  switch (screen) {
    case "atelier": return atelierPanel(state);
    case "detecter": return detectPanel(state, rerender);
    case "compiler": return compilePanel(state, rerender);
    case "gamme": return gammePanel(state, rerender);
    case "avant-agir": return beforeActingPanel(state, rerender);
    case "derouler": return runPanel(state, rerender);
    case "liaison": return bindingPanel(state, rerender);
    case "mesures": return mesuresPanel(state, rerender);
    case "amendements": return amendementsPanel(state, rerender);
    case "conflits": return conflitsPanel(state, rerender);
    case "fantomes": return fantomesPanel(state, rerender);
    case "mcp": return mcpPanel(state, rerender);
    case "skill": return skillPanel(state, rerender);
    case "encarts": return encartsPanel(state, rerender);
    case "journal": return journalPanel(state, rerender);
    default: return reglagesPanel(state, rerender);
  }
};

let navNode: HTMLElement | undefined;
let mainNode: HTMLElement | undefined;
let stateRef: AppState | undefined;

const mount = async (state: AppState, screen: Screen): Promise<void> => {
  if (!mainNode) return;
  for (const child of Array.from(navNode?.children ?? [])) {
    for (const button of Array.from(child.children)) {
      button.classList.toggle("active", (button as HTMLElement).dataset["screen"] === screen);
    }
  }
  mainNode.replaceChildren(h("p", { class: "loading" }, "Chargement…"));
  const view = await build(state, screen);
  mainNode.replaceChildren(...(state.message ? [h("p", { class: "note info" }, state.message)] : []), view);
};

const boot = async (): Promise<void> => {
  const state = await createState();
  stateRef = state;
  const app = document.getElementById("app");
  if (!app) return;
  clear(app);
  navNode = h("nav", { class: "nav" });
  mainNode = h("main", { class: "main" });
  app.append(header(), h("div", { class: "layout" }, navNode, mainNode));
  for (const group of GROUPS) {
    const block = h("div", { class: "navgroup" }, h("h3", {}, group.title));
    for (const item of group.items) {
      block.append(h("button", { class: "tab", "data-screen": item.id, onclick: () => void mount(state, item.id) }, item.label));
    }
    navNode.append(block);
  }
  void mount(state, "atelier");
};

void boot();

export const appState = (): AppState | undefined => stateRef;
