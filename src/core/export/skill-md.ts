/**
 * Gammes — export `SKILL.md` par gamme approuvée (§ 15, § 18, GA-13).
 *
 * Chaque gamme approuvée produit un `SKILL.md` téléchargeable, en source ouverte, que
 * l'équipe ajoute à ses agents tiers : l'équivalent dynamique d'un skill par procédure,
 * sans dépendre d'un redéploiement. Garanties : **aucun secret** dans l'export (vérifié,
 * pas simplement promis), et la **version** est toujours citée.
 */

import type { Deps } from "../ports";
import { ok, refusals, type Result } from "../result";
import type { ExportRecord, GammeVersion, Lang, Step, StepLock } from "../types";
import { getVersion } from "../version/versioning";
import { detectSecrets } from "../secrets/detectors";

export type SkillExport = {
  readonly skillMd: string;
  readonly files: Record<string, string>;
  readonly hash: string;
  readonly record: ExportRecord;
};

/** La conduite commune à tous les skills exportés — la même discipline que la maison. */
export const SKILL_CONDUCT = [
  "Chercher une gamme avant d'agir, demander les entrées typées, acquitter chaque étape avec",
  "sa preuve, déclarer toute déviation, s'arrêter net au premier verrou humain ou de permis,",
  "ne jamais improviser une étape à risque, citer la version dans le compte rendu.",
].join(" ");

const LABELS: Record<Lang, { inputs: string; steps: string; fallback: string; source: string; locks: string; evidence: string }> = {
  fr: { inputs: "Entrées", steps: "Étapes", fallback: "Repli", source: "Source", locks: "Verrous", evidence: "Preuve exigée" },
  en: { inputs: "Inputs", steps: "Steps", fallback: "Fallback", source: "Source", locks: "Locks", evidence: "Evidence required" },
};

const lockLabel = (lock: StepLock, lang: Lang): string => {
  if (lang === "en") return lock.kind === "human" ? "human" : lock.kind === "permit" ? `permit: ${lock.permitClass ?? "?"}` : "secret";
  return lock.kind === "human" ? "humain" : lock.kind === "permit" ? `permis « ${lock.permitClass ?? "?"} »` : "secret";
};

const stepLine = (step: Step, lang: Lang): string => {
  const l = LABELS[lang];
  const lines = [`### ${step.ord}. ${step.text}`, "", `- nature : ${step.kind}`];
  if (step.command) {
    lines.push("", "```sh", step.command, "```");
  }
  lines.push("", `- ${l.evidence} : ${step.evidence.kind} (force ${step.evidence.strength})${step.evidence.required ? "" : " — facultative"}`);
  if (step.locks.length > 0) lines.push(`- ${l.locks} : ${step.locks.map((k) => lockLabel(k, lang)).join(" · ")}`);
  if (step.onFailure !== "stop") lines.push(`- conduite en cas d'échec : ${step.onFailure}`);
  return lines.join("\n");
};

const buildSkillMd = (version: GammeVersion, lang: Lang): string => {
  const l = LABELS[lang];
  const locked = version.steps.filter((s) => s.locks.length > 0).length;
  const head = [
    "# Gammes · " + version.title,
    "",
    `> Procédure compilée — **version v${version.version}** (immuable).`,
    `> ${l.source} : ${version.sourcePages.join(", ") || "jira"}`,
    "> " + SKILL_CONDUCT,
    "",
  ];
  const inputs = version.inputs.length > 0
    ? [`## ${l.inputs}`, "", ...version.inputs.map((i) => `- \`${i.name}\` (${i.type}${i.required ? ", obligatoire" : ""}) — ${i.description ?? ""}`), ""]
    : [];
  const pre = version.conditions.preconditions.length > 0
    ? ["## Préconditions", "", ...version.conditions.preconditions.map((p) => `- ${p}`), ""]
    : [];
  const steps = [`## ${l.steps} (${version.steps.length}, dont ${locked} verrouillée${locked > 1 ? "s" : ""})`, "", ...version.steps.map((s) => stepLine(s, lang)), ""];
  const fallback = [`## ${l.fallback}`, "", ...(version.fallback.steps.length > 0 ? version.fallback.steps.map((s) => stepLine(s, lang)) : [version.fallback.text ?? "—"]), ""];
  const footer = ["---", "", "> `Aucun secret dans ce skill.` `Aucune mesure par personne.`", `> Citation : \`${version.title}@v${version.version}\``];
  return [...head, ...inputs, ...pre, ...steps, ...fallback, ...footer].join("\n");
};

export type ExportArgs = { readonly code: string; readonly version?: number; readonly lang?: Lang };

/** Génère et enregistre l'export. Refusé si un secret se cachait dans une étape. */
export const exportSkillMd = async (deps: Deps, args: ExportArgs): Promise<Result<SkillExport>> => {
  const version = await getVersion(deps, args.code, args.version);
  if (!version.ok) return version;
  const value = version.value;
  const lang = args.lang ?? "fr";
  const hay = value.steps.map((s) => `${s.text} ${s.command ?? ""}`).join("\n");
  const findings = detectSecrets(deps, hay, value.sourcePageAri ?? value.sourcePages[0] ?? "");
  if (findings.length > 0) return refusals.secretFound(String(value.version), findings[0]!.id);
  const skillMd = buildSkillMd(value, lang);
  const hash = deps.hasher.hash(skillMd);
  const record: ExportRecord = {
    id: deps.ids.next("xp"),
    gammeId: value.gammeId,
    versionId: value.id,
    skillMdHash: hash,
    exportedAt: deps.clock.now(),
    downloads: 0,
  };
  await deps.store.exports.insert(record);
  await deps.store.appendEvent({
    at: record.exportedAt,
    kind: "skill.exported",
    subjectRef: record.id,
    payload: { code: args.code, version: value.version, lang, hash },
  });
  return ok({ skillMd, files: { "SKILL.md": skillMd }, hash, record });
};