/**
 * Gammes — site public : « Conflits » et « Fantômes ».
 *
 * § 13, GA-23 : deux gammes (ou une gamme et une page de politique) qui prescrivent
 * l'incompatible sont portées aux deux propriétaires, passages sources cités de part et
 * d'autre. Le conciliateur hermes prépare un dossier ; **l'app ne tranche jamais**.
 * § 12, GA-22 : les gestes répétés jamais écrits, avec leurs preuves et leur coût —
 * un effectif de personnes, jamais un nom.
 */

import type { AppState } from "./state";
import { OWNER, say } from "./state";
import { append, badge, button, code, details, field, h, kv, line, list, note, panel, select, table } from "./dom";
import { acknowledgeConflict, detectConflicts, resolveConflict } from "../src/core/conflicts/detect";
import { conciliate as conciliateConflict, decideConciliation, HERMES_CONDUCT } from "../src/core/conciliation/hermes";
import { adoptGhost, detectGhosts, HOURS_PER_DAY, MIN_CLUSTER_SIZE } from "../src/core/ghosts/ghosts";
import { TICKETS } from "../seed/atelier";
import { human, agent } from "../test/helpers";
import type { Rerender } from "./types";

export const conflitsPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Conflits entre procédures (§ 13 · GA-23)");
  const out = h("div", { class: "out" });
  root.append(
    note("Un conflit n'est jamais tranché par l'app : il est porté aux deux propriétaires, avec les passages sources cités de part et d'autre. Le conciliateur prépare un dossier, un humain décide."),
    line(
      select(
        [
          { value: "", label: "tous les services" },
          { value: "paiements", label: "service : paiements" },
          { value: "staging", label: "service : staging" },
        ],
        (v) => { state.service = v; },
        state.service,
      ),
      button("Détecter les conflits", () => void detect(state, out), "primary"),
      button("Voir la conduite du conciliateur", () => out.append(details("HERMES_CONDUCT", code(HERMES_CONDUCT)))),
    ),
    out,
  );
  return root;
};

const detect = async (state: AppState, out: HTMLElement): Promise<void> => {
  const conflicts = await detectConflicts(state.deps, state.service ? { service: state.service } : {});
  out.replaceChildren(h("h3", {}, `${conflicts.length} conflit(s) — détection déterministe, sans modèle`));
  if (conflicts.length === 0) {
    out.append(note("Aucun conflit. Compile et approuve deux gammes du même service pour en provoquer un.", "info"));
    return;
  }
  for (const conflict of conflicts) {
    append(out, [
      h("h4", {}, `${conflict.kind} · ${conflict.gammeA} ↔ ${conflict.gammeB ?? conflict.policyPageAri ?? "?"}`),
      kv("état", badge(conflict.state, conflict.state === "resolved" ? "ok" : "warn")),
      kv("service", conflict.service ?? "—"),
      kv("porté le", conflict.raisedAt),
      table(
        ["Sujet", "À gauche", "Passage cité", "À droite", "Passage cité"],
        conflict.facts.map((f) => [
          h("code", {}, f.subject),
          f.left,
          f.leftSpan ? h("span", { class: "quote" }, `« ${f.leftSpan.quote} »`) : "—",
          f.right,
          f.rightSpan ? h("span", { class: "quote" }, `« ${f.rightSpan.quote} »`) : "—",
        ]),
      ),
      line(
        button("Préparer le dossier (hermes)", () => void conciliate(state, conflict.id, out), "primary"),
        button("Prendre en compte (humain)", () => void ack(state, conflict.id, out)),
        button("Trancher (humain)", () => void resolve(state, conflict.id, out)),
      ),
    ]);
  }
};

const conciliate = async (state: AppState, conflictId: string, out: HTMLElement): Promise<void> => {
  const res = await conciliateConflict(state.deps, conflictId);
  if (!res.ok) {
    out.append(note(`Conciliateur indisponible : ${res.error.messageFr}`, "ko"));
    return;
  }
  const dossier = res.value;
  out.append(
    h("h4", {}, `Dossier ${dossier.id} — moteur ${dossier.engine}, modèle ${dossier.model}`),
    kv("résumé", dossier.summary),
    note("Aucune option n'est appliquée : chaque option porte `requiresHuman: true`. La décision est humaine, datée et nommée.", "info"),
    table(
      ["Option", "Conséquences", "Concerne", "Décision"],
      dossier.options.map((o) => [
        h("strong", {}, o.title),
        o.detail,
        list(o.affects),
        line(
          button("Choisir (humain)", () => void decide(state, dossier.id, o.id, out)),
          button("Tenter en agent", () => void decideAsAgent(state, dossier.id, o.id, out), "warn"),
        ),
      ]),
    ),
  );
};

