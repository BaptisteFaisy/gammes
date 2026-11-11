#!/usr/bin/env -S npx tsx
/**
 * Gammes — la démo de bout en bout (§ 26, § 27).
 *
 * Déroule tout le produit sur l'espace de démonstration, en mémoire, sans réseau :
 * détection → compilation → approbation → exécution (avec refus d'un agent sur un
 * verrou) → trace → désynchronisation → statistiques → amendement → fraîcheur →
 * fantômes → conflits + conciliateur → export SKILL.md. Chaque acte imprime sa preuve.
 *
 * Usage : npx tsx scripts/demo.ts
 */

import type { Deps } from "../src/core/ports";
import { detectCandidates, explainScore } from "../src/core/detect/detect-candidates";
import { compilePage } from "../src/core/compile/compile-page";
import { approveVersion, getVersion } from "../src/core/version/versioning";
import { startRun, recordStep, finishRun } from "../src/core/run/runs";
import { renderTraceMarkdown } from "../src/core/trace/trace";
import { checkSync } from "../src/core/binding/binding";
import { computeStepStats } from "../src/core/stats/step-stats";
import { proposeFromTraces } from "../src/core/amendments/amendments";
import { detectGhosts } from "../src/core/ghosts/ghosts";
import { detectConflicts } from "../src/core/conflicts/detect";
import { conciliate } from "../src/core/conciliation/hermes";
import { exportSkillMd } from "../src/core/export/skill-md";
import { freshness } from "../src/core/stats/workshop";
import { PAGES, seedAtelier, seedSettings, seedTraces } from "../seed/atelier";
import { human, agent, makePage } from "../test/helpers";

