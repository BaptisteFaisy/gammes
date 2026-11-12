/**
 * Gammes — chercher une procédure avant d'agir (§ 15, § 18, GA-14).
 *
 * Deux outils MCP en lecture, zéro effet de bord : « existe-t-il une procédure pour ce
 * que je m'apprête à faire ? » et « quelles gammes correspondent ? ». La réponse ne
 * s'invente jamais : une action sans gamme approuvée est dite telle quelle, un agent ne
 * reçoit ni improvisation ni faux positif.
 */

import type { Deps } from "../ports";
import type { Gamme, RiskLevel, StepLock } from "../types";
import { getVersion } from "../version/versioning";
import { tokensOf } from "../text/tokens";

export type ProcedureMatch = {
  readonly code: string;
  readonly title: string;
  readonly version: number;
  readonly state: Gamme["state"];
  readonly confidence: number;
  readonly reasons: readonly string[];
};

export type BeforeActingVerdict = {
  readonly found: boolean;
  readonly code?: string;
  readonly version?: number;
  readonly state?: Gamme["state"];
  readonly risk?: RiskLevel;
  readonly permitRequired?: boolean;
  readonly locks?: readonly StepLock[];
  readonly messageFr: string;
  readonly messageEn: string;
};

const overlap = (a: readonly string[], b: readonly string[]): number => {
  const set = new Set(b);
  return a.filter((w) => set.has(w)).length;
};

const scoreGamme = (gamme: Gamme, queryTokens: readonly string[], service?: string): { confidence: number; reasons: string[] } => {
  const reasons: string[] = [];
  let confidence = 0;
  const serviceExact = service && gamme.scope.services.includes(service);
  if (serviceExact) {
    confidence += 0.4;
    reasons.push(`le service ${service} est dans le périmètre de la gamme`);
  }
  const titleHits = overlap(queryTokens, tokensOf(gamme.title));
  if (titleHits > 0) {
    confidence += Math.min(0.5, titleHits * 0.15);
    reasons.push(`${titleHits} mot(s) du titre correspondent`);
  }
  const codeHits = queryTokens.filter((t) => gamme.code.toLowerCase().includes(t)).length;
  if (codeHits > 0) {
    confidence += 0.2;
    reasons.push("le code de gamme correspond");
  }
  // Le bonus « approuvée » ne vaut que si la gamme a vraiment Correspondence :
  // sinon toute gamme approuvée remonterait comme candidate, même sans rapport.
  if (confidence > 0 && gamme.state === "approved") {
    confidence += 0.1;
    reasons.push("gamme approuvée");
  }
  return { confidence: Math.min(1, Math.round(confidence * 100) / 100), reasons };
};

/** Les gammes les plus proches de la requête, approuvées en tête. */
export const findProcedure = async (
  deps: Deps,
  args: { readonly query?: string; readonly context?: { readonly service?: string; readonly action?: string } } = {},
): Promise<readonly ProcedureMatch[]> => {
  const queryTokens = [...tokensOf(args.query ?? ""), ...tokensOf(args.context?.action ?? "")];
  const service = args.context?.service;
  const gammes = await deps.store.gammes.list();
  const matches = gammes
    .map((gamme) => {
      const { confidence, reasons } = scoreGamme(gamme, queryTokens, service);
      return { gamme, confidence, reasons };
    })
    .filter((m) => m.confidence > 0)
    .sort((a, b) => Number(a.gamme.state !== "approved") - Number(b.gamme.state !== "approved") || b.confidence - a.confidence)
    .slice(0, 10);
  return matches.map((m) => ({
    code: m.gamme.code,
    title: m.gamme.title,
    version: m.gamme.currentVersion,
    state: m.gamme.state,
    confidence: m.confidence,
    reasons: m.reasons,
  }));
};

const noMatch = (intendedAction: string): BeforeActingVerdict => ({
  found: false,
  messageFr: `Aucune gamme approuvée pour « ${intendedAction} ». Ne pas improviser : demander à un humain de documenter la procédure.`,
  messageEn: `No approved gammes for "${intendedAction}". Do not improvise: ask a human to document the procedure.`,
});

/** Le point d'entrée externe : que dit l'atelier d'un geste sensible envisagé ? */
export const checkBeforeActing = async (
  deps: Deps,
  args: { readonly intendedAction: string; readonly service?: string },
): Promise<BeforeActingVerdict> => {
  const matches = await findProcedure(deps, { query: args.intendedAction, context: { service: args.service } });
  const match = matches[0];
  if (!match) return noMatch(args.intendedAction);
  if (match.state !== "approved") {
    return {
      found: true,
      code: match.code,
      version: match.version,
      state: match.state,
      messageFr: `Gamme ${match.code} (état ${match.state}) : non approuvée, un agent ne doit pas s'en servir.`,
      messageEn: `Gammes ${match.code} (state: ${match.state}): not approved, agents must not rely on it.`,
    };
  }
  const versionRes = await getVersion(deps, match.code, match.version);
  const current = versionRes.ok ? versionRes.value : undefined;
  const locks = current?.steps.flatMap((s) => s.locks) ?? [];
  const risk = current?.steps.reduce<RiskLevel>((worst, s) => (s.risk === "critical" || s.risk === "high" ? "high" : worst), "none") ?? "none";
  const permitRequired = locks.some((l) => l.kind === "permit");
  return {
    found: true,
    code: match.code,
    version: match.version,
    state: "approved",
    risk,
    permitRequired,
    ...(locks.length > 0 ? { locks } : {}),
    messageFr: `Gamme ${match.code}@v${match.version} trouvée${permitRequired ? " : des permis sont requis" : ""}.`,
    messageEn: `Gammes ${match.code}@v${match.version} found${permitRequired ? ": permits are required" : ""}.`,
  };
};