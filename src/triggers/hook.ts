/**
 * Gammes — le point d'entrée externe signé (§ 15, § 18, GA-26).
 *
 * Un hook d'agent de code ou un pipeline CI demande à l'app deux choses, en signant :
 * « existe-t-il une procédure pour ce que je m'apprête à faire ? » (avant un geste
 * sensible) et « compile cette page de procédure » (pour peupler l'atelier du tenant).
 *
 * Ces deux requêtes arrivent par un **web trigger**, pas par un événement produit :
 * la plateforme y appelle la fonction avec `(payload, context)` et attend
 * `{ statusCode, headers, body }`. C'est le contrat v2, détaillé dans `hook-shape.ts` ;
 * le violer (renvoyer un objet `Response`) fait répondre la plateforme
 * « 424 Failed Dependency » **sans appeler la fonction** : ni log, ni verdict.
 *
 * Le secret vient de l'environnement Forge (`GAMMES_HOOK_SECRET`) ; sans secret,
 * l'entrée **échoue fermé** (503). La vérification d'intégrité est la même
 * implémentation que celle du resolver (`signatureValide`) — aucune seconde copie.
 */

import type { WebTriggerRequest, WebTriggerResponse } from "@forge/api";
import { compileIfProcedure } from "../core/compile/auto-compile";
import type { Deps } from "../core/ports";
import type { ActorRef, PageDigest } from "../core/types";
import { createSignedHook, signatureValide } from "../platform/webtrigger";
import { entetesDe, json, pageDepuisRequete, texte, transmiseDe } from "./hook-shape";

/** La demande, lue sans jamais supposer sa forme. */
type Demande = Readonly<Record<string, unknown>>;

const demandeDe = (corps: string): Demande | undefined => {
  try {
    const lue = JSON.parse(corps) as unknown;
    return lue && typeof lue === "object" ? (lue as Demande) : undefined;
  } catch {
    return undefined;
  }
};

/** L'en-tête de signature, tel que l'appelant CI l'envoie. */
const SIGNATURE = "x-gammes-signature";

/**
 * La page à compiler : celle du tenant si l'app peut la lire, sinon celle que
 * l'appelant a transmise dans le corps signé.
 *
 * Le second cas n'est pas un trou : la requête est signée, l'appelant identifié, et
 * le contenu empreinté comme toute version compilée. Il existe parce qu'ici l'app
 * n'a **aucun** jeton utilisable — ni utilisateur, ni `asApp()`.
 */
const pagePour = async (
  deps: Deps,
  pageAri: string,
  demande: Demande,
): Promise<PageDigest | undefined> => {
  if (deps.confluence) {
    const page = await deps.confluence.getPage(pageAri);
    if (page.reachable) return page;
  }
  return pageDepuisRequete(pageAri, transmiseDe(demande));
};

/** `job: "compile"` : compile la page si son titre annonce une procédure. */
const jobCompile = async (
  deps: Deps,
  demande: Demande,
): Promise<WebTriggerResponse> => {
  const pageAri = texte(demande.pageAri);
  if (!pageAri) {
    return json(400, { ok: false, error: { code: "page_manquante", message: "`pageAri` est requis pour compiler." } });
  }
  const page = await pagePour(deps, pageAri, demande);
  if (!page) {
    return json(404, {
      ok: false,
      error: {
        code: "page_injoignable",
        message: "Page injoignable : transmets son contenu signé (`title`, `storageBody`, `spaceKey`).",
      },
    });
  }
  const confirmedBy: ActorRef = { id: texte(demande.confirmedById) || "hook:appelant", kind: "human" };
  const rendu = await compileIfProcedure(deps, { page, confirmedBy });
  return json(rendu.ok ? 200 : 422, rendu);
};

/** Sans `job` : la question du § 18, traitée par la même implémentation que le MCP. */
const questionGeste = async (
  deps: Deps,
  corps: string,
  signature: string,
  secret: string,
): Promise<WebTriggerResponse> => {
  const rendu = await createSignedHook(deps, { secret })({ body: corps, signature });
  return json(rendu.ok ? 200 : 422, rendu);
};

/**
 * Le gestionnaire du point d'entrée, construit sur des `Deps` injectées : c'est lui
 * qui est testé, sans runtime Forge. `handler` ci-dessous ne fait que le câbler.
 */
export const createHookHandler = (deps: Deps, secret: string) =>
  async (payload: WebTriggerRequest | undefined): Promise<WebTriggerResponse> => {
    if (!secret) {
      return json(503, { ok: false, error: { code: "hook_non_configuré", message: "Aucun secret de signature configuré." } });
    }
    const corps = typeof payload?.body === "string" ? payload.body : "";
    const signature = entetesDe(payload)[SIGNATURE] ?? "";
    if (!signatureValide(corps, signature, secret)) {
      return json(401, { ok: false, error: { code: "signature_invalide", message: "Signature invalide : requête refusée." } });
    }
    const demande = demandeDe(corps);
    if (!demande) {
      return json(400, { ok: false, error: { code: "corps_invalide", message: "Corps de requête invalide : JSON attendu." } });
    }
    return texte(demande.job) === "compile"
      ? jobCompile(deps, demande)
      : questionGeste(deps, corps, signature, secret);
  };
