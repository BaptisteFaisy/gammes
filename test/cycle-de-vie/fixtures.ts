/**
 * Fixtures du lot cycle de vie : pages de procédure réalistes (avec repli, avec une
 * fausse clé), et un petit outillage pour compiler/approuver sans répéter le geste.
 */

import type { Deps } from "../../src/core/ports";
import type { ActorRef, Gamme, GammeVersion, PageDigest } from "../../src/core/types";
import { compilePage, type CompileOutcome } from "../../src/core/compile/compile-page";
import { approveVersion } from "../../src/core/version/versioning";
import { fakeAwsKey, human, makePage, T0 } from "../helpers";

/** Fausse clé : une seule copie, chez les fixtures partagées (`test/helpers.ts`). */
export { fakeAwsKey };

export const PAGE_DEPLOY = [
  "<h1>Procédure : déployer le service paiements</h1>",
  "<p>Cette procédure décrit le déploiement en production du service paiements.</p>",
  "<h2>Entrées</h2>",
  "<ul>",
  "<li>service : nom du service concerné (obligatoire)</li>",
  "<li>version_cible : numéro de version à déployer (obligatoire)</li>",
  "</ul>",
  "<h2>Avant de commencer</h2>",
  "<ul><li>Le merge check doit être vert.</li></ul>",
  "<h2>Étapes</h2>",
  "<ol>",
  "<li>Vérifier que le pipeline est vert sur la version candidate.</li>",
  "<li>Déployer la version candidate :",
  '<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[kubectl rollout status deploy/paiements]]></ac:plain-text-body></ac:structured-macro>',
  "</li>",
  "<li>Contrôler le taux d'erreur pendant 5 minutes.</li>",
  "<li>Faire valider le déploiement par le responsable d'astreinte.</li>",
  "</ol>",
  "<h2>Si ça tourne mal</h2>",
  "<ol><li>Revenir à la version précédente avec kubectl rollout undo deploy/paiements.</li></ol>",
].join("\n");

export const PAGE_MODIFIEE = PAGE_DEPLOY.replace(
  "<li>Contrôler le taux d'erreur pendant 5 minutes.</li>",
  "<li>Contrôler le taux d'erreur pendant 15 minutes et le taux de latence p99.</li>",
);

export const PAGE_AVEC_SECRET = PAGE_DEPLOY.replace(
  "<li>Vérifier que le pipeline est vert sur la version candidate.</li>",
  `<li>Exporter la clé AWS ${fakeAwsKey()} puis vérifier que le pipeline est vert.</li>`,
);

export const deployPage = (over: Partial<PageDigest> = {}): PageDigest =>
  makePage({ title: "Procédure : déployer le service paiements", storageBody: PAGE_DEPLOY, ...over });

export const compile = async (deps: Deps, page: PageDigest, by: ActorRef = human()): Promise<CompileOutcome> => {
  const res = await compilePage(deps, { page, confirmedBy: by });
  if (!res.ok) throw new Error(`compilation refusée : ${res.error.code} — ${res.error.messageFr}`);
  return res.value;
};

export type Approved = { gamme: Gamme; version: GammeVersion };

/** Compile puis fait approuver par un humain : le chemin nominal d'une mise en service. */
export const compileAndApprove = async (
  deps: Deps,
  page: PageDigest = deployPage(),
  over: Partial<PageDigest> = {},
): Promise<Approved> => {
  const compiled = await compile(deps, { ...page, ...over });
  await deps.store.gammes.update(compiled.gamme.id, (g) => ({ ...g, ownerRef: g.ownerRef ?? "ari:cloud:aaid:demo:ana" }));
  const approved = await approveVersion(deps, { versionId: compiled.version.id, approver: human() });
  if (!approved.ok) throw new Error(`approbation refusée : ${approved.error.code}`);
  return { gamme: approved.value, version: compiled.version };
};

export const COMPILED_AT = T0;
