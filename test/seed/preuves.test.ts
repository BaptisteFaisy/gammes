/**
 * « À chaque étape, un élément qui prouve que cela a fonctionné. »
 *
 * Deux niveaux, une même règle (§ 4 : l'app ne dit jamais « la procédure est
 * respectée » sans trace) :
 *
 *   1. la démo — les traces semées portent une preuve sur chaque étape
 *      franchie, sinon le site montrerait des exécutions sans preuve ;
 *   2. l'encart — chaque étape affiche la preuve **attendue** et la preuve
 *      **laissée**.
 */

import { describe, expect, it } from "vitest";
import { agent, human, makeDeps, T0 } from "../helpers";
import { PAGES, seedAtelier, seedTraces } from "../../seed/atelier";
import { compilePage } from "../../src/core/compile/compile-page";
import { approveVersion } from "../../src/core/version/versioning";
import { recordStep } from "../../src/core/run/record";
import { startRun } from "../../src/core/run/runs";
import { panelSteps } from "../../src/ui/issue-panel/panel-model";
import { validInputs } from "../moteur-execution/fixtures";

const OWNER = "ari:cloud:aaid:demo:ana";

const compileAndApprove = async (deps: ReturnType<typeof seedAtelier>["deps"], ari: string) => {
  const compiled = await compilePage(deps, { page: PAGES[ari]!, confirmedBy: human(OWNER) });
  if (!compiled.ok) throw new Error(compiled.error.messageFr);
  await deps.store.gammes.update(compiled.value.gamme.id, (g) => ({ ...g, ownerRef: OWNER }));
  const approved = await approveVersion(deps, { versionId: compiled.value.version.id, approver: human(OWNER) });
  if (!approved.ok) throw new Error(approved.error.messageFr);
  return compiled.value;
};

describe("la démo : une preuve par étape franchie", () => {
  it("chaque étape franchie des traces semées porte sa preuve", async () => {
    const { deps } = seedAtelier();
    const out = await compileAndApprove(deps, "ari:page/deploy");
    const step = out.version.steps[1]!;
    await seedTraces(deps, {
      gammeId: out.gamme.id, code: out.gamme.code, versionId: out.version.id, n: 5, failures: 2, stepId: step.id,
    });
    const runs = await deps.store.runs.list();
    expect(runs).toHaveLength(5);
    for (const run of runs) {
      for (const etape of run.steps.filter((s) => s.state === "done" || s.state === "failed")) {
        expect(etape.evidence, `${run.id}/${etape.stepId}`).toBeDefined();
        expect(etape.evidence?.ref).toBeTruthy();
      }
    }
  });

  it("chaque preuve semée porte un extrait que le juge peut lire", async () => {
    const { deps } = seedAtelier();
    const out = await compileAndApprove(deps, "ari:page/deploy");
    await seedTraces(deps, {
      gammeId: out.gamme.id, code: out.gamme.code, versionId: out.version.id, n: 3, failures: 0,
      stepId: out.version.steps[0]!.id,
    });
    const runs = await deps.store.runs.list();
    for (const etape of runs[0]!.steps.filter((s) => s.state === "done")) {
      expect(etape.evidence?.note, etape.stepId).toBeTruthy();
      expect(etape.evidence?.note?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it("l'extrait d'une étape à commande montre la commande et sa sortie", async () => {
    const { deps } = seedAtelier();
    const out = await compileAndApprove(deps, "ari:page/deploy");
    const commande = out.version.steps.find((s) => s.command);
    expect(commande).toBeDefined();
    await seedTraces(deps, {
      gammeId: out.gamme.id, code: out.gamme.code, versionId: out.version.id, n: 1, failures: 0,
      stepId: commande!.id,
    });
    const runs = await deps.store.runs.list();
    const extrait = runs[0]!.steps.find((s) => s.stepId === commande!.id)?.evidence?.note ?? "";
    expect(extrait).toContain(commande!.command);
    expect(extrait.length).toBeGreaterThan(20);
  });

  it("la preuve semée suit la spec de la version (une seule source de vérité)", async () => {
    const { deps } = seedAtelier();
    const out = await compileAndApprove(deps, "ari:page/deploy");
    const step = out.version.steps[0]!;
    await seedTraces(deps, {
      gammeId: out.gamme.id, code: out.gamme.code, versionId: out.version.id, n: 2, failures: 0, stepId: step.id,
    });
    const runs = await deps.store.runs.list();
    const preuve = runs[0]?.steps.find((s) => s.stepId === step.id)?.evidence;
    expect(preuve?.kind).toBe(step.evidence.kind);
    expect(preuve?.strength).toBe(step.evidence.strength);
  });
});

describe("l'encart : la preuve attendue et la preuve laissée", () => {
  it("chaque étape de la gamme a une preuve attendue, avec sa force", async () => {
    const deps = makeDeps();
    const compiled = await compilePage(deps, { page: PAGES["ari:page/deploy"]!, confirmedBy: human(OWNER) });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const etapes = await panelSteps(deps, { code: compiled.value.gamme.code });
    expect(etapes.length).toBeGreaterThan(3);
    for (const etape of etapes) {
      expect(etape.proofExpected.kind).toBeTruthy();
      expect(etape.proofExpected.strength).toBeTruthy();
    }
  });

  it("une étape franchie montre la preuve laissée ; une étape en attente, non", async () => {
    const deps = makeDeps();
    const compiled = await compilePage(deps, { page: PAGES["ari:page/deploy"]!, confirmedBy: human(OWNER) });
    if (!compiled.ok) throw new Error(compiled.error.messageFr);
    await deps.store.gammes.update(compiled.value.gamme.id, (g) => ({ ...g, ownerRef: OWNER }));
    await approveVersion(deps, { versionId: compiled.value.version.id, approver: human(OWNER) });
    const started = await startRun(deps, {
      code: compiled.value.gamme.code, inputs: validInputs(), actor: agent(), ticketRef: "PAY-777",
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const premiere = compiled.value.version.steps[0]!;
    const acquit = await recordStep(deps, {
      runId: started.value.run.id,
      stepId: premiere.id,
      outcome: "done",
      evidence: { kind: "command_output", strength: "machine", ref: "https://ci.example.internal/build/4242", capturedAt: T0 },
      actor: agent(),
    });
    expect(acquit.ok).toBe(true);

    const etapes = await panelSteps(deps, { code: compiled.value.gamme.code, runId: started.value.run.id });
    const franchie = etapes.find((e) => e.stepId === premiere.id);
    expect(franchie?.proof?.ref).toBe("https://ci.example.internal/build/4242");
    const suivante = etapes.find((e) => e.stepId !== premiere.id);
    expect(suivante?.proof).toBeUndefined();
  });
});
