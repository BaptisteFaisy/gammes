/**
 * Gammes — étapes non falsifiables (§ 7, GA-28).
 *
 * « S'assurer que tout va bien » n'est pas une étape : c'est une intention. C'est le
 * défaut n° 1 des runbooks. L'app le **signale** et propose une reformulation ; elle
 * ne devine jamais à la place de l'auteur, et ne publie rien sans validation humaine.
 */

import type { Deps } from "../ports";
import type { Step } from "../types";
import { stripFence } from "../json";

const VAGUE_PATTERNS: readonly RegExp[] = [
  /(s'?assurer|assurez-vous|vérifi\w+|contrôl\w+|check)\s*(que|if)?\s*(tout|ça|ca|cela)\s*(va|marche|fonctionne|est\s+ok|se\s+passe\s+bien)/i,
  /\btout\s+(va\s+bien|fonctionne|marche|est\s+ok|est\s+bon)\b/i,
  /(works?\s+as\s+expected|as\s+expected|tout\s+normalement)/i,
  /(être|etre)\s*(sûr|sur|attentif)\s*que/i,
  /^\s*(?:bien\s+)?(?:vérifier|controll?er|tester)\s*$/i,
];

/** Marqueurs d'un contrôle mesurable : ce qui rend une étape falsifiable. */
const MEASURABLE_PATTERNS: readonly RegExp[] = [
  /\b\d+\s*(?:%|ms|s\b|sec|min|ko|mo|go|€|\$)/i,
  /[<>=≤≥]\s*\d/,
  /\b(?:code|statut|status)\s+(?:\d{3}|HTTP)/i,
  /\b(?:200|201|204|404|500)\b/,
  /\b(?:vert|green|rouge|red|succès|success|échec|failed|healthz|ready)\b/i,
  /\bhttps?:\/\/\S+/i,
  /\b(?:kubectl|curl|grep|tail|journalctl|docker|helm|git|psql|mysql|aws|gh)\b/i,
  /\b(?:logs?|métriques?|metrics?|tableau de bord|dashboard|sonde|probe|healthz|ready)\b/i,
  /\b\d+\s*(?:fois|fois\/|par\s+minute|req\/s|rps)/i,
];

export type Falsifiability = {
  readonly falsifiable: boolean;
  readonly note?: string;
  readonly matchedVague?: string;
  readonly measurable?: readonly string[];
};

const hits = (text: string, patterns: readonly RegExp[]): readonly string[] =>
  patterns.flatMap((p) => {
    const m = p.exec(text);
    return m ? [m[0].trim()] : [];
  });

/** Une étape est falsifiable si elle désigne un objet mesurable, ou si rien d'imprécis ne la traverse. */
export const assessFalsifiability = (text: string): Falsifiability => {
  const vague = hits(text, VAGUE_PATTERNS);
  const measurable = hits(text, MEASURABLE_PATTERNS);
  if (vague.length === 0 && measurable.length === 0) {
    return {
      falsifiable: false,
      note: "aucun critère observable : rien ne permet de dire si l'étape a réussi",
      measurable,
    };
  }
  if (vague.length > 0 && measurable.length === 0) {
    return {
      falsifiable: false,
      note: `formulation invérifiable (« ${vague[0]} ») sans objet mesurable`,
      matchedVague: vague[0],
      measurable,
    };
  }
  return { falsifiable: true, measurable, ...(vague[0] ? { matchedVague: vague[0] } : {}) };
};

const REWORD_TASK = "reword_falsifiable";

const buildPrompt = (step: Step, note: string): string =>
  [
    "Une étape de procédure est invérifiable. Reformule-la en un contrôle falsifiable,",
    "c'est-à-dire avec un objet observable (commande, seuil, code de retour, lien, métrique).",
    "Garde la même intention, ne change pas la langue, ne rajoute aucun contexte inventé.",
    "Réponds en JSON strict : {\"rewording\": string, \"observable\": string}.",
    "",
    `Étape : ${step.text}`,
    step.command ? `Commande citée : ${step.command}` : "Aucune commande citée.",
    `Diagnostic : ${note}`,
  ].join("\n");

/**
 * Reformulation proposée par le modèle — une **proposition**, jamais une écriture
 * automatique : le brouillon reste revu par un humain (§ 6).
 */
export const proposeRewording = async (deps: Deps, step: Step): Promise<string | undefined> => {
  const assessment = assessFalsifiability(step.text);
  if (assessment.falsifiable) return undefined;
  try {
    const res = await deps.llm.complete({
      task: REWORD_TASK,
      prompt: buildPrompt(step, assessment.note ?? "formulation invérifiable"),
      cacheKey: deps.hasher.hash(step.text),
      json: true,
    });
    const parsed = JSON.parse(stripFence(res.text)) as { rewording?: unknown };
    const rewording = typeof parsed.rewording === "string" ? parsed.rewording.trim() : "";
    return rewording.length > 0 ? rewording : undefined;
  } catch {
    return undefined; // modèle indisponible : le signalement suffit, on ne devine pas
  }
};
