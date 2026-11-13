#!/usr/bin/env node
/**
 * Garde du manifeste Forge — « Apps for Software Teams » : sans lui,
 * `manifest.yml` reste une intention.
 *
 *   1. le manifeste contre le schéma officiel `@forge/manifest` (la version
 *      installée dans le dépôt — pas celle d'un dépôt voisin) ;
 *   2. les modules `action` correspondent **exactement** aux outils MCP déclarés
 *      dans `src/core/mcp/tools.ts` : ni action orpheline, ni outil sans
 *      action (le § 18 du cahier des charges est la seule liste) ;
 *   3. `rovo:mcp.tools` cite ces mêmes actions ;
 *   4. chaque `function:` référencée existe, et chaque `handler:` a un fichier
 *      dans `src/` ;
 *   5. clés de modules uniques, ressources présentes sur le disque.
 *
 * Usage : `node tools/check-manifest.mjs` — code 0 si tout va bien, 1 sinon.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(HERE, "..");
const req = createRequire(join(RACINE, "package.json"));

const erreurs = [];
const ajouter = (message) => erreurs.push(message);
const lire = (chemin) => readFileSync(join(RACINE, chemin), "utf8");

const SCHEMA = join(RACINE, "node_modules/@forge/manifest/out/schema/manifest-schema.json");
if (!existsSync(SCHEMA)) {
  console.error("@forge/manifest absent du dépôt : `npm ci` avant de lancer le garde.");
  process.exit(1);
}
const AjvModule = req("ajv");
const Ajv = AjvModule.default ?? AjvModule;
const YAML = req("yaml");

const manifest = YAML.parse(lire("manifest.yml"));

/** 1. Le schéma officiel. */
const controlerSchema = () => {
  const schema = JSON.parse(readFileSync(SCHEMA, "utf8"));
  const ajv = new Ajv({ allErrors: true, logger: false, strict: false });
  const valider = ajv.compile(schema);
  if (valider(manifest)) {
    console.log("✔ schéma @forge/manifest : conforme");
    return;
  }
  for (const e of valider.errors ?? []) {
    ajouter(`schéma ${e.instancePath || "/"} : ${e.message} ${JSON.stringify(e.params ?? {})}`);
  }
};

/** Les outils MCP déclarés dans le code — la seule liste des outils. */
const outilsDuCode = () => [...lire("src/core/mcp/tools.ts").matchAll(/key: "([a-z-]+)", verb:/g)].map((m) => m[1]);

/** 2 et 3. Actions du manifeste = outils du code, et `rovo:mcp.tools` les cite. */
const controlerActions = () => {
  const outils = outilsDuCode();
  const actions = (manifest.modules?.action ?? []).map((a) => a.key);
  for (const outil of outils) {
    if (!actions.includes(outil)) ajouter(`action manquante pour l'outil MCP « ${outil} »`);
  }
  for (const action of actions) {
    if (!outils.includes(action)) ajouter(`action « ${action} » sans outil MCP dans src/core/mcp/tools.ts`);
  }
  const cites = manifest.modules?.["rovo:mcp"]?.[0]?.tools ?? [];
  for (const outil of outils) {
    if (!cites.includes(outil)) ajouter(`rovo:mcp.tools ne cite pas l'outil « ${outil} »`);
  }
  for (const cite of cites) {
    if (!actions.includes(cite)) ajouter(`rovo:mcp.tools cite « ${cite} », qui n'est pas une action`);
  }
  console.log(`✔ ${outils.length} outil(s) MCP, ${actions.length} action(s), ${cites.length} cité(s) par rovo:mcp`);
};

