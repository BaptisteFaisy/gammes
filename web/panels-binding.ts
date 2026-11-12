/**
 * Gammes — site public : « Liaison page ↔ gamme ».
 *
 * § 10, GA-10 : le point fragile de tout outillage de procédures. Les trois cas sont
 * traités explicitement — la page change (désynchronisation, âge de l'écart, diff de
 * recompilation proposé), la gamme change (proposition de modification de la page),
 * la page disparaît (la gamme garde sa dernière version et reste exécutable).
 */

import type { AppState } from "./state";
import { OWNER, gammeOptions } from "./state";
import { append, badge, button, code, h, kv, line, note, panel, select, table, toneOf } from "./dom";
import { checkSync, isRunnableWhileStale, markSourceGone, stalenessOf } from "../src/core/binding/binding";
import { proposeRecompile } from "../src/core/compile/recompile";
import { approveVersion, getGammeByCode } from "../src/core/version/versioning";
import { PAGES } from "../seed/atelier";
import { human } from "../test/helpers";
import type { PageDigest } from "../src/core/types";
import type { Rerender } from "./types";

export const bindingPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Liaison page ↔ gamme (§ 10 · GA-10)");
  const out = h("div", { class: "out" });
  const picker = select([], (v) => { state.gamme = v || undefined; void show(state, out, rerender); }, state.gamme);
  root.append(
    note("Une gamme désynchronisée reste exécutable : on affiche l'âge de l'écart, on ne bloque rien. La recompilation est une proposition, jamais une republication automatique."),
    line(picker, button("Afficher la liaison", () => void show(state, out, rerender), "primary")),
    out,
  );
  void gammeOptions(state).then((options) => fill(picker, options, state.gamme));
  return root;
};

const fill = (node: HTMLSelectElement, options: readonly { value: string; label: string }[], selected?: string): void => {
  node.replaceChildren(
    ...options.map((o) => {
      const opt = h("option", { value: o.value }, o.label) as HTMLOptionElement;
      if (o.value === selected) opt.selected = true;
      return opt;
    }),
  );
};

const show = async (state: AppState, out: HTMLElement, rerender: Rerender): Promise<void> => {
  if (!state.gamme) {
    out.replaceChildren(note("Choisis une gamme compilée.", "info"));
    return;
  }
  const gamme = await getGammeByCode(state.deps, state.gamme);
  if (!gamme) {
    out.replaceChildren(note(`Gamme ${state.gamme} introuvable.`, "ko"));
    return;
  }
  const binding = (await state.deps.store.bindings.list((b) => b.gammeId === gamme.id))[0];
  const page = binding ? PAGES[binding.pageAri] : undefined;
  out.replaceChildren(
    h("h3", {}, `Liaison de ${gamme.code}`),
    binding
      ? table(
          ["Champ", "Valeur"],
          [
            ["page source", h("code", {}, binding.pageAri)],
            ["empreinte à la compilation", h("code", {}, binding.contentHash)],
            ["synchronisée le", binding.syncedAt],
            ["état", badge(binding.sync, toneOf(binding.sync))],
            ["désynchronisée depuis", binding.staleSince ?? "—"],
            ["âge de l'écart", stalenessOf(binding, state.deps.clock.now()) !== undefined ? `${stalenessOf(binding, state.deps.clock.now())} jour(s)` : "—"],
            ["gamme toujours exécutable", isRunnableWhileStale(gamme) ? badge("oui", "ok") : badge("non", "ko")],
          ],
        )
      : note("Aucune page liée : cette gamme est née de tickets (fantôme adopté).", "info"),
  );
  if (!binding || !page) return;
  const editor = buildEditor(state, page, binding.gammeId, out, rerender);
  out.append(editor);
};

/** La page est éditable : c'est le seul moyen honnête de provoquer une désynchronisation. */
const buildEditor = (state: AppState, page: PageDigest, gammeId: string, out: HTMLElement, rerender: Rerender): HTMLElement => {
  const box = h("div", {});
  let body = page.storageBody;
  const area = h("textarea", {
    class: "input area big",
    rows: "10",
    oninput: (e: Event) => { body = (e.target as HTMLTextAreaElement).value; },
  }, page.storageBody) as HTMLTextAreaElement;
  box.append(
    h("h3", {}, "Modifier la page source (format storage Confluence)"),
    area,
    line(
      button("Vérifier la synchronisation", () => void check(state, gammeId, body, out), "primary"),
      button("Proposer la recompilation (diff)", () => void recompile(state, gammeId, body, out), "warn"),
      button("Simuler la suppression de la page", () => void gone(state, gammeId, out, rerender)),
    ),
    h("p", { class: "muted" }, "Astuce : change « 5 minutes » en « 15 minutes », ou ajoute une étape."),
  );
  return box;
};

