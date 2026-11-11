/**
 * Le conciliateur hermes (§ 13) : il prépare un dossier, il ne tranche jamais.
 * Trois garanties testées ici : aucune option inventée sur une réponse invalide,
 * aucune décision possible par un agent, citations transmises telles quelles.
 */

import { describe, expect, it } from "vitest";
import { agent, human, makeDeps } from "../helpers";
import { buildPrompt, conciliate, decideConciliation, HERMES_CONDUCT, parseDossier } from "../../src/core/conciliation/hermes";
import { detectConflicts } from "../../src/core/conflicts/detect";
import { seedTwoGammes } from "./fixtures";
import { fakeLlm, scriptedLlm } from "../../src/platform/llm/fake-llm";
import { seqIds } from "../../src/platform/ids";

const DOSSIER = JSON.stringify({
  summary: "GAM-deploy-01 exige deux approbations, GAM-deploy-02 une seule, sur le service paiements.",
  options: [
    {
      title: "Aligner GAM-deploy-02 sur deux approbations",
      detail: "La politique de déploiement impose le double visa : la gamme B ajoute une étape humaine.",
      affects: ["GAM-deploy-02"],
    },
    {
      title: "Restreindre GAM-deploy-02 aux déploiements hors production",
      detail: "La production reste sur GAM-deploy-01 ; B ne s'applique plus qu'en préproduction.",
      affects: ["GAM-deploy-01", "GAM-deploy-02"],
    },
  ],
});

const raiseOne = async () => {
  const deps = makeDeps();
  await seedTwoGammes(deps);
  const [conflict] = await detectConflicts(deps);
  return { deps, conflict: conflict! };
};

describe("conciliateur hermes (§ 13)", () => {
  it("prépare un dossier : résumé, options, aucune appliquée, décision humaine exigée", async () => {
    const { deps, conflict } = await raiseOne();
    const res = await conciliate(deps, conflict.id, { llm: scriptedLlm({ conciliate_conflict: DOSSIER }) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.engine).toBe("hermes");
    expect(res.value.options.length).toBeGreaterThanOrEqual(2);
    expect(res.value.options.every((o) => o.requiresHuman)).toBe(true);
    expect(res.value.decidedOptionId).toBeUndefined();
    const stored = await deps.store.conflicts.get(conflict.id);
    expect(stored?.conciliationId).toBe(res.value.id);
    expect(stored?.state).toBe("raised"); // porté aux propriétaires, pas tranché
    const events = await deps.store.events((e) => e.kind === "conflict.conciliated");
    expect(events).toHaveLength(1);
  });

  it("l'invite transmet la conduite et les passages sources tels quels", async () => {
    const { deps, conflict } = await raiseOne();
    const llm = scriptedLlm({ conciliate_conflict: DOSSIER });
    await conciliate(deps, conflict.id, { llm });
    const prompt = buildPrompt(conflict);
    expect(prompt).toContain("tu ne tranches jamais");
    expect(prompt).toContain(HERMES_CONDUCT.split("\n")[0]!);
    expect(prompt).toContain(conflict.facts[0]!.leftSpan!.quote);
    expect(llm.calls[0]?.task).toBe("conciliate_conflict");
    expect(llm.calls[0]?.prompt).toContain(conflict.facts[0]!.leftSpan!.quote);
  });

  it("réponse inexploitable : échec propre, aucune option inventée, le conflit reste porté", async () => {
    const { deps, conflict } = await raiseOne();
    const res = await conciliate(deps, conflict.id, {
      llm: scriptedLlm({ conciliate_conflict: "je propose de trancher pour la gamme A" }),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("conciliator_unavailable");
    expect(await deps.store.conciliations.count()).toBe(0);
    expect((await deps.store.conflicts.get(conflict.id))?.state).toBe("raised");
  });

  it("une seule option : refusée — un dossier qui n'offre pas de choix est une décision déguisée", async () => {
    const deps = makeDeps();
    const single = JSON.stringify({ summary: "s", options: [{ title: "t", detail: "d", affects: [] }] });
    expect(parseDossier(single, seqIds())).toBeUndefined();
    const fenced = `voici le dossier :\n\`\`\`json\n${DOSSIER}\n\`\`\`\n`;
    const parsed = parseDossier(fenced, seqIds());
    expect(parsed?.options).toHaveLength(2);
    expect(parseDossier("{ cassé", seqIds())).toBeUndefined();
  });

  it("modèle en panne : le conflit survit, le dossier est absent", async () => {
    const { deps, conflict } = await raiseOne();
    const res = await conciliate(deps, conflict.id, {
      llm: fakeLlm(() => {
        throw new Error("provider indisponible");
      }),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.messageFr).toContain("porté aux propriétaires");
    expect(await deps.store.conflicts.count()).toBe(1);
  });

  it("décider est humain : refus à un agent, option inconnue refusée, décision tracée", async () => {
    const { deps, conflict } = await raiseOne();
    const created = await conciliate(deps, conflict.id, { llm: scriptedLlm({ conciliate_conflict: DOSSIER }) });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const byAgent = await decideConciliation(deps, created.value.id, created.value.options[0]!.id, agent());
    expect(byAgent.ok).toBe(false);
    if (!byAgent.ok) expect(byAgent.error.code).toBe("approval_requires_human");

    const unknown = await decideConciliation(deps, created.value.id, "opt_absent", human());
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe("conciliator_unavailable");

    const decided = await decideConciliation(deps, created.value.id, created.value.options[1]!.id, human());
    expect(decided.ok).toBe(true);
    if (decided.ok) {
      expect(decided.value.decidedOptionId).toBe(created.value.options[1]!.id);
      expect(decided.value.decidedByRef).toBe("ari:cloud:aaid:demo:ana");
    }
  });

  it("dossier introuvable : refus explicite", async () => {
    const deps = makeDeps();
    const res = await decideConciliation(deps, "cnc_inconnu", "opt_1", human());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("conciliator_unavailable");
  });
});
