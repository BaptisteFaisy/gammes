/**
 * Le point d'entrée externe signé : le contrat web trigger **v2**.
 *
 * Ce que la plateforme impose, et ce que ce test verrouille :
 * - la fonction rend `{ statusCode, headers, body }` — pas un objet `Response` : avec
 *   le mauvais type, la plateforme répond « 424 Failed Dependency » **sans jamais
 *   appeler la fonction**, donc sans log ni verdict (le bug qui a fait échouer la
 *   compilation automatique en production) ;
 * - le corps arrive en chaîne et les en-têtes en tableaux, à plat et sans casse ;
 * - sans secret, l'entrée **échoue fermé** (503) ; signature fausse → 401 ;
 * - le verdict d'un geste est celui de `check-before-acting` (une seule implémentation) ;
 * - `job: "compile"` accepte la page **transmise** par l'appelant signé, parce qu'un
 *   web trigger n'a aucun jeton : ni `asUser()`, ni `asApp()`.
 */

import { describe, expect, it } from "vitest";
import { createHookHandler } from "../../src/triggers/hook";
import { signBody } from "../../src/platform/webtrigger";
import { makeDeps, makePage } from "../helpers";
import { CODE, OWNER, seedApproved } from "../mcp/fixtures";
import type { ConfluencePort } from "../../src/core/ports";
import type { PageDigest } from "../../src/core/types";

const SECRET = "un-secret-de-test-assez-long-pour-le-hmac";
const ARI = "ari:cloud:confluence:demo:page/7001";

/** Une requête de web trigger v2 : corps en chaîne, en-têtes en tableaux. */
const requete = (corps: string, signature: string, cle = "x-gammes-signature") => ({
  method: "POST" as const,
  body: corps,
  path: "/x1/hook",
  headers: { [cle]: [signature] },
  queryParameters: {},
});

const appele = async (deps: Parameters<typeof createHookHandler>[0], secret: string, corps: string, signature?: string) =>
  createHookHandler(deps, secret)(requete(corps, signature ?? signBody(corps, secret)));

const corpsDun = (o: Record<string, unknown>): string => JSON.stringify(o);

describe("point d'entrée externe — contrat v2", () => {
  it("sans secret, l'entrée échoue fermé : 503, et rien n'est traité", async () => {
    const rendu = await appele(makeDeps(), "", corpsDun({ intendedAction: "déployer" }));
    expect(rendu.statusCode).toBe(503);
    expect(JSON.parse(rendu.body ?? "{}")).toMatchObject({ ok: false });
  });

  it("une signature fausse est refusée : 401", async () => {
    const rendu = await appele(makeDeps(), SECRET, corpsDun({ intendedAction: "déployer" }), "deadbeef");
    expect(rendu.statusCode).toBe(401);
  });

  it("un corps qui n'est pas du JSON est refusé : 400", async () => {
    const rendu = await appele(makeDeps(), SECRET, "pas du json");
    expect(rendu.statusCode).toBe(400);
  });

  it("la réponse a la forme attendue par la plateforme, et un Content-Type", async () => {
    const rendu = await appele(makeDeps(), SECRET, corpsDun({ intendedAction: "déployer paiements" }));
    expect(rendu).toMatchObject({
      statusCode: expect.any(Number),
      headers: { "Content-Type": ["application/json"] },
    });
    expect(typeof rendu.body).toBe("string");
    expect(() => JSON.parse(rendu.body ?? "")).not.toThrow();
  });

  it("un en-tête envoyé en majuscules est lu (la plateforme ne respecte pas la casse)", async () => {
    const corps = corpsDun({ intendedAction: "déployer paiements" });
    const rendu = await createHookHandler(makeDeps(), SECRET)(
      requete(corps, signBody(corps, SECRET), "X-Gammes-Signature"),
    );
    expect(rendu.statusCode).toBe(200);
  });

  it("le verdict d'un geste est celui de `check-before-acting`", async () => {
    const deps = makeDeps();
    await seedApproved(deps);
    const rendu = await appele(deps, SECRET, corpsDun({ intendedAction: "déployer le service paiements", service: "paiements" }));
    expect(rendu.statusCode).toBe(200);
    const corps = JSON.parse(rendu.body ?? "{}") as { ok: boolean; value: { found: boolean; code: string } };
    expect(corps.ok).toBe(true);
    expect(corps.value.found).toBe(true);
    expect(corps.value.code).toBe(CODE);
  });

  it("sans procédure correspondante, le verdict est rendu tel quel (200, `found: false`)", async () => {
    const rendu = await appele(makeDeps(), SECRET, corpsDun({ intendedAction: "polir la rampe" }));
    const corps = JSON.parse(rendu.body ?? "{}") as { ok: boolean; value: { found: boolean } };
    expect(rendu.statusCode).toBe(200);
    expect(corps.value.found).toBe(false);
  });
});

describe("point d'entrée externe — compilation d'une page du tenant", () => {
  const pageDuTenant = (over: Partial<PageDigest> = {}): PageDigest =>
    makePage({ ari: ARI, title: "Procédure : sauvegarder la base paiements", ...over });

  const depsAvec = (page: PageDigest): ReturnType<typeof makeDeps> =>
    makeDeps({
      confluence: {
        getPage: async () => page,
        listPages: async () => [page],
        isReachable: async () => true,
      } satisfies ConfluencePort,
    });

  it("une page lisible dans le tenant est compilée", async () => {
    const rendu = await appele(
      depsAvec(pageDuTenant()),
      SECRET,
      corpsDun({ job: "compile", pageAri: ARI, confirmedById: OWNER }),
    );
    expect(rendu.statusCode).toBe(200);
    const corps = JSON.parse(rendu.body ?? "{}") as { ok: boolean; value: { compiled: boolean } };
    expect(corps.ok).toBe(true);
    expect(corps.value.compiled).toBe(true);
  });

  it("une page qui n'annonce pas une procédure n'est pas touchée", async () => {
    const rendu = await appele(
      depsAvec(pageDuTenant({ title: "Compte rendu de la réunion du 12" })),
      SECRET,
      corpsDun({ job: "compile", pageAri: ARI }),
    );
    const corps = JSON.parse(rendu.body ?? "{}") as { value: { compiled: boolean; reason?: string } };
    expect(rendu.statusCode).toBe(200);
    expect(corps.value.compiled).toBe(false);
  });

  it("sans jeton dans le tenant, la page transmise par l'appelant signé est compilée", async () => {
    const rendu = await appele(
      makeDeps(),
      SECRET,
      corpsDun({
        job: "compile",
        pageAri: ARI,
        title: "Procédure : sauvegarder la base paiements",
        spaceKey: "SRE",
        storageBody: "<h1>Procédure : sauvegarder la base paiements</h1><h2>Étapes</h2><ol><li>Vérifier la réplication.</li><li>Lancer la sauvegarde :</li></ol>",
      }),
    );
    expect(rendu.statusCode).toBe(200);
    const corps = JSON.parse(rendu.body ?? "{}") as { ok: boolean; value: { compiled: boolean } };
    expect(corps.ok).toBe(true);
    expect(corps.value.compiled).toBe(true);
  });

  it("`job: compile` sans `pageAri` est refusé : 400, et sans page transmise : 404", async () => {
    expect((await appele(makeDeps(), SECRET, corpsDun({ job: "compile" }))).statusCode).toBe(400);
    const injoignable = await appele(
      depsAvec(pageDuTenant({ reachable: false })),
      SECRET,
      corpsDun({ job: "compile", pageAri: ARI }),
    );
    expect(injoignable.statusCode).toBe(404);
  });
});
