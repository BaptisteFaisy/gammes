/**
 * Gammes — démo guidée, partie 1 : de la page à la trace.
 *
 * Chaque étape est une fonction du cœur, appelée pour de vrai. Les refus du produit
 * sont des résultats à part entière : c'est même là que la démo est la plus parlante.
 */

import type { TourStep } from "./tour";
import {
  DEPLOY,
  SECRETES,
  adopter,
  attestation,
  compagnon,
  humain,
  page,
  preuveMachine,
  valeur,
  versionCourante,
} from "./tour-helpers";
import { detectCandidates } from "../src/core/detect/detect-candidates";
import { compilePage } from "../src/core/compile/compile-page";
import { approveVersion } from "../src/core/version/versioning";
import { checkBeforeActing } from "../src/core/mcp/search";
import { startRun, recordStep, finishRun } from "../src/core/run/runs";
import { checkSync } from "../src/core/binding/binding";
import { proposeRecompile } from "../src/core/compile/recompile";
import { PAGES } from "../seed/atelier";
import type { Step } from "../src/core/types";

const modifiee = (): typeof PAGES[string] => ({
  ...page(DEPLOY),
  storageBody: page(DEPLOY).storageBody.replace("5 minutes", "15 minutes"),
});

const evidenceFor = (state: Parameters<TourStep["run"]>[0], step: Step) =>
  step.kind === "command" || step.kind === "check" ? preuveMachine(state) : attestation(state);

/** Avance l'exécution avec un humain, jusqu'à l'étape visée (exclue). */
const avancer = async (
  state: Parameters<TourStep["run"]>[0],
  runId: string,
  steps: readonly Step[],
  until: string,
): Promise<void> => {
  for (const step of steps) {
    if (step.id === until) return;
    await recordStep(state.deps, { runId, stepId: step.id, outcome: "done", actor: humain(), evidence: evidenceFor(state, step) });
  }
};

