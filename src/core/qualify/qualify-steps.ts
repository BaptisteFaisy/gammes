/**
 * Gammes — qualifier chaque étape (§ 6 étage 3, GA-03 et GA-04).
 *
 * Nature, preuve attendue et sa force, verrou humain, idempotence, niveau de
 * risque et classe d'actions, conduite en cas d'échec, délai. **Règles d'abord,
 * modèle ensuite, humain toujours** : une qualification produite ici est un
 * brouillon, jamais une publication.
 */

import type { Deps } from "../ports";
import type { EvidenceSpec, OnFailure, PageDigest, RiskLevel, Step, StepKind, StepLock } from "../types";
import type { DraftStep } from "../extract/extract-steps";
import { assessFalsifiability, proposeRewording } from "../falsifiable/falsifiability";
import { parseJsonLoose } from "../json";
import { detectRisk, isRisky } from "../risk/risk-motifs";

export type QualifyOptions = {
  /** Faux en mode strictement déterministe (aucun appel modèle). */
  readonly useModel?: boolean;
  readonly defaultTimeoutS?: number;
  readonly riskMotifs?: Parameters<typeof detectRisk>[2];
};

const AUTHORITY_RE =
  /(approbation|approuv|validation|valider|responsable|astreinte|on-?call|sign-?off|visa|quorum|double controle)/i;
const SCREENSHOT_RE = /(capture|screenshot|photo|image)/i;
const NON_IDEMPOTENT_RE =
  /\b(delete|drop|truncate|create|insert|send|notif\w*|post|rm|remove|rotate|reset|destroy|apply|push)\b/i;

const evidenceFor = (draft: DraftStep): EvidenceSpec => {
  if (SCREENSHOT_RE.test(draft.text)) {
    return { kind: "screenshot", strength: "attested", required: true, hint: "capture d'écran horodatée" };
  }
  switch (draft.kind) {
    case "command":
      return { kind: "command_output", strength: "machine", required: true, hint: "sortie complète de la commande" };
    case "check":
      return { kind: "command_output", strength: "machine", required: true, hint: "résultat observable du contrôle" };
    case "notification":
      return { kind: "log_ref", strength: "declared", required: false, hint: "lien du message envoyé" };
    case "decision":
      return { kind: "attestation", strength: "attested", required: true, hint: "qui a décidé, sur quel critère" };
    default:
      return { kind: "attestation", strength: "attested", required: true, hint: "attestation de l'opérateur" };
  }
};

const idempotentOf = (draft: DraftStep): boolean => {
  const hay = `${draft.text} ${draft.command ?? ""}`;
  return !NON_IDEMPOTENT_RE.test(hay);
};

const onFailureOf = (draft: DraftStep, risk: RiskLevel): OnFailure => {
  if (isRisky(risk)) return "stop";
  if (draft.kind === "check") return "retry";
  if (draft.kind === "notification") return "skip_with_reason";
  return "stop";
};

const humanOnlyOf = (draft: DraftStep, risk: RiskLevel): boolean =>
  isRisky(risk) || draft.kind === "decision" || AUTHORITY_RE.test(draft.text);

const locksOf = (draft: DraftStep, risk: RiskLevel, riskClass?: string, humanOnly = false): readonly StepLock[] => {
  const out: StepLock[] = [];
  if (humanOnly) {
    out.push({
      kind: "human",
      reason: riskClass
        ? `étape à risque (${riskClass}) : réservée à une personne authentifiée`
        : "acte d'autorité : réservée à une personne authentifiée",
    });
  }
  if (riskClass && isRisky(risk)) {
    out.push({
      kind: "permit",
      reason: `un agent doit présenter un permis valide de la classe « ${riskClass} »`,
      permitClass: riskClass,
    });
  }
  return out;
};

const timeoutOf = (draft: DraftStep, opts: QualifyOptions): number => {
  if (opts.defaultTimeoutS) return opts.defaultTimeoutS;
  if (draft.kind === "command") return 600;
  if (draft.kind === "notification") return 120;
  return 300;
};

type ModelHint = { kind?: StepKind; humanOnly?: boolean; evidence?: EvidenceSpec["kind"] };

const HINT_KINDS: readonly StepKind[] = ["manual", "command", "check", "decision", "notification"];

/** Le modèle n'est consulté que sur une étape manuelle longue et sans signal fort. */
const isAmbiguous = (draft: DraftStep, risk: RiskLevel): boolean =>
  risk === "none" && draft.kind === "manual" && draft.text.length > 120;

