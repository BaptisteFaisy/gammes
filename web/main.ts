/**
 * Gammes — site public : point d'entrée.
 *
 * Un démonstrateur interactif du produit complet, qui tourne **dans le navigateur**
 * sur le vrai cœur TypeScript (src/core) avec le magasin en mémoire. Aucun réseau,
 * aucun secret, aucune donnée réelle : tout est semé depuis `seed/atelier.ts`.
 */

import { createState, type AppState } from "./state";
import { atelierPanel, compilePanel, runPanel, type Rerender } from "./panels-atelier";
import { mesuresPanel, conflitsPanel, fantomesPanel, skillPanel } from "./panels-analysis";
import { clear, h } from "./dom";

type Tab = "atelier" | "compiler" | "derouler" | "mesures" | "conflits" | "fantomes" | "skill";

const TABS: readonly { id: Tab; label: string }[] = [
  { id: "atelier", label: "Atelier" },
  { id: "compiler", label: "Compiler" },
  { id: "derouler", label: "Dérouler" },
  { id: "mesures", label: "Mesures" },
  { id: "conflits", label: "Conflits" },
  { id: "fantomes", label: "Fantômes" },
  { id: "skill", label: "SKILL.md" },
];

const header = (): HTMLElement =>
  h(
    "header",
    { class: "head" },
    h("h1", {}, "Gammes", h("span", { class: "sub" }, " — your runbooks, as tools")),
    h("p", { class: "pitch" }, "Le wiki sait déjà tout faire. Les agents, non. Gammes compile une page de procédure en outil exécutable, verrouillé et tracé."),
    h("p", { class: "note" }, "Démonstration en mémoire, sans réseau : le vrai cœur du produit, sans Forge. Aucune donnée réelle."),
  );

const render = async (state: AppState, tab: Tab, main: HTMLElement, rerender: Rerender): Promise<void> => {
  clear(main);
  main.append(h("p", { class: "loading" }, "Chargement…"));
  const view =
    tab === "atelier" ? await atelierPanel(state)
    : tab === "compiler" ? compilePanel(state, rerender)
    : tab === "derouler" ? runPanel(state, rerender)
    : tab === "mesures" ? mesuresPanel(state, rerender)
    : tab === "conflits" ? conflitsPanel(state, rerender)
    : tab === "fantomes" ? fantomesPanel(state, rerender)
    : skillPanel(state, rerender);
  clear(main);
  main.append(view);
};

const boot = async (): Promise<void> => {
  const state = await createState();
  const app = document.getElementById("app");
  if (!app) return;
  clear(app);
  const nav = h("nav", { class: "nav" });
  const main = h("main", { class: "main" });
  app.append(header(), nav, main);

  let current: Tab = "atelier";
  const rerender: Rerender = () => void render(state, current, main, rerender);
  const go = (tab: Tab): void => {
    current = tab;
    for (const child of Array.from(nav.children)) {
      child.classList.toggle("active", (child as HTMLElement).dataset["tab"] === tab);
    }
    rerender();
  };
  for (const t of TABS) {
    nav.append(h("button", { class: "tab", "data-tab": t.id, onclick: () => go(t.id) }, t.label));
  }
  go("atelier");
};

void boot();