const edited = (page: PageDigest, body: string): PageDigest => ({ ...page, storageBody: body });

const check = async (state: AppState, gammeId: string, body: string, out: HTMLElement): Promise<void> => {
  const binding = (await state.deps.store.bindings.list((b) => b.gammeId === gammeId))[0];
  const page = binding ? PAGES[binding.pageAri] : undefined;
  if (!page) return;
  const res = await checkSync(state.deps, gammeId, edited(page, body));
  const box = h("div", {});
  out.append(box);
  if (!res.ok) {
    box.append(note(res.error.messageFr, "ko"));
    return;
  }
  append(box, [
    h("h4", {}, "Résultat du contrôle d'empreinte"),
    kv("état", badge(res.value.sync, toneOf(res.value.sync))),
    kv("âge de l'écart", res.value.ageDays !== undefined ? `${res.value.ageDays} jour(s)` : "—"),
    res.value.diff ? kv("diff conservé pour la revue", code(res.value.diff)) : null,
    note(
      res.value.sync === "stale"
        ? "La page a changé : la gamme est marquée désynchronisée. L'exécution en cours garde sa version épinglée."
        : "Empreinte identique : la gamme suit la page.",
      res.value.sync === "stale" ? "ko" : "ok",
    ),
  ]);
};

const recompile = async (state: AppState, gammeId: string, body: string, out: HTMLElement): Promise<void> => {
  const binding = (await state.deps.store.bindings.list((b) => b.gammeId === gammeId))[0];
  const page = binding ? PAGES[binding.pageAri] : undefined;
  if (!page) return;
  const res = await proposeRecompile(state.deps, { gammeId, page: edited(page, body), confirmedBy: human(OWNER) });
  const box = h("div", {});
  out.append(box);
  if (!res.ok) {
    box.append(note(`Recompilation refusée : ${res.error.messageFr}`, "ko"));
    return;
  }
  box.append(
    h("h4", {}, `Nouvelle version v${res.value.version.version} — brouillon, rien n'est republié`),
    kv("état de la gamme", badge(res.value.gamme.state, toneOf(res.value.gamme.state))),
    kv("version courante en service", `v${res.value.gamme.currentVersion}`),
    h("p", {}, "Diff proposé :"),
    code(res.value.diff),
    line(button("Approuver la nouvelle version (referme l'écart)", () => void approveNew(state, res.value.version.id, box), "primary")),
  );
};

const approveNew = async (state: AppState, versionId: string, box: HTMLElement): Promise<void> => {
  const res = await approveVersion(state.deps, { versionId, approver: human(OWNER) });
  box.append(
    res.ok
      ? note(`v${res.value.currentVersion} approuvée : le lien page ↔ gamme repart de cette empreinte, l'écart est refermé.`, "ok")
      : note(`Approbation refusée : ${res.error.messageFr}`, "ko"),
  );
};

const gone = async (state: AppState, gammeId: string, out: HTMLElement, rerender: Rerender): Promise<void> => {
  const binding = (await state.deps.store.bindings.list((b) => b.gammeId === gammeId))[0];
  const page = binding ? PAGES[binding.pageAri] : undefined;
  if (page) {
    // Premier passage : la page est injoignable ; second passage : elle a disparu.
    await checkSync(state.deps, gammeId, { ...page, reachable: false });
  }
  const res = await markSourceGone(state.deps, gammeId);
  out.append(
    h("h4", {}, "Page disparue"),
    res.ok
      ? note(
          `La gamme garde sa dernière version compilée (empreinte ${res.value.contentHash.slice(0, 10)}…), marquée « source disparue ». Elle continue de s'exécuter, et l'absence de source est affichée partout.`,
          "info",
        )
      : note(res.error.messageFr, "ko"),
  );
  rerender();
};
