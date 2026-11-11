/**
 * Détection des pages candidates (GA-01) et extraction déterministe des étapes
 * (GA-02), avec le passage source exact de chaque étape.
 *
 * Recette 1 : une page avec une liste numérotée et un bloc de code compile en étapes
 * dont chacune cite son passage source.
 * Recette 2 : une page sans aucun signal n'est pas proposée, ou l'est avec un score
 * faible et ses raisons.
 */

import { describe, expect, it } from "vitest";
import { makeDeps, makePage } from "../helpers";
import {
  DETECTION_SIGNALS,
  RECOMMEND_THRESHOLD,
  detectCandidates,
  explainScore,
  scorePage,
} from "../../src/core/detect/detect-candidates";
import { extractInputs, extractSteps, parseStorageBody } from "../../src/core/extract/extract-steps";
import { scriptedLlm } from "../../src/platform/llm/fake-llm";

const COMPTÉ_RENDU = [
  "<h1>Compte rendu du comité du 3 mars</h1>",
  "<p>Ordre du jour, décisions et suites données. Aucun geste technique n'est décrit ici.</p>",
].join("\n");

const AVEC_ENTREES = [
  "<h1>Procédure : redémarrer le worker facturation</h1>",
  "<h2>Entrées</h2>",
  "<ul>",
  "<li>service : nom du service concerné (obligatoire)</li>",
  "<li>environnement : parmi production, preprod, staging (obligatoire)</li>",
  "<li>timeout_portes : nombre de secondes, 120 par défaut</li>",
  "</ul>",
  "<h2>Étapes</h2>",
  "<ol><li>Vérifier que le worker est bien en échec.</li><li>Redémarrer le worker.</li></ol>",
].join("\n");

const PROSE_AMBIGUE = [
  "<h1>Mode opératoire : rotation des clés de signature</h1>",
  "<p>Exécuter la rotation en deux temps : d'abord générer la nouvelle clé dans le coffre, puis attendre que tous les services l'aient rechargée avant de révoquer l'ancienne clé de signature.</p>",
].join("\n");

describe("détection des candidates (GA-01)", () => {
  it("une page de procédure est recommandée, avec ses raisons", () => {
    const page = makePage({ viewsLast30d: 42, linkedFromOnCall: true });
    const { score, signals } = scorePage(page);
    expect(score).toBeGreaterThan(RECOMMEND_THRESHOLD);
    const keys = signals.map((s) => s.key);
    expect(keys).toContain("titre_procedure");
    expect(keys).toContain("liste_numerotee");
    expect(keys).toContain("blocs_de_code");
    expect(keys).toContain("lien_astreinte");
    expect(signals.every((s) => s.reason.length > 10)).toBe(true);
    expect(
      explainScore({
        id: "cnd_1",
        pageAri: page.ari,
        title: page.title,
        spaceKey: page.spaceKey,
        score,
        signals,
        recommended: true,
        scannedAt: "",
      }),
    ).toContain("recommandée");
  });

  it("recette 2 : une page sans signal n'est pas proposée, et le dit", () => {
    const page = makePage({ title: "Compte rendu du comité", labels: [], storageBody: COMPTÉ_RENDU });
    const { score, signals } = scorePage(page);
    expect(score).toBeLessThan(RECOMMEND_THRESHOLD);
    expect(signals).toHaveLength(0);
    expect(explainScore({ id: "cnd_x", pageAri: page.ari, title: page.title, spaceKey: page.spaceKey, score, signals, recommended: false, scannedAt: "" })).toContain("Aucun signal");
  });

  it("les candidates sont classées, persistées et non recompilées deux fois", async () => {
    const deps = makeDeps();
    const pages = [
      makePage({ title: "Compte rendu", labels: [], storageBody: COMPTÉ_RENDU }),
      makePage({ ari: "ari:cloud:confluence:demo:page/1002", id: "1002" }),
    ];
    const first = await detectCandidates(deps, pages);
    expect(first[0]?.title).toContain("Procédure");
    expect(first[0]!.score).toBeGreaterThan(first[1]!.score);
    const second = await detectCandidates(deps, pages);
    expect(await deps.store.candidates.count()).toBe(2);
    expect(second.map((c) => c.id)).toEqual(first.map((c) => c.id));
    expect(DETECTION_SIGNALS.length).toBeGreaterThanOrEqual(8);
  });

  it("le périmètre d'espace est respecté", async () => {
    const deps = makeDeps();
    const page = makePage({ spaceKey: "AUTRE" });
    const out = await detectCandidates(deps, [page], {
      spaceKey: "SRE",
      riskMotifs: [],
      policyPages: [],
      statThreshold: 30,
      lockPolicy: "human_or_permitted_agent",
      reviewAfterDays: 365,
      dustAfterDays: 90,
      lang: "fr",
    });
    expect(out).toHaveLength(0);
  });
});

