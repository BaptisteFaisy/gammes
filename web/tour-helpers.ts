/**
 * Gammes — démo guidée : outillage partagé par les étapes du scénario.
 *
 * Une règle : la démo n'a pas de passe-droit. Elle appelle les mêmes fonctions que le
 * reste du site, et un refus du produit est **montré comme un résultat**, pas contourné.
 */

import type { AppState } from "./state";
import { OWNER, AGENT_ID } from "./state";
import type { Result } from "../src/core/result";
import type { ActorRef, Evidence, Gamme, GammeVersion } from "../src/core/types";
import { human, agent } from "../test/helpers";
import { PAGES } from "../seed/atelier";

export const humain = (): ActorRef => human(OWNER);
export const compagnon = (): ActorRef => agent(AGENT_ID);

export const preuveMachine = (state: AppState, ref = "https://ci.example.internal/build/42"): Evidence => ({
  kind: "command_output",
  strength: "machine",
  ref,
  capturedAt: state.deps.clock.now(),
  origin: "fixture",
  note: [
    "$ gh run list --workflow ci --limit 1",
    "✓ build #4242 — pipeline vert — 2 min 14 s",
    "✓ merge check: passed",
    "✓ run #4242 conclu : SUCCESS",
  ].join("\n"),
});

export const attestation = (state: AppState): Evidence => ({
  kind: "attestation",
  strength: "attested",
  ref: `attestation:${OWNER}`,
  capturedAt: state.deps.clock.now(),
  origin: "fixture",
  note: [
    "Attestation — responsable d'astreinte",
    "« Déploiement validé : merge check vert, contrôle d'erreur à 0,2 % sur 5 minutes. »",
    `Référence : ticket PAY-412 — ${state.deps.clock.now()}`,
  ].join("\n"),
});

/** Un refus inattendu arrête l'étape avec un message lisible — jamais de `!` optimiste. */
export const valeur = <T>(res: Result<T>, contexte: string): T => {
  if (!res.ok) throw new Error(`${contexte} : ${res.error.code} — ${res.error.messageFr}`);
  return res.value;
};

export const page = (ari: string): NonNullable<(typeof PAGES)[string]> => {
  const found = PAGES[ari];
  if (!found) throw new Error(`page de démonstration absente : ${ari}`);
  return found;
};

export const DEPLOY = "ari:page/deploy";
export const DEPLOY_B = "ari:page/deploy-b";
export const SECRETES = "ari:page/creances";

export const gammeCourante = async (state: AppState): Promise<Gamme> => {
  if (!state.gamme) throw new Error("aucune gamme sélectionnée");
  const gammes = await state.deps.store.gammes.list((g) => g.code === state.gamme);
  const gamme = gammes[0];
  if (!gamme) throw new Error(`gamme ${state.gamme} introuvable`);
  return gamme;
};

export const versionCourante = async (state: AppState): Promise<GammeVersion> => {
  const gamme = await gammeCourante(state);
  const versions = await state.deps.store.versions.list((v) => v.gammeId === gamme.id);
  const version = versions.find((v) => v.version === gamme.currentVersion) ?? versions[versions.length - 1];
  if (!version) throw new Error(`aucune version pour ${gamme.code}`);
  return version;
};

/** Adopte la gamme au nom du propriétaire : sans propriétaire, rien n'est approuvable. */
export const adopter = async (state: AppState, gammeId: string): Promise<void> => {
  await state.deps.store.gammes.update(gammeId, (g) => ({ ...g, ownerRef: g.ownerRef ?? OWNER }));
};

/** Pourcentage lisible d'un taux, ou la mention honnête « pas assez de recul ». */
export const taux = (rate: { value?: number; cohort: { n: number; enoughHistory: boolean } }): string =>
  rate.value === undefined ? `pas assez de recul (n=${rate.cohort.n})` : `${Math.round(rate.value * 100)} % (n=${rate.cohort.n})`;
