/**
 * Le paquet portable d'une gamme (idée de consolidation n° 9).
 *
 * Une gamme ne vit pas que dans l'app : elle doit sortir, se transporter, et
 * pouvoir être vérifiée ailleurs. Le paquet est **une seule source, cinq
 * cibles** (§ 33.1) : l'app, un `SKILL.md` pour un agent tiers, un script
 * d'intégration, une checklist, un flux Jira.
 *
 * Deux garanties :
 *
 *   1. le paquet est **auto-descriptif** : format, version, code, version de
 *      la gamme, entrées typées, étapes, `SKILL.md` ;
 *   2. il est **scellé** : l'empreinte porte sur le contenu, jamais sur le
 *      secret. Un paquet dont on a modifié le contenu est refusé à la
 *      lecture — on ne transporte pas une procédure altérée.
 */

import type { Deps, Hasher } from "../ports";
import { fail, ok, type Result } from "../result";
import type { InputSpec, Step } from "../types";
import { getVersion } from "../version/versioning";
import { exportSkillMd } from "./skill-md";

export const BUNDLE_FORMAT = "gammes.bundle/1";

export type GammeBundle = {
  readonly format: string;
  readonly code: string;
  readonly title: string;
  readonly version: number;
  readonly compiledAt: string;
  readonly sourcePageAri?: string;
  readonly inputs: readonly InputSpec[];
  readonly steps: readonly Step[];
  readonly skillMd: string;
  /** L'empreinte du contenu : elle ne couvre pas le hash lui-même. */
  readonly hash: string;
};

type SansHash = Omit<GammeBundle, "hash">;

/** L'empreinte du contenu du paquet — déterministe, clé par clé. */
export const bundleDigest = (hasher: Hasher, bundle: SansHash): string =>
  hasher.hash(JSON.stringify(bundle));

/** Construit le paquet d'une version de gamme. */
export const buildBundle = async (
  deps: Deps,
  args: { readonly code: string; readonly version?: number },
): Promise<Result<GammeBundle>> => {
  const found = await getVersion(deps, args.code, args.version);
  if (!found.ok) return found;
  const value = found.value;
  const skill = await exportSkillMd(deps, { code: args.code, version: value.version });
  if (!skill.ok) return skill;
  const sansHash: SansHash = {
    format: BUNDLE_FORMAT,
    code: args.code,
    title: value.title,
    version: value.version,
    compiledAt: value.compiledAt,
    ...(value.sourcePageAri ? { sourcePageAri: value.sourcePageAri } : {}),
    inputs: value.inputs,
    steps: value.steps,
    skillMd: skill.value.skillMd,
  };
  return ok({ ...sansHash, hash: bundleDigest(deps.hasher, sansHash) });
};

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Relit un paquet : format, champs obligatoires, et **empreinte vérifiée**.
 * Un paquet altéré est refusé — c'est le but du sceau.
 */
export const readBundle = (hasher: Hasher, brut: unknown): Result<GammeBundle> => {
  if (!estObjet(brut)) {
    return fail("internal", "Paquet illisible : ce n'est pas un objet.", "Unreadable bundle: not an object.");
  }
  if (brut.format !== BUNDLE_FORMAT) {
    return fail("internal", `Format de paquet inconnu : « ${String(brut.format)} ».`, `Unknown bundle format: ${String(brut.format)}.`);
  }
  for (const champ of ["code", "title", "version", "compiledAt", "skillMd", "hash"]) {
    if (brut[champ] === undefined) {
      return fail("internal", `Paquet incomplet : « ${champ} » manque.`, `Incomplete bundle: "${champ}" is missing.`);
    }
  }
  const sansHash = {
    format: String(brut.format),
    code: String(brut.code),
    title: String(brut.title),
    version: Number(brut.version),
    compiledAt: String(brut.compiledAt),
    ...(brut.sourcePageAri ? { sourcePageAri: String(brut.sourcePageAri) } : {}),
    inputs: Array.isArray(brut.inputs) ? (brut.inputs as InputSpec[]) : [],
    steps: Array.isArray(brut.steps) ? (brut.steps as Step[]) : [],
    skillMd: String(brut.skillMd),
  };
  const attendu = bundleDigest(hasher, sansHash);
  if (attendu !== String(brut.hash)) {
    return fail("internal", "Paquet altéré : l'empreinte ne correspond plus au contenu.", "Altered bundle: the hash no longer matches the content.");
  }
  return ok({ ...sansHash, hash: attendu });
};
