/**
 * Gammes — site public : « Preuves » — le tableau de preuves du juge.
 *
 * À chaque étape de chaque gamme : ce qui était **attendu**, ce qui a été
 * **laissé**, et l'extrait que le juge peut lire (la sortie de la commande, la
 * ligne de CI, la validation). Une étape franchie **sans** preuve est signalée
 * en rouge — jamais comptée comme acquittée.
 *
 * Une seule source de vérité : les traces du cœur. L'écran ne réécrit rien.
 */

import type { AppState } from "./state";
import { gammeOptions } from "./state";
import { badge, code, details, h, kv, line, note, panel, select, table } from "./dom";
import type { Evidence } from "../src/core/types";
import type { Rerender } from "./types";

type PreuveLaissee = { readonly evidence: Evidence; readonly runId: string; readonly code: string };

/** Les preuves laissées sur une étape, la plus récente d'abord. */
const preuvesDe = async (state: AppState, stepId: string): Promise<readonly PreuveLaissee[]> => {
  const runs = await state.deps.store.runs.list((r) => r.steps.some((s) => s.stepId === stepId));
  const preuves: PreuveLaissee[] = [];
  for (const run of runs) {
    const etape = run.steps.find((s) => s.stepId === stepId);
    if (etape?.evidence) preuves.push({ evidence: etape.evidence, runId: run.id, code: run.code });
  }
  return preuves.sort((a, b) => b.runId.localeCompare(a.runId));
};

/** Un extrait lisible : la note de la preuve, ou son rafraîchissement daté. */
const extrait = (preuve: Evidence): HTMLElement =>
  preuve.note ? code(preuve.note) : note(`aucun extrait — référence ${preuve.ref}`, "info");

/** Le bloc d'une preuve : ce qu'elle est, où elle est, ce qu'elle dit. */
const blocPreuve = (laissee: PreuveLaissee): HTMLElement =>
  details(
    `${laissee.evidence.kind} · force ${laissee.evidence.strength} — ${laissee.code}`,
    h("div", { class: "out" }, extrait(laissee.evidence)),
  );

export const preuvesPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Preuves — ce que chaque étape a laissé derrière elle");
  const out = h("div", { class: "out" });
  const picker = select([], (v) => { state.gamme = v || undefined; void render(state, out, rerender); }, state.gamme);
  root.append(
    note(
      "Règle du produit : on ne dit jamais qu'une procédure a été respectée sans trace. " +
        "Chaque étape de la gamme affiche la preuve attendue, les preuves réellement laissées, " +
        "et l'extrait que le juge peut lire.",
    ),
    line(picker),
    out,
  );
  void gammeOptions(state).then((options) =>
    picker.replaceChildren(
      ...options.map((o) => {
        const opt = h("option", { value: o.value }, o.label) as HTMLOptionElement;
        if (o.value === state.gamme) opt.selected = true;
        return opt;
      }),
    ),
  );
  void render(state, out, rerender);
  return root;
};

const render = async (state: AppState, out: HTMLElement, rerender: Rerender): Promise<void> => {
  if (!state.gamme) {
    out.replaceChildren(note("Choisis une gamme.", "info"));
    return;
  }
  const gamme = (await state.deps.store.gammes.list((g) => g.code === state.gamme))[0];
  if (!gamme) {
    out.replaceChildren(note("Gamme introuvable.", "ko"));
    return;
  }
  const versions = await state.deps.store.versions.list((v) => v.gammeId === gamme.id);
  const version = versions.find((v) => v.version === gamme.currentVersion) ?? versions[0];
  if (!version) {
    out.replaceChildren(note("Version introuvable.", "ko"));
    return;
  }
  const lignes: (readonly (string | HTMLElement)[])[] = [];
  let avec = 0;
  let sans = 0;
  for (const step of [...version.steps].sort((a, b) => a.ord - b.ord)) {
    const preuves = await preuvesDe(state, step.id);
    if (preuves.length > 0) avec += 1;
    else sans += 1;
    const colonnes: (string | HTMLElement)[] = [
      `${step.ord}. ${step.text}`,
      `${step.evidence.kind} · ${step.evidence.strength}${step.evidence.required ? " · obligatoire" : ""}`,
      preuves.length === 0
        ? badge("aucune preuve laissée", "ko")
        : h("div", { class: "out" }, ...preuves.map(blocPreuve)),
    ];
    lignes.push(colonnes);
  }
  out.replaceChildren(
    kv("étapes", `${avec + sans} — ${avec} avec preuve, ${sans} sans`),
    table(["Étape", "Preuve attendue", "Preuves laissées"], lignes),
    note(
      sans === 0
        ? "Toutes les étapes de cette gamme ont laissé une preuve. C'est le seul critère qui compte ici."
        : `${sans} étape(s) sans preuve : ce sont elles que l'atelier doit montrer en priorité.`,
      sans === 0 ? "ok" : "info",
    ),
  );
};
