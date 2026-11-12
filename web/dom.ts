/**
 * Gammes — site public : petites aides DOM.
 *
 * Pas de framework : le site est un démonstrateur, et il doit rester lisible.
 * Une seule fonction de construction (`h`), un seul vidage (`clear`), et de quoi
 * poser une étiquette avec sa valeur — la mise en forme porte toujours la donnée.
 */

export type Child = Node | string | number | null | undefined | Child[];

export const append = (node: HTMLElement, children: readonly Child[]): void => {
  for (const child of children) {
    if (child === null || child === undefined) continue;
    if (Array.isArray(child)) append(node, child);
    else node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
};

export const h = (tag: string, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElement => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    if (key === "class") node.className = String(value);
    else if (key === "onclick") node.addEventListener("click", value as EventListener);
    else node.setAttribute(key, String(value));
  }
  append(node, children);
  return node;
};

export const clear = (node: HTMLElement): void => {
  node.replaceChildren();
};

/** Un couple libellé / valeur : la donnée d'abord, la décoration ensuite. */
export const kv = (label: string, value: Child): HTMLElement =>
  h("div", { class: "kv" }, h("span", { class: "k" }, label), h("span", { class: "v" }, value));

/** Une étiquette d'état (vert/ambre/rouge/neutre) — jamais la seule information. */
export const badge = (text: string, tone: "ok" | "warn" | "ko" | "idle" = "idle"): HTMLElement =>
  h("span", { class: `badge ${tone}` }, text);

export const toneOf = (state: string): "ok" | "warn" | "ko" | "idle" => {
  if (state === "approved" || state === "synced" || state === "succeeded") return "ok";
  if (state === "stale" || state === "source_gone" || state === "deprecated" || state === "failed") return "ko";
  if (state === "in_review" || state === "draft" || state === "aborted") return "warn";
  return "idle";
};

export const panel = (title: string, ...children: Child[]): HTMLElement =>
  h("section", { class: "panel" }, h("h2", {}, title), ...children);

export const code = (text: string): HTMLElement => h("pre", { class: "code" }, text);

export const button = (label: string, onClick: () => void, tone = "normal"): HTMLElement =>
  h("button", { class: `btn ${tone}`, onclick: onClick }, label);

export const select = (
  options: readonly { value: string; label: string }[],
  onChange: (value: string) => void,
  selected?: string,
): HTMLSelectElement => {
  const node = h("select", { class: "select", onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value) }) as HTMLSelectElement;
  for (const option of options) {
    const opt = h("option", { value: option.value }, option.label) as HTMLOptionElement;
    if (option.value === selected) opt.selected = true;
    node.append(opt);
  }
  return node;
};

export const line = (...children: Child[]): HTMLElement => h("div", { class: "line" }, ...children);
