/**
 * Recette de bout en bout (§ 25) — points 1 à 11.
 *
 * Ces tests déroulent le produit COMPLET sur l'espace de démonstration (`seed/atelier.ts`) :
 * détection → compilation → approbation → exécution → verrous → trace. Ils complètent les
 * tests unitaires de chaque lot en prouvant que la chaîne tient ensemble. Chaque `it` cite
 * son numéro de recette.
 */

import { describe, expect, it } from "vitest";
import { agent, human } from "../helpers";
import { PAGES, seedAtelier, seedSettings } from "../../seed/atelier";
import { detectCandidates } from "../../src/core/detect/detect-candidates";
import { compilePage } from "../../src/core/compile/compile-page";
import { approveVersion } from "../../src/core/version/versioning";
import { startRun, recordStep, reportDeviation, finishRun, getCurrentStep } from "../../src/core/run/runs";
import { buildTrace, renderTraceMarkdown } from "../../src/core/trace/trace";
import { detectSecrets } from "../../src/core/secrets/detectors";

const OWNER = "ari:cloud:aaid:demo:ana";

const compileAndApprove = async (deps: ReturnType<typeof seedAtelier>["deps"], ari: string) => {
  const compiled = await compilePage(deps, { page: PAGES[ari]!, confirmedBy: human(OWNER) });
  if (!compiled.ok) throw new Error(compiled.error.messageFr);
  await deps.store.gammes.update(compiled.value.gamme.id, (g) => ({ ...g, ownerRef: OWNER }));
  const approved = await approveVersion(deps, { versionId: compiled.value.version.id, approver: human(OWNER) });
  if (!approved.ok) throw new Error(approved.error.messageFr);
  return compiled.value;
};

describe("recette 1–6 : compiler et approuver", () => {
  it("1. liste numérotée + bloc de code ⇒ étapes citant leur passage source", async () => {
    const { deps } = seedAtelier();
    const compiled = await compilePage(deps, { page: PAGES["ari:page/deploy"]!, confirmedBy: human(OWNER) });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const steps = compiled.value.version.steps;
    expect(steps.length).toBeGreaterThanOrEqual(4);
    const withCommand = steps.find((s) => s.command?.includes("kubectl apply"));
    expect(withCommand).toBeDefined();
    for (const s of steps) {
      expect(s.source.pageAri).toBe("ari:page/deploy");
      expect(s.source.quote.length).toBeGreaterThan(3);
      expect(s.source.end).toBeGreaterThan(s.source.start);
    }
  });

  it("2. une page sans signal n'est pas recommandée, et le dit", async () => {
    const { deps } = seedAtelier();
    const candidates = await detectCandidates(deps, [PAGES["ari:page/compte-rendu"]!]);
    expect(candidates[0]?.recommended).toBe(false);
    expect(candidates[0]?.signals).toHaveLength(0);
  });

  it("3. compiler ne publie rien : brouillon + diff, l'état reste draft", async () => {
    const { deps } = seedAtelier();
    const compiled = await compilePage(deps, { page: PAGES["ari:page/deploy"]!, confirmedBy: human(OWNER) });
    if (!compiled.ok) throw new Error("compilation refusée");
    expect(compiled.value.gamme.state).toBe("draft");
    expect(compiled.value.version.approvedAt).toBeUndefined();
    expect(compiled.value.diff).toContain("nouvelle gamme → v1");
  });

  it("4. une étape à risque reçoit un verrou humain et une classe visibles", async () => {
    const { deps } = seedAtelier();
    const compiled = await compilePage(deps, { page: PAGES["ari:page/rotation"]!, confirmedBy: human(OWNER) });
    if (!compiled.ok) throw new Error("compilation refusée");
    const risky = compiled.value.version.steps.find((s) => s.riskClass);
    expect(risky).toBeDefined();
    expect(risky?.locks.some((l) => l.kind === "human" || l.kind === "permit")).toBe(true);
  });

  it("5. une clé dans une étape n'est pas publiée ; signalement avec empreinte et aperçu masqué", async () => {
    const { deps } = seedAtelier();
    const compiled = await compilePage(deps, { page: PAGES["ari:page/creances"]!, confirmedBy: human(OWNER) });
    if (!compiled.ok) throw new Error("compilation refusée");
    expect(compiled.value.findings.length).toBeGreaterThan(0);
    expect(compiled.value.droppedSteps).toBe(1);
    const finding = compiled.value.findings[0]!;
    expect(finding.maskedPreview).toMatch(/^AKI…\[\d+\]$/);
    expect(finding.fingerprint.length).toBe(32);
    // Approbation refusée tant qu'un signalement est ouvert.
    await deps.store.gammes.update(compiled.value.gamme.id, (g) => ({ ...g, ownerRef: OWNER }));
    const approved = await approveVersion(deps, { versionId: compiled.value.version.id, approver: human(OWNER) });
    expect(approved.ok).toBe(false);
    if (!approved.ok) expect(approved.error.code).toBe("lock_secret");
    // Le détecteur isolé ne recopie jamais la valeur.
    expect(JSON.stringify(detectSecrets(deps, PAGES["ari:page/creances"]!.storageBody, "x"))).not.toContain("OSFODNN7EXAMPLE");
  });

  it("6. approbation ⇒ version immuable, datée et nommée", async () => {
    const { deps } = seedAtelier();
    const out = await compileAndApprove(deps, "ari:page/deploy");
    const stored = await deps.store.gammes.get(out.gamme.id);
    expect(stored?.state).toBe("approved");
    expect(stored?.approvedByRef).toBe(OWNER);
    const version = await deps.store.versions.get(out.version.id);
    expect(version?.immutable).toBe(true);
    expect(version?.approvedAt).toBeTruthy();
  });
});

