/**
 * Fixtures du lot moteur d'exécution : une gamme approuvée de trois étapes qui
 * concentre les trois verrous (preuve machine, permis, humain), un registre de
 * permis bouchonné et des preuves types. Aucun réseau, aucun LLM.
 */

import type { Deps, PermitRegistry, ReservationRegistry } from "../../src/core/ports";
import type { Evidence, Gamme, GammeVersion, PermitCheck, Step } from "../../src/core/types";
import { attestationEvidence, evidenceSpec, lock, makeGamme, makeStep, makeVersion, span, T0 } from "../helpers";

export const OWNER = "ari:cloud:aaid:demo:ana";
export const PERMIT_URL = "https://permis.example.internal/demande";

export const STEPS: readonly Step[] = [
  makeStep({
    id: "stp_1",
    ord: 1,
    kind: "check",
    text: "Vérifier que le pipeline est vert sur la version candidate",
    command: "gh run list --limit 1",
    evidence: evidenceSpec({ kind: "command_output", strength: "machine", required: true }),
    source: span({ quote: "Vérifier que le pipeline est vert", start: 10, end: 44 }),
  }),
  makeStep({
    id: "stp_2",
    ord: 2,
    kind: "command",
    text: "Déployer la version candidate en production",
    command: "kubectl apply -f deploy/paiements.yaml",
    risk: "high",
    riskClass: "production-write",
    locks: [lock("permit", "un agent doit présenter un permis valide", { permitClass: "production-write" })],
    evidence: evidenceSpec({ kind: "command_output", strength: "machine", required: true }),
    idempotent: false,
    source: span({ quote: "Déployer la version candidate en production", start: 60, end: 103 }),
  }),
  makeStep({
    id: "stp_3",
    ord: 3,
    kind: "manual",
    text: "Faire valider le déploiement par le responsable d'astreinte",
    humanOnly: true,
    locks: [lock("human", "acte d'autorité : réservé à une personne authentifiée")],
    evidence: evidenceSpec({ kind: "attestation", strength: "attested", required: true }),
    source: span({ quote: "Faire valider le déploiement", start: 120, end: 148 }),
  }),
];

export const INPUTS = [
  { name: "service", type: "string", required: true, description: "service concerné" },
  { name: "version_cible", type: "string", required: true, description: "version à déployer" },
  { name: "fenetre", type: "enum", required: false, enumValues: ["jour", "nuit"] },
] as const;

export type Seeded = { gamme: Gamme; version: GammeVersion };

export const seedApprovedGamme = async (deps: Deps, over: Partial<Gamme> = {}): Promise<Seeded> => {
  const gamme = makeGamme({
    id: "gam_1",
    code: "GAM-deploy-01",
    state: "approved",
    currentVersion: 1,
    ownerRef: OWNER,
    approvedAt: T0,
    approvedByRef: OWNER,
    scope: { services: ["paiements"], projects: ["PAY"], spaces: ["SRE"] },
    ...over,
  });
  const version = makeVersion({
    id: "ver_1",
    gammeId: "gam_1",
    version: 1,
    steps: [...STEPS],
    inputs: INPUTS.map((i) => ({ ...i })),
    approvedAt: T0,
    approvedByRef: OWNER,
  });
  await deps.store.gammes.insert(gamme);
  await deps.store.versions.insert(version);
  return { gamme, version };
};

export const grantedPermits = (): PermitRegistry => ({
  check: async (_actorId, _kind, permitClass, _scope): Promise<PermitCheck> => ({
    id: "per_ok",
    stepId: "stp_2",
    permitClass,
    permitId: "permit-2026-148",
    checkedAt: T0,
    result: "granted",
  }),
  requestUrl: (permitClass) => `${PERMIT_URL}/${permitClass}`,
});

export const deniedPermits = (): PermitRegistry => ({
  check: async (_actorId, _kind, permitClass, _scope): Promise<PermitCheck> => ({
    id: "per_ko",
    stepId: "stp_2",
    permitClass,
    checkedAt: T0,
    result: "denied",
    requestUrl: `${PERMIT_URL}/${permitClass}`,
  }),
  requestUrl: (permitClass) => `${PERMIT_URL}/${permitClass}`,
});

export const freeReservations = (): ReservationRegistry & { readonly held: string[] } => {
  const held: string[] = [];
  return {
    held,
    tryReserve: async (resource, runId) => {
      if (held.includes(resource)) return { reserved: false, holder: "run_prec" };
      held.push(resource);
      void runId;
      return { reserved: true };
    },
    release: async (resource) => {
      held.splice(held.indexOf(resource), 1);
    },
  };
};

export { machineEvidence } from "../helpers";

export const attestation = (by = OWNER): Evidence => attestationEvidence(by, "validé de vive voix en astreinte");

export const validInputs = (): Record<string, unknown> => ({ service: "paiements", version_cible: "1.8.2" });
