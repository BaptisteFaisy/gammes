/**
 * Gammes — les verrous, côté serveur (§ 9, GA-08 et GA-12).
 *
 * Trois verrous, une seule porte d'entrée : `evaluateStepLocks`. Un client (UI, MCP,
 * webtrigger) ne peut pas les contourner, parce que la décision est prise ici, dans le
 * cœur, et qu'un refus est **toujours enregistré** — la tentative d'un agent sur une
 * étape humaine devient une déviation, jamais une erreur silencieuse.
 */

import type { Deps } from "../ports";
import { refusals, type AppError } from "../result";
import type { ActorRef, Evidence, PermitCheck, Step, StepLock } from "../types";
import { isStrongEnough } from "./evidence";

export type LockDecision = {
  readonly allowed: boolean;
  readonly applied: readonly StepLock[];
  readonly permit?: PermitCheck;
  readonly refusal?: AppError;
};

export type LockContext = {
  readonly step: Step;
  readonly actor: ActorRef;
  /** Périmètre transmis au registre de permis : service, ou espace à défaut. */
  readonly scope: string;
};

const hasLock = (step: Step, kind: StepLock["kind"]): boolean => step.locks.some((l) => l.kind === kind);

/** Le verrou de secret n'a pas de circonstance atténuante : l'étape ne passe pas. */
const secretRefusal = (step: Step): AppError | undefined => {
  const lock = step.locks.find((l) => l.kind === "secret");
  return lock ? refusals.secretFound(step.id, lock.replacement?.findingId ?? "inconnu") : undefined;
};

const humanRefusal = (step: Step, actor: ActorRef): AppError | undefined => {
  const humanOnly = step.humanOnly || hasLock(step, "human");
  return humanOnly && actor.kind !== "human" ? refusals.humanOnly(step.id, actor.id) : undefined;
};

const permitCheck = async (deps: Deps, ctx: LockContext, lock: StepLock): Promise<PermitCheck> => {
  const permitClass = lock.permitClass ?? "non specifiee";
  if (!deps.permits) {
    const denied: PermitCheck = {
      id: deps.ids.next("per"),
      stepId: ctx.step.id,
      permitClass,
      checkedAt: deps.clock.now(),
      result: "unknown_service",
    };
    await deps.store.permits.insert(denied);
    return denied;
  }
  const checked = await deps.permits.check(ctx.actor.id, ctx.actor.kind, permitClass, ctx.scope);
  await deps.store.permits.insert(checked);
  return checked;
};

/** Le verrou de permis ne concerne que les agents : un humain agit sous sa responsabilité. */
const permitRefusal = async (
  deps: Deps,
  ctx: LockContext,
): Promise<{ refusal?: AppError; permit?: PermitCheck }> => {
  const lock = ctx.step.locks.find((l) => l.kind === "permit");
  if (!lock || ctx.actor.kind !== "agent") return {};
  const permit = await permitCheck(deps, ctx, lock);
  if (permit.result === "granted") return { permit };
  const requestUrl = permit.requestUrl ?? (deps.permits ? deps.permits.requestUrl(permit.permitClass) : undefined);
  return { permit, refusal: refusals.permitMissing(ctx.step.id, permit.permitClass, requestUrl) };
};

/**
 * Évalue les trois verrous d'une étape pour un acteur donné.
 * Ordre volontaire : secret (rien ne passe), humain (le refus est tracé), permis
 (l'agent doit présenter un droit).
 */
export const evaluateStepLocks = async (deps: Deps, ctx: LockContext): Promise<LockDecision> => {
  const applied = ctx.step.locks;
  const secret = secretRefusal(ctx.step);
  if (secret) return { allowed: false, applied, refusal: secret };

  const human = humanRefusal(ctx.step, ctx.actor);
  if (human) return { allowed: false, applied, refusal: human };

  const permit = await permitRefusal(deps, ctx);
  if (permit.refusal) {
    return { allowed: false, applied, refusal: permit.refusal, ...(permit.permit ? { permit: permit.permit } : {}) };
  }
  return { allowed: true, applied, ...(permit.permit ? { permit: permit.permit } : {}) };
};

/** Une preuve manquante ou trop faible bloque l'étape : ce n'est pas un verrou, c'est une exigence. */
export const evidenceRefusal = (step: Step, evidence?: Evidence): AppError | undefined => {
  if (!step.evidence.required) return undefined;
  if (!evidence) return refusals.evidenceRequired(step.id, step.evidence.kind);
  if (!isStrongEnough(step.evidence.strength, evidence.strength)) {
    return refusals.evidenceRequired(step.id, `${step.evidence.strength} (fournie : ${evidence.strength})`);
  }
  return undefined;
};
