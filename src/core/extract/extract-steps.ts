/**
 * Gammes — extraire les étapes d'une page (§ 6 étage 2, GA-02).
 *
 * Déterministe d'abord : listes numérotées et à puces, cases à cocher, blocs de
 * code, tableaux, titres. Le modèle n'intervient que sur la **prose ambiguë**, avec
 * cache par empreinte de contenu.
 *
 * Chaque étape conserve l'emplacement exact de son passage source : `start`/`end`
 * sont les décalages dans le `storageBody`, et `quote` est le passage rendu lisible
 * (balises retirées). Rien n'est affirmé sans sa source.
 */

import type { Deps } from "../ports";
import { promptAvecDonnees } from "../../platform/llm/prompt-shield";
import type { InputSpec, PageDigest, SourceSpan, StepKind } from "../types";
import { arrayField, parseJsonLoose } from "../json";

export type BlockKind = "heading" | "list_item" | "checkbox" | "code" | "table_row" | "paragraph";

export type ParsedBlock = {
  readonly kind: BlockKind;
  readonly level?: number;
  readonly text: string;
  readonly command?: string;
  readonly start: number;
  readonly end: number;
  readonly section: string;
};

/** Ébauche d'étape : la qualification (lot `qualify`) pose preuves, verrous et risque. */
export type DraftStep = {
  readonly ord: number;
  readonly kind: StepKind;
  readonly text: string;
  readonly command?: string;
  readonly expectedResult?: string;
  readonly source: SourceSpan;
  readonly sectionTitle?: string;
  readonly inferredBy: "rule" | "model";
  readonly inferredReason?: string;
};

export type ExtractionResult = {
  readonly drafts: readonly DraftStep[];
  readonly usedModel: boolean;
  readonly modelTasks: readonly string[];
  readonly inputs: readonly InputSpec[];
};

const BLOCK_RE =
  /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>|<ac:structured-macro[^>]*ac:name="code"[\s\S]*?CDATA\[([\s\S]*?)\][\s\S]*?<\/ac:structured-macro>|<li[^>]*>([\s\S]*?)<\/li>|<tr[^>]*>([\s\S]*?)<\/tr>|<p[^>]*>([\s\S]*?)<\/p>/gi;

const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export const stripTags = (html: string): string =>
  html
    // Le contenu d'un CDATA est du texte, pas une balise : le préserver avant nettoyage.
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, " $1 ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTITIES[e] ?? e)
    .replace(/\s+/g, " ")
    .trim();

const extractCdata = (raw: string): string | undefined => {
  const m = /CDATA\[([\s\S]*?)\]\]/.exec(raw);
  const body = m?.[1]?.trim();
  return body && body.length > 0 ? body : undefined;
};

const isCheckBox = (raw: string): boolean => /ac:task|type="checkbox"|\[[ xX]\]/.test(raw);