const OWNER = "ari:cloud:aaid:demo:ana";
const line = (t: string): void => console.log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`);
const show = (label: string, value: unknown): void =>
  console.log(`  ${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
const ev = (kind: "command_output" | "attestation", strength: "machine" | "attested", ref: string, at: string) =>
  ({ kind, strength, ref, capturedAt: at } as const);

type Ctx = { code: string; gammeId: string; versionId: string };

const phaseDetect = async (deps: Deps): Promise<void> => {
  line("1 · DÉTECTION — quelles pages sont des procédures ?");
  const candidates = await detectCandidates(deps, Object.values(PAGES));
  for (const c of candidates.slice(0, 3)) console.log(explainScore(c));
};

const phaseCompileApprove = async (deps: Deps): Promise<Ctx> => {
  line("2 · COMPILATION — la page de déploiement devient une gamme (brouillon + diff)");
  const compiled = await compilePage(deps, { page: PAGES["ari:page/deploy"]!, confirmedBy: human(OWNER) });
  if (!compiled.ok) throw new Error(compiled.error.messageFr);
  show("gamme", compiled.value.gamme.code);
  show("état", compiled.value.gamme.state);
  show("étapes", compiled.value.version.steps.length);
  console.log(compiled.value.diff.split("\n").slice(0, 5).join("\n"));

  line("3 · APPROBATION — acte humain daté, version immuable");
  await deps.store.gammes.update(compiled.value.gamme.id, (g) => ({ ...g, ownerRef: OWNER }));
  const approved = await approveVersion(deps, { versionId: compiled.value.version.id, approver: human(OWNER) });
  if (!approved.ok) throw new Error(approved.error.messageFr);
  show("état", approved.value.state);
  show("révision due", approved.value.reviewDueAt);
  return { code: compiled.value.gamme.code, gammeId: compiled.value.gamme.id, versionId: compiled.value.version.id };
};

const phaseRun = async (deps: Deps, ctx: Ctx, now: string): Promise<void> => {
  line("4 · EXÉCUTION — un agent déroule, et s'arrête net au premier verrou");
  const started = await startRun(deps, { code: ctx.code, inputs: { service: "paiements", version_cible: "1.8.2" }, actor: agent("ari:agent:compagnon") });
  if (!started.ok) throw new Error(started.error.messageFr);
  const runId = started.value.run.id;
  const v = await getVersion(deps, ctx.code);
  if (!v.ok) throw new Error("version illisible");
  for (const s of v.value.steps) {
    const res = await recordStep(deps, { runId, stepId: s.id, outcome: "done", actor: agent("ari:agent:compagnon"), evidence: ev("command_output", "machine", "https://ci/build/1", now) });
    const accepted = res.ok && res.value.accepted;
    show(`étape ${s.ord} (${s.kind})`, accepted ? "acquittée" : `refusée — ${res.ok ? res.value.refusal?.code : "?"}`);
    if (!accepted) break; // l'agent s'arrête au premier verrou, il n'improvise pas
  }
  const closed = await finishRun(deps, { runId, outcome: "aborted", notes: "arrêté au verrou" });
  if (closed.ok) console.log(renderTraceMarkdown(closed.value, "fr").split("\n").slice(0, 7).join("\n"));
};

const phaseMeasure = async (deps: Deps, ctx: Ctx, clock: { advanceDays(n: number): void }): Promise<void> => {
  line("5 · DÉSYNCHRONISATION — la page change, la gamme est marquée");
  const modifiee = makePage({ ...PAGES["ari:page/deploy"]!, storageBody: PAGES["ari:page/deploy"]!.storageBody.replace("5 minutes", "15 minutes") });
  await checkSync(deps, ctx.gammeId, modifiee);
  clock.advanceDays(45);
  const sync = await checkSync(deps, ctx.gammeId, modifiee);
  if (sync.ok) { show("état", sync.value.sync); show("âge de l'écart (jours)", sync.value.ageDays ?? 0); }

  line("6 · STATISTIQUES — 40 exécutions, une étape échoue 6 fois sur 10");
  const v = await getVersion(deps, ctx.code);
  const stepId = v.ok ? v.value.steps[1]!.id : "";
  await seedTraces(deps, { gammeId: ctx.gammeId, code: ctx.code, versionId: ctx.versionId, n: 40, failures: 24, stepId });
  const stats = await computeStepStats(deps, { code: ctx.code });
  for (const s of stats) show(`étape ${s.stepId}`, `échec ${s.failRate.value ?? "—"} sur ${s.failRate.cohort.n}`);
  const amended = await proposeFromTraces(deps, { code: ctx.code });
  if (amended.ok && amended.value[0]) show("amendement proposé", amended.value[0].proposal.slice(0, 70));
  line("7 · FRAÎCHEUR de l'atelier");
  show("fraîcheur", await freshness(deps));
};

const phaseExtend = async (deps: Deps, ctx: Ctx): Promise<void> => {
  line("8 · FANTÔMES — 40 tickets semblables, aucune procédure écrite");
  const ghosts = await detectGhosts(deps, { projectKey: "PAY" });
  for (const g of ghosts.slice(0, 2)) show(g.label, `n=${g.n} · étalement=${g.spanDays}j · coût=${g.costDays}j · personnes=${g.peopleCount}`);

  line("9 · CONFLITS — deux gammes déploient paiements différemment");
  const b = await compilePage(deps, { page: PAGES["ari:page/deploy-b"]!, confirmedBy: human(OWNER) });
  if (b.ok) {
    await deps.store.gammes.update(b.value.gamme.id, (g) => ({ ...g, ownerRef: OWNER }));
    await approveVersion(deps, { versionId: b.value.version.id, approver: human(OWNER) });
  }
  const conflicts = await detectConflicts(deps, { service: "paiements" });
  show("conflits", conflicts.length);
  if (conflicts[0]) {
    show("nature", conflicts[0].kind);
    const dossier = await conciliate(deps, conflicts[0].id);
    if (dossier.ok) { show("conciliateur", dossier.value.engine); show("options", dossier.value.options.map((o) => o.title)); show("décision", "humaine requise — l'app ne tranche pas"); }
  }

  line("10 · EXPORT SKILL.md — la gamme devient un outil pour agents tiers");
  const skill = await exportSkillMd(deps, { code: ctx.code });
  if (skill.ok) console.log(skill.value.skillMd.split("\n").slice(0, 8).join("\n"));
};

const demo = async (): Promise<void> => {
  const { deps, clock } = seedAtelier({ permitsGranted: false });
  await seedSettings(deps);
  await phaseDetect(deps);
  const ctx = await phaseCompileApprove(deps);
  await phaseRun(deps, ctx, clock.now());
  await phaseMeasure(deps, ctx, clock);
  await phaseExtend(deps, ctx);
  line("Fin de la démo — la boucle est fermée : la page compile, s'exécute, se mesure, se corrige.");
};

await demo();