/** 4. Références de fonction et handlers sur disque. */
const controlerReferences = () => {
  const fonctions = new Set((manifest.modules?.function ?? []).map((f) => f.key));
  const handlers = new Map((manifest.modules?.function ?? []).map((f) => [f.key, f.handler]));
  const parcouru = (noeud, chemin) => {
    if (!noeud || typeof noeud !== "object") return;
    for (const [cle, valeur] of Object.entries(noeud)) {
      const ici = `${chemin}.${cle}`;
      if (cle === "function" && typeof valeur === "string" && !fonctions.has(valeur)) {
        ajouter(`${ici} → function « ${valeur} » non déclarée`);
      }
      if (cle === "handler" && typeof valeur === "string") {
        const fichier = `src/${valeur.split(".").slice(0, -1).join("/")}.ts`;
        if (!existsSync(join(RACINE, fichier))) ajouter(`${ici} → handler « ${valeur} » sans fichier ${fichier}`);
      }
      parcouru(valeur, ici);
    }
  };
  parcouru(manifest.modules, "modules");
  for (const [cle, handler] of handlers) {
    if (!handler) ajouter(`function « ${cle} » sans handler`);
  }
  console.log(`✔ ${fonctions.size} function(s) déclarée(s), références et handlers vérifiés`);
};

/** 5. Unicité des clés et ressources présentes. */
const controlerUnicite = () => {
  const vues = new Set();
  for (const [type, modules] of Object.entries(manifest.modules ?? {})) {
    for (const module of Array.isArray(modules) ? modules : [modules]) {
      const cle = `${type}/${module.key}`;
      if (vues.has(cle)) ajouter(`clé de module en double : ${cle}`);
      vues.add(cle);
    }
  }
  for (const skill of manifest.modules?.["rovo:skill"] ?? []) {
    const dir = skill.source?.dir;
    if (!dir || !existsSync(join(RACINE, dir))) ajouter(`rovo:skill « ${skill.key} » : répertoire absent ${dir ?? "(non déclaré)"}`);
  }
  for (const ressource of manifest.resources ?? []) {
    if (!existsSync(join(RACINE, ressource.path))) ajouter(`ressource « ${ressource.key} » : fichier absent ${ressource.path}`);
  }
  console.log(`✔ ${vues.size} clés de modules uniques, ${(manifest.resources ?? []).length} ressource(s) sur disque`);
};

/**
 * 6. La ressource d'un écran est le point d'entrée UI Kit 2.
 *
 * Un chemin qui finit par `.html` sert un fichier **statique** : la plateforme y
 * charge la page, mais le bundle de l'app n'y est jamais monté — l'écran reste
 * blanc dans Atlassian. C'est arrivé : la ressource `main` pointait vers un dossier
 * statique, et l'app installée ne montrait rien. Le garde le rend impossible.
 */
const controlerRessources = () => {
  const ressources = new Map((manifest.resources ?? []).map((r) => [r.key, r.path]));
  const utilisees = new Set();
  for (const [type, modules] of Object.entries(manifest.modules ?? {})) {
    for (const module of Array.isArray(modules) ? modules : [modules]) {
      if (typeof module.resource === "string") utilisees.add(module.resource);
    }
  }
  for (const cle of utilisees) {
    const chemin = ressources.get(cle);
    if (!chemin) {
      ajouter(`écran : ressource « ${cle} » non déclarée dans resources`);
      continue;
    }
    if (/\.html?$/i.test(chemin)) {
      ajouter(`ressource « ${cle} » : un HTML statique sert une page vide — pointez l'entrée UI Kit 2 (${chemin})`);
      continue;
    }
    if (statSync(join(RACINE, chemin)).isDirectory()) {
      ajouter(`ressource « ${cle} » : un dossier statique sert une page vide — pointez l'entrée UI Kit 2 (${chemin})`);
    }
  }
  console.log(`✔ ${utilisees.size} ressource(s) d'écran : point d'entrée, pas de HTML statique`);
};

controlerSchema();
controlerActions();
controlerReferences();
controlerUnicite();
controlerRessources();

if (erreurs.length === 0) {
  console.log("✔ manifeste conforme");
  process.exit(0);
}
console.error(`✘ ${erreurs.length} problème(s) de manifeste :`);
for (const e of erreurs) console.error(`   - ${e}`);
process.exit(1);
