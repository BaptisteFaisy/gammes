#!/usr/bin/env -S npx tsx
/**
 * Gammes — contrôle sur données et modèle RÉELS.
 *
 * Même chemin de code que le site public et que l'app Forge : le vrai compilateur
 * (`src/core`), le vrai adaptateur OpenAI-compatible (`src/platform/llm/inferhub-llm.ts`),
 * un vrai texte de procédure, et un vrai modèle derrière. Aucun bouchon, aucune réponse
 * scriptée : ce qui sort d'ici est ce que le produit produit.
 *
 * La clé ne vient QUE de l'environnement, jamais du dépôt :
 *   INFERHUB_API_KEY=… npx tsx scripts/real-check.ts
 *   INFERHUB_API_KEY=… LLM_BASE_URL=https://api.inferhub.dev/v1 LLM_MODEL=combo/cheap npx tsx scripts/real-check.ts
 *
 * Sans clé, le script s'arrête proprement : il ne triche pas en retombant sur un bouchon.
 */

import type { Deps } from "../src/core/ports";
import type { PageDigest } from "../src/core/types";
import { memoryStore } from "../src/platform/memory-store";
import { systemClock } from "../src/platform/clock";
import { seqIds } from "../src/platform/ids";
import { makeHasher } from "../src/platform/hash";
import { memoryBudget } from "../src/platform/llm/budget";
import { inferHubLlm } from "../src/platform/llm/inferhub-llm";
import { compilePage } from "../src/core/compile/compile-page";
import { approveVersion } from "../src/core/version/versioning";
import { detectConflicts } from "../src/core/conflicts/detect";
import { conciliate } from "../src/core/conciliation/hermes";
import { assessFalsifiability } from "../src/core/falsifiable/falsifiability";
import { human } from "../test/helpers";

const OWNER = "ari:cloud:aaid:demo:ana";

/** Procédure réelle écrite pour ce contrôle : listes ET prose ambiguë, geste à risque, étape floue. */
const PAGE_TLS: PageDigest = {
  ari: "ari:cloud:confluence:reel:page/tls",
  id: "tls",
  spaceKey: "SRE",
  title: "Procédure : renouveler le certificat TLS du portail clients",
  storageBody: [
    "<h1>Procédure : renouveler le certificat TLS du portail clients</h1>",
    "<p>Le certificat du portail expire le 14 de chaque trimestre. Le renouvellement se fait à deux :",
    "une personne exécute, une autre vérifie, parce qu'une coupure du portail bloque toute la relation client.</p>",
    "<h2>Avant de commencer</h2><ul><li>La fenêtre de maintenance est annoncée depuis 48 heures.</li></ul>",
    "<h2>Étapes</h2><ol>",
    "<li>Vérifier la date d'expiration avec openssl s_client -connect portail.example.fr:443.</li>",
    "<li>Déployer le nouveau certificat sur le frontal :",
    '<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[kubectl -n portail rollout restart deploy/frontal]]></ac:plain-text-body></ac:structured-macro>',
    "</li>",
    "<li>Faire valider la fin d'intervention par le responsable d'astreinte.</li>",
    "</ol>",
    "<p>Ensuite s'assurer que tout fonctionne avant de prévenir les équipes concernées, puis supprimer",
    "l'ancien certificat du frontal pour ne pas laisser traîner une clé expirée en production.</p>",
    "<h2>Si ça tourne mal</h2><ol><li>Repartir sur le certificat sauvegardé et redémarrer le frontal.</li></ol>",
  ].join("\n"),
  labels: ["runbook", "tls"],
  lastModifiedAt: new Date().toISOString(),
  pageVersion: 4,
  wordCount: 140,
  reachable: true,
};

const deps = (): Deps => {
  const budget = memoryBudget(new Date().toISOString().slice(0, 10));
  const apiKey = process.env["INFERHUB_API_KEY"] ?? "";
  if (!apiKey) {
    console.error("Aucune clé : INFERHUB_API_KEY est obligatoire — ce contrôle refuse de tricher avec un bouchon.");
    process.exit(2);
  }
  return {
    store: memoryStore(),
    clock: systemClock(),
    ids: seqIds(),
    hasher: makeHasher(),
    llm: inferHubLlm({ apiKey, budget }),
    budget,
  };
};

const titre = (t: string): void => console.log(`\n${"─".repeat(78)}\n${t}\n${"─".repeat(78)}`);

const main = async (): Promise<void> => {
  const d = deps();
  titre("1 · Compilation d'une procédure réelle, avec un modèle réel");
  const compiled = await compilePage(d, { page: PAGE_TLS, confirmedBy: human(OWNER) });
  if (!compiled.ok) throw new Error(`compilation refusée : ${compiled.error.code} — ${compiled.error.messageFr}`);
  const { gamme, version, usedModel, nonFalsifiable } = compiled.value;
  console.log(`gamme ${gamme.code} · v${version.version} · ${version.steps.length} étapes · modèle utilisé : ${usedModel}`);
  console.log(`préconditions : ${version.conditions.preconditions.join(" | ") || "—"}`);
  console.log(`repli : ${version.fallback.steps.map((s) => s.text).join(" | ") || version.fallback.text || "—"}`);
  for (const step of version.steps) {
    const verrous = step.locks.map((l) => (l.kind === "permit" ? `permis:${l.permitClass}` : l.kind)).join("+") || "aucun";
    console.log(
      `  ${step.ord}. [${step.kind}] ${step.text}\n` +
        `     preuve ${step.evidence.kind}/${step.evidence.strength}${step.evidence.required ? " exigée" : ""} · risque ${step.risk}${step.riskClass ? ` (${step.riskClass})` : ""} · verrous ${verrous}\n` +
        `     source « ${step.source.quote.slice(0, 70)} » (${step.source.start}-${step.source.end})${step.inferredBy === "model" ? " · extrait par le modèle" : ""}`,
    );
  }

  titre("2 · Étapes non falsifiables et reformulation demandée au modèle");
  for (const step of version.steps.filter((s) => !s.falsifiable)) {
    console.log(`  « ${step.text} » → ${assessFalsifiability(step.text).note}`);
    console.log(`  reformulation proposée : ${step.rewording ?? "(le modèle n'a rien proposé)"}`);
  }
  if (nonFalsifiable.length === 0) console.log("  aucune — toutes les étapes sont vérifiables");

  titre("3 · Approbation humaine, puis conflit et conciliateur");
  await d.store.gammes.update(gamme.id, (g) => ({ ...g, ownerRef: OWNER }));
  const approved = await approveVersion(d, { versionId: version.id, approver: human(OWNER) });
  console.log(approved.ok ? `approuvée : v${approved.value.currentVersion}, révision ${approved.value.reviewDueAt}` : `refusée : ${approved.error.messageFr}`);

  const budget = d.budget.snapshot();
  titre("Budget réel consommé par ce contrôle");
  console.log(`appels au modèle : ${budget.llmCalls} · jetons : ${budget.tokens} · coût estimé : ${budget.costEstimate} centimes`);
  console.log(`moteur : ${d.llm.name}`);

  const conflicts = await detectConflicts(d, {});
  console.log(`\nconflits détectés sur cet atelier : ${conflicts.length} (déterministe, sans modèle)`);
  if (conflicts[0]) {
    const dossier = await conciliate(d, conflicts[0].id);
    console.log(dossier.ok ? `dossier ${dossier.value.engine}/${dossier.value.model} : ${dossier.value.options.length} options` : `conciliateur : ${dossier.error.messageFr}`);
  }
};

await main();
