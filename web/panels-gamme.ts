/**
 * Gammes — site public : « Fiche de gamme ».
 *
 * Toute la structure du § 7 sur un écran : identité, provenance, périmètre, entrées,
 * étapes, conditions, repli, acteurs autorisés, mesures — plus les versions immuables,
 * les faits comparables (ce que la détection de conflits compare) et l'effet réel des
 * verrous sur un humain et sur un agent.
 */

import type { AppState } from "./state";
import { OWNER, gammeOptions } from "./state";
import { badge, button, code, details, h, kv, line, list, note, panel, select, table, toneOf } from "./dom";
import { stepsTable } from "./panels-compile";
import { canTransition, deprecateGamme, getGammeByCode, getVersion, isInvocable, listVersions } from "../src/core/version/versioning";
import { evaluateStepLocks } from "../src/core/locks/locks";
import { factsOf } from "../src/core/conflicts/facts";
import { stalenessOf } from "../src/core/binding/binding";
import { human, agent } from "../test/helpers";
import type { Gamme, GammeVersion } from "../src/core/types";
import type { Rerender } from "./types";

export const gammePanel = (state: AppState, rerender: Rerender): HTMLElement => {
  const root = panel("Fiche de gamme (§ 7)");
  const out = h("div", { class: "out" });
  const picker = select([], (v) => { state.gamme = v || undefined; void show(state, out, rerender); }, state.gamme);
  root.append(line(picker, button("Afficher", () => void show(state, out, rerender), "primary")), out);
  void gammeOptions(state).then((options) => {
    picker.replaceChildren(...options.map((o) => {
      const opt = h("option", { value: o.value }, o.label) as HTMLOptionElement;
      if (o.value === state.gamme) opt.selected = true;
      return opt;
    }));
  });
  return root;
};

const show = async (state: AppState, out: HTMLElement, rerender: Rerender): Promise<void> => {
  if (!state.gamme) {
    out.replaceChildren(note("Choisis une gamme — compile d'abord une page si l'atelier est vide.", "info"));
    return;
  }
  const gamme = await getGammeByCode(state.deps, state.gamme);
  if (!gamme) {
    out.replaceChildren(note(`Gamme ${state.gamme} introuvable.`, "ko"));
    return;
  }
  const versionRes = await getVersion(state.deps, gamme.code, state.version);
  const versions = await listVersions(state.deps, gamme.id);
  out.replaceChildren(identityBlock(gamme), provenanceBlock(gamme, versionRes.ok ? versionRes.value : undefined));
  if (!versionRes.ok) {
    out.append(note(versionRes.error.messageFr, "ko"));
    return;
  }
  const version = versionRes.value;
  out.append(scopeBlock(gamme), inputsBlock(version), stepsBlock(version), actorsBlock(version));
  out.append(await locksBlock(state, gamme, version));
  out.append(factsBlock(gamme, version), versionsBlock(versions), transitionsBlock(gamme));
  out.append(actionsBlock(state, gamme, out, rerender));
};

const identityBlock = (gamme: Gamme): HTMLElement =>
  details(
    `Identité — ${gamme.code}`,
    kv("code", h("strong", {}, gamme.code)),
    kv("titre", gamme.title),
    kv("état", badge(gamme.state, toneOf(gamme.state))),
    kv("version courante", `v${gamme.currentVersion}`),
    kv("propriétaire", gamme.ownerRef ?? badge("aucun — file d'adoption", "warn")),
    kv("espace", gamme.spaceKey),
    kv("risque porté", badge(gamme.risk, gamme.risk === "none" ? "idle" : "warn")),
    kv("exclusive", gamme.exclusive ? "oui — une seule exécution à la fois" : "non"),
    kv("liaison page ↔ gamme", badge(gamme.sync, toneOf(gamme.sync))),
    kv("créée le", gamme.createdAt),
    kv("approuvée le", gamme.approvedAt ?? "—"),
    kv("approuvée par", gamme.approvedByRef ?? "—"),
    kv("révision due", gamme.reviewDueAt ?? "—"),
    kv("dépréciée le", gamme.deprecatedAt ?? "—"),
    kv("remplacée par", gamme.replacedBy ?? "—"),
    kv("invocable par un agent", isInvocable(gamme) ? badge("oui", "ok") : badge("non", "ko")),
  );

