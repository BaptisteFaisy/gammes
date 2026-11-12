/**
 * Gammes — l'espace de démonstration des juges (§ 27).
 *
 * Sème sept pages Confluence (trois procédures réalistes, une page qui n'en est pas une,
 * une procédure avec une fausse clé, deux procédures en conflit sur le même service), un
 * projet Jira de 40 tickets semblables (pour les fantômes) et des traces (pour les
 * statistiques). Tout est en mémoire, aucun réseau : `seedAtelier()` rend un `Deps` prêt.
 */

import type { ConfluencePort, Deps, GraphPort, JiraPort, LlmClient, PermitRegistry } from "../src/core/ports";
import type { Evidence, EvidenceSpec, IssueDigest, PageDigest, Run, RunStep, Step } from "../src/core/types";
import { fakeAwsKey, makeDeps, makePage, T0 } from "../test/helpers";
import { fixedClock } from "../src/platform/clock";
import { seqIds } from "../src/platform/ids";
import { makeHasher } from "../src/platform/hash";
import { memoryStore } from "../src/platform/memory-store";
import { memoryBudget } from "../src/platform/llm/budget";
import { scriptedLlm } from "../src/platform/llm/fake-llm";
import { OWNER } from "../test/moteur-execution/fixtures";

const code = (macro: string): string =>
  `<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[${macro}]]></ac:plain-text-body></ac:structured-macro>`;

export const PAGE_DEPLOY = [
  "<h1>Procédure : déployer le service paiements</h1>",
  "<p>Cette procédure décrit le déploiement en production du service paiements.</p>",
  "<h2>Entrées</h2><ul><li>service : nom du service (obligatoire)</li><li>version_cible : version à déployer (obligatoire)</li></ul>",
  "<h2>Avant de commencer</h2><ul><li>Le merge check doit être vert.</li></ul>",
  "<h2>Étapes</h2><ol>",
  "<li>Vérifier que le pipeline est vert sur la version candidate.</li>",
  `<li>Déployer la version candidate en production : ${code("kubectl apply -f deploy/paiements.yaml")}</li>`,
  "<li>Contrôler le taux d'erreur pendant 5 minutes.</li>",
  "<li>Obtenir la validation du responsable d'astreinte.</li>",
  "<li>Obtenir la seconde approbation du propriétaire du service.</li>",
  "</ol>",
  "<h2>Si ça tourne mal</h2><ol><li>Revenir à la version précédente avec kubectl rollout undo deploy/paiements.</li></ol>",
].join("\n");

export const PAGE_DEPLOY_CONFLIT = [
  "<h1>Procédure : déployer paiements (variante équipe B)</h1>",
  "<h2>Étapes</h2><ol>",
  "<li>Vérifier que le pipeline est vert.</li>",
  `<li>Déployer en production : ${code("kubectl apply -f deploy/paiements.yaml")}</li>`,
  "<li>Obtenir la validation du responsable (1 approbation suffit).</li>",
  "</ol>",
].join("\n");

export const PAGE_ROTATION = [
  "<h1>Procédure : rotation des clés API</h1>",
  "<h2>Étapes</h2><ol>",
  "<li>Générer une nouvelle clé dans le coffre.</li>",
  "<li>Attendre le rechargement de tous les services (contrôler /healthz).</li>",
  "<li>Révoquer l'ancienne clé : réaliser la rotation de la clé de signature.</li>",
  "<li>Faire valider la rotation par le responsable sécurité.</li>",
  "</ol>",
].join("\n");

export const PAGE_ONBOARDING = [
  "<h1>Mode opératoire : intégrer un collaborateur</h1>",
  "<h2>Étapes</h2><ol>",
  "<li>Créer le compte dans l'annuaire.</li>",
  "<li>Attribuer les accès au projet PAY.</li>",
  "<li>Vérifier que le collaborateur accède au dépôt.</li>",
  "<li>Notifier l'équipe de l'arrivée.</li>",
  "</ol>",
].join("\n");

