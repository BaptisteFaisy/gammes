/**
 * L'atelier : poussières, fraîcheur, couverture (§ 19, § 10, GA-18) et les gammes
 * fantômes (§ 12, GA-22).
 *
 * Recette 18 : un motif de tickets répétés sans gamme apparaît dans les fantômes, avec
 * nombre de tickets, étalement et coût estimé.
 */

import { describe, expect, it } from "vitest";
import { agent, human, makeClock, makeDeps, makeGamme, T0 } from "../helpers";
import { DEFAULT_DUST_DAYS, freshness, isForgotten, workshopDust } from "../../src/core/stats/workshop";
import { computeCoverage, coverageDetail, renderCoverage } from "../../src/core/coverage/coverage";
import { adoptGhost, clusterKeyOf, detectGhosts, MIN_CLUSTER_SIZE } from "../../src/core/ghosts/ghosts";
import { CODE, makeIssue, seedGamme, seedRuns, stubJira } from "./fixtures";
import { shiftDays } from "../../src/platform/clock";

describe("poussières de l'atelier (§ 19)", () => {
  it("une gamme approuvée et jamais exécutée prend la poussière, avec son âge", async () => {
    const clock = makeClock(T0);
    const deps = makeDeps({ clock });
    await seedGamme(deps);
    clock.advanceDays(120);
    const dust = await workshopDust(deps);
    expect(dust.map((d) => d.kind)).toContain("dust");
    expect(dust[0]?.ageDays).toBe(120);
    expect(dust[0]?.reason).toContain("jamais exécutée");
    expect(isForgotten((await deps.store.gammes.get("gam_stats"))!, clock.now())).toBe(true);
    expect(DEFAULT_DUST_DAYS).toBe(90);
  });

  it("une exécution récente dépoussière l'établi", async () => {
    const clock = makeClock(T0);
    const deps = makeDeps({ clock });
    await seedGamme(deps);
    await seedRuns(deps, 1, 0, "stp_1", clock.now());
    clock.advanceDays(120);
    await seedRuns(deps, 1, 0, "stp_1", clock.now());
    const dust = await workshopDust(deps);
    expect(dust.filter((d) => d.kind === "dust")).toHaveLength(0);
  });

  it("toile d'araignée, panneau rouge et file d'adoption sont des données distinctes", async () => {
    const clock = makeClock(T0);
    const deps = makeDeps({ clock });
    await deps.store.gammes.insert(
      makeGamme({ id: "gam_cobweb", code: "GAM-cobweb-01", reviewDueAt: shiftDays(T0, -10), approvedAt: T0 }),
    );
    await deps.store.gammes.insert(makeGamme({ id: "gam_stale", code: "GAM-stale-01", sync: "stale", approvedAt: T0 }));
    await deps.store.bindings.insert({
      id: "bnd_1",
      gammeId: "gam_stale",
      pageAri: "ari:cloud:confluence:demo:page/1",
      contentHash: "hash",
      syncedAt: T0,
      staleSince: shiftDays(T0, -95),
      sync: "stale",
    });
    await deps.store.gammes.insert(
      makeGamme({ id: "gam_orphan", code: "GAM-orphan-01", ownerRef: undefined, approvedAt: T0 }),
    );
    clock.advanceDays(30);
    const dust = await workshopDust(deps);
    const kinds = dust.map((d) => `${d.code}:${d.kind}`);
    expect(kinds).toContain("GAM-cobweb-01:cobweb");
    expect(kinds).toContain("GAM-stale-01:stale");
    expect(kinds).toContain("GAM-orphan-01:orphan");
    expect(dust.find((d) => d.kind === "stale")?.ageDays).toBe(125);
    expect(dust.find((d) => d.kind === "orphan")?.reason).toContain("file d'adoption");
  });

  it("fraîcheur : part synchronisée, âge médian de l'écart, alerte au-delà de 90 jours", async () => {
    const deps = makeDeps();
    await seedGamme(deps, { id: "gam_a", code: "GAM-a-01", sync: "synced" });
    await deps.store.gammes.insert(makeGamme({ id: "gam_b", code: "GAM-b-01", sync: "stale", approvedAt: T0 }));
    await deps.store.bindings.insert({
      id: "bnd_b",
      gammeId: "gam_b",
      pageAri: "ari:p/2",
      contentHash: "h",
      syncedAt: T0,
      staleSince: shiftDays(T0, -120),
      sync: "stale",
    });
    await deps.store.gammes.insert(makeGamme({ id: "gam_c", code: "GAM-c-01", sync: "stale", approvedAt: T0 }));
    await deps.store.bindings.insert({
      id: "bnd_c",
      gammeId: "gam_c",
      pageAri: "ari:p/3",
      contentHash: "h",
      syncedAt: T0,
      staleSince: shiftDays(T0, -10),
      sync: "stale",
    });
    const fresh = await freshness(deps);
    expect(fresh.total).toBe(3);
    expect(fresh.syncedPct).toBe(33);
    expect(fresh.medianGapDays).toBe(65); // médiane de 10 et 120 jours
    expect(fresh.staleOver90d).toBe(1);
  });

  it("atelier vide : aucune poussière, fraîcheur à 100 %", async () => {
    const deps = makeDeps();
    expect(await workshopDust(deps)).toHaveLength(0);
    expect(await freshness(deps)).toEqual({ syncedPct: 100, medianGapDays: 0, staleOver90d: 0, total: 0 });
  });
});

