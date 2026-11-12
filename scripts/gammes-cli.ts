#!/usr/bin/env tsx
/**
 * Gammes — la CLI portable (idée de consolidation n° 9).
 *
 * Une procédure de wiki, hors de l'app : on compile une page en **gamme**, et on
 * emporte le paquet (JSON scellé + `SKILL.md`) dans n'importe quel agent tiers.
 * C'est la première des cinq cibles du § 33.1 — la même source, un autre runtime.
 *
 *   npm run cli -- compile <fichier.html> [--sortie <dossier>]
 *   npm run cli -- verify <gamme.json>
 *
 * Hors réseau, hors Forge : le cœur TypeScript fait le même travail que dans
 * l'app, sur le magasin en mémoire. Le modèle est **interdit** ici (extraction
 * 100 % déterministe) : une procédure se compile pareil partout.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { Deps } from "../src/core/ports";
import { compilePage } from "../src/core/compile/compile-page";
import { buildBundle, readBundle } from "../src/core/export/gamme-bundle";
import type { PageDigest } from "../src/core/types";
import { fixedClock } from "../src/platform/clock";
import { makeHasher } from "../src/platform/hash";
import { seqIds } from "../src/platform/ids";
import { memoryBudget } from "../src/platform/llm/budget";
import { forbiddenLlm } from "../src/platform/llm/fake-llm";
import { memoryStore } from "../src/platform/memory-store";

/** Le monde de la CLI : mémoire, horloge, identifiants, empreintes, pas de modèle. */
const deps = (): Deps => ({
  store: memoryStore(),
  clock: fixedClock(new Date().toISOString()),
  ids: seqIds(),
  hasher: makeHasher(),
  llm: forbiddenLlm(),
  budget: memoryBudget(new Date().toISOString().slice(0, 10)),
});

/** Le titre d'une page : son premier `<h1>`, sinon le nom du fichier. */
const titreDe = (contenu: string, fichier: string): string => {
  const h1 = /<h1[^>]*>(.*?)<\/h1>/is.exec(contenu);
  if (h1?.[1]) return h1[1].replace(/<[^>]+>/g, "").trim();
  const premiere = contenu.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  return premiere ? premiere.slice(0, 80) : basename(fichier);
};

/** La page telle qu'elle arrive du wiki : format storage, ou texte brut. */
const pageDe = (fichier: string, contenu: string): PageDigest => ({
  ari: `file://${resolve(fichier)}`,
  id: basename(fichier, extname(fichier)),
  spaceKey: "CLI",
  title: titreDe(contenu, fichier),
  storageBody: contenu,
  labels: [],
  lastModifiedAt: new Date().toISOString(),
  pageVersion: 1,
  wordCount: contenu.split(/\s+/).filter(Boolean).length,
  reachable: true,
});

const argument = (args: readonly string[], nom: string): string | undefined => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};

/** `compile <fichier>` : la page devient un paquet portable sur le disque. */
const compile = async (args: readonly string[]): Promise<number> => {
  const fichier = args[1];
  if (!fichier) {
    console.error("usage : npm run cli -- compile <fichier.html> [--sortie <dossier>]");
    return 2;
  }
  const sortie = argument(args, "--sortie") ?? join(dirname(resolve(fichier)), "gamme-out");
  const contenu = readFileSync(fichier, "utf8");
  const page = pageDe(fichier, contenu);
  const monde = deps();
  const compilee = await compilePage(monde, {
    page,
    confirmedBy: { id: "cli:local", kind: "human" },
  });
  if (!compilee.ok) {
    console.error(`refus : ${compilee.error.code} — ${compilee.error.messageFr}`);
    return 1;
  }
  const paquet = await buildBundle(monde, { code: compilee.value.gamme.code, version: compilee.value.version.version });
  if (!paquet.ok) {
    console.error(`refus : ${paquet.error.code} — ${paquet.error.messageFr}`);
    return 1;
  }
  mkdirSync(sortie, { recursive: true });
  writeFileSync(join(sortie, "gamme.json"), `${JSON.stringify(paquet.value, null, 2)}\n`, "utf8");
  writeFileSync(join(sortie, "SKILL.md"), paquet.value.skillMd, "utf8");
  console.log(`gamme ${paquet.value.code} v${paquet.value.version} — ${paquet.value.steps.length} étape(s)`);
  console.log(`empreinte : ${paquet.value.hash}`);
  console.log(`paquet    : ${join(sortie, "gamme.json")}`);
  console.log(`skill     : ${join(sortie, "SKILL.md")}`);
  return 0;
};

/** `verify <paquet.json>` : l'empreinte du paquet est-elle encore bonne ? */
const verify = async (args: readonly string[]): Promise<number> => {
  const fichier = args[1];
  if (!fichier) {
    console.error("usage : npm run cli -- verify <gamme.json>");
    return 2;
  }
  const brut = JSON.parse(readFileSync(fichier, "utf8")) as unknown;
  const paquet = await readBundle(makeHasher(), brut);
  if (!paquet.ok) {
    console.error(`refus : ${paquet.error.code} — ${paquet.error.messageFr}`);
    return 1;
  }
  console.log(`paquet conforme : ${paquet.value.code} v${paquet.value.version} — empreinte ${paquet.value.hash}`);
  return 0;
};

/** Le point d'entrée : une commande, un code de sortie. */
const main = async (): Promise<number> => {
  const args = process.argv.slice(2);
  const commande = args[0];
  if (commande === "compile") return compile(args);
  if (commande === "verify") return verify(args);
  console.error("usage : npm run cli -- <compile|verify> …");
  return 2;
};

main().then((code) => {
  process.exitCode = code;
});
