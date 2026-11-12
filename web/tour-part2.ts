/**
 * Gammes — démo guidée, partie 2 : mesurer, corriger, outiller les agents.
 *
 * Chaque étape produit un état **réel** : les statistiques, l'amendement, le conflit, le
 * fantôme, l'export existent ensuite dans l'atelier, consultables et contestables.
 */

import type { TourStep } from "./tour";
import {
  DEPLOY,
  DEPLOY_B,
  adopter,
  attestation,
  compagnon,
  humain,
  page,
  preuveMachine,
  taux,
  valeur,
  versionCourante,
} from "./tour-helpers";
import { computeStepStats, compareVersions } from "../src/core/stats/step-stats";
import { delegableSteps } from "../src/integrations/delegable-ou-pas";
import { proposeFromTraces, decideAmendment } from "../src/core/amendments/amendments";
import { proposeRecompile } from "../src/core/compile/recompile";
import { seedTraces } from "../seed/atelier";
import { detectGhosts, adoptGhost } from "../src/core/ghosts/ghosts";
import { compilePage } from "../src/core/compile/compile-page";
import { approveVersion } from "../src/core/version/versioning";
import { detectConflicts } from "../src/core/conflicts/detect";
import { conciliate, decideConciliation } from "../src/core/conciliation/hermes";
import { handleTool } from "../src/core/mcp/tools";
import { exportSkillMd } from "../src/core/export/skill-md";
import { findProcedure } from "../src/core/mcp/search";
import { coverageDetail } from "../src/core/coverage/coverage";
import { freshness } from "../src/core/stats/workshop";
import { DEFAULT_RISK_MOTIFS } from "../src/core/risk/risk-motifs";
import { DEFAULT_SECRET_DETECTORS as SECRET_DETECTORS } from "../src/core/secrets/detectors";

const versionDe = async (state: Parameters<TourStep["run"]>[0], numero: number) => {
  const version = await versionCourante(state);
  const gamme = (await state.deps.store.gammes.get(version.gammeId))!;
  const versions = await state.deps.store.versions.list((v) => v.gammeId === gamme.id);
  const found = versions.find((v) => v.version === numero);
  if (!found) throw new Error(`version v${numero} introuvable`);
  return found;
};

