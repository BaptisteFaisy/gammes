/**
 * Gammes — site public : point d'entrée et navigation.
 *
 * Un démonstrateur interactif du produit **complet**, qui tourne dans le navigateur sur le
 * vrai cœur TypeScript (`src/core`) avec le magasin en mémoire : exactement ce que fait
 * l'app dans Forge, sans Forge. Les données sont semées, ou **les tiennes** (écran
 * « Données réelles ») ; le modèle est scripté par défaut, ou **le tien** (écran « Modèle réel »).
 */

import { createState, type AppState } from "./state";
import { button, clear, h } from "./dom";
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
import { modelePanel } from "./panels-model";
import { tourPanel } from "./panels-tour";
import { runTour } from "./tour";
import { createTourOverlay } from "./tour-ui";
import { realDataPanel } from "./panels-realdata";
import { preuvesPanel } from "./panels-preuves";
import { describeEngine } from "./engine";
import type { Navigate, Rerender } from "./types";

type Screen =
  | "demo"
  | "atelier" | "detecter" | "compiler" | "gamme" | "avant-agir" | "derouler"
  | "liaison" | "mesures" | "amendements" | "conflits" | "fantomes"
  | "mcp" | "skill" | "encarts" | "journal" | "reglages" | "modele" | "donnees"
  | "preuves";

type Group = { readonly title: string; readonly items: readonly { id: Screen; label: string }[] };

const GROUPS: readonly Group[] = [
  {
    title: "Démo",
    items: [{ id: "demo", label: "0 · Démo complète" }],
  },
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
      { id: "preuves", label: "14 · Preuves (le tableau du juge)" },
      { id: "journal", label: "15 · Journal d'audit" },
      { id: "reglages", label: "16 · Réglages" },
    ],
  },
  {
    title: "Brancher du réel",
    items: [
      { id: "modele", label: "17 · Modèle réel (OpenCode…)" },
      { id: "donnees", label: "18 · Tes données réelles" },
    ],
  },
];

let state: AppState | undefined;
let overlay: ReturnType<typeof createTourOverlay> | undefined;
let current: Screen = "atelier";
let navNode: HTMLElement | undefined;
let mainNode: HTMLElement | undefined;
let engineNode: HTMLElement | undefined;

const header = (): HTMLElement => {
  engineNode = h("p", { class: "engine" }, "moteur : …");
  return h(
    "header",
    { class: "head" },
    h("h1", {}, "Gammes", h("span", { class: "sub" }, " — your runbooks, as tools")),
    h("p", { class: "pitch" }, "Le wiki sait déjà tout faire. Les agents, non. Gammes compile une page de procédure en outil exécutable, verrouillé et tracé — et refuse l'improvisation."),
    h(
      "p",
      { class: "notebarun" },
      button("▶ Démo complète", () => startTour(), "primary"),
      h("span", { class: "muted" }, "28 étapes, le vrai produit, tout seul"),
    ),
    h(
      "p",
      { class: "note" },
      "Le cœur du produit tourne dans votre navigateur. Données semées ou ",
      h("a", { href: "#", onclick: (e: Event) => { e.preventDefault(); goTo("donnees"); } }, "les vôtres"),
      " · modèle scripté ou ",
      h("a", { href: "#", onclick: (e: Event) => { e.preventDefault(); goTo("modele"); } }, "un vrai modèle"),
      " · ",
      h("a", { href: "https://github.com/BaptisteFaisy/gammes" }, "code source"),
    ),
    engineNode,
  );
};

const build = async (screen: Screen, go: Navigate): Promise<HTMLElement> => {
  if (!state) return h("p", {}, "État non initialisé.");
  const app = state;
  const rerender: Rerender = () => void mount();
  switch (screen) {
    case "demo": return tourPanel(startTour, rerender, go);
    case "preuves": return preuvesPanel(app, rerender);
    case "atelier": return atelierPanel(app);
    case "detecter": return detectPanel(app, rerender);
    case "compiler": return compilePanel(app, rerender);
    case "gamme": return gammePanel(app, rerender);
    case "avant-agir": return beforeActingPanel(app, rerender);
    case "derouler": return runPanel(app, rerender);
    case "liaison": return bindingPanel(app, rerender);
    case "mesures": return mesuresPanel(app, rerender);
    case "amendements": return amendementsPanel(app, rerender);
    case "conflits": return conflitsPanel(app, rerender);
    case "fantomes": return fantomesPanel(app, rerender);
    case "mcp": return mcpPanel(app, rerender);
    case "skill": return skillPanel(app, rerender);
    case "encarts": return encartsPanel(app, rerender);
    case "journal": return journalPanel(app, rerender);
    case "reglages": return reglagesPanel(app, rerender);
    case "modele": return modelePanel(app, rerender);
    default: return realDataPanel(app, rerender, go);
  }
};

const paintNav = (): void => {
  for (const group of Array.from(navNode?.children ?? [])) {
    for (const item of Array.from(group.children)) {
      if ((item as HTMLElement).dataset["screen"]) {
        item.classList.toggle("active", (item as HTMLElement).dataset["screen"] === current);
      }
    }
  }
};

const mount = async (): Promise<void> => {
  if (!mainNode || !state) return;
  paintNav();
  if (engineNode) engineNode.textContent = describeEngine(state);
  mainNode.replaceChildren(h("p", { class: "loading" }, "Chargement…"));
  const view = await build(current, (screen) => goTo(screen as Screen));
  if (!mainNode || !state) return;
  mainNode.replaceChildren(...(state.message ? [h("p", { class: "note info" }, state.message)] : []), view);
};

const goTo = (screen: Screen): void => {
  current = screen;
  void mount();
};

/** La démo rejoue tout depuis un atelier neuf : mêmes résultats, même ordre, à chaque fois. */
const startTour = (): void => {
  if (!overlay) return;
  const control = { stopped: false, paused: false };
  overlay.reset();
  overlay.setRunning(true);
  void (async () => {
    state = await createState();
    await runTour(state, {
      go: (screen) => goTo(screen as Screen),
      onStep: (i, step) => overlay?.onStep(i, step),
      onResult: (i, step, proof, failed) => overlay?.onResult(i, step, proof, failed),
      onDone: (done, failed) => overlay?.onDone(done, failed),
    }, { delayMs: 1100, control });
    overlay?.setRunning(false);
  })();
};

const boot = async (): Promise<void> => {
  state = await createState();
  const app = document.getElementById("app");
  if (!app) return;
  clear(app);
  navNode = h("nav", { class: "nav" });
  mainNode = h("main", { class: "main" });
  app.append(header(), h("div", { class: "layout" }, navNode, mainNode));
  overlay = createTourOverlay();
  document.body.append(overlay.element);
  // Le budget et le moteur sont des compteurs vivants : rafraîchis sans redessiner l'écran.
  setInterval(() => {
    if (engineNode && state) engineNode.textContent = describeEngine(state);
  }, 3000);
  for (const group of GROUPS) {
    const block = h("div", { class: "navgroup" }, h("h3", {}, group.title));
    for (const item of group.items) {
      block.append(h("button", { class: "tab", "data-screen": item.id, onclick: () => goTo(item.id) }, item.label));
    }
    navNode.append(block);
  }
  await mount();
};

void boot();
