/**
 * Fixtures du lot MCP/skill : une gamme approuvée avec verrous, une page Confluence
 * bouchonnée, et un constructeur de dépendances avec un port Confluence.
 */

import type { ConfluencePort, Deps } from "../../src/core/ports";
import type { Gamme, GammeVersion, PageDigest } from "../../src/core/types";
import { evidenceSpec, lock, makeGamme, makePage, makeStep, makeVersion, span, T0 } from "../helpers";

export const OWNER = "ari:cloud:aaid:demo:ana";
export const CODE = "GAM-deployer-service-paiements-01";

export const STEPS = [
  makeStep({ id: "stp_1", ord: 1, kind: "check", text: "Vérifier que le pipeline est vert", command: "gh run list", evidence: evidenceSpec({ kind: "command_output", strength: "machine", required: true }), source: span({ quote: "Vérifier que le pipeline est vert" }) }),
  makeStep({ id: "stp_2", ord: 2, kind: "command", text: "Déployer la version candidate en production", command: "kubectl apply -f deploy.yaml", risk: "high", riskClass: "production-write", locks: [lock("permit", "permis requis", { permitClass: "production-write" })], evidence: evidenceSpec({ kind: "command_output", strength: "machine", required: true }), source: span({ quote: "Déployer en production" }) }),
  makeStep({ id: "stp_3", ord: 3, kind: "manual", text: "Faire valider par le responsable d'astreinte", humanOnly: true, locks: [lock("human", "acte d'autorité")], evidence: evidenceSpec({ kind: "attestation", strength: "attested", required: true }), source: span({ quote: "Faire valider par le responsable" }) }),
];

export const seedApproved = async (deps: Deps): Promise<{ gamme: Gamme; version: GammeVersion }> => {
  const gamme = makeGamme({
    id: "gam_mcp",
    code: CODE,
    state: "approved",
    currentVersion: 1,
    ownerRef: OWNER,
    approvedAt: T0,
    approvedByRef: OWNER,
    scope: { services: ["paiements"], projects: ["PAY"], spaces: ["SRE"] },
  });
  const version = makeVersion({
    id: "ver_mcp_1",
    gammeId: "gam_mcp",
    version: 1,
    steps: [...STEPS],
    inputs: [],
    approvedAt: T0,
    approvedByRef: OWNER,
    sourcePages: ["ari:cloud:confluence:demo:page/1001"],
  });
  await deps.store.gammes.insert(gamme);
  await deps.store.versions.insert(version);
  return { gamme, version };
};

export const DEPLOY_PAGE = [
  "<h1>Procédure : déployer le service paiements</h1>",
  "<h2>Étapes</h2>",
  "<ol><li>Vérifier que le pipeline est vert.</li><li>Déployer la version candidate.</li></ol>",
].join("\n");

export const confluenceStub = (pages: Record<string, PageDigest> = {}): ConfluencePort => ({
  getPage: async (ari) => pages[ari] ?? makePage({ ari, storageBody: DEPLOY_PAGE, title: "Procédure : déployer" }),
  listPages: async () => Object.values(pages),
  isReachable: async () => true,
});

// Les preuves types viennent du harness partagé : une seule implémentation.
export { attestationEvidence, machineEvidence } from "../helpers";