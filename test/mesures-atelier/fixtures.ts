/**
 * Fixtures du lot mesures d'atelier : gammes, versions, exécutions et tickets semés.
 * Tout est construit ici — aucune dépendance à un autre lot, aucun réseau.
 */

import type { Deps, JiraPort } from "../../src/core/ports";
import type {
  Deviation,
  Gamme,
  GammeVersion,
  IssueDigest,
  Run,
  RunStep,
  RunStepState,
  Step,
} from "../../src/core/types";
import { agent, human, makeGamme, makeStep, makeVersion, span, T0 } from "../helpers";

export const CODE = "GAM-stats-01";
export const STEP_IDS = ["stp_1", "stp_2", "stp_3"] as const;

export const STEPS: readonly Step[] = STEP_IDS.map((id, index) =>
  makeStep({
    id,
    ord: index + 1,
    kind: index === 1 ? "command" : "check",
    text: `Étape ${index + 1} de la gamme de démonstration`,
    command: index === 1 ? "kubectl rollout status deploy/paiements" : undefined,
  }),
);

export const seedGamme = async (
  deps: Deps,
  over: Partial<Gamme> = {},
  versionOver: Partial<GammeVersion> = {},
): Promise<{ gamme: Gamme; version: GammeVersion }> => {
  const gamme = makeGamme({
    id: "gam_stats",
    code: CODE,
    state: "approved",
    currentVersion: 1,
    ownerRef: "ari:cloud:aaid:demo:ana",
    approvedAt: T0,
    approvedByRef: "ari:cloud:aaid:demo:ana",
    reviewDueAt: "2027-11-11T09:00:00.000Z",
    ...over,
  });
  const version = makeVersion({
    id: "ver_stats_1",
    gammeId: gamme.id,
    version: gamme.currentVersion,
    steps: [...STEPS],
    approvedAt: T0,
    approvedByRef: "ari:cloud:aaid:demo:ana",
    ...versionOver,
  });
  await deps.store.gammes.insert(gamme);
  await deps.store.versions.insert(version);
  return { gamme, version };
};

export type RunSpec = {
  readonly id: string;
  readonly states: Record<string, RunStepState>;
  readonly startedAt?: string;
  readonly outcome?: Run["outcome"];
  readonly deviations?: readonly Deviation[];
  readonly durations?: Record<string, number>;
  readonly actorKind?: "human" | "agent";
};

export const makeRun = (spec: RunSpec, gammeId = "gam_stats", versionId = "ver_stats_1", code = CODE): Run => {
  const steps: RunStep[] = STEP_IDS.map((stepId) => ({
    stepId,
    state: spec.states[stepId] ?? "done",
    attempts: 1,
    startedAt: spec.startedAt ?? T0,
    ...(spec.durations?.[stepId] !== undefined ? { durationS: spec.durations![stepId] } : {}),
  }));
  return {
    id: spec.id,
    gammeId,
    code,
    versionId,
    pinnedVersion: 1,
    actor: spec.actorKind === "agent" ? agent() : human(),
    startedAt: spec.startedAt ?? T0,
    finishedAt: spec.startedAt ?? T0,
    outcome: spec.outcome ?? "succeeded",
    mode: "normal",
    resumedCount: 0,
    steps,
    deviations: [...(spec.deviations ?? [])],
    links: [],
  };
};

/** `n` exécutions dont `failures` en échec sur `stepId` — la matière des statistiques. */
export const seedRuns = async (
  deps: Deps,
  n: number,
  failures: number,
  stepId: string = STEP_IDS[1]!,
  startedAt = T0,
  versionId = "ver_stats_1",
  idPrefix = "run",
): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    const failed = i < failures;
    const deviations: Deviation[] = failed
      ? [
          {
            id: `dev_${idPrefix}_${i}`,
            runId: `${idPrefix}_${i}`,
            stepId,
            whatHappened: "déployé depuis le poste de l'astreinte",
            why: "le rollout restait bloqué sur l'ancienne réplique",
            at: startedAt,
            actorKind: "human",
            origin: "declared",
          },
        ]
      : [];
    await deps.store.runs.insert(
      makeRun(
        {
          id: `${idPrefix}_${i}`,
          states: { [stepId]: failed ? "failed" : "done" },
          deviations,
          durations: { [stepId]: failed ? 900 : 120 },
          startedAt,
          outcome: failed ? "failed" : "succeeded",
        },
        "gam_stats",
        versionId,
      ),
    );
  }
};

export const makeIssue = (index: number, over: Partial<IssueDigest> = {}): IssueDigest => ({
  id: `${20000 + index}`,
  key: `PAY-${100 + index}`,
  projectKey: "PAY",
  summary: "Réinitialiser le coffre de clés du service paiements",
  components: ["paiements"],
  labels: [],
  createdAt: `2026-0${(index % 9) + 1}-1${index % 9}T09:00:00.000Z`,
  resolvedAt: `2026-0${(index % 9) + 1}-1${index % 9}T13:00:00.000Z`,
  transitions: ["To Do", "In Progress", "Done"],
  commentBodies: [
    "Ouvrir le coffre et générer une nouvelle clé.\nAttendre le rechargement des services.\nRévoquer l'ancienne clé.",
  ],
  assigneeCount: 1 + (index % 3),
  ...over,
});

export const stubJira = (issues: readonly IssueDigest[]): JiraPort => ({
  getIssue: async (id) => {
    const found = issues.find((i) => i.id === id);
    if (!found) throw new Error(`ticket ${id} introuvable`);
    return found;
  },
  searchIssues: async () => issues,
});

export const unusedSpan = span({ quote: "fixture" });
