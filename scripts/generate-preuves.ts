#!/usr/bin/env -S npx tsx
/**
 * Gammes — génération des preuves du site public.
 *
 * Ce que fait ce script, dans l'ordre :
 * 1. il joue la **suite de tests** et note, pour chaque test, son résultat ;
 * 2. il rejoue le **scénario de la démo** (les 28 étapes), avec le **modèle réel** si le
 *    secret du dépôt est présent ;
 * 3. il écrit `web/generated/preuves.json` : pour chaque étape, la preuve obtenue et le
 *    test qui la prouve, avec son statut.
 *
 * Le site public affiche ensuite ce fichier : à chaque étape, on voit que le test passe
 * bien — et la preuve vient du **modèle réel**, sans clé dans le navigateur.
 *
 * Usage :
 *   INFERHUB_API_KEY=… npx tsx scripts/generate-preuves.ts
 *   (sans clé : le scénario tourne sur le modèle scripté, et c'est indiqué dans le fichier)
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Deps } from "../src/core/ports";
import { createState, type AppState } from "../web/state";
import { TOUR_STEPS, TOUR_TESTS } from "../web/tour-steps";
import { inferHubLlm } from "../src/platform/llm/inferhub-llm";
import { memoryBudget } from "../src/platform/llm/budget";

const OUT = resolve(process.cwd(), "web/generated/preuves.json");
const API_KEY = process.env["INFERHUB_API_KEY"] ?? "";
const RAW_BASE = (process.env["INFERHUB_BASE_URL"] ?? "https://api.inferhub.dev/v1").replace(
  /\/chat\/completions\/?$/,
  "",
);
const MODEL = process.env["INFERHUB_MODEL"] ?? "combo/cheap";

type VitestResult = {
  name?: string;
  status?: string;
  assertionResults?: { title?: string; fullName?: string; status?: string }[];
};

type VitestReport = {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  testResults?: VitestResult[];
};

const runSuite = (): VitestReport => {
  const out = "/tmp/gammes-vitest.json";
  const bin = resolve(process.cwd(), "node_modules/vitest/vitest.mjs");
  const res = spawnSync(process.execPath, [bin, "run", "--reporter=json", `--outputFile=${out}`], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0 && !res.stdout.includes("Tests")) {
    console.error("[preuves] la suite n'a pas pu être jouée :", res.stderr.slice(0, 400));
  }
  try {
    return JSON.parse(readFileSync(out, "utf8")) as VitestReport;
  } catch {
    return {};
  }
};

const statusOfTest = (report: VitestReport, file: string, name: string): "passed" | "failed" | "unknown" => {
  for (const result of report.testResults ?? []) {
    const path = (result.name ?? "").replace(/\\/g, "/");
    if (!path.includes(file)) continue;
    for (const assertion of result.assertionResults ?? []) {
      const title = assertion.title ?? "";
      const full = assertion.fullName ?? "";
      if (title === name || full.endsWith(name) || title.includes(name)) {
        return assertion.status === "passed" ? "passed" : assertion.status === "failed" ? "failed" : "unknown";
      }
    }
  }
  return "unknown";
};


type StepRecord = { proof: string; test?: { file: string; name: string; status: string } };

/** Rejoue les étapes du scénario et note, pour chacune, sa preuve et le test qui la prouve. */
/** Budget global : le build des Pages a 5 minutes, on ne les mange pas toutes. */
const DEADLINE_MS = Number(process.env["GAMMES_PREUVES_DEADLINE_MS"] ?? 150_000);

const playScenario = async (state: AppState, report: VitestReport): Promise<Record<string, StepRecord>> => {
  const steps: Record<string, StepRecord> = {};
  const startedAt = Date.now();
  for (const step of TOUR_STEPS) {
    let proof = "";
    let failed = false;
    if (Date.now() - startedAt > DEADLINE_MS) {
      proof = "non exécuté — budget de génération atteint (le modèle réel est plus lent que le scripté)";
      failed = true;
      steps[step.id] = { proof };
      console.log(`[preuves]   ⏱ ${step.id} — ${proof}`);
      continue;
    }
    try {
      proof = await step.run(state);
    } catch (error) {
      proof = `échec — ${(error as Error).message.slice(0, 200)}`;
      failed = true;
    }
    const test = TOUR_TESTS[step.id];
    steps[step.id] = {
      proof,
      ...(test ? { test: { file: test.file, name: test.name, status: statusOfTest(report, test.file, test.name) } } : {}),
    };
    console.log(`[preuves]   ${failed ? "✗" : "✓"} ${step.id} — ${proof.slice(0, 90)}`);
  }
  return steps;
};

const main = async (): Promise<void> => {
  console.log("[preuves] suite de tests…");
  const report = runSuite();
  console.log(
    `[preuves] ${report.numPassedTests ?? 0}/${report.numTotalTests ?? 0} tests passés, ${report.numFailedTests ?? 0} en échec`,
  );

  const budget = memoryBudget(new Date().toISOString().slice(0, 10));
  const state = await createState();
  if (API_KEY) {
    state.deps = {
      ...state.deps,
      llm: inferHubLlm({ apiKey: API_KEY, baseUrl: RAW_BASE, model: MODEL, budget }),
    };
  }
  console.log(`[preuves] scénario (${TOUR_STEPS.length} étapes) avec le modèle ${API_KEY ? MODEL : "scripté"}…`);
  const steps = await playScenario(state, report);

  const payload = {
    generatedAt: new Date().toISOString(),
    engine: API_KEY ? "inferhub" : "scripté",
    model: API_KEY ? MODEL : "fake/gammes-deterministic",
    suite: {
      tests: report.numTotalTests ?? 0,
      passed: report.numPassedTests ?? 0,
      failed: report.numFailedTests ?? 0,
    },
    steps,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`[preuves] écrit : ${OUT}`);
};

await main();