describe("couverture (GA-18)", () => {
  it("une couverture partielle est déclarée, jamais masquée", async () => {
    const deps = makeDeps();
    for (let i = 0; i < 10; i += 1) {
      await deps.store.candidates.insert({
        id: `cnd_${i}`,
        pageAri: `ari:p/${i}`,
        title: `Procédure ${i}`,
        spaceKey: "SRE",
        score: 0.8,
        signals: [],
        recommended: true,
        scannedAt: T0,
      });
    }
    await seedGamme(deps); // approuvée, sans exécution
    await deps.store.gammes.insert(makeGamme({ id: "gam_draft", code: "GAM-draft-01", state: "draft", sync: "stale" }));
    await deps.store.gammes.insert(makeGamme({ id: "gam_traced", code: "GAM-traced-01" }));
    await seedRuns(deps, 1, 0, "stp_1", T0, "ver_stats_1", "run_cov");

    const detail = await coverageDetail(deps, "SRE");
    expect(detail.pagesDetected).toBe(10);
    expect(detail.compiled).toBe(3);
    expect(detail.compiledPct).toBe(30);
    expect(detail.approvedPct).toBe(67);
    expect(detail.tracedPct).toBe(33);
    expect(detail.stalePct).toBe(33);
    expect(detail.graphReadable).toBe(false);

    const coverage = await computeCoverage(deps, "SRE");
    expect(coverage.scope).toBe("SRE");
    expect(await deps.store.coverage.count()).toBe(1);
    expect(renderCoverage(detail, "fr")).toContain("30 %");
    expect(renderCoverage(detail, "fr")).toContain("droit manquant");
    expect(renderCoverage(detail, "en")).toContain("missing permission");
  });

  it("aucune page détectée : 0 % et aucune division par zéro", async () => {
    const deps = makeDeps();
    const detail = await coverageDetail(deps, "*");
    expect(detail.compiledPct).toBe(0);
    expect(renderCoverage(detail, "fr")).toContain("Périmètre : *");
  });
});

