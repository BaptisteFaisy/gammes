/**
 * Gammes — site public : « Compiler ».
 *
 * § 6 étages 2 et 3, GA-02/03/04/11/28 : extraction déterministe avec le passage source
 * exact, qualification (nature, preuve, verrous, risque, conduite en échec), étapes non
 * falsifiables signalées, secrets écartés avec emplacement de remplacement.
 * **Compiler ne publie rien** : brouillon + diff, approbation humaine ensuite.
 */

import type { AppState } from "./state";
import { OWNER, pageOptions, say } from "./state";
import { badge, button, code, details, h, kv, line, list, note, panel, select, table, toneOf } from "./dom";
import { compilePage } from "../src/core/compile/compile-page";
import { approveVersion } from "../src/core/version/versioning";
import { assessFalsifiability } from "../src/core/falsifiable/falsifiability";
import { detectRisk, DEFAULT_RISK_MOTIFS } from "../src/core/risk/risk-motifs";
import { summarizeFindings } from "../src/core/secrets/detectors";
import { PAGES } from "../seed/atelier";
import { human } from "../test/helpers";
import type { GammeVersion, SecretFinding, Step } from "../src/core/types";
import type { Rerender } from "./types";

export const compilePanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Compiler une page en gamme (§ 6 · GA-02/03/04/11/28)");
  const out = h("div", { class: "out" });
  root.append(
    note("Une compilation produit un brouillon et un diff. Rien n'est publié : l'approbation est un acte humain daté."),
    line(
      select(pageOptions(), (v) => { state.page = v; }, state.page),
      button("Compiler", () => void compile(state, out, rerender), "primary"),
    ),
    line(
      button("Compiler la page avec une fausse clé (recette 5)", () => void compileSecret(state, out), "warn"),
      button("Voir les motifs de risque", () => showMotifs(out)),
    ),
    out,
  );
  return root;
};

const showMotifs = (out: HTMLElement): void => {
  out.replaceChildren(
    h("h3", {}, `Les ${DEFAULT_RISK_MOTIFS.length} motifs de risque (GA-04)`),
    note("Les gestes destructifs sont réservés à un humain ; les autres gestes à risque exigent un permis pour un agent."),
    table(
      ["Classe d'actions", "Niveau", "Réservé à un humain", "Libellé", "Motif"],
      DEFAULT_RISK_MOTIFS.map((m) => [
        h("code", {}, m.class),
        badge(m.level, m.level === "critical" ? "ko" : m.level === "high" ? "warn" : "idle"),
        m.humanOnly ? badge("oui", "ko") : badge("non — permis", "idle"),
        m.label,
        h("code", {}, String(m.pattern)),
      ]),
    ),
  );
};

const compileSecret = async (state: AppState, out: HTMLElement): Promise<void> => {
  const page = PAGES["ari:page/creances"];
  if (!page) return;
  const res = await compilePage(state.deps, { page, confirmedBy: human(OWNER) });
  out.replaceChildren(h("h3", {}, "Recette 5 — une clé dans une étape"));
  if (!res.ok) {
    out.append(note(`Compilation refusée : ${res.error.messageFr}`, "ko"));
    return;
  }
  out.append(
    note(`${res.value.findings.length} signalement(s) ouvert(s), ${res.value.droppedSteps} étape(s) écartée(s). La gamme n'est pas publiable tant qu'un signalement est ouvert.`, "ko"),
    findingsTable(res.value.findings),
    h("h4", {}, "Étapes conservées"),
    stepsTable(res.value.version.steps),
    line(button("Tenter d'approuver quand même", () => void tryApprove(state, res.value.version.id, out), "warn")),
  );
};

const tryApprove = async (state: AppState, versionId: string, out: HTMLElement): Promise<void> => {
  const gammeId = (await state.deps.store.versions.get(versionId))?.gammeId ?? "";
  await state.deps.store.gammes.update(gammeId, (g) => ({ ...g, ownerRef: OWNER }));
  const res = await approveVersion(state.deps, { versionId, approver: human(OWNER) });
  out.append(
    res.ok
      ? note("Approuvée — inattendu.", "ko")
      : note(`Refusée : ${res.error.code} — ${res.error.messageFr}`, "ko"),
  );
};

const findingsTable = (findings: readonly SecretFinding[]): HTMLElement =>
  table(
    ["Détecteur", "Nature", "Aperçu masqué", "Empreinte", "Emplacement (décalages)", "Remplacement proposé"],
    findings.map((f) => [
      h("code", {}, f.detector),
      f.kind,
      h("code", {}, f.maskedPreview),
      h("code", {}, f.fingerprint.slice(0, 12) + "…"),
      `${f.where.start}–${f.where.end}`,
      `${f.replacement.kind} → ${f.replacement.target}`,
    ]),
  );

export const stepsTable = (steps: readonly Step[]): HTMLElement =>
  table(
    ["#", "Nature", "Étape", "Preuve exigée", "Verrous", "Risque", "Échec", "Falsifiable"],
    steps.map((s) => [
      String(s.ord),
      badge(s.kind, "idle"),
      h("div", {}, s.text, s.command ? code(s.command) : null),
      `${s.evidence.kind} / ${s.evidence.strength}${s.evidence.required ? " (exigée)" : " (facultative)"}`,
      s.locks.length ? list(s.locks.map((l) => badge(l.kind === "human" ? "humain" : l.kind === "permit" ? `permis ${l.permitClass ?? ""}` : "secret", l.kind === "human" ? "ko" : "warn"))) : "—",
      s.riskClass ? [badge(s.risk, s.risk === "critical" ? "ko" : "warn"), ` ${s.riskClass}`] : badge("none", "idle"),
      s.onFailure,
      s.falsifiable ? badge("oui", "ok") : badge("non", "ko"),
    ]),
  );

