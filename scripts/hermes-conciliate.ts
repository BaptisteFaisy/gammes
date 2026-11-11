#!/usr/bin/env -S npx tsx
/**
 * Harness local du conciliateur hermes (§ 13).
 *
 * Sème un atelier minimal (deux gammes en désaccord sur le nombre d'approbations,
 * une page de politique), détecte les conflits, puis prépare les dossiers :
 * - avec `--dry` (ou sans clé) : le dossier est monté par les règles, citations
 *   comprises, et AUCUN appel réseau n'est fait ;
 * - avec une clé InferHub dans l'environnement : le conciliateur interroge le
 *   modèle (task `conciliate_conflict`) et rend le dossier JSON analysé.
 *
 * Usage :
 *   npx tsx scripts/hermes-conciliate.ts --dry
 *   INFERHUB_API_KEY=... npx tsx scripts/hermes-conciliate.ts
 *   INFERHUB_API_KEY=... LLM_MODEL=combo/cheap npx tsx scripts/hermes-conciliate.ts --service paiements
 *
 * La clé ne vient QUE de l'environnement : jamais de fichier versionné, jamais de
 * clé dans la sortie (le conciliateur ne cite que des passages de procédures).
 */

import type { Deps } from "../src/core/ports";
import type { Conflict } from "../src/core/types";
import { detectConflicts } from "../src/core/conflicts/detect";
import { conciliate } from "../src/core/conciliation/hermes";
import { memoryStore } from "../src/platform/memory-store";
import { systemClock } from "../src/platform/clock";
import { seqIds } from "../src/platform/ids";
import { makeHasher } from "../src/platform/hash";
import { memoryBudget } from "../src/platform/llm/budget";
import { forbiddenLlm } from "../src/platform/llm/fake-llm";
import { inferHubLlm } from "../src/platform/llm/inferhub-llm";
import { makeDeps } from "../test/helpers";
import { seedSettings, seedTwoGammes, stubConfluence } from "../test/conflits/fixtures";

type Args = { readonly dry: boolean; readonly service?: string };

const parseArgs = (argv: readonly string[]): Args => {
  const serviceIdx = argv.indexOf("--service");
  return {
    dry: argv.includes("--dry") || !process.env["INFERHUB_API_KEY"],
    ...(serviceIdx >= 0 && argv[serviceIdx + 1] ? { service: argv[serviceIdx + 1] } : {}),
  };
};

const buildDeps = (dry: boolean): Deps => {
  const budget = memoryBudget(new Date().toISOString().slice(0, 10));
  const deps = makeDeps({
    store: memoryStore(),
    clock: systemClock(),
    ids: seqIds(),
    hasher: makeHasher(),
    llm: dry ? forbiddenLlm() : inferHubLlm({ budget }),
    budget,
    confluence: stubConfluence(),
  });
  return deps;
};

const printConflict = (c: Conflict): void => {
  const pair = c.gammeB ?? c.policyPageAri ?? "?";
  console.log(`\n── ${c.id} · ${c.kind} · ${c.gammeA} ↔ ${pair}${c.service ? ` · service ${c.service}` : ""}`);
  for (const f of c.facts) {
    console.log(`   sujet : ${f.subject}`);
    console.log(`   gauche : ${f.left}`);
    if (f.leftSpan) console.log(`            « ${f.leftSpan.quote} » (${f.leftSpan.pageAri}:${f.leftSpan.start}-${f.leftSpan.end})`);
    console.log(`   droite : ${f.right}`);
    if (f.rightSpan) console.log(`            « ${f.rightSpan.quote} » (${f.rightSpan.pageAri}:${f.rightSpan.start}-${f.rightSpan.end})`);
  }
};

const printDossier = (c: Conflict, deps: Deps, dry: boolean): Promise<void> =>
  dry
    ? Promise.resolve(
        console.log(
          `   dossier : non préparé (mode --dry, aucun appel réseau). Le conflit reste porté aux propriétaires.`,
        ),
      )
    : conciliate(deps, c.id).then((res) => {
        if (!res.ok) {
          console.log(`   dossier : échec — ${res.error.code} : ${res.error.messageFr}`);
          return;
        }
        console.log(`   dossier ${res.value.id} (moteur ${res.value.engine}, modèle ${res.value.model})`);
        console.log(`   résumé : ${res.value.summary}`);
        res.value.options.forEach((o, i) => {
          console.log(`   option ${i + 1} — ${o.title} [décision humaine requise]`);
          console.log(`      ${o.detail}`);
          console.log(`      concerne : ${o.affects.join(", ") || "—"}`);
        });
      });

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  const deps = buildDeps(args.dry);
  await seedTwoGammes(deps);
  await seedSettings(deps);
  console.log(`Conciliateur hermes — mode ${args.dry ? "règles (--dry, aucun appel réseau)" : "modèle InferHub"}`);
  const conflicts = await detectConflicts(deps, args.service ? { service: args.service } : {});
  console.log(`${conflicts.length} conflit(s) détecté(s), tous déterministes et cités.`);
  for (const c of conflicts) {
    printConflict(c);
    await printDossier(c, deps, args.dry);
  }
  if (conflicts.length === 0) console.log("Aucun conflit : rien à porter aux propriétaires.");
};

await main();