export const PAGE_COMPTE_RENDU = [
  "<h1>Compte rendu du comité du 3 mars</h1>",
  "<p>Ordre du jour, décisions et suites données. Aucun geste technique n'est décrit ici.</p>",
].join("\n");

export const PAGE_AVEC_CLE = [
  "<h1>Procédure : exporter les créances</h1>",
  "<h2>Étapes</h2><ol>",
  `<li>Exporter la clé AWS ${fakeAwsKey()} puis lancer l'export.</li>`,
  "<li>Vérifier que le fichier est produit.</li>",
  "</ol>",
].join("\n");

export const PAGES: Record<string, PageDigest> = {
  "ari:page/deploy": makePage({ ari: "ari:page/deploy", id: "deploy", title: "Procédure : déployer le service paiements", storageBody: PAGE_DEPLOY, labels: ["runbook", "deploiement"], viewsLast30d: 120, linkedFromOnCall: true }),
  "ari:page/deploy-b": makePage({ ari: "ari:page/deploy-b", id: "deploy-b", title: "Procédure : déployer paiements (variante équipe B)", storageBody: PAGE_DEPLOY_CONFLIT, labels: ["runbook"] }),
  "ari:page/rotation": makePage({ ari: "ari:page/rotation", id: "rotation", title: "Procédure : rotation des clés API", storageBody: PAGE_ROTATION, labels: ["runbook", "securite"] }),
  "ari:page/onboarding": makePage({ ari: "ari:page/onboarding", id: "onboarding", title: "Mode opératoire : intégrer un collaborateur", storageBody: PAGE_ONBOARDING, labels: ["sop"] }),
  "ari:page/compte-rendu": makePage({ ari: "ari:page/compte-rendu", id: "compte-rendu", title: "Compte rendu du comité du 3 mars", storageBody: PAGE_COMPTE_RENDU, labels: [] }),
  "ari:page/creances": makePage({ ari: "ari:page/creances", id: "creances", title: "Procédure : exporter les créances", storageBody: PAGE_AVEC_CLE, labels: ["runbook"] }),
  "ari:page/politique": makePage({ ari: "ari:page/politique", id: "politique", title: "Politique de déploiement", storageBody: "<p>Tout déploiement en production exige 3 approbations humaines.</p>", labels: ["politique"] }),
};

const comment = "Ouvrir le coffre et générer une nouvelle clé.\nAttendre le rechargement.\nRévoquer l'ancienne clé.";

export const TICKETS: IssueDigest[] = [
  ...Array.from({ length: 40 }, (_, i) => ({
    id: `${30000 + i}`,
    key: `PAY-${200 + i}`,
    projectKey: "PAY",
    summary: "Réinitialiser le coffre de clés du service paiements",
    components: ["paiements"],
    labels: [],
    createdAt: `2026-0${(i % 9) + 1}-1${i % 9}T09:00:00.000Z`,
    resolvedAt: `2026-0${(i % 9) + 1}-1${i % 9}T13:00:00.000Z`,
    transitions: ["To Do", "In Progress", "Done"],
    commentBodies: [comment],
    assigneeCount: 1 + (i % 3),
  })),
  { id: "39999", key: "PAY-999", projectKey: "PAY", summary: "Sujet isolé sans rapport", components: ["autre"], labels: [], createdAt: T0, transitions: ["To Do"], commentBodies: [], assigneeCount: 1 },
];

export const demoConfluence = (): ConfluencePort => ({
  getPage: async (ari) => PAGES[ari] ?? makePage({ ari, reachable: false }),
  listPages: async () => Object.values(PAGES),
  isReachable: async () => true,
  proposePageEdit: async (ari) => ({ url: `https://confluence.example/pages/${ari}?diff=proposed` }),
});

export const demoJira = (): JiraPort => ({
  getIssue: async (id) => TICKETS.find((t) => t.id === id) ?? TICKETS[0]!,
  searchIssues: async () => TICKETS,
});

