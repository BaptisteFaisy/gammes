/**
 * Fixtures du lot conflits : deux gammes approuvées sur le même service, dont les
 * exigences d'approbation divergent, plus une page de politique et un port
 * Confluence bouchonné. Aucun réseau, aucun LLM.
 */

import type { Deps, ConfluencePort } from "../../src/core/ports";
import type { Gamme, GammeVersion, PageDigest } from "../../src/core/types";
import { makeGamme, makePage, makeStep, makeVersion, span, T0 } from "../helpers";

export const SERVICE = "paiements";
export const POLICY_ARI = "ari:cloud:confluence:demo:page/9000";
export const POLICY_BODY =
  "<p>Politique de déploiement. Tout déploiement en production exige 3 approbations humaines.</p>";

const approvalStep = (ord: number, text: string): ReturnType<typeof makeStep> =>
  makeStep({
    id: `stp_appr_${ord}`,
    ord,
    kind: "manual",
    text,
    humanOnly: true,
    command: undefined,
    evidence: { kind: "attestation", strength: "attested", required: true },
    source: span({ quote: text, start: ord * 100, end: ord * 100 + text.length }),
  });

const deployStep = (ord: number): ReturnType<typeof makeStep> =>
  makeStep({
    id: `stp_deploy_${ord}`,
    ord,
    text: "Déployer la version candidate sur paiements",
    command: "kubectl rollout status deploy/paiements",
    source: span({ quote: "Déployer la version candidate", start: 10, end: 40 }),
  });

const buildGamme = (
  code: string,
  id: string,
  approvals: number,
  over: Partial<Gamme> = {},
): { gamme: Gamme; version: GammeVersion } => {
  const steps = [
    deployStep(1),
    ...Array.from({ length: approvals }, (_, i) =>
      approvalStep(i + 2, `Obtenir la validation n°${i + 1} du responsable d'astreinte`),
    ),
  ];
  const gamme = makeGamme({
    id,
    code,
    state: "approved",
    currentVersion: 1,
    scope: { services: [SERVICE], projects: ["PAY"], spaces: ["SRE"] },
    spaceKey: "SRE",
    approvedAt: T0,
    approvedByRef: "ari:cloud:aaid:demo:ana",
    ...over,
  });
  const version = makeVersion({
    id: `${id}_v1`,
    gammeId: id,
    version: 1,
    title: gamme.title,
    steps,
    approvedAt: T0,
    approvedByRef: "ari:cloud:aaid:demo:ana",
  });
  return { gamme, version };
};

/** Deux gammes, même service : l'une exige 2 approbations, l'autre `approvalsB`. */
export const seedTwoGammes = async (deps: Deps, approvalsB = 1): Promise<{ a: Gamme; b: Gamme }> => {
  const a = buildGamme("GAM-deploy-01", "gam_a", 2);
  const b = buildGamme("GAM-deploy-02", "gam_b", approvalsB);
  for (const item of [a, b]) {
    await deps.store.gammes.insert(item.gamme);
    await deps.store.versions.insert(item.version);
  }
  return { a: a.gamme, b: b.gamme };
};

/** Deux gammes exclusives sur le même service : concurrence sur la ressource. */
export const seedExclusivePair = async (deps: Deps): Promise<void> => {
  const a = buildGamme("GAM-rotate-01", "gam_x", 1, { exclusive: true });
  const b = buildGamme("GAM-rotate-02", "gam_y", 1, { exclusive: true });
  for (const item of [a, b]) {
    await deps.store.gammes.insert(item.gamme);
    await deps.store.versions.insert(item.version);
  }
};

export const policyPage = (): PageDigest =>
  makePage({ ari: POLICY_ARI, id: "9000", title: "Politique de déploiement", storageBody: POLICY_BODY });

export const stubConfluence = (pages: readonly PageDigest[] = [policyPage()]): ConfluencePort => ({
  getPage: async (ari: string) => {
    const found = pages.find((p) => p.ari === ari);
    if (!found) throw new Error(`page inconnue ${ari}`);
    return found;
  },
  listPages: async () => pages,
  isReachable: async () => true,
});

/** Réglages d'espace qui déclarent la page de politique. */
export const seedSettings = async (deps: Deps): Promise<void> => {
  await deps.store.settings.insert({
    spaceKey: "SRE",
    riskMotifs: [],
    policyPages: [POLICY_ARI],
    statThreshold: 30,
    lockPolicy: "human_or_permitted_agent",
    reviewAfterDays: 365,
    dustAfterDays: 90,
    lang: "fr",
  });
};