const decide = async (state: AppState, id: string, optionId: string, out: HTMLElement): Promise<void> => {
  const res = await decideConciliation(state.deps, id, optionId, human(OWNER));
  out.append(res.ok ? note(`Option retenue par ${OWNER} le ${state.deps.clock.now()}. Le conflit reste à trancher par ses propriétaires.`, "ok") : note(res.error.messageFr, "ko"));
};

const decideAsAgent = async (state: AppState, id: string, optionId: string, out: HTMLElement): Promise<void> => {
  const res = await decideConciliation(state.deps, id, optionId, agent());
  out.append(res.ok ? note("Inattendu : un agent a décidé.", "ko") : note(`Refusé à un agent : ${res.error.code} — ${res.error.messageFr}`, "ok"));
};

const ack = async (state: AppState, id: string, out: HTMLElement): Promise<void> => {
  const res = await acknowledgeConflict(state.deps, id, human(OWNER));
  out.append(res.ok ? note(`Conflit pris en compte, état ${res.value.state}.`, "ok") : note(res.error.messageFr, "ko"));
};

const resolve = async (state: AppState, id: string, out: HTMLElement): Promise<void> => {
  const res = await resolveConflict(state.deps, id, human(OWNER), "les deux propriétaires s'alignent sur la politique de déploiement");
  out.append(res.ok ? note(`Conflit tranché le ${res.value.resolvedAt} : ${res.value.resolutionNote}`, "ok") : note(res.error.messageFr, "ko"));
};

/** Fantômes : le travail répété que personne n'a écrit. */
export const fantomesPanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Gammes fantômes (§ 12 · GA-22)");
  const out = h("div", { class: "out" });
  root.append(
    note(
      `L'app cherche les motifs répétés dans Jira/JSM : au moins ${MIN_CLUSTER_SIZE} tickets semblables. ` +
        `Le coût estimé compte ${HOURS_PER_DAY} h par jour. L'effectif de personnes est une borne basse — jamais un nom, jamais un classement.`,
    ),
    line(
      field("projet", "PAY", (v) => { state.projectKey = v; }),
      button("Chercher les motifs répétés", () => void ghosts(state, out, rerender), "primary"),
    ),
    kv("tickets disponibles dans la démo", String(TICKETS.length)),
    out,
  );
  return root;
};

const ghosts = async (state: AppState, out: HTMLElement, rerender: Rerender): Promise<void> => {
  const found = await detectGhosts(state.deps, { projectKey: state.projectKey || undefined, limit: 20 });
  out.replaceChildren(h("h3", {}, `${found.length} motif(s) répété(s) sans procédure écrite`));
  if (found.length === 0) {
    out.append(note("Aucun motif : soit trop peu de tickets semblables, soit une gamme couvre déjà ce travail.", "info"));
    return;
  }
  for (const ghost of found) {
    out.append(
      h("h4", {}, ghost.label),
      table(
        ["Preuve", "Valeur"],
        [
          ["tickets semblables", String(ghost.n)],
          ["étalement", `${ghost.spanDays} jours`],
          ["durée médiane de traitement", `${ghost.medianHandleH} h`],
          ["personnes différentes (effectif, jamais un nom)", String(ghost.peopleCount)],
          ["coût estimé", `${ghost.costDays} jours`],
          ["clé de regroupement", h("code", {}, ghost.clusterKey)],
          ["échantillon de tickets", h("code", {}, ghost.sampleIssueIds.join(", "))],
          ["état", badge(ghost.state, ghost.state === "proposed" ? "warn" : "ok")],
        ],
      ),
      line(button("Adopter et ouvrir un brouillon (humain)", () => void adopt(state, ghost.id, out, rerender), "primary"), button("Tenter en agent", () => void adoptAsAgent(state, ghost.id, out), "warn")),
    );
  }
};

const adopt = async (state: AppState, ghostId: string, out: HTMLElement, rerender: Rerender): Promise<void> => {
  const res = await adoptGhost(state.deps, ghostId, human(OWNER));
  if (!res.ok) {
    out.append(note(res.error.messageFr, "ko"));
    return;
  }
  const versions = await state.deps.store.versions.list((v) => v.gammeId === res.value.id);
  const message = `Brouillon ${res.value.code} créé, pré-rempli depuis les commentaires les plus constants (${versions[0]?.steps.length ?? 0} étapes). À compléter puis approuver par un humain.`;
  say(state, message);
  append(out, [
    note(message, "ok"),
    versions[0] ? table(["#", "Étape pré-remplie", "Provenance"], versions[0].steps.map((s) => [String(s.ord), s.text, h("code", {}, s.source.pageAri)])) : null,
  ]);
  state.gamme = res.value.code;
  rerender();
};

const adoptAsAgent = async (state: AppState, ghostId: string, out: HTMLElement): Promise<void> => {
  const res = await adoptGhost(state.deps, ghostId, agent());
  out.append(res.ok ? note("Inattendu : un agent a adopté un fantôme.", "ko") : note(`Refusé à un agent : ${res.error.code} — l'adoption est humaine.`, "ok"));
};