export const demoPermits = (granted: boolean): PermitRegistry => ({
  check: async (_actorId, kind, permitClass) =>
    kind === "human"
      ? { id: "per_h", stepId: "", permitClass, checkedAt: T0, result: "granted" }
      : { id: "per_a", stepId: "", permitClass, checkedAt: T0, result: granted ? "granted" : "denied", requestUrl: `https://permis.example/${permitClass}` },
  requestUrl: (permitClass) => `https://permis.example/${permitClass}`,
});

/** Graphe de démo : rattache les pages de déploiement au service « paiements » (périmètre des conflits). */
export const demoGraph = (): GraphPort => ({
  servicesFor: async (ari) => (ari.includes("deploy") ? ["paiements"] : []),
  projectsFor: async (ari) => (ari.includes("deploy") ? ["PAY"] : []),
  ownerOf: async () => "ari:cloud:aaid:demo:ana",
  readable: async () => true,
});

export type AtelierOptions = {
  readonly permitsGranted?: boolean;
  readonly clock?: ReturnType<typeof fixedClock>;
  /** Modèle injecté : le site public y branche un vrai modèle (OpenCode Zen, InferHub, proxy). */
  readonly llm?: LlmClient;
};

export type Atelier = { readonly deps: Deps; readonly clock: ReturnType<typeof fixedClock> };

/** Un monde complet, prêt à dérouler : pages, tickets, permis, graphe, modèle scripté. */
export const seedAtelier = (options: AtelierOptions = {}): Atelier => {
  const clock = options.clock ?? fixedClock(T0);
  const deps = makeDeps({
    store: memoryStore(),
    clock,
    ids: seqIds(),
    hasher: makeHasher(),
    llm: options.llm ?? scriptedLlm({
      conciliate_conflict: JSON.stringify({
        summary: "Deux gammes déploient paiements avec un nombre d'approbations différent.",
        options: [
          { title: "Aligner la variante B sur 2 approbations", detail: "Conforme à la gamme principale.", affects: ["deploy-b"] },
          { title: "Porter les deux à 3 approbations", detail: "Conforme à la politique de déploiement.", affects: ["deploy", "deploy-b"] },
        ],
      }),
    }),
    budget: memoryBudget("2026-11-11"),
    confluence: demoConfluence(),
    jira: demoJira(),
    permits: demoPermits(options.permitsGranted ?? false),
    graph: demoGraph(),
  });
  return { deps, clock };
};

/** Règlages d'espace de démo : la page de politique est déclarée, seuil à 30. */
export const seedSettings = async (deps: Deps): Promise<void> => {
  await deps.store.settings.insert({
    spaceKey: "SRE",
    riskMotifs: [],
    policyPages: ["ari:page/politique"],
    statThreshold: 30,
    lockPolicy: "human_or_permitted_agent",
    reviewAfterDays: 365,
    dustAfterDays: 90,
    lang: "fr",
  });
};

/**
 * L'extrait de preuve d'une étape : **ce que l'opérateur a réellement laissé**.
 *
 * Un juge doit pouvoir lire la preuve, pas seulement une référence : la sortie
 * de la commande, la ligne de CI, la validation d'un responsable. L'extrait est
 * donc écrit à partir de l'étape elle-même (sa commande, son verrou, son
 * résultat attendu) — il estAttached à la preuve, il ne la remplace pas.
 */
const excerptFor = (step: Step, index: number): string => {
  if (step.command) {
    const sortie = step.command.startsWith("kubectl apply")
      ? ["deployment.apps/paiements configured", "deployment.apps/paiements rollout status: successfully rolled out"]
      : ["✓ build #4242 — pipeline vert — 2 min 14 s", "✓ merge check: passed"];
    return [`$ ${step.command}`, ...sortie, ...(step.expectedResult ? [`attendu : ${step.expectedResult}`] : [])].join("\n");
  }
  if (step.humanOnly || step.locks.some((l) => l.kind === "human")) {
    return `validation du responsable d'astreinte — « ${step.text} » — 2026-03-03T02:1${index}:00.000Z (ticket PAY-412)`;
  }
  return `« ${step.text} » — vérifié le 2026-03-03T02:1${index}:00.000Z — conforme`;
};

