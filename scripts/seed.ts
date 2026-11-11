#!/usr/bin/env -S npx tsx
/**
 * Gammes — sème l'espace de démonstration et affiche l'état de l'atelier (§ 27).
 *
 * Utile aux juges : sans dérouler toute la démo, voir d'un coup les candidates détectées,
 * la couverture, les fantômes et les conflits. Aucun réseau, tout en mémoire.
 *
 * Usage : npx tsx scripts/seed.ts
 */

import { detectCandidates, explainScore } from "../src/core/detect/detect-candidates";
import { detectGhosts } from "../src/core/ghosts/ghosts";
import { detectConflicts } from "../src/core/conflicts/detect";
import { compilePage } from "../src/core/compile/compile-page";
import { approveVersion } from "../src/core/version/versioning";
import { coverageDetail, renderCoverage } from "../src/core/coverage/coverage";
import { PAGES, seedAtelier, seedSettings } from "../seed/atelier";
import { human } from "../test/helpers";

const OWNER = "ari:cloud:aaid:demo:ana";

const seed = async (): Promise<void> => {
  const { deps } = seedAtelier();
  await seedSettings(deps);

  console.log("— Candidates détectées (score + raisons) —");
  const candidates = await detectCandidates(deps, Object.values(PAGES));
  for (const c of candidates) console.log(explainScore(c));

  // Compile ET approuve les deux procédures de déploiement pour faire apparaître un conflit.
  for (const ari of ["ari:page/deploy", "ari:page/deploy-b"]) {
    const c = await compilePage(deps, { page: PAGES[ari]!, confirmedBy: human(OWNER) });
    if (c.ok) {
      await deps.store.gammes.update(c.value.gamme.id, (g) => ({ ...g, ownerRef: OWNER }));
      await approveVersion(deps, { versionId: c.value.version.id, approver: human(OWNER) });
    }
  }

  console.log("\n— Couverture —");
  console.log(renderCoverage(await coverageDetail(deps, "*"), "fr"));

  console.log("\n— Fantômes (motifs répétés jamais écrits) —");
  const ghosts = await detectGhosts(deps, { projectKey: "PAY" });
  for (const g of ghosts) console.log(`  ${g.label} : n=${g.n}, étalement=${g.spanDays}j, coût=${g.costDays}j, personnes=${g.peopleCount}`);

  console.log("\n— Conflits —");
  const conflicts = await detectConflicts(deps);
  for (const c of conflicts) console.log(`  ${c.kind} : ${c.gammeA} ↔ ${c.gammeB ?? c.policyPageAri ?? "?"} (${c.facts.length} fait(s))`);
  if (conflicts.length === 0) console.log("  aucun");

  console.log(`\nAtelier semé : ${await deps.store.gammes.count()} gamme(s), ${await deps.store.candidates.count()} candidate(s), ${ghosts.length} fantôme(s), ${conflicts.length} conflit(s).`);
};

await seed();