describe("extraction déterministe (GA-02)", () => {
  it("recette 1 : liste numérotée et bloc de code deviennent des étapes citant leur passage", async () => {
    const deps = makeDeps(); // forbiddenLlm : le moindre appel modèle ferait échouer le test
    const page = makePage();
    const { drafts, usedModel, modelTasks } = await extractSteps(deps, page);
    expect(usedModel).toBe(false);
    expect(modelTasks).toEqual([]);
    expect(drafts).toHaveLength(5);
    expect(drafts.map((d) => d.ord)).toEqual([1, 2, 3, 4, 5]);
    expect(drafts.every((d) => d.inferredBy === "rule")).toBe(true);

    const deploy = drafts.find((d) => d.command);
    expect(deploy?.command).toBe("kubectl rollout status deploy/paiements");
    expect(deploy?.kind).toBe("command");
    expect(deploy?.text).toContain("Déployer la version candidate");

    const check = drafts.find((d) => d.text.startsWith("Vérifier"));
    expect(check?.kind).toBe("check");

    for (const d of drafts) {
      expect(d.source.pageAri).toBe(page.ari);
      expect(d.source.quote.length).toBeGreaterThan(5);
      expect(d.source.start).toBeGreaterThanOrEqual(0);
      expect(d.source.end).toBeGreaterThan(d.source.start);
      expect(d.source.end).toBeLessThanOrEqual(page.storageBody.length);
      // Le passage cité est bien celui de la page, balises retirées.
      expect(page.storageBody.slice(d.source.start, d.source.end)).toContain("<li");
    }
  });

  it("les sections sont conservées et les titres ne deviennent pas des étapes", async () => {
    const page = makePage();
    const blocks = parseStorageBody(page);
    const headings = blocks.filter((b) => b.kind === "heading").map((b) => b.text);
    expect(headings).toContain("Étapes");
    expect(headings).toContain("Si ça tourne mal");
    const deps = makeDeps();
    const { drafts } = await extractSteps(deps, page);
    expect(drafts.every((d) => d.sectionTitle === "Étapes" || d.sectionTitle === "Avant de commencer")).toBe(true);
  });

  it("les entrées typées sont lues dans la section dédiée", async () => {
    const page = makePage({ title: "Procédure : redémarrer le worker", storageBody: AVEC_ENTREES, labels: ["runbook"] });
    const blocks = parseStorageBody(page);
    const inputs = extractInputs(blocks);
    expect(inputs.map((i) => i.name)).toEqual(["service", "environnement", "timeout_portes"]);
    expect(inputs[0]?.required).toBe(true);
    expect(inputs[1]?.type).toBe("enum");
    expect(inputs[2]?.type).toBe("number");
    expect(inputs[2]?.required).toBe(false);
  });

  it("le modèle n'intervient que sur la prose ambiguë, et le dit", async () => {
    const page = makePage({ title: "Mode opératoire : rotation", storageBody: PROSE_AMBIGUE, labels: ["sop"] });
    const llm = scriptedLlm({
      extract_prose: JSON.stringify({
        steps: [
          { paragraphIndex: 0, text: "Générer la nouvelle clé dans le coffre", command: "vault write rotations/sign -kind=signing", kind: "command" },
          { paragraphIndex: 0, text: "Révoquer l'ancienne clé après rechargement des services", kind: "manual" },
        ],
      }),
    });
    const deps = makeDeps({ llm });
    const { drafts, usedModel, modelTasks } = await extractSteps(deps, page);
    expect(usedModel).toBe(true);
    expect(modelTasks).toEqual(["extract_prose"]);
    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0]?.cacheKey).toBeTruthy();
    expect(drafts).toHaveLength(2);
    expect(drafts.every((d) => d.inferredBy === "model")).toBe(true);
    expect(drafts[0]?.inferredReason).toContain("prose ambiguë");
    expect(drafts[0]?.kind).toBe("command");
    expect(drafts[1]?.source.quote).toContain("Exécuter la rotation");
  });

  it("réponse de modèle inexploitable : les étapes déterministes restent, sans crash", async () => {
    const page = makePage({ title: "Mode opératoire : rotation", storageBody: PROSE_AMBIGUE, labels: [] });
    const deps = makeDeps({ llm: scriptedLlm({ extract_prose: "pas du JSON" }, "pas du JSON") });
    const { drafts, usedModel } = await extractSteps(deps, page);
    expect(usedModel).toBe(false);
    expect(drafts).toHaveLength(0);
  });
});
