#!/usr/bin/env node
/**
 * Gammes — garde-fous de la maison (bloquants en CI).
 *
 * 1. aucun fichier source ≥ 500 lignes ;
 * 2. aucune fonction ≥ 50 lignes ;
 * 3. syntaxe effaçable seulement (pas d'`enum`, pas de `namespace`) ;
 * 4. le cœur ne lit jamais l'heure système (port `Clock`) ;
 * 5. aucune statistique par personne, nulle part ;
 * 6. aucun secret commité.
 *
 * Usage : `node scripts/check-limits.mjs` — sortie non vide ⇔ CI rouge.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src", "test", "scripts", "web"];
const SOURCE_EXT = new Set([".ts", ".tsx", ".mjs"]);
const MAX_FILE_LINES = 500;
const MAX_FUNC_LINES = 50;
const ALLOWLIST = join("scripts", "limits-allowlist.json");
/** Marqueur explicite d'une fausse clé de fixture (jamais de secret réel en test). */
const SECRET_FIXTURE_MARKER = "gammes-allow-secret-fixture";

const violations = [];
const add = (rule, file, line, detail) => violations.push(`${rule} · ${file}:${line} · ${detail}`);

const walk = (dir, out = []) => {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return out;
  }
  for (const entry of entries) {
    const rel = join(dir, entry);
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walk(rel, out);
    else if (SOURCE_EXT.has(extname(entry))) out.push(rel);
  }
  return out;
};

const loadAllowlist = () => {
  try {
    const raw = JSON.parse(readFileSync(join(ROOT, ALLOWLIST), "utf8"));
    return new Set(Array.isArray(raw.functions) ? raw.functions : []);
  } catch {
    return new Set();
  }
};

/** Repère les débuts de fonction et mesure leur corps par comptage d'accolades. */
const FUNC_START =
  /^(?:export\s+)?(?:async\s+)?(?:function\s*\*?\s*([A-Za-z0-9_$]+)|(?:const|let)\s+([A-Za-z0-9_$]+)\s*(?::[^=]+)?=\s*(?:async\s*)?\()/;

const measureFunctions = (rel, lines, allow) => {
  for (let i = 0; i < lines.length; i += 1) {
    const m = FUNC_START.exec(lines[i]);
    if (!m) continue;
    const name = m[1] ?? m[2] ?? "anonymous";
    const span = bodySpan(lines, i);
    if (span <= 0) continue;
    if (span >= MAX_FUNC_LINES && !allow.has(`${rel}#${name}`)) {
      add("func-too-long", rel, i + 1, `${name} fait ${span} lignes (max ${MAX_FUNC_LINES})`);
    }
  }
};

const bodySpan = (lines, startIdx) => {
  let depth = 0;
  let opened = false;
  for (let i = startIdx; i < lines.length; i += 1) {
    const code = stripStrings(lines[i]);
    // Corps expression (aucune accolade avant le `;`) : rien à mesurer.
    if (!opened && code.includes(";") && !code.includes("{")) return -1;
    for (const ch of code) {
      if (ch === "{") {
        depth += 1;
        opened = true;
      } else if (ch === "}") depth -= 1;
    }
    if (opened && depth <= 0) return i - startIdx + 1;
  }
  return -1;
};

const stripStrings = (line) =>
  line
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/\/\/.*$/, "");

const NO_ENUM = /\b(?:export\s+)?(?:const\s+)?enum\s+[A-Za-z0-9_$]+|\bnamespace\s+[A-Za-z0-9_$]+\s*\{/;
const SYSTEM_TIME = /\bDate\.now\(\)|\bnew\s+Date\s*\(/;
const PER_PERSON =
  /\b(?:byActor|perActor|perPerson|byPerson|actorRanking|actorScore|classement|ranking|leaderboard)\b/;
const SECRET_PATTERNS = [
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["openai-like-key", /\bsk-(?:airo-)?[A-Za-z0-9_-]{16,}\b/],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["slack-token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
];

const checkFile = (rel, allow) => {
  const raw = readFileSync(join(ROOT, rel), "utf8");
  const lines = raw.split("\n");
  if (lines.length > MAX_FILE_LINES) {
    add("file-too-long", rel, lines.length, `${lines.length} lignes (max ${MAX_FILE_LINES}) — découper`);
  }
  const inCore = rel.startsWith(join("src", "core"));
  let markerAbove = false;
  lines.forEach((line, idx) => {
    const n = idx + 1;
    const t = line.trimStart();
    const marker = line.includes(SECRET_FIXTURE_MARKER) || markerAbove;
    markerAbove = line.includes(SECRET_FIXTURE_MARKER);
    if (t.startsWith("*") || t.startsWith("//") || t.startsWith("/*")) return;
    if (NO_ENUM.test(line)) add("erasable-syntax", rel, n, line.trim().slice(0, 80));
    if (inCore && SYSTEM_TIME.test(line)) add("no-system-clock", rel, n, "utiliser le port Clock");
    if (rel.startsWith("src") && PER_PERSON.test(line)) add("no-per-person-stats", rel, n, line.trim().slice(0, 80));
    // Une fausse clé de fixture est assumée par un marqueur explicite, jamais par défaut.
    if (!marker) {
      for (const [name, re] of SECRET_PATTERNS) {
        if (re.test(line)) add("secret-committed", rel, n, `motif ${name}`);
      }
    }
  });
  measureFunctions(rel, lines, allow);
};

const checkDocsAndSeed = () => {
  const extras = [];
  for (const f of readdirSync(ROOT)) {
    if (/\.(md|yml|yaml)$/.test(f) && statSync(join(ROOT, f)).isFile()) extras.push(f);
  }
  for (const dir of ["docs", "seed", "skills", "agents", ".github/workflows"]) {
    try {
      for (const f of readdirSync(join(ROOT, dir))) {
        const rel = join(dir, f);
        if (statSync(join(ROOT, rel)).isFile() && /\.(md|yml|yaml|json)$/.test(f)) extras.push(rel);
      }
    } catch {
      /* dossier absent : rien à vérifier */
    }
  }
  const allow = loadAllowlist();
  for (const rel of extras) {
    const lines = readFileSync(join(ROOT, rel), "utf8").split("\n");
    lines.forEach((line, idx) => {
      if (line.includes(SECRET_FIXTURE_MARKER)) return;
      for (const [name, re] of SECRET_PATTERNS) {
        if (re.test(line)) add("secret-committed", rel, idx + 1, `motif ${name}`);
      }
    });
  }
  return allow;
};

const main = () => {
  const allow = checkDocsAndSeed();
  const files = SCAN_DIRS.flatMap((d) => walk(d));
  for (const rel of files) checkFile(rel, allow);
  if (violations.length > 0) {
    console.error(`✖ ${violations.length} entorse(s) aux règles de la maison :\n`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log(`✔ règles de la maison respectées (${files.length} fichiers sources)`);
};

main();
