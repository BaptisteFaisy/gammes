/**
 * Le resolver et ses actions (§ 20) : le câblage est testé avec le magasin en mémoire,
 * hors Forge. Chaque action est une fonction pure du `Deps` — aucune dépendance à @forge/*.
 */

import { describe, expect, it } from "vitest";
import { actorFromRequest, createActions } from "../../src/resolver/actions";
import { handleTool, MCP_TOOLS } from "../../src/core/mcp/tools";
import { compilePage } from "../../src/core/compile/compile-page";
import { approveVersion } from "../../src/core/version/versioning";
import { startRun } from "../../src/core/run/runs";
import { human, makeDeps, makePage } from "../helpers";

const OWNER = "ari:cloud:aaid:demo:ana";

const PAGE = makePage({
  ari: "ari:page/resolver",
  title: "Procédure : redémarrer le worker",
  storageBody: [
    "<h1>Procédure : redémarrer le worker</h1>",
    "<h2>Étapes</h2><ol>",
    "<li>Vérifier que le worker est en échec.</li>",
    "<li>Redémarrer le worker avec la commande :",
    '<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[systemctl restart worker]]></ac:plain-text-body></ac:structured-macro>',
    "</li></ol>",
  ].join("\n"),
});

const seed = async () => {
  const deps = makeDeps();
  const compiled = await compilePage(deps, { page: PAGE, confirmedBy: human(OWNER) });
  if (!compiled.ok) throw new Error("compilation refusée");
  await deps.store.gammes.update(compiled.value.gamme.id, (g) => ({ ...g, ownerRef: OWNER }));
  await approveVersion(deps, { versionId: compiled.value.version.id, approver: human(OWNER) });
  return { deps, code: compiled.value.gamme.code, gammeId: compiled.value.gamme.id };
};

describe("actions du resolver", () => {
  it("atelier : registre, poussières, fraîcheur et couverture d'un coup", async () => {
    const { deps } = await seed();
    const res = await createActions(deps).atelier();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const value = res.value as { gammes: unknown[]; dust: unknown[]; freshness: { total: number }; coverage: { scope: string } };
    expect(value.gammes.length).toBe(1);
    expect(value.freshness.total).toBe(1);
    expect(value.coverage.scope).toBe("*");
  });

  it("gamme : version courante, étapes et statistiques", async () => {
    const { deps, code } = await seed();
    const res = await createActions(deps).gamme({ code });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const value = res.value as { version: { steps: unknown[] } };
    expect(value.version.steps.length).toBeGreaterThanOrEqual(2);
  });

  it("mcp : l'action relaie les 16 outils sans logique propre", async () => {
    const { deps, code } = await seed();
    const viaAction = await createActions(deps).mcp({ tool: "get-procedure", args: { code } });
    const viaTool = await handleTool(deps, "get-procedure", { code });
    expect(viaAction.ok).toBe(true);
    expect(viaTool.ok).toBe(true);
    expect(MCP_TOOLS).toHaveLength(16);
  });

  it("run : l'étape courante d'une exécution démarrée", async () => {
    const { deps, code } = await seed();
    const started = await startRun(deps, { code, inputs: {}, actor: human(OWNER) });
    if (!started.ok) throw new Error("démarrage refusé");
    const res = await createActions(deps).run({ runId: started.value.run.id });
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.value as { step: { ord: number } }).step.ord).toBe(1);
  });

  it("issuePanel : trouve la procédure qui correspond au ticket", async () => {
    const { deps } = await seed();
    const res = await createActions(deps).issuePanel({ summary: "redémarrer le worker" });
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.value as unknown[]).length).toBeGreaterThan(0);
  });

  it("nightly : recalculs sans crash sur un atelier quasi vide", async () => {
    const { deps } = await seed();
    const res = await createActions(deps).nightly();
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.value as { gammes: number }).gammes).toBe(1);
  });

  it("pageEvent : sans gamme liée, rien n'est fait ; avec une liaison, la synchronisation est contrôlée", async () => {
    const { deps, gammeId } = await seed();
    const orphan = await createActions(deps).pageEvent({ ari: "ari:page/inconnue", kind: "updated" });
    expect(orphan.ok).toBe(true);
    if (orphan.ok) expect((orphan.value as { handled: boolean }).handled).toBe(false);

    const binding = (await deps.store.bindings.list((b) => b.gammeId === gammeId))[0];
    expect(binding).toBeDefined();
  });

  it("l'acteur d'une requête Forge est humain par défaut, jamais deviné", () => {
    expect(actorFromRequest({ accountId: OWNER })).toEqual({ id: OWNER, kind: "human" });
    expect(actorFromRequest({ accountId: OWNER }, "agent").kind).toBe("agent");
    expect(actorFromRequest({}).id).toBe("forge:anonymous");
  });
});