export const TOUR_PART2: readonly TourStep[] = [
  {
    id: "mesures",
    title: "Mesurer : 40 exécutions, une étape qui échoue six fois sur dix",
    screen: "mesures",
    expect: "Le taux est publié avec son effectif et sa fourchette ; l'étape fautive est repérée.",
    ga: ["GA-19"],
    run: async (state) => {
      const version = await versionCourante(state);
      const gamme = (await state.deps.store.gammes.get(version.gammeId))!;
      const stepId = version.steps[1]?.id ?? version.steps[0]!.id;
      await seedTraces(state.deps, {
        gammeId: gamme.id, code: gamme.code, versionId: version.id, n: 40, failures: 24, stepId,
        stepIds: version.steps.map((s) => s.id),
      });
      const stats = await computeStepStats(state.deps, { code: gamme.code, version: version.version });
      const worst = stats.find((s) => s.stepId === stepId);
      return `40 exécutions semées ; l'étape la plus faible : ${worst ? taux(worst.failRate) : "—"} — une étape qui échoue 6 fois sur 10 n'est pas difficile, elle est fausse.`;
    },
  },
  {
    id: "pas-assez-de-recul",
    title: "Trois exécutions : pas assez de recul",
    screen: "mesures",
    expect: "Aucun pourcentage n'est publié ; l'app affiche l'effectif et le seuil.",
    ga: ["GA-19", "GA-21"],
    run: async (state) => {
      const v1 = await versionDe(state, 1);
      const gamme = (await state.deps.store.gammes.get(v1.gammeId))!;
      await seedTraces(state.deps, { gammeId: gamme.id, code: gamme.code, versionId: v1.id, n: 3, failures: 2, stepId: v1.steps[0]!.id });
      const stats = await computeStepStats(state.deps, { code: gamme.code, version: 1 });
      const small = stats.find((s) => s.stepId === v1.steps[0]!.id);
      return small ? `version v1 : ${taux(small.failRate)} — aucun pourcentage inventé sous le seuil de ${small.failRate.cohort.n}/${DEFAULT_THRESHOLD_HINT}.` : "—";
    },
  },
  {
    id: "amendement",
    title: "L'amendement proposé, preuves à l'appui",
    screen: "amendements",
    expect: "Une proposition, sa raison, et les exécutions qui la fondent.",
    ga: ["GA-20"],
    run: async (state) => {
      const version = await versionCourante(state);
      const gamme = (await state.deps.store.gammes.get(version.gammeId))!;
      const proposed = valeur(await proposeFromTraces(state.deps, { code: gamme.code }), "proposition d'amendement");
      if (proposed.length === 0) return "aucun amendement proposé (pas assez de recul, ou proposition déjà ouverte)";
      state.amendmentId = proposed[0]!.id;
      const first = proposed[0]!;
      return `« ${first.proposal.slice(0, 90) } » — ${first.evidenceRefs.length} preuve(s) jointe(s) ; ${first.rationale.slice(0, 90)}.`;
    },
  },
  {
    id: "amendement-decide",
    title: "Un humain décide de l'amendement",
    screen: "amendements",
    expect: "La décision est datée et nommée ; l'amendement n'est jamais appliqué seul.",
    ga: ["GA-20"],
    run: async (state) => {
      const id = state.amendmentId;
      if (!id) return "aucun amendement à décider";
      const decided = valeur(await decideAmendment(state.deps, { id, decision: "accepted", by: humain() }), "décision");
      return `amendement ${decided.state} le ${decided.decidedAt?.slice(0, 10)} par ${decided.decidedByRef?.slice(0, 18)}… ; la modification de la page est proposée à son propriétaire, pas appliquée.`;
    },
  },
  {
    id: "comparaison",
    title: "Comparer deux versions",
    screen: "mesures",
    expect: "Les deux taux, leurs effectifs, et un verdict net sur l'amendement.",
    ga: ["GA-24"],
    run: async (state) => {
      const version = await versionCourante(state);
      const gamme = (await state.deps.store.gammes.get(version.gammeId))!;
      const stepId = version.steps[1]?.id ?? version.steps[0]!.id;
      const v3 = valeur(await proposeRecompile(state.deps, { gammeId: gamme.id, page: page(DEPLOY), confirmedBy: humain() }), "v3");
      await adopter(state, gamme.id);
      valeur(await approveVersion(state.deps, { versionId: v3.version.id, approver: humain() }), "approbation v3");
      await seedTraces(state.deps, {
        gammeId: gamme.id, code: gamme.code, versionId: v3.version.id, n: 40, failures: 8, stepId,
        stepIds: v3.version.steps.map((s) => s.id),
      });
      const comparison = await compareVersions(state.deps, gamme.code, 2, 3);
      return `v2 : ${taux(comparison.left.failRate)} · v3 : ${taux(comparison.right.failRate)} → verdict « ${comparison.verdict} » : l'amendement a-t-il amélioré quelque chose ?`;
    },
  },
  {
    id: "delegable",
    title: "Quelles étapes sont fiables pour un agent",
    screen: "mesures",
    expect: "Les cohortes décident : une étape trop souvent en échec revient à un humain.",
    ga: ["GA-21"],
    run: async (state) => {
      const version = await versionCourante(state);
      const gamme = (await state.deps.store.gammes.get(version.gammeId))!;
      const stats = await computeStepStats(state.deps, { code: gamme.code, version: version.version });
      const verdicts = delegableSteps(stats);
      const count = (v: string) => verdicts.filter((x) => x.verdict === v).length;
      return `${count("delegable")} étape(s) délégable(s) à un agent, ${count("needs_human")} à garder humaines, ${count("not_enough_history")} sans recul suffisant.`;
    },
  },
  {
    id: "fantomes",
    title: "Des gestes répétés que personne n'a écrits",
    screen: "fantomes",
    expect: "Le motifRepeated, son étalement, sa durée médiane, son coût — et un effectif, jamais un nom.",
    ga: ["GA-22"],
    run: async (state) => {
      const ghosts = await detectGhosts(state.deps, { projectKey: "PAY", limit: 10 });
      if (ghosts.length === 0) return "aucun motif détecté";
      const ghost = ghosts[0]!;
      state.ghostId = ghost.id;
      return `« ${ghost.label} » : ${ghost.n} tickets semblables sur ${ghost.spanDays} jours, durée médiane ${ghost.medianHandleH} h, coût estimé ${ghost.costDays} jours, ${ghost.peopleCount} personne(s) — un effectif, jamais un nom.`;
    },
  },
  {
    id: "adopter-fantome",
    title: "Adopter un fantôme : un brouillon, pas une publication",
    screen: "fantomes",
    expect: "Un brouillon pré-rempli depuis les commentaires les plus constants, à compléter par un humain.",
    ga: ["GA-22"],
    run: async (state) => {
      const ghostId = state.ghostId;
      if (!ghostId) return "aucun fantôme à adopter";
      const gamme = valeur(await adoptGhost(state.deps, ghostId, humain()), "adoption");
      const versions = await state.deps.store.versions.list((v) => v.gammeId === gamme.id);
      state.gamme = gamme.code;
      return `brouillon ${gamme.code} créé, pré-rempli avec ${versions[0]?.steps.length ?? 0} étape(s) issues des commentaires les plus constants ; l'adoption est un acte humain, l'approbation reste à faire.`;
    },
  },
  {
    id: "conflits",
    title: "Deux gammes qui prescrivent l'incompatible",
    screen: "conflits",
    expect: "Les trois familles de conflits, avec les passages cités de part et d'autre.",
    ga: ["GA-23"],
    run: async (state) => {
      const compiled = valeur(await compilePage(state.deps, { page: page(DEPLOY_B), confirmedBy: humain() }), "compilation de la variante");
      await adopter(state, compiled.gamme.id);
      valeur(await approveVersion(state.deps, { versionId: compiled.version.id, approver: humain() }), "approbation de la variante");
      const conflicts = await detectConflicts(state.deps, { service: "paiements" });
      const kinds = [...new Set(conflicts.map((c) => c.kind))];
      state.conflictId = conflicts[0]?.id;
      const first = conflicts[0];
      return `${conflicts.length} conflit(s) détectés (${kinds.join(", ")}), déterministes et sans modèle ; sur « ${first?.facts[0]?.subject ?? "—"} », les deux passages sont cités : « ${first?.facts[0]?.leftSpan?.quote.slice(0, 40) ?? "—"} » / « ${first?.facts[0]?.rightSpan?.quote.slice(0, 40) ?? "—"} ».`;
    },
  },
  {
    id: "concilier",
    title: "Le conciliateur hermes prépare le dossier — il ne tranche pas",
    screen: "conflits",
    expect: "Un résumé et des options ; la décision reste humaine.",
    ga: ["GA-23"],
    run: async (state) => {
      const conflictId = state.conflictId;
      if (!conflictId) return "aucun conflit à concilier";
      const dossier = valeur(await conciliate(state.deps, conflictId), "conciliateur");
      const option = dossier.options[0];
      if (!option) return "dossier sans option";
      const decided = valeur(await decideConciliation(state.deps, dossier.id, option.id, humain()), "décision de conciliation");
      return `dossier « ${dossier.summary.slice(0, 80) } » — ${dossier.options.length} option(s) ; l'option retenue est${decided.decidedOptionId ? " choisie" : " en attente"} ; chaque option exige une décision humaine.`;
    },
  },
  {
    id: "mcp",
    title: "Les 16 outils MCP, appelé pour de vrai",
    screen: "mcp",
    expect: "Le même dispatch que les agents et le CI : verdict, trace, contrat d'export.",
    ga: ["GA-14"],
    run: async (state) => {
      const version = await versionCourante(state);
      const gamme = (await state.deps.store.gammes.get(version.gammeId))!;
      const before = valeur(await handleTool(state.deps, "check-before-acting", { intendedAction: "déployer paiements", service: "paiements" }), "check-before-acting");
      const procedures = valeur(await handleTool(state.deps, "list-procedures", { state: "approved" }), "list-procedures");
      const stats = valeur(await handleTool(state.deps, "get-procedure-stats", { code: gamme.code }), "get-procedure-stats");
      const found = (before as { found?: boolean; code?: string }).found ? (before as { code: string }).code : "—";
      return `check-before-acting → ${found} ; list-procedures → ${(procedures as unknown[]).length} gamme(s) ; get-procedure-stats → ${(stats as unknown[]).length} ligne(s) de statistiques ; 16 outils exposés, un seul dispatch.`;
    },
  },
  {
    id: "skill",
    title: "Exporter le SKILL.md de la gamme",
    screen: "skill",
    expect: "Un fichier téléchargeable, la version citée, aucun secret.",
    ga: ["GA-13"],
    run: async (state) => {
      const version = await versionCourante(state);
      const gamme = (await state.deps.store.gammes.get(version.gammeId))!;
      const exported = valeur(await exportSkillMd(state.deps, { code: gamme.code }), "export");
      return `SKILL.md de ${gamme.code} : ${exported.skillMd.length} caractères, empreinte ${exported.hash.slice(0, 12)}…, version citée, aucun secret ; le skill générique et le prompt de l'agent sont affichés tels quels.`;
    },
  },
  {
    id: "encarts",
    title: "L'encart Jira et la macro Confluence",
    screen: "encarts",
    expect: "Quelle gamme s'applique au ticket, et l'état de la gamme dans sa page.",
    ga: ["GA-16", "GA-17"],
    run: async (state) => {
      const matches = await findProcedure(state.deps, { query: "réinitialiser le coffre de clés du service paiements", context: { service: "paiements" } });
      const version = await versionCourante(state);
      const gamme = (await state.deps.store.gammes.get(version.gammeId))!;
      const runs = await state.deps.store.runs.list((r) => r.gammeId === gamme.id);
      return `encart Jira : ${matches.length} gamme(s) applicable(s) ; la macro affiche l'état « ${gamme.state} », la version v${gamme.currentVersion}, ${runs.length} exécution(s) et la fraîcheur — la page dit si elle est outillée.`;
    },
  },
  {
    id: "journal",
    title: "Le journal d'audit, append-only",
    screen: "journal",
    expect: "Chaque acte d'autorité est daté, nommé, jamais modifié.",
    ga: ["GA-09"],
    run: async (state) => {
      const events = await state.deps.store.events();
      const kinds = new Set(events.map((e) => e.kind));
      return `${events.length} événement(s) journalisés, ${kinds.size} types d'acte distincts ; aucun n'est modifié ni supprimé — déprécier n'est pas effacer.`;
    },
  },
  {
    id: "atelier",
    title: "La couverture, la fraîcheur, le budget",
    screen: "atelier",
    expect: "Ce qui est réellement compilé, tracé, synchronisé — et ce que le modèle a coûté.",
    ga: ["GA-18"],
    run: async (state) => {
      const coverage = await coverageDetail(state.deps, "*");
      const fresh = await freshness(state.deps);
      const budget = state.deps.budget.snapshot();
      return `${coverage.pagesDetected} page(s) détectée(s), ${coverage.compiledPct} % compilé(s), ${coverage.tracedPct} % tracé(s) ; ${fresh.syncedPct} % synchronisé(s), ${fresh.staleOver90d} désynchronisée(s) depuis plus de 90 jours ; budget modèle : ${budget.llmCalls} appel(s), ${budget.tokens} jetons.`;
    },
  },
  {
    id: "reglages",
    title: "Les réglages qui pilotent tout cela",
    screen: "reglages",
    expect: "Seuils, pages de politique, motifs de risque, détecteurs de secrets : chaque réglage a un effet mesurable.",
    ga: ["GA-19"],
    run: async (state) => {
      const settings = await state.deps.store.settings.get("SRE");
      if (!settings) return "aucun réglage d'espace";
      return `espace ${settings.spaceKey} : seuil ${settings.statThreshold} exécutions, politique de verrous « ${settings.lockPolicy} », révision à ${settings.reviewAfterDays} j, poussière à ${settings.dustAfterDays} j, ${settings.policyPages.length} page(s) de politique ; ${DEFAULT_RISK_MOTIFS.length} motifs de risque, ${SECRET_DETECTORS.length} détecteurs de secrets.`;
    },
  },
];

const DEFAULT_THRESHOLD_HINT = 30;
