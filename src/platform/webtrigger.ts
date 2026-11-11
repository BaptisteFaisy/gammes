/**
 * Gammes — point d'entrée externe signé (§ 15, § 18, GA-26).
 *
 * Un hook d'agent de code ou un pipeline CI demande « existe-t-il une procédure pour ce que
 * je m'apprête à faire ? » avant un geste sensible, sans client MCP. La requête est signée
 * (HMAC-SHA256 du corps avec un secret partagé) ; sans secret configuré, on **échoue fermé**.
 *
 * Dans Forge, le secret vient du stockage chiffré de l'app et le `webtrigger` du manifeste
 * ajoute sa propre signature plateforme — les deux se cumulent, aucun n'est contournable.
 * La logique de verdict est celle de `checkBeforeActing` : une seule implémentation.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Deps } from "../core/ports";
import { fail, ok, type Result } from "../core/result";
import { checkBeforeActing, type BeforeActingVerdict } from "../core/mcp/search";

export type SignedRequest = {
  readonly body: string;
  readonly signature: string;
};

export type HookOptions = {
  /** Secret partagé ; vient de l'environnement ou du coffre Forge. Jamais commité. */
  readonly secret?: string;
  /** Vérificateur injectable (tests) ; par défaut HMAC-SHA256. */
  readonly verify?: (body: string, signature: string, secret: string) => boolean;
};

const hmacVerify = (body: string, signature: string, secret: string): boolean => {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature ?? "", "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
};

export type ParsedHookBody = { readonly intendedAction: string; readonly service?: string };

const parseBody = (body: string): ParsedHookBody | undefined => {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const intendedAction = typeof parsed.intendedAction === "string" ? parsed.intendedAction : undefined;
    if (!intendedAction) return undefined;
    const service = typeof parsed.service === "string" ? parsed.service : undefined;
    return { intendedAction, ...(service ? { service } : {}) };
  } catch {
    return undefined;
  }
};

/** Crée le gestionnaire signé : vérifie la signature, puis répond comme `check-before-acting`. */
export const createSignedHook = (deps: Deps, options: HookOptions = {}) => {
  const verify = options.verify ?? hmacVerify;
  return async (request: SignedRequest): Promise<Result<BeforeActingVerdict>> => {
    if (!options.secret) {
      return fail("conciliator_unavailable", "Point d'entrée non configuré : aucun secret de signature.", "Unsigned hook: no shared secret configured.", {});
    }
    if (!verify(request.body, request.signature, options.secret)) {
      return fail("lock_permit_missing", "Signature invalide : requête refusée.", "Invalid signature: request refused.", {});
    }
    const parsed = parseBody(request.body);
    if (!parsed) {
      return fail("input_invalid", "Corps de requête invalide : `intendedAction` requis.", "Invalid body: `intendedAction` required.", {});
    }
    return ok(await checkBeforeActing(deps, parsed));
  };
};

/** Signe un corps (utilisé par l'appelant CI / hook, jamais côté serveur). */
export const signBody = (body: string, secret: string): string => createHmac("sha256", secret).update(body).digest("hex");