/**
 * Gammes — la trace (§ 8, GA-09).
 *
 * La trace est la preuve, et elle est citable : « le 3 mars, quand on a déployé en
 * urgence, quelle procédure a été suivie, par qui, jusqu'où, et avec quelle preuve ? »
 * Elle nomme un acteur pour l'audit et sa **nature** (humain ou agent) ; elle ne
 * contient aucune mesure par personne et aucune valeur de secret — seulement des
 * références de preuve.
 */

import type { Deps } from "../ports";
import type { Lang, Run, RunStep, Step, Trace, TraceStep } from "../types";
import { secondsBetween } from "../../platform/clock";

/** Forme citable : `GAM-deploy-01@v7 · run_3`. */
export const citeRun = (run: Run): string => `${run.code}@v${run.pinnedVersion} · ${run.id}`;

const byOrdinal = (a: Step | undefined, b: Step | undefined): number => (a?.ord ?? 0) - (b?.ord ?? 0);

const traceStepOf = (runStep: RunStep, step: Step | undefined, index: number): TraceStep => ({
  ord: step?.ord ?? index + 1,
  stepId: runStep.stepId,
  text: step?.text ?? `étape ${runStep.stepId} (version illisible)`,
  state: runStep.state,
  ...(runStep.evidence ? { evidence: runStep.evidence } : {}),
  ...(runStep.refusedReason ? { refusedReason: runStep.refusedReason } : {}),
  ...(runStep.durationS !== undefined ? { durationS: runStep.durationS } : {}),
});

/** Construit la vue citable d'une exécution, à partir de la version épinglée. */
export const buildTrace = async (deps: Deps, run: Run): Promise<Trace> => {
  const version = await deps.store.versions.get(run.versionId);
  const steps = version?.steps ?? [];
  const ordered = [...run.steps].sort((a, b) =>
    byOrdinal(steps.find((s) => s.id === a.stepId), steps.find((s) => s.id === b.stepId)),
  );
  const until = run.finishedAt ?? deps.clock.now();
  return {
    runId: run.id,
    code: run.code,
    version: run.pinnedVersion,
    actorKind: run.actor.kind,
    startedAt: run.startedAt,
    ...(run.finishedAt ? { finishedAt: run.finishedAt } : {}),
    ...(run.outcome ? { outcome: run.outcome } : {}),
    mode: run.mode,
    steps: ordered.map((runStep, index) =>
      traceStepOf(runStep, steps.find((s) => s.id === runStep.stepId), index),
    ),
    deviations: run.deviations,
    links: run.links,
    durationS: secondsBetween(run.startedAt, until),
    citation: citeRun(run),
  };
};

const LABELS: Record<Lang, Record<string, string>> = {
  fr: {
    trace: "Trace",
    actor: "Acteur",
    human: "humain",
    agent: "agent",
    mode: "Mode",
    normal: "normal",
    emergency: "urgences (dégradé)",
    outcome: "Issue",
    started: "Démarrée",
    finished: "Close",
    duration: "Durée",
    steps: "Étapes",
    deviations: "Déviations",
    links: "Rattachements",
    evidence: "preuve",
    refused: "refus",
    pending: "en attente",
    current: "en cours",
    emergencyReason: "Raison du mode dégradé",
    emergencyReview: "Revue différée exigée avant le",
    nobody: "Aucune mesure par personne : cette trace qualifie des étapes, pas des individus.",
    seconds: "s",
  },
  en: {
    trace: "Trace",
    actor: "Actor",
    human: "human",
    agent: "agent",
    mode: "Mode",
    normal: "normal",
    emergency: "emergency (degraded)",
    outcome: "Outcome",
    started: "Started",
    finished: "Finished",
    duration: "Duration",
    steps: "Steps",
    deviations: "Deviations",
    links: "Links",
    evidence: "evidence",
    refused: "refused",
    pending: "pending",
    current: "current",
    emergencyReason: "Emergency reason",
    emergencyReview: "Deferred review due before",
    nobody: "No per-person metric: this trace qualifies steps, not people.",
    seconds: "s",
  },
};

const MARK: Readonly<Record<TraceStep["state"], string>> = {
  done: "[x]",
  skipped: "[~]",
  failed: "[!]",
  refused: "[r]",
  current: "[ ]",
  pending: "[ ]",
};

const lineOf = (step: TraceStep, l: Record<string, string>): string => {
  const evidence = step.evidence ? ` — ${l.evidence}: ${step.evidence.kind}/${step.evidence.strength} (${step.evidence.ref})` : "";
  const refused = step.refusedReason ? ` — ${l.refused}: ${step.refusedReason}` : "";
  const duration = step.durationS !== undefined ? ` (${step.durationS}${l.seconds})` : "";
  return `${MARK[step.state]} ${step.ord}. ${step.text}${duration}${evidence}${refused}`;
};

/** Rendu lisible de la trace : ce que l'auditeur lit, ce que le ticket cite. */
export const renderTraceMarkdown = (trace: Trace, lang: Lang = "fr", run?: Run): string => {
  const l = LABELS[lang];
  const head = [
    `# ${l.trace} ${trace.citation}`,
    "",
    `- ${l.actor} : ${l[trace.actorKind]} (${trace.actorKind})`,
    `- ${l.mode} : ${trace.mode === "emergency" ? l.emergency : l.normal}`,
    `- ${l.started} : ${trace.startedAt}`,
    `- ${l.finished} : ${trace.finishedAt ?? l.current}`,
    `- ${l.outcome} : ${trace.outcome ?? l.pending}`,
    `- ${l.duration} : ${trace.durationS}${l.seconds}`,
  ];
  const emergency =
    trace.mode === "emergency" && run
      ? [`- ${l.emergencyReason} : ${run.emergencyReason ?? "—"}`, `- ${l.emergencyReview} : ${run.emergencyReviewDueAt ?? "—"}`]
      : [];
  const steps = [``, `## ${l.steps}`, ...trace.steps.map((s) => lineOf(s, l))];
  const deviations =
    trace.deviations.length > 0
      ? [``, `## ${l.deviations}`, ...trace.deviations.map((d) => `- (${d.origin}) ${d.whatHappened} — ${d.why}`)]
      : [];
  const links =
    trace.links.length > 0 ? [``, `## ${l.links}`, ...trace.links.map((k) => `- ${k.targetType}: ${k.targetRef}`)] : [];
  return [...head, ...emergency, ...steps, ...deviations, ...links, "", `> ${l.nobody}`].join("\n");
};