export const TOUR_PART1: readonly TourStep[] = [
  {
    id: "detecter",
    title: "Repérer les pages qui sont des procédures",
    screen: "detecter",
    expect: "Les procédures sont recommandées avec leurs raisons ; la page de compte rendu est écartée.",
    ga: ["GA-01"],
    run: async (state) => {
      const candidates = await detectCandidates(state.deps, Object.values(PAGES));
      const recommandees = candidates.filter((c) => c.recommended);
      const ecartee = candidates.find((c) => !c.recommended);
      return `${candidates.length} pages analysées, ${recommandees.length} recommandées avec leurs raisons ; « ${ecartee?.title ?? "—"} » écartée : aucun signal de procédure.`;
    },
  },
  {
    id: "compiler",
    title: "Compiler la page de déploiement",
    screen: "compiler",
    expect: "Un brouillon et un diff — rien n'est publié. Chaque étape cite son passage source.",
    ga: ["GA-02", "GA-03", "GA-04"],
    run: async (state) => {
      const compiled = valeur(await compilePage(state.deps, { page: page(DEPLOY), confirmedBy: humain() }), "compilation");
      state.gamme = compiled.gamme.code;
      const verrous = compiled.version.steps.filter((s) => s.locks.length > 0).length;
      return `${compiled.gamme.code} v${compiled.version.version} : ${compiled.version.steps.length} étapes (chacune avec son passage source et ses décalages), ${verrous} verrou(x), modèle utilisé : ${compiled.usedModel ? "oui" : "non — extraction 100 % déterministe"}.`;
    },
  },
  {
    id: "secret",
    title: "Une clé glissée dans une étape",
    screen: "compiler",
    expect: "L'étape devient un signalement, l'empreinte et l'aperçu masqué sont affichés, la publication est refusée.",
    ga: ["GA-11"],
    run: async (state) => {
      const compiled = valeur(await compilePage(state.deps, { page: page(SECRETES), confirmedBy: humain() }), "compilation avec secret");
      await adopter(state, compiled.gamme.id);
      const approve = await approveVersion(state.deps, { versionId: compiled.version.id, approver: humain() });
      const refus = approve.ok ? "PUBLICATION ACCEPTÉE (anormal)" : `approbation refusée : ${approve.error.code}`;
      const f = compiled.findings[0];
      return `${compiled.findings.length} signalement(s) — ${f ? `${f.detector}, aperçu « ${f.maskedPreview} », empreinte ${f.fingerprint.slice(0, 8)}…` : "—"}, ${compiled.droppedSteps} étape(s) écartée(s) ; ${refus}.`;
    },
  },
  {
    id: "approuver",
    title: "Approuver : un acte humain daté",
    screen: "gamme",
    expect: "La version est figée, elle porte une date, un nom et une date de révision.",
    ga: ["GA-05", "GA-06"],
    run: async (state) => {
      const version = await versionCourante(state);
      await adopter(state, version.gammeId);
      const approved = valeur(await approveVersion(state.deps, { versionId: version.id, approver: humain() }), "approbation");
      return `v${approved.currentVersion} figée, approuvée le ${approved.approvedAt?.slice(0, 10)} par ${approved.approvedByRef?.slice(0, 18)}… ; révision due le ${approved.reviewDueAt?.slice(0, 10)}.`;
    },
  },
  {
    id: "avant-agir-oui",
    title: "Avant d'agir : il existe une procédure",
    screen: "avant-agir",
    expect: "Le verdict nomme la gamme et sa version, et signale le permis à obtenir.",
    ga: ["GA-14", "GA-26"],
    run: async (state) => {
      const verdict = await checkBeforeActing(state.deps, { intendedAction: "déployer le service paiements en production", service: "paiements" });
      return verdict.found
        ? `« ${verdict.code}@v${verdict.version} » trouvée — ${verdict.permitRequired ? "permis requis pour un agent" : "aucun permis requis"} ; ${verdict.messageFr}`
        : "aucune gamme trouvée";
    },
  },
  {
    id: "avant-agir-non",
    title: "Avant d'agir : personne n'a écrit la procédure",
    screen: "avant-agir",
    expect: "L'app le dit et interdit d'improviser — c'est tout l'intérêt du point d'entrée externe.",
    ga: ["GA-15"],
    run: async (state) => {
      const verdict = await checkBeforeActing(state.deps, { intendedAction: "redémarrer le routeur de secours à 3 h du matin", service: "reseau" });
      return verdict.found ? "inattendu : une gamme a été trouvée" : `« ${verdict.messageFr} »`;
    },
  },
  {
    id: "executer-agent",
    title: "Un agent déroule la gamme",
    screen: "derouler",
    expect: "L'agent acquitte l'étape 1 avec sa preuve, puis bute sur le verrou de permis de l'étape à risque.",
    ga: ["GA-07", "GA-12"],
    run: async (state) => {
      const version = await versionCourante(state);
      const started = valeur(await startRun(state.deps, { code: version.gammeId ? (await state.deps.store.gammes.get(version.gammeId))!.code : "", inputs: { service: "paiements", version_cible: "1.8.2" }, actor: compagnon() }), "démarrage");
      state.runId = started.run.id;
      const steps = [...version.steps].sort((a, b) => a.ord - b.ord);
      const first = steps[0]!;
      await recordStep(state.deps, { runId: started.run.id, stepId: first.id, outcome: "done", actor: compagnon(), evidence: preuveMachine(state) });
      const risky = steps.find((s) => s.locks.some((l) => l.kind === "permit"));
      if (!risky) return "exécution démarrée (aucune étape à risque)";
      const refused = await recordStep(state.deps, { runId: started.run.id, stepId: risky.id, outcome: "done", actor: compagnon(), evidence: preuveMachine(state) });
      const code = refused.ok ? refused.value.refusal?.code ?? "inconnu" : "erreur";
      return `étape 1 acquittée avec sa preuve machine ; étape « ${risky.text.slice(0, 44)} » → REFUS ${code} — l'agent ne franchit pas le verrou, la tentative est tracée.`;
    },
  },
  {
    id: "verrou-humain",
    title: "Le verrou humain refuse l'agent",
    screen: "derouler",
    expect: "L'agent est refusé sur une étape réservée à une personne ; un humain, lui, passe.",
    ga: ["GA-08"],
    run: async (state) => {
      const runId = state.runId;
      if (!runId) throw new Error("aucune exécution en cours");
      const version = await versionCourante(state);
      const steps = [...version.steps].sort((a, b) => a.ord - b.ord);
      const humanStep = steps.find((s) => s.humanOnly);
      if (!humanStep) return "aucune étape réservée à un humain dans cette gamme";
      await avancer(state, runId, steps, humanStep.id);
      const refused = await recordStep(state.deps, { runId, stepId: humanStep.id, outcome: "done", actor: compagnon(), evidence: attestation(state) });
      const code = refused.ok ? refused.value.refusal?.code ?? "inconnu" : "erreur";
      const byHuman = await recordStep(state.deps, { runId, stepId: humanStep.id, outcome: "done", actor: humain(), evidence: attestation(state) });
      const passe = byHuman.ok && byHuman.value.accepted;
      return `étape « ${humanStep.text.slice(0, 44)} » : l'agent reçoit ${code}, la tentative devient une déviation ; la personne authenticate passe : ${passe ? "acquis" : "bloquée"}.`;
    },
  },
  {
    id: "trace",
    title: "La trace citable",
    screen: "derouler",
    expect: "Version, acteur et sa nature, étapes, preuves, déviations, issue — et une citation.",
    ga: ["GA-09"],
    run: async (state) => {
      const runId = state.runId;
      if (!runId) throw new Error("aucune exécution en cours");
      const closed = valeur(await finishRun(state.deps, { runId, outcome: "succeeded" }), "clôture");
      state.runId = undefined;
      return `${closed.citation} — ${closed.steps.length} étapes, ${closed.deviations.length} déviation(s), durée ${closed.durationS} s, acteur : ${closed.actorKind}, issue : ${closed.outcome}.`;
    },
  },
  {
    id: "desynchronisation",
    title: "La page change, la gamme est marquée",
    screen: "liaison",
    expect: "L'empreinte diffère : la gamme est désynchronisée et l'âge de l'écart s'affiche.",
    ga: ["GA-10"],
    run: async (state) => {
      const version = await versionCourante(state);
      const gamme = (await state.deps.store.gammes.get(version.gammeId))!;
      const sync = valeur(await checkSync(state.deps, gamme.id, modifiee()), "contrôle de synchronisation");
      return sync.sync === "stale"
        ? `page modifiée → gamme désynchronisée (écart de ${sync.ageDays ?? 0} jour(s)) ; l'exécution déjà close garde sa version épinglée.`
        : "la page n'a pas changé";
    },
  },
  {
    id: "recompilation",
    title: "Recompilation proposée, pas appliquée",
    screen: "liaison",
    expect: "Un nouveau brouillon et un diff ; la gamme reste désynchronisée tant que personne n'a approuvé.",
    ga: ["GA-10", "GA-05"],
    run: async (state) => {
      const version = await versionCourante(state);
      const gamme = (await state.deps.store.gammes.get(version.gammeId))!;
      const proposed = valeur(await proposeRecompile(state.deps, { gammeId: gamme.id, page: modifiee(), confirmedBy: humain() }), "recompilation");
      state.pendingVersionId = proposed.version.id;
      return `v${proposed.version.version} proposée en brouillon — la version en service reste v${gamme.currentVersion} ; diff de ${proposed.diff.split("\n").length} ligne(s) conservé pour la revue.`;
    },
  },
  {
    id: "refermer-ecart",
    title: "L'approbation referme l'écart",
    screen: "liaison",
    expect: "La nouvelle version approuvée devient la référence : le lien repart de son empreinte.",
    ga: ["GA-06", "GA-10"],
    run: async (state) => {
      const versionId = state.pendingVersionId;
      if (!versionId) throw new Error("aucune version en attente d'approbation");
      const approved = valeur(await approveVersion(state.deps, { versionId, approver: humain() }), "approbation de la v2");
      state.pendingVersionId = undefined;
      const version = await versionCourante(state);
      const gamme = (await state.deps.store.gammes.get(version.gammeId))!;
      const sync = valeur(await checkSync(state.deps, gamme.id, modifiee()), "contrôle final");
      return `v${approved.currentVersion} approuvée (révision due le ${approved.reviewDueAt?.slice(0, 10)}) ; l'écart est refermé : ${sync.sync}.`;
    },
  },
];
