/**
 * Le garde du manifeste est lui-même gardé : un garde cassé est une porte
 * grande ouverte. Le test lance le script réel et exige qu'il passe.
 *
 * Délai large : le garde compile le schéma `@forge/manifest` (211 modules), ce
 * qui prend quelques secondes — sous un `vitest` qui lance les fichiers en
 * parallèle, le délai par défaut de 5 s serait franchi pour un rien.
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("garde du manifeste Forge", () => {
  it("le manifeste du dépôt passe le garde", () => {
    const sortie = execFileSync("node", ["tools/check-manifest.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(sortie).toContain("manifeste conforme");
  }, 60_000);
});