const provenanceBlock = (gamme: Gamme, version?: GammeVersion): HTMLElement => {
  const binding = version?.sourcePageAri ? `page ${version.sourcePageAri}` : "aucune page source (gamme née de tickets)";
  return details(
    "Provenance — rien n'est affirmé sans sa source",
    kv("page source", binding),
    kv("empreinte du contenu à la compilation", version?.contentHash ? h("code", {}, version.contentHash) : "—"),
    kv("pages citées", list(version?.sourcePages ?? [])),
    kv("compilée le", version?.compiledAt ?? "—"),
    kv("compilée par", version?.compiledBy ?? "—"),
    kv("gammes liées", gamme.code),
  );
};

const scopeBlock = (gamme: Gamme): HTMLElement =>
  details(
    "Périmètre — lu dans le graphe (document, project, software-service)",
    kv("services", list(gamme.scope.services.length ? gamme.scope.services : ["—"])),
    kv("projets", list(gamme.scope.projects.length ? gamme.scope.projects : ["—"])),
    kv("espaces", list(gamme.scope.spaces)),
  );

const inputsBlock = (version: GammeVersion): HTMLElement =>
  details(
    `Entrées, conditions et repli — ${version.inputs.length} entrée(s)`,
    table(["Entrée", "Type", "Obligatoire", "Description"], version.inputs.map((i) => [h("code", {}, i.name), i.type, i.required ? "oui" : "non", i.description ?? "—"])),
    h("h4", {}, "Préconditions vérifiables"),
    list(version.conditions.preconditions.length ? version.conditions.preconditions : ["—"]),
    h("h4", {}, "Postconditions"),
    list(version.conditions.postconditions.length ? version.conditions.postconditions : ["—"]),
    h("h4", {}, "Repli — ce qu'on fait si ça tourne mal"),
    version.fallback.steps.length ? stepsTable(version.fallback.steps) : note(version.fallback.text ?? "Aucun repli écrit.", "info"),
  );

const stepsBlock = (version: GammeVersion): HTMLElement =>
  details(
    `Étapes (${version.steps.length})`,
    stepsTable(version.steps),
    kv("durée estimée", `${version.estimatedDurationS ?? 0} s`),
  );

const actorsBlock = (version: GammeVersion): HTMLElement =>
  details(
    "Acteurs autorisés — par gamme et par étape",
    kv("politique de la gamme", badge(version.actorPolicy, version.actorPolicy === "agent_free" ? "ok" : "warn")),
    table(
      ["Étape", "Réservée à un humain", "Permis requis", "Idempotente", "Conduite en échec", "Délai"],
      version.steps.map((s) => [
        `${s.ord}. ${s.text.slice(0, 48)}`,
        s.humanOnly ? badge("humain seul", "ko") : badge("humain ou agent", "idle"),
        s.locks.find((l) => l.kind === "permit")?.permitClass ?? "—",
        s.idempotent ? "oui" : "non",
        s.onFailure,
        s.timeoutS ? `${s.timeoutS} s` : "—",
      ]),
    ),
  );

const locksBlock = async (state: AppState, gamme: Gamme, version: GammeVersion): Promise<HTMLElement> => {
  const scope = gamme.scope.services[0] ?? gamme.spaceKey;
  const rows: (string | HTMLElement)[][] = [];
  for (const step of version.steps) {
    const asHuman = await evaluateStepLocks(state.deps, { step, actor: human(OWNER), scope });
    const asAgent = await evaluateStepLocks(state.deps, { step, actor: agent(), scope });
    rows.push([
      `${step.ord}. ${step.text.slice(0, 40)}`,
      asHuman.allowed ? badge("passe", "ok") : badge(`refus : ${asHuman.refusal?.code ?? "?"}`, "ko"),
      asAgent.allowed ? badge("passe", "ok") : badge(`refus : ${asAgent.refusal?.code ?? "?"}`, "ko"),
      asAgent.permit ? `${asAgent.permit.result}${asAgent.permit.requestUrl ? ` · ${asAgent.permit.requestUrl}` : ""}` : "—",
    ]);
  }
  return details(
    "Les trois verrous, côté serveur — ce que voient un humain et un agent (§ 9)",
    table(["Étape", "Humain", "Agent", "Vérification de permis"], rows),
  );
};