const compile = async (state: AppState, out: HTMLElement, rerender: Rerender): Promise<void> => {
  const page = PAGES[state.page];
  if (!page) return;
  const res = await compilePage(state.deps, { page, confirmedBy: human(OWNER) });
  if (!res.ok) {
    out.replaceChildren(note(`Compilation refusée : ${res.error.code} — ${res.error.messageFr}`, "ko"));
    return;
  }
  const { gamme, version, diff, findings, nonFalsifiable, usedModel, droppedSteps } = res.value;
  state.gamme = gamme.code;
  out.replaceChildren(
    h("h3", {}, `Brouillon ${gamme.code} · v${version.version}`),
    kv("état", badge(gamme.state, toneOf(gamme.state))),
    kv("modèle utilisé", usedModel ? "oui (prose ambiguë seulement)" : "non — extraction 100 % déterministe"),
    kv("étapes retenues", String(version.steps.length)),
    kv("étapes écartées (secret)", String(droppedSteps)),
    kv("signalements de secret", String(findings.length)),
    kv("durée estimée", `${version.estimatedDurationS ?? 0} s`),
    kv("exclusive", version.exclusive ? "oui (une seule exécution à la fois)" : "non"),
    kv("acteurs autorisés", version.actorPolicy),
    h("h4", {}, "Diff"),
    code(diff),
  );
  out.append(inputsBlock(version), stepsBlock(version), findings.length ? findingsTable(findings) : note("Aucun secret détecté.", "ok"));
  out.append(falsifiableBlock(nonFalsifiable, version.steps));
  out.append(
    h("h4", {}, "Passer en revue"),
    line(
      button("Approuver (acte humain daté)", () => void approve(state, gamme.id, version.id, out, rerender), "primary"),
      button("Voir la fiche de la gamme", () => rerender()),
    ),
  );
};

const inputsBlock = (version: GammeVersion): HTMLElement =>
  details(
    `Entrées typées (${version.inputs.length}), préconditions (${version.conditions.preconditions.length}), repli (${version.fallback.steps.length})`,
    table(["Entrée", "Type", "Obligatoire", "Description"], version.inputs.map((i) => [h("code", {}, i.name), i.type, i.required ? "oui" : "non", i.description ?? "—"])),
    h("h4", {}, "Préconditions"),
    list(version.conditions.preconditions.length ? version.conditions.preconditions : ["—"]),
    h("h4", {}, "Postconditions"),
    list(version.conditions.postconditions.length ? version.conditions.postconditions : ["—"]),
    h("h4", {}, "Repli"),
    version.fallback.steps.length ? stepsTable(version.fallback.steps) : note(version.fallback.text ?? "Aucun repli écrit dans la page.", "info"),
  );

const stepsBlock = (version: GammeVersion): HTMLElement =>
  details(
    `Étapes (${version.steps.length}) — chacune cite son passage source`,
    stepsTable(version.steps),
    h("h4", {}, "Provenance : passages cités"),
    table(
      ["#", "Passage cité", "Emplacement dans la page"],
      version.steps.map((s) => [String(s.ord), h("span", { class: "quote" }, `« ${s.source.quote} »`), h("code", {}, `${s.source.pageAri}:${s.source.start}-${s.source.end}`)]),
    ),
  );

const falsifiableBlock = (nonFalsifiable: readonly string[], steps: readonly Step[]): HTMLElement => {
  const vague = steps.filter((s) => !s.falsifiable);
  return details(
    `Étapes non falsifiables (${vague.length}) — le défaut n° 1 des runbooks (GA-28)`,
    nonFalsifiable.length === 0
      ? note("Toutes les étapes sont vérifiables.", "ok")
      : table(
          ["Étape", "Diagnostic", "Reformulation proposée"],
          vague.map((s) => [s.text, s.falsifiabilityNote ?? assessFalsifiability(s.text).note ?? "—", s.rewording ?? "—"]),
        ),
  );
};

const approve = async (state: AppState, gammeId: string, versionId: string, out: HTMLElement, rerender: Rerender): Promise<void> => {
  await state.deps.store.gammes.update(gammeId, (g) => ({ ...g, ownerRef: g.ownerRef ?? OWNER }));
  const res = await approveVersion(state.deps, { versionId, approver: human(OWNER) });
  // `rerender` replace l'écran : le message passe par l'état, sinon il est effacé aussitôt affiché.
  if (res.ok) say(state, `Approuvée : version v${res.value.currentVersion} figée, révision due le ${res.value.reviewDueAt}.`);
  else say(state, `Approbation refusée : ${res.error.code} — ${res.error.messageFr}`);
  out.append(
    res.ok
      ? note(`Approuvée : version v${res.value.currentVersion} figée, révision due le ${res.value.reviewDueAt}.`, "ok")
      : note(`Approbation refusée : ${res.error.code} — ${res.error.messageFr}`, "ko"),
  );
  rerender();
};

/** Outil de diagnostic : ce que les règles disent d'un texte libre. */
export const riskProbe = (text: string): string => {
  const motif = detectRisk(text);
  return motif ? `${motif.class} (${motif.level}) — ${motif.label}` : "aucun risque reconnu";
};

export const findingsSummary = (findings: readonly SecretFinding[]): string =>
  summarizeFindings(findings).map((s) => `${s.detector} ×${s.count}`).join(", ") || "aucun";