describe("gammes fantômes (§ 12, GA-22)", () => {
  it("recette 18 : 38 tickets semblables sans procédure écrite, avec preuves et coût", async () => {
    const deps = makeDeps();
    const issues = Array.from({ length: 38 }, (_, i) => makeIssue(i));
    const depsWithJira = makeDeps({ jira: stubJira(issues), store: deps.store });
    const ghosts = await detectGhosts(depsWithJira, { projectKey: "PAY" });
    expect(ghosts).toHaveLength(1);
    const ghost = ghosts[0]!;
    expect(ghost.n).toBe(38);
    expect(ghost.spanDays).toBeGreaterThan(0);
    expect(ghost.medianHandleH).toBe(4);
    expect(ghost.peopleCount).toBe(3); // un effectif, jamais un nom
    expect(ghost.costDays).toBe(19);
    expect(ghost.state).toBe("proposed");
    expect(ghost.sampleIssueIds.length).toBeLessThanOrEqual(8);
    expect(JSON.stringify(ghost)).not.toMatch(/assignee|actor/i);
    expect(await deps.store.ghosts.count()).toBe(1);
    expect((await deps.store.events()).some((e) => e.kind === "ghost.proposed")).toBe(true);
  });

  it("sans port Jira ou sous le seuil de motif : aucune proposition", async () => {
    const deps = makeDeps();
    expect(await detectGhosts(deps)).toHaveLength(0);
    const few = Array.from({ length: MIN_CLUSTER_SIZE - 1 }, (_, i) => makeIssue(i));
    const withJira = makeDeps({ jira: stubJira(few) });
    expect(await detectGhosts(withJira, { projectKey: "PAY" })).toHaveLength(0);
  });

  it("un motif déjà proposé n'est pas reproposé", async () => {
    const issues = Array.from({ length: 12 }, (_, i) => makeIssue(i));
    const deps = makeDeps({ jira: stubJira(issues) });
    const first = await detectGhosts(deps, { projectKey: "PAY" });
    const second = await detectGhosts(deps, { projectKey: "PAY" });
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    expect(await deps.store.ghosts.count()).toBe(1);
  });

  it("la clé de regroupement est stable et lisible", () => {
    const key = clusterKeyOf(makeIssue(1));
    expect(key.startsWith("PAY:paiements:")).toBe(true);
    expect(clusterKeyOf(makeIssue(2))).toBe(key);
    expect(clusterKeyOf(makeIssue(3, { summary: "Autre chose sans rapport" }))).not.toBe(key);
  });

  it("l'adoption est humaine et ouvre un brouillon pré-rempli depuis les commentaires constants", async () => {
    const issues = Array.from({ length: 12 }, (_, i) => makeIssue(i));
    const deps = makeDeps({ jira: stubJira(issues) });
    const [ghost] = await detectGhosts(deps, { projectKey: "PAY" });
    expect(ghost).toBeDefined();

    const byAgent = await adoptGhost(deps, ghost!.id, agent());
    expect(byAgent.ok).toBe(false);
    if (!byAgent.ok) expect(byAgent.error.code).toBe("approval_requires_human");

    const byHuman = await adoptGhost(deps, ghost!.id, human());
    expect(byHuman.ok).toBe(true);
    if (!byHuman.ok) return;
    expect(byHuman.value.state).toBe("draft");
    expect(byHuman.value.ownerRef).toBeTruthy();
    expect(byHuman.value.sync).toBe("source_gone"); // aucune page source : elle naît des tickets
    const versions = await deps.store.versions.list((v) => v.gammeId === byHuman.value.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.steps.length).toBe(3);
    expect(versions[0]!.steps[0]!.text).toContain("coffre");
    expect(versions[0]!.steps.every((s) => s.inferredReason?.includes("jamais écrit"))).toBe(true);
    expect((await deps.store.ghosts.get(ghost!.id))?.state).toBe("drafted");
    expect((await deps.store.ghosts.get(ghost!.id))?.draftGammeId).toBe(byHuman.value.id);
  });

  it("fantôme introuvable : refus explicite", async () => {
    const deps = makeDeps();
    const res = await adoptGhost(deps, "gho_absent", human());
    expect(res.ok).toBe(false);
    expect(await detectGhosts(makeDeps({ jira: stubJira([]) }))).toHaveLength(0);
    expect(CODE).toBe("GAM-stats-01");
  });
});
