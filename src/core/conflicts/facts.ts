/**
 * Gammes — les faits comparables d'une gamme (§ 13).
 *
 * Un conflit n'est jamais une impression : c'est deux faits de même `subject`
 * qui ne disent pas la même chose. Ces faits sont extraits de façon déterministe
 * et chacun cite le passage source qui le fonde — la citation vient de l'étape,
 * jamais réécrite.
 */

import type { Conflict, Gamme, GammeVersion, SourceSpan, Step } from "../types";

export type FactKind = "approvals" | "window" | "order" | "evidence" | "human_lock" | "exclusive";

/** Une gamme approuvée, sa version courante et ses faits : l'unité de comparaison. */
export type LoadedGamme = {
  readonly gamme: Gamme;
  readonly version: GammeVersion;
  readonly facts: readonly Fact[];
};

/** Un conflit pas encore identifié ni daté : la détection le produit, `raiseConflict` le grave. */
export type ConflictDraft = Omit<Conflict, "id" | "state" | "raisedAt">;

export type Fact = {
  readonly kind: FactKind;
  /** Clé de comparabilité : deux faits de même subject sont comparés. */
  readonly subject: string;
  /** Formulation lisible, affichée aux deux propriétaires. */
  readonly value: string;
  /** Valeur numérique quand elle existe (nombre d'approbations, début de fenêtre). */
  readonly count?: number;
  readonly spans: readonly SourceSpan[];
};

const APPROVAL_WORDS =
  /(approbation|approbations|approuv|validation|valider|sign-?off|visa|quorum|double controle)/i;
const WINDOW_RE =
  /(?:entre|de|from)\s*(\d{1,2})\s*[h:.]?\s*(\d{2})?\s*(?:et|à|-|–|to|until)\s*(\d{1,2})\s*[h:.]?\s*(\d{2})?/i;
const NIGHT_WORDS = /(nuit|heures creuses|off-?hours|week-?end|astreinte de nuit|22\s*h|02\s*h)/i;

/** Clé d'une étape : la commande si elle existe, sinon ses premiers mots normalisés. */
export const stepKey = (step: Step): string => {
  if (step.command) return step.command.trim().toLowerCase().replace(/\s+/g, " ");
  return step.text
    .toLowerCase()
    .replace(/[.,;:!?]/g, "")
    .split(/\s+/)
    .slice(0, 6)
    .join(" ");
};

const serviceKey = (gamme: Gamme): string => gamme.scope.services[0] ?? gamme.spaceKey;

const approvalsFact = (gamme: Gamme, version: GammeVersion): Fact | undefined => {
  const concerned = version.steps.filter(
    (s) => APPROVAL_WORDS.test(s.text) || (s.humanOnly && APPROVAL_WORDS.test(s.expectedResult ?? "")),
  );
  if (concerned.length === 0) return undefined;
  return {
    kind: "approvals",
    subject: `approbations:${serviceKey(gamme)}`,
    value: `${concerned.length} approbation(s) humaine(s) exigée(s)`,
    count: concerned.length,
    spans: concerned.map((s) => s.source),
  };
};

const windowFact = (gamme: Gamme, version: GammeVersion): Fact | undefined => {
  for (const step of version.steps) {
    const text = `${step.text} ${step.expectedResult ?? ""}`;
    const m = WINDOW_RE.exec(text);
    if (m) {
      const start = Number(m[1]);
      return {
        kind: "window",
        subject: `fenetre:${serviceKey(gamme)}`,
        value: `fenêtre ${m[0].trim()}`,
        count: start,
        spans: [step.source],
      };
    }
    if (NIGHT_WORDS.test(text)) {
      return {
        kind: "window",
        subject: `fenetre:${serviceKey(gamme)}`,
        value: "fenêtre de nuit / heures creuses",
        count: 22,
        spans: [step.source],
      };
    }
  }
  return undefined;
};

const orderFact = (gamme: Gamme, version: GammeVersion): Fact | undefined => {
  if (version.steps.length < 2) return undefined;
  const keys = version.steps.map(stepKey);
  return {
    kind: "order",
    subject: `ordre:${serviceKey(gamme)}`,
    value: keys.map((k, i) => `${i + 1}. ${k}`).join(" | "),
    spans: version.steps.map((s) => s.source),
  };
};

const evidenceFact = (gamme: Gamme, version: GammeVersion): Fact | undefined => {
  const required = version.steps.filter((s) => s.evidence.required);
  const machine = required.filter((s) => s.evidence.strength === "machine");
  if (required.length === 0) return undefined;
  return {
    kind: "evidence",
    subject: `preuve:${serviceKey(gamme)}`,
    value: `${machine.length} preuve(s) machine sur ${required.length} preuve(s) exigée(s)`,
    count: machine.length,
    spans: required.map((s) => s.source),
  };
};

const humanLockFacts = (version: GammeVersion): readonly Fact[] =>
  version.steps
    .filter((s) => s.humanOnly || s.locks.some((l) => l.kind === "human"))
    .map((s) => ({
      kind: "human_lock" as const,
      subject: `verrou_humain:${s.riskClass ?? stepKey(s)}`,
      value: `étape réservée à un humain (${s.riskClass ?? "sans classe"})`,
      spans: [s.source] as readonly SourceSpan[],
    }));

const agentFreeFacts = (version: GammeVersion): readonly Fact[] =>
  version.actorPolicy === "agent_free"
    ? version.steps
        .filter((s) => s.riskClass && !s.humanOnly)
        .map((s) => ({
          kind: "human_lock" as const,
          subject: `verrou_humain:${s.riskClass}`,
          value: "étape à risque laissée libre à un agent (gamme agent_free)",
          spans: [s.source] as readonly SourceSpan[],
        }))
    : [];

const exclusiveFact = (gamme: Gamme, version: GammeVersion): Fact | undefined =>
  gamme.exclusive
    ? {
        kind: "exclusive",
        subject: `ressource:${serviceKey(gamme)}`,
        value: "ressource exclusive : une seule exécution à la fois",
        spans: version.steps.slice(0, 1).map((s) => s.source),
      }
    : undefined;

/** Tous les faits d'une gamme, dans un ordre stable (affichage et diff reproductibles). */
export const factsOf = (gamme: Gamme, version: GammeVersion): readonly Fact[] => {
  const single = [
    approvalsFact(gamme, version),
    windowFact(gamme, version),
    orderFact(gamme, version),
    evidenceFact(gamme, version),
    exclusiveFact(gamme, version),
  ].filter((f): f is Fact => f !== undefined);
  return [...single, ...humanLockFacts(version), ...agentFreeFacts(version)];
};

/** Deux faits se contredisent : même sujet, valeurs différentes (l'ordre est trié pour comparer). */
export const factsContradict = (a: Fact, b: Fact): boolean => {
  if (a.subject !== b.subject) return false;
  if (a.kind === "order" && b.kind === "order") return orderContradicts(a, b);
  if (a.count !== undefined && b.count !== undefined) return a.count !== b.count;
  return a.value !== b.value;
};

const orderContradicts = (a: Fact, b: Fact): boolean => {
  const keys = (f: Fact): string[] => f.value.split(" | ").map((part) => part.replace(/^\d+\. /, ""));
  const left = keys(a);
  const right = keys(b);
  const shared = left.filter((k) => right.includes(k));
  if (shared.length < 2) return false;
  const leftOrder = left.filter((k) => shared.includes(k)).join(">");
  const rightOrder = right.filter((k) => shared.includes(k)).join(">");
  return leftOrder !== rightOrder;
};
