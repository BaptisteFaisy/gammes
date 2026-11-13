/**
 * L'approbation, action du resolver : l'acte humain qui rend une gamme
 * invocable — et les refus qu'il ne contourne pas.
 *
 * Quatre cas, un par règle : ça approuve, ça refuse sans compte identifié, ça
 * refuse une version déjà approuvée, ça propage le refus d'une garde du cœur
 * (un secret ouvert). Aucun de ces refus n'est une exception : ce sont des
 * réponses, avec un motif.
 */
import { describe, expect, it } from "vitest";
import { makeDeps, makePage } from "../helpers";
import { compile, deployPage, PAGE_AVEC_SECRET } from "../cycle-de-vie/fixtures";
import { isInvocable } from "../../src/core/version/versioning";
import { createActions } from "../../src/resolver/actions";

const OWNER = "ari:cloud:aaid:demo:ana";

/** Compile une page, puis adopte la gamme : sans propriétaire, l'approbation est refusée. */
const brouillonAvecProprietaire = async (deps: ReturnType<typeof makeDeps>, page = deployPage()) => {
  const compilee = await compile(deps, page);
  await deps.store.gammes.update(compilee.gamme.id, (g) => ({ ...g, ownerRef: OWNER }));
  return compilee;
};

describe("approbation (action du resolver)", () => {
  it("approuve une version en brouillon, et la gamme devient invocable", async () => {
    const deps = makeDeps();
    const compilee = await brouillonAvecProprietaire(deps);
    const actions = createActions(deps);
    const res = await actions.approve({ code: compilee.gamme.code }, { accountId: OWNER });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.code).toBe(compilee.gamme.code);
    expect(res.value.version).toBe(1);
    expect(res.value.state).toBe("approved");
    expect(res.value.approvedBy).toBe(OWNER);
    const gamme = await deps.store.gammes.get(compilee.gamme.id);
    expect(gamme?.state).toBe("approved");
    expect(isInvocable(gamme!)).toBe(true);
    expect((await deps.store.events()).some((e) => e.kind === "gamme.approved")).toBe(true);
  });

  it("refuse sans compte identifié : l'approbation est un acte d'une personne", async () => {
    const deps = makeDeps();
    const compilee = await brouillonAvecProprietaire(deps);
    const actions = createActions(deps);
    const res = await actions.approve({ code: compilee.gamme.code });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("approval_requires_human");
    expect(res.error.messageFr).toContain("compte identifié");
    const gamme = await deps.store.gammes.get(compilee.gamme.id);
    expect(gamme?.state).toBe("draft");
  });

  it("refuse une version déjà approuvée : une version approuvée est immuable", async () => {
    const deps = makeDeps();
    const compilee = await brouillonAvecProprietaire(deps);
    const actions = createActions(deps);
    const premier = await actions.approve({ code: compilee.gamme.code }, { accountId: OWNER });
    expect(premier.ok).toBe(true);
    const second = await actions.approve({ code: compilee.gamme.code }, { accountId: OWNER });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe("version_immutable");
  });

  it("propage le refus d'une garde du cœur : un secret ouvert bloque l'approbation", async () => {
    const deps = makeDeps();
    const pageAvecSecret = makePage({ title: "Procédure : déployer", storageBody: PAGE_AVEC_SECRET });
    const compilee = await brouillonAvecProprietaire(deps, pageAvecSecret);
    expect(await deps.store.findings.count((f) => f.state === "open")).toBeGreaterThan(0);
    const actions = createActions(deps);
    const res = await actions.approve({ code: compilee.gamme.code }, { accountId: OWNER });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("lock_secret");
    const gamme = await deps.store.gammes.get(compilee.gamme.id);
    expect(gamme?.state).toBe("draft");
  });

  it("une gamme sans propriétaire reste refusée : elle passe par la file d'adoption", async () => {
    const deps = makeDeps();
    const compilee = await compile(deps, deployPage());
    const actions = createActions(deps);
    const res = await actions.approve({ code: compilee.gamme.code }, { accountId: OWNER });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("gamme_without_owner");
  });

  it("un code inconnu est refusé, pas deviné", async () => {
    const deps = makeDeps();
    const res = await createActions(deps).approve({ code: "GAM-inexistante-01" }, { accountId: OWNER });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("unknown_gamme");
  });
});