const factsBlock = (gamme: Gamme, version: GammeVersion): HTMLElement => {
  const facts = factsOf(gamme, version);
  return details(
    `Faits comparables (${facts.length}) — ce que la détection de conflits compare`,
    facts.length
      ? table(["Fait", "Sujet", "Valeur", "Passages cités"], facts.map((f) => [f.kind, h("code", {}, f.subject), f.value, String(f.spans.length)]))
      : note("Aucun fait comparable extrait.", "info"),
  );
};

const versionsBlock = (versions: readonly GammeVersion[]): HTMLElement =>
  details(
    `Versions (${versions.length}) — chacune est immuable`,
    table(
      ["Version", "Compilée", "Approuvée", "Par", "Révision due", "Étapes", "Notes"],
      versions.map((v) => [
        `v${v.version}`,
        v.compiledAt,
        v.approvedAt ?? badge("brouillon", "warn"),
        v.approvedByRef ?? "—",
        v.reviewDueAt ?? "—",
        String(v.steps.length),
        v.notes ?? "—",
      ]),
    ),
  );

const transitionsBlock = (gamme: Gamme): HTMLElement => {
  const states = ["draft", "in_review", "approved", "deprecated"] as const;
  return details(
    "Cycle de vie (§ 14) — les transitions autorisées",
    table(["Depuis", ...states.map((s) => `→ ${s}`)], states.map((from) => [badge(from, toneOf(from)), ...states.map((to) => (canTransition(from, to) ? badge("oui", "ok") : badge("non", "idle")))])),
    note(`État actuel : ${gamme.state}. Déprécier n'est jamais supprimer — les versions et les traces restent lisibles.`),
  );
};

const actionsBlock = (state: AppState, gamme: Gamme, out: HTMLElement, rerender: Rerender): HTMLElement =>
  line(
    button("Déprécier (acte humain)", () => void deprecate(state, gamme, out, rerender), "warn"),
    button("Voir la liaison page ↔ gamme", () => rerender()),
    gamme.state === "deprecated" ? note(`Dépréciée — remplacée par ${gamme.replacedBy ?? "aucune gamme"}.`, "info") : null,
  );

const deprecate = async (state: AppState, gamme: Gamme, out: HTMLElement, rerender: Rerender): Promise<void> => {
  const res = await deprecateGamme(state.deps, { gammeId: gamme.id, by: human(OWNER) });
  out.append(
    res.ok
      ? note(`Gamme ${res.value.code} dépréciée le ${res.value.deprecatedAt}. Lisible par les humains, refusée aux agents.`, "ok")
      : note(`Refusée : ${res.error.messageFr}`, "ko"),
  );
  rerender();
};

/** Âge de l'écart page ↔ gamme, affiché sur la fiche. */
export const stalenessLabel = async (state: AppState, gammeId: string): Promise<string> => {
  const binding = (await state.deps.store.bindings.list((b) => b.gammeId === gammeId))[0];
  if (!binding) return "aucune page liée";
  const age = stalenessOf(binding, state.deps.clock.now());
  return age === undefined ? `synchronisée (${binding.sync})` : `désynchronisée depuis ${age} jour(s)`;
};

export const versionCode = (gamme: Gamme, version?: GammeVersion): string =>
  `${gamme.code}@v${version?.version ?? gamme.currentVersion}`;

export const citationsOf = (version: GammeVersion): string =>
  version.steps.map((s) => `« ${s.source.quote} »`).join(" · ");

export const locksOf = (version: GammeVersion): string =>
  version.steps.flatMap((s) => s.locks.map((l) => l.kind)).join(", ") || "aucun";

export const codesBlock = (version: GammeVersion): HTMLElement => code(version.steps.map((s) => s.command ?? "").filter(Boolean).join("\n"));