/**
 * La preuve d'une étape de démonstration : la **spec de la version** (une seule
 * source de vérité), une référence plausible, et l'extrait que le juge peut lire.
 * Une étape franchie sans preuve ne serait pas une preuve — le produit ne dit
 * jamais « la procédure est respectée » sans trace, la démo doit respecter la
 * même règle.
 */
const preuveDe = (spec: EvidenceSpec | undefined, step: Step | undefined, index: number): Evidence => ({
  kind: spec?.kind ?? "command_output",
  strength: spec?.strength ?? "machine",
  ref:
    spec?.strength === "attested"
      ? `attestation:${OWNER}`
      : `https://ci.example.internal/build/${42 + index}`,
  capturedAt: T0,
  ...(step ? { note: excerptFor(step, index) } : {}),
});

/** Trace synthétique : `n` exécutions dont `failures` en échec sur `stepId`. */
export const seedTraces = async (
  deps: Deps,
  args: {
    gammeId: string; code: string; versionId: string; n: number; failures: number; stepId: string;
    startedAt?: string;
    /** Ordre des étapes de la version : les étapes après un échec ne sont pas atteintes. */
    stepIds?: readonly string[];
  },
): Promise<void> => {
  const order = args.stepIds ?? [args.stepId];
  const failIndex = order.indexOf(args.stepId);
  for (let i = 0; i < args.n; i += 1) {
    const failed = i < args.failures;
    const version = await deps.store.versions.get(args.versionId);
    const specDe = (stepId: string) => version?.steps.find((s) => s.id === stepId)?.evidence;
    const steps: RunStep[] = order.map((stepId, index) => {
      const preuve = preuveDe(specDe(stepId), version?.steps.find((s) => s.id === stepId), index);
      if (stepId === args.stepId) {
        return {
          stepId, state: failed ? "failed" : "done", attempts: 1, startedAt: args.startedAt ?? T0,
          evidence: preuve, ...(failed ? {} : { durationS: 120 }),
        };
      }
      if (failed && failIndex >= 0 && index > failIndex) {
        return { stepId, state: "pending", attempts: 0 };
      }
      return { stepId, state: "done", attempts: 1, startedAt: args.startedAt ?? T0, durationS: 120, evidence: preuve };
    });
    const run: Run = {
      id: `run_seed_${args.versionId}_${i}`,
      gammeId: args.gammeId,
      code: args.code,
      versionId: args.versionId,
      pinnedVersion: 1,
      actor: { id: `ari:seed:${i % 4}`, kind: i % 2 === 0 ? "human" : "agent" },
      startedAt: args.startedAt ?? T0,
      finishedAt: args.startedAt ?? T0,
      outcome: failed ? "failed" : "succeeded",
      mode: "normal",
      resumedCount: 0,
      steps,
      deviations: failed
        ? [{ id: `dev_seed_${args.versionId}_${i}`, runId: `run_seed_${args.versionId}_${i}`, stepId: args.stepId, whatHappened: "déployé à la main depuis le poste d'astreinte", why: "le rollout restait bloqué", at: args.startedAt ?? T0, actorKind: "human", origin: "declared" }]
        : [],
      links: [],
    };
    await deps.store.runs.insert(run);
  }
};

/**
 * Remplace le jeu de tickets par celui du visiteur : la détection de fantômes tourne alors
 * sur des données réelles. Le tableau est muté sur place, les ports bouchonnés le lisent en direct.
 */
export const setTickets = (issues: readonly IssueDigest[]): void => {
  TICKETS.length = 0;
  TICKETS.push(...issues);
};

/** Page collée par le visiteur : elle entre dans le catalogue comme n'importe quelle page. */
export const addPastedPage = (ari: string, title: string, storageBody: string): PageDigest => {
  const page = makePage({ ari, id: ari.split("/").pop() ?? ari, title, storageBody, labels: ["collee"] });
  PAGES[ari] = page;
  return page;
};
