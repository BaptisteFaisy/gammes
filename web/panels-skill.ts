/**
 * Gammes — site public : « SKILL.md et agents ».
 *
 * § 15, § 18, GA-13 : la couche exportée (un `SKILL.md` par gamme approuvée, en source
 * ouverte) et la couche outillée (le skill générique `derouler-une-gamme`, l'agent Rovo
 * « le compagnon »). Les fichiers réellement livrés dans le dépôt sont affichés tels quels.
 */

import type { AppState } from "./state";
import { gammeOptions } from "./state";
import { badge, button, code, details, h, kv, line, note, panel, select, table } from "./dom";
import { exportSkillMd, SKILL_CONDUCT } from "../src/core/export/skill-md";
import { HERMES_CONDUCT } from "../src/core/conciliation/hermes";
import { checkBeforeActing } from "../src/core/mcp/search";
import genericSkillFile from "../skills/derouler-une-gamme/SKILL.md?raw";
import companionPrompt from "../agents/le-compagnon.md?raw";
import type { Rerender } from "./types";

export const skillPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("SKILL.md exporté, skill générique et agent Rovo (§ 15 · GA-13/15)");
  const out = h("div", { class: "out" });
  const picker = select([], (v) => { state.gamme = v || undefined; }, state.gamme);
  root.append(
    note("Deux couches : la couche outillée (un skill générique + des outils MCP paramétrés, statiques au manifeste) et la couche exportée (un SKILL.md par gamme approuvée, téléchargeable, en source ouverte)."),
    line(picker, select([{ value: "fr", label: "français" }, { value: "en", label: "anglais" }], (v) => { state.lang = v === "en" ? "en" : "fr"; }, state.lang ?? "fr"), button("Exporter le SKILL.md", () => void exportIt(state, out), "primary")),
    details("Le skill générique livré dans le dépôt (skills/derouler-une-gamme/SKILL.md)", code(genericSkillFile)),
    details("La conduite, en une phrase (SKILL_CONDUCT)", code(SKILL_CONDUCT)),
    details("L'agent Rovo « le compagnon » livré dans le dépôt (agents/le-compagnon.md)", code(companionPrompt)),
    details("La conduite du conciliateur de conflits (HERMES_CONDUCT)", code(HERMES_CONDUCT)),
    h("h3", {}, "Point d'entrée externe signé (GA-26)"),
    note(
      "Un hook d'agent de code ou un pipeline CI interroge le webtrigger signé avant un geste sensible. " +
        "La signature HMAC-SHA256 est vérifiée côté serveur (node:crypto) ; sans secret configuré, l'app échoue fermé. " +
        "Le verdict renvoyé est exactement celui de `check-before-acting` — le voici :",
    ),
    line(button("Simuler l'appel du CI", () => void simulateHook(state, out))),
    out,
  );
  void gammeOptions(state, (g) => g.state === "approved").then((options) =>
    picker.replaceChildren(
      ...options.map((o) => {
        const opt = h("option", { value: o.value }, o.label) as HTMLOptionElement;
        if (o.value === state.gamme) opt.selected = true;
        return opt;
      }),
    ),
  );
  return root;
};

const exportIt = async (state: AppState, out: HTMLElement): Promise<void> => {
  if (!state.gamme) {
    out.replaceChildren(note("Choisis une gamme approuvée.", "info"));
    return;
  }
  const res = await exportSkillMd(state.deps, { code: state.gamme, lang: state.lang ?? "fr" });
  out.replaceChildren();
  if (!res.ok) {
    out.append(note(`Export refusé : ${res.error.code} — ${res.error.messageFr}`, "ko"));
    return;
  }
  out.append(
    h("h3", {}, `SKILL.md de ${state.gamme}`),
    kv("empreinte du fichier", h("code", {}, res.value.hash)),
    kv("fichiers livrés", Object.keys(res.value.files).join(", ")),
    kv("enregistrement", `${res.value.record.id} · exporté le ${res.value.record.exportedAt} · ${res.value.record.downloads} téléchargement(s)`),
    note("Recette 17 : aucun secret dans l'export, et la version est citée. L'export est refusé (lock_secret) si une étape contient encore une clé.", "ok"),
    code(res.value.skillMd),
    line(button("Télécharger", () => download(res.value.skillMd, `SKILL-${state.gamme}.md`))),
  );
};

const download = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = h("a", { href: url, download: filename }) as HTMLAnchorElement;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const simulateHook = async (state: AppState, out: HTMLElement): Promise<void> => {
  const body = JSON.stringify({ intendedAction: state.intendedAction, service: state.service || undefined });
  const verdict = await checkBeforeActing(state.deps, {
    intendedAction: state.intendedAction,
    service: state.service || undefined,
  });
  out.append(
    h("h4", {}, "Requête signée du CI"),
    code(`POST /webtrigger/gammes-hook\nx-gammes-signature: <hmac-sha256 du corps>\n\n${body}`),
    h("h4", {}, "Réponse"),
    code(JSON.stringify(verdict, null, 2)),
    table(
      ["Cas", "Ce que répond l'app"],
      [
        ["aucune gamme", "l'appelant décide — mais l'app le dit explicitement"],
        ["gamme non approuvée", "l'app le dit, l'agent ne s'en sert pas"],
        ["gamme à verrou de permis", "l'app renvoie la demande de permis à obtenir"],
        ["signature invalide ou absente", "refus — échec fermé"],
      ],
    ),
    badge("webtrigger signé", "ok"),
  );
};