const TABLE_HEADER_CELL = /^(?:#|n°|etape|étape|step|action|commande|preuve|evidence|description)$/i;

const cellsOf = (raw: string): readonly string[] =>
  raw
    .split(/<\/t[dh]>/i)
    .map(stripTags)
    .filter((c) => c.length > 0);

const isTableHeader = (cells: readonly string[]): boolean =>
  cells.length > 0 && cells.every((c) => TABLE_HEADER_CELL.test(c));

const buildBlock = (
  m: RegExpExecArray,
  section: string,
): { readonly block: ParsedBlock; readonly heading?: { level: number; text: string } } => {
  const start = m.index;
  const end = start + m[0].length;
  const at = (b: Omit<ParsedBlock, "start" | "end" | "section">): { block: ParsedBlock } => ({
    block: { ...b, start, end, section },
  });
  if (m[1] && m[2] !== undefined) {
    const level = Number(m[1].slice(1));
    const text = stripTags(m[2]);
    return { ...at({ kind: "heading", level, text }), heading: { level, text } };
  }
  if (m[3] !== undefined) {
    const command = m[3].trim();
    return at({ kind: "code", text: command, command });
  }
  if (m[4] !== undefined) {
    const raw = m[4];
    const text = stripTags(raw);
    const command = extractCdata(raw);
    return at({ kind: isCheckBox(raw) ? "checkbox" : "list_item", text, ...(command ? { command } : {}) });
  }
  if (m[5] !== undefined) {
    const cells = cellsOf(m[5]);
    if (isTableHeader(cells)) return at({ kind: "table_row", text: "" });
    return at({ kind: "table_row", text: cells.join(" | ") });
  }
  return at({ kind: "paragraph", text: stripTags(m[6] ?? "") });
};

/** Le format storage devient une suite de blocs horodatés dans la page. */
export const parseStorageBody = (page: PageDigest): readonly ParsedBlock[] => {
  const out: ParsedBlock[] = [];
  let section = page.title;
  for (const m of page.storageBody.matchAll(BLOCK_RE)) {
    const { block, heading } = buildBlock(m as RegExpExecArray, section);
    if (heading) section = heading.text || section;
    if (block.text.length === 0 && block.kind !== "heading") continue;
    out.push(block);
  }
  return out;
};

const CONTROL_RE = /^(?:v[ée]rifier|contr[ôo]ler|tester|check\b|valider que|s'assurer que le)/i;
const NOTIFY_RE = /(pr[ée]venir|notifier|informer|annoncer|notify|prevenir l|envoyer un message|pr[ée]venir l)/i;
const DECISION_RE = /^(?:si|selon|choose|choisir)\b|(?:sinon|autrement)\b/i;
const EXPECTED_RE = /(?:->|→|attendu|expected|r[ée]sultat)\s*[::]?\s*(.+)$/i;

const kindOf = (block: ParsedBlock): StepKind => {
  if (block.command) return "command";
  if (CONTROL_RE.test(block.text)) return "check";
  if (NOTIFY_RE.test(block.text)) return "notification";
  if (DECISION_RE.test(block.text)) return "decision";
  return block.kind === "checkbox" ? "check" : "manual";
};

const expectedOf = (text: string): string | undefined => {
  const m = EXPECTED_RE.exec(text);
  const value = m?.[1]?.trim();
  return value && value.length > 1 ? value : undefined;
};

const cleanText = (text: string): string => text.replace(EXPECTED_RE, "").replace(/\s+/g, " ").trim();

const spanOf = (page: PageDigest, block: ParsedBlock): SourceSpan => ({
  pageAri: page.ari,
  start: block.start,
  end: block.end,
  quote: block.text,
});

const draftOf = (page: PageDigest, block: ParsedBlock, ord: number): DraftStep => {
  const text = cleanText(block.text);
  const expected = expectedOf(block.text);
  return {
    ord,
    kind: kindOf(block),
    text,
    source: spanOf(page, block),
    inferredBy: "rule",
    ...(block.command ? { command: block.command } : {}),
    ...(expected ? { expectedResult: expected } : {}),
    ...(block.section ? { sectionTitle: block.section } : {}),
  };
};

const STEPABLE: readonly BlockKind[] = ["list_item", "checkbox", "code", "table_row"];

const IMPERATIVE_RE =
  /^\s*(?:on|vous|il\s+faudra|il\s+faut|ensuite|puis|enfin|d'abord|alors|then|next|finally)?\s*(?:s'?assurer|assur\w+|ex[ée]cut\w+|lanc\w+|v[ée]rif\w+|d[ée]ploy\w+|contr[ôo]l\w+|ouvr\w+|appliqu\w+|attend\w+|not\w+|pr[ée]ven\w+|valid\w+|sais\w+|copi\w+|red[ée]marr\w+|supprim\w+|r[ée]voqu\w+|renouvel\w+|install\w+|configur\w+|sauvegard\w+|restaur\w+|g[ée]n[ée]r\w+|test\w+|rempla\w+|met\w+|run|execute|verify|deploy|ensure|remove|revoke|renew|install|configure)\b/i;

const isAmbiguousProse = (block: ParsedBlock): boolean =>
  block.kind === "paragraph" && block.text.length >= 60 && IMPERATIVE_RE.test(block.text);

const INPUT_SECTION_RE = /entr[ée]es|inputs?|param[èe]tres|pr[ée]requis|variables/i;
const INPUT_LINE_RE = /^([A-Za-z0-9_.-]{2,30})\s*[:=–]\s*(.+)$/;

const inferType = (description: string): InputSpec["type"] => {
  if (/(nombre|number|entier|integer|port)/i.test(description)) return "number";
  if (/(bool[ée]en|oui\s*\/\s*non|true\s*\/\s*false)/i.test(description)) return "boolean";
  if (/(date|heure|timestamp)/i.test(description)) return "date";
  if (/(parmi|liste|enum|one of|choix)/i.test(description)) return "enum";
  if (/(ari|ticket|lien|url|ref)/i.test(description)) return "ref";
  return "string";
};

/** Entrées typées : section « Entrées », lignes `nom : description` ou tableau à deux colonnes. */
export const extractInputs = (blocks: readonly ParsedBlock[]): readonly InputSpec[] => {
  const out: InputSpec[] = [];
  for (const block of blocks) {
    if (!INPUT_SECTION_RE.test(block.section)) continue;
    if (block.kind !== "list_item" && block.kind !== "table_row" && block.kind !== "paragraph") continue;
    const line = block.kind === "table_row" ? block.text.replace(" | ", " : ") : block.text;
    const m = INPUT_LINE_RE.exec(line.trim());
    if (!m || !m[1] || !m[2]) continue;
    const description = m[2].trim();
    out.push({
      name: m[1],
      type: inferType(description),
      required: /(obligatoire|required|imp[ée]ratif|mandatory)/i.test(description),
      description,
    });
  }
  return out;
};

const prosePrompt = (page: PageDigest, prose: readonly ParsedBlock[]): string =>
  promptAvecDonnees(
    [
      "Cette page de procédure contient de la prose qui décrit des étapes sans liste.",
      "Extrais les étapes implicites, sans rien inventer, sans réécrire les commandes.",
      "Réponds en JSON strict : {\"steps\":[{\"paragraphIndex\":number,\"text\":string,\"command\":string|null,\"kind\":\"manual\"|\"command\"|\"check\"|\"decision\"|\"notification\"}]}",
      `Page : ${page.title} (${page.ari})`,
    ],
    [{ etiquette: "PROSE (page wiki)", contenu: prose.map((b, i) => `[${i}] ${b.text}`).join("\n") }],
  );

const KINDS: readonly StepKind[] = ["manual", "command", "check", "decision", "notification"];

type RawProseStep = {
  paragraphIndex?: unknown;
  text?: unknown;
  command?: unknown;
  kind?: unknown;
};

const proseDrafts = (
  page: PageDigest,
  prose: readonly ParsedBlock[],
  raw: readonly RawProseStep[],
  startOrd: number,
): readonly DraftStep[] => {
  const out: DraftStep[] = [];
  raw.forEach((item, i) => {
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (text.length === 0) return;
    const idx = typeof item.paragraphIndex === "number" ? item.paragraphIndex : i;
    const block = prose[idx] ?? prose[0];
    if (!block) return;
    const command = typeof item.command === "string" && item.command.trim() ? item.command.trim() : undefined;
    const kind = typeof item.kind === "string" && KINDS.includes(item.kind as StepKind)
      ? (item.kind as StepKind)
      : command
        ? "command"
        : "manual";
    out.push({
      ord: startOrd + out.length,
      kind,
      text,
      source: spanOf(page, block),
      inferredBy: "model",
      inferredReason: "prose ambiguë : étape extraite par le modèle, à faire confirmer",
      ...(command ? { command } : {}),
      ...(block.section ? { sectionTitle: block.section } : {}),
    });
  });
  return out;
};

/** Extraction complète : règles d'abord, modèle sur la prose ambiguë seulement. */
export const extractSteps = async (deps: Deps, page: PageDigest): Promise<ExtractionResult> => {
  const blocks = parseStorageBody(page);
  const stepable = blocks.filter((b) => STEPABLE.includes(b.kind) && b.text.trim().length > 0);
  const drafts: DraftStep[] = stepable.map((b, i) => draftOf(page, b, i + 1));
  const inputs = extractInputs(blocks);
  const prose = blocks.filter(isAmbiguousProse);
  if (prose.length === 0) {
    return { drafts, usedModel: false, modelTasks: [], inputs };
  }
  return withProseModel(deps, page, prose, drafts, inputs);
};

const withProseModel = async (
  deps: Deps,
  page: PageDigest,
  prose: readonly ParsedBlock[],
  drafts: readonly DraftStep[],
  inputs: readonly InputSpec[],
): Promise<ExtractionResult> => {
  try {
    const res = await deps.llm.complete({
      task: "extract_prose",
      prompt: prosePrompt(page, prose),
      cacheKey: deps.hasher.contentHash(page.storageBody),
      json: true,
    });
    const parsed = parseJsonLoose<{ steps?: unknown }>(res.text);
    // Réponse inexploitable : même issue qu'un modèle indisponible, les règles tiennent seules.
    if (!parsed) return { drafts, usedModel: false, modelTasks: [], inputs };
    const raw = arrayField(parsed, "steps") as readonly RawProseStep[];
    const extra = proseDrafts(page, prose, raw, drafts.length + 1);
    return {
      drafts: [...drafts, ...extra],
      usedModel: true,
      modelTasks: ["extract_prose"],
      inputs,
    };
  } catch {
    // Modèle indisponible : les étapes déterministes restent valables, la prose est signalée.
    return { drafts, usedModel: false, modelTasks: [], inputs };
  }
};