const modelHint = async (deps: Deps, draft: DraftStep): Promise<ModelHint | undefined> => {
  try {
    const res = await deps.llm.complete({
      task: "qualify_step",
      prompt: [
        "Qualifie cette étape de procédure. Ne devine rien : réponds seulement si tu es sûr.",
        'JSON strict : {"kind":"manual"|"command"|"check"|"decision"|"notification","humanOnly":boolean,"evidence":"command_output"|"build_link"|"screenshot"|"log_ref"|"ticket_ref"|"attestation"}',
        "",
        `Étape : ${draft.text}`,
      ].join("\n"),
      cacheKey: deps.hasher.hash(draft.text),
      json: true,
    });
    const parsed = parseJsonLoose<Record<string, unknown>>(res.text);
    if (!parsed) return undefined;
    const hint: ModelHint = {};
    if (typeof parsed.kind === "string" && HINT_KINDS.includes(parsed.kind as StepKind)) {
      hint.kind = parsed.kind as StepKind;
    }
    if (typeof parsed.humanOnly === "boolean") hint.humanOnly = parsed.humanOnly;
    return Object.keys(hint).length > 0 ? hint : undefined;
  } catch {
    return undefined; // sans modèle, la qualification par règles reste valable
  }
};

/** Une ébauche devient une étape qualifiée, avec son identifiant et ses verrous. */
export const qualifyStep = async (
  deps: Deps,
  draft: DraftStep,
  _page: PageDigest,
  opts: QualifyOptions = {},
): Promise<Step> => {
  const motif = detectRisk(draft.text, draft.command, opts.riskMotifs);
  const risk: RiskLevel = motif?.level ?? "none";
  const riskClass = motif?.class;
  const hint = opts.useModel === false || !isAmbiguous(draft, risk) ? undefined : await modelHint(deps, draft);
  const kind = hint?.kind ?? draft.kind;
  const humanOnly = hint?.humanOnly ?? humanOnlyOf({ ...draft, kind }, risk);
  const step = assembleStep(deps, draft, {
    kind,
    risk,
    ...(riskClass ? { riskClass } : {}),
    humanOnly,
    falsifiability: assessFalsifiability(draft.text),
    opts,
  });
  if (step.falsifiable || opts.useModel === false) return step;
  const rewording = await proposeRewording(deps, step);
  return rewording ? { ...step, rewording } : step;
};

type Assembled = {
  kind: StepKind;
  risk: RiskLevel;
  riskClass?: string;
  humanOnly: boolean;
  falsifiability: ReturnType<typeof assessFalsifiability>;
  rewording?: string;
  opts: QualifyOptions;
};

const assembleStep = (deps: Deps, draft: DraftStep, a: Assembled): Step => {
  const evidence = evidenceFor({ ...draft, kind: a.kind });
  const step: Step = {
    id: deps.ids.next("stp"),
    ord: draft.ord,
    kind: a.kind,
    text: draft.text,
    evidence,
    locks: locksOf(draft, a.risk, a.riskClass, a.humanOnly),
    humanOnly: a.humanOnly,
    idempotent: idempotentOf(draft),
    risk: a.risk,
    onFailure: onFailureOf(draft, a.risk),
    timeoutS: timeoutOf(draft, a.opts),
    source: draft.source,
    falsifiable: a.falsifiability.falsifiable,
    ...(draft.command ? { command: draft.command } : {}),
    ...(draft.expectedResult ? { expectedResult: draft.expectedResult } : {}),
    ...(a.riskClass ? { riskClass: a.riskClass } : {}),
    ...(draft.sectionTitle ? { section: draft.sectionTitle } : {}),
    ...(a.falsifiability.note ? { falsifiabilityNote: a.falsifiability.note } : {}),
    ...(a.rewording ? { rewording: a.rewording } : {}),
    ...(draft.inferredBy ? { inferredBy: draft.inferredBy } : {}),
    ...(draft.inferredReason ? { inferredReason: draft.inferredReason } : {}),
  };
  return step;
};

/** Qualification d'une page entière, dans l'ordre des étapes. */
export const qualifySteps = async (
  deps: Deps,
  drafts: readonly DraftStep[],
  page: PageDigest,
  opts: QualifyOptions = {},
): Promise<readonly Step[]> => {
  const out: Step[] = [];
  for (const draft of drafts) out.push(await qualifyStep(deps, draft, page, opts));
  return out;
};

/** Résumé lisible pour l'écran de revue : ce que les règles ont décidé, et pourquoi. */
export const qualificationSummary = (steps: readonly Step[]): string => {
  const risky = steps.filter((s) => s.riskClass);
  const human = steps.filter((s) => s.humanOnly);
  const vague = steps.filter((s) => !s.falsifiable);
  return [
    `${steps.length} étape(s) qualifiée(s)`,
    `${risky.length} à risque (${risky.map((s) => s.riskClass).join(", ") || "—"})`,
    `${human.length} réservée(s) à un humain`,
    `${vague.length} non falsifiable(s) à reformuler`,
  ].join(" · ");
};