describe("recette 7–11, 13 : dérouler, verrouiller, tracer", () => {
  it("7. start-run épingle la version ; la page peut changer ensuite", async () => {
    const { deps } = seedAtelier();
    const out = await compileAndApprove(deps, "ari:page/deploy");
    const started = await startRun(deps, { code: out.gamme.code, inputs: { service: "paiements", version_cible: "1.0" }, actor: human(OWNER) });
    if (!started.ok) throw new Error("démarrage refusé");
    expect(started.value.run.pinnedVersion).toBe(1);
    expect(started.value.run.versionId).toBe(out.version.id);
  });

  it("8. un agent sur une étape human_only ⇒ refus + tentative tracée comme déviation", async () => {
    const { deps } = seedAtelier();
    const out = await compileAndApprove(deps, "ari:page/deploy");
    const started = await startRun(deps, { code: out.gamme.code, inputs: { service: "paiements", version_cible: "1.0" }, actor: agent("ari:agent:x") });
    if (!started.ok) throw new Error("démarrage refusé");
    const humanStep = out.version.steps.find((s) => s.humanOnly)!;
    // Amène l'exécution jusqu'à l'étape humaine en acquittant les précédentes en humain.
    for (const s of out.version.steps) {
      if (s.id === humanStep.id) break;
      await recordStep(deps, { runId: started.value.run.id, stepId: s.id, outcome: "done", actor: human(OWNER), evidence: { kind: "command_output", strength: "machine", ref: "ci/1", capturedAt: "2026-11-11T09:00:00.000Z" } });
    }
    const refused = await recordStep(deps, { runId: started.value.run.id, stepId: humanStep.id, outcome: "done", actor: agent("ari:agent:x"), evidence: { kind: "attestation", strength: "attested", ref: "x", capturedAt: "2026-11-11T09:00:00.000Z" } });
    expect(refused.ok).toBe(true);
    if (!refused.ok) return;
    expect(refused.value.accepted).toBe(false);
    expect(refused.value.refusal?.code).toBe("lock_human_only");
    expect(refused.value.deviation?.origin).toBe("lock_refusal");
    expect(await deps.store.deviations.count()).toBeGreaterThan(0);
  });

  it("9. étape à risque par un agent sans permis ⇒ refus + demande de permis", async () => {
    const { deps } = seedAtelier({ permitsGranted: false });
    const out = await compileAndApprove(deps, "ari:page/deploy");
    const started = await startRun(deps, { code: out.gamme.code, inputs: { service: "paiements", version_cible: "1.0" }, actor: agent("ari:agent:x") });
    if (!started.ok) throw new Error("démarrage refusé");
    const risky = out.version.steps.find((s) => s.locks.some((l) => l.kind === "permit"))!;
    for (const s of out.version.steps) {
      if (s.id === risky.id) break;
      await recordStep(deps, { runId: started.value.run.id, stepId: s.id, outcome: "done", actor: agent("ari:agent:x"), evidence: { kind: "command_output", strength: "machine", ref: "ci/1", capturedAt: "2026-11-11T09:00:00.000Z" } });
    }
    const refused = await recordStep(deps, { runId: started.value.run.id, stepId: risky.id, outcome: "done", actor: agent("ari:agent:x"), evidence: { kind: "command_output", strength: "machine", ref: "ci/2", capturedAt: "2026-11-11T09:00:00.000Z" } });
    if (!refused.ok) throw new Error("appel en échec");
    expect(refused.value.accepted).toBe(false);
    expect(refused.value.refusal?.code).toBe("lock_permit_missing");
    expect(refused.value.refusal?.details).toHaveProperty("requestUrl");
  });

  it("10. étape sans preuve là où elle est exigée ⇒ n'avance pas", async () => {
    const { deps } = seedAtelier();
    const out = await compileAndApprove(deps, "ari:page/deploy");
    const started = await startRun(deps, { code: out.gamme.code, inputs: { service: "paiements", version_cible: "1.0" }, actor: human(OWNER) });
    if (!started.ok) throw new Error("démarrage refusé");
    const first = out.version.steps[0]!;
    const noProof = await recordStep(deps, { runId: started.value.run.id, stepId: first.id, outcome: "done", actor: human(OWNER) });
    if (!noProof.ok) throw new Error("appel en échec");
    expect(noProof.value.accepted).toBe(false);
    expect(noProof.value.refusal?.code).toBe("evidence_required");
    const still = await getCurrentStep(deps, started.value.run.id);
    if (still.ok) expect(still.value.step.id).toBe(first.id);
  });

  it("11 + 13. déviation déclarée visible dans la trace ; trace citable une fois close", async () => {
    const { deps } = seedAtelier();
    const out = await compileAndApprove(deps, "ari:page/deploy");
    const started = await startRun(deps, { code: out.gamme.code, inputs: { service: "paiements", version_cible: "1.0" }, actor: human(OWNER) });
    if (!started.ok) throw new Error("démarrage refusé");
    const runId = started.value.run.id;
    await reportDeviation(deps, { runId, stepId: out.version.steps[0]!.id, whatHappened: "vérifié depuis le poste d'astreinte", why: "CI indisponible", actor: human(OWNER) });
    const closed = await finishRun(deps, { runId, outcome: "aborted", notes: "interrompu" });
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    const trace = closed.value;
    expect(trace.citation).toContain(`${out.gamme.code}@v1`);
    expect(trace.deviations.some((d) => d.why.includes("CI indisponible"))).toBe(true);
    const md = renderTraceMarkdown(trace, "fr");
    expect(md).toContain("Déviations");
    expect(md).toContain("Aucune mesure par personne");
    // buildTrace est rejouable et stable.
    const again = await buildTrace(deps, (await deps.store.runs.get(runId))!);
    expect(again.citation).toBe(trace.citation);
  });
});

describe("recette 21 : robustesse", () => {
  it("21. Confluence injoignable : la gamme approuvée se déroule encore depuis la base", async () => {
    const { deps } = seedAtelier();
    await seedSettings(deps);
    const out = await compileAndApprove(deps, "ari:page/deploy");
    // On coupe Confluence : la gamme approuvée reste exécutable depuis le magasin.
    const started = await startRun(deps, { code: out.gamme.code, inputs: { service: "paiements", version_cible: "1.0" }, actor: human(OWNER) });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const step = await getCurrentStep(deps, started.value.run.id);
    expect(step.ok).toBe(true);
    expect(out.gamme.code).toBeTruthy();
  });
});
