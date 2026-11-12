/**
 * Gammes — le conciliateur « hermes » (§ 13).
 *
 * Deux gammes qui prescrivent l'incompatible sont portées aux deux propriétaires.
 * Le conciliateur prépare le dossier : résumé, options, conséquences, citations de
 * part et d'autre. **Il ne tranche jamais** : aucune option n'est appliquée, aucune
 * gamme n'est modifiée, aucune version n'est touchée, et chaque option porte
 * `requiresHuman: true`.
 *
 * Même code, deux moteurs : dans Forge le LLM hébergé (`llm:` au manifeste) ; dans
 * le harness local un endpoint OpenAI-compatible — par défaut InferHub
 * (`scripts/hermes-conciliate.ts`). La détection des conflits, elle, n'appelle
 * jamais de modèle : si le conciliateur tombe, le conflit est quand même porté.
 */

import type { Deps, LlmClient } from "../ports";
import { promptAvecDonnees } from "../../platform/llm/prompt-shield";
import { ok, refusals, type Result } from "../result";
import type { ActorRef, Conflict, Conciliation, ConciliationOption } from "../types";
import { asText, parseJsonLoose } from "../json";

export const HERMES_CONDUCT = [
  "Tu es le conciliateur de l'atelier Gammes. Deux procédures prescrivent des choses incompatibles.",
  "Règle absolue : tu ne tranches jamais. Tu exposes, tu éclaires, tu proposes des options.",
  "1. Résume le désaccord en deux phrases, sans jargon, en citant les deux gammes par leur code.",
  "2. Propose deux à quatre options réelles : ce que chacune change, qui est concerné, ce qu'elle coûte.",
  "3. Ne réécris jamais un passage source : cite-le tel quel, avec sa gamme.",
  "4. N'invente aucun fait absent du dossier. Si le dossier ne permet pas de conclure, dis-le.",
  "5. Aucune option ne peut être appliquée automatiquement : la décision est humaine, datée et nommée.",
  'Réponds en JSON strict : {"summary": string, "options": [{"title": string, "detail": string, "affects": [string]}]}',
].join("\n");

const MAX_OPTIONS = 4;
const MIN_OPTIONS = 2;

type RawOption = { title?: unknown; detail?: unknown; affects?: unknown };
type RawDossier = { summary?: unknown; options?: unknown };

export const buildPrompt = (conflict: Conflict): string => {
  const facts = conflict.facts
    .map((f) => {
      const left = f.leftSpan ? `\n  passage cité (${f.leftSpan.pageAri}) : « ${f.leftSpan.quote} »` : "";
      const right = f.rightSpan ? `\n  passage cité (${f.rightSpan.pageAri}) : « ${f.rightSpan.quote} »` : "";
      return `- sujet ${f.subject}\n  à gauche : ${f.left}${left}\n  à droite : ${f.right}${right}`;
    })
    .join("\n");
  const counterpart = conflict.gammeB ?? conflict.policyPageAri ?? "une page de politique";
  return promptAvecDonnees(
    [
      HERMES_CONDUCT,
      `Dossier : ${conflict.gammeA} contre ${counterpart}${conflict.service ? ` (service ${conflict.service})` : ""}.`,
      `Nature : ${conflict.kind}.`,
      "Faits, avec leurs passages sources :",
      "Rends le JSON attendu, et rien d'autre.",
    ],
    [{ etiquette: "FAITS ET PASSAGES CITÉS (pages wiki)", contenu: facts }],
  );
};

/** Un modèle peut nommer les champs autrement : on accepte les variantes usuelles. */
const pickText = (o: RawOption, keys: readonly string[]): string | undefined => {
  for (const key of keys) {
    const value = asText((o as Record<string, unknown>)[key]);
    if (value) return value;
  }
  return undefined;
};

const parseOptions = (raw: readonly RawOption[], ids: Deps["ids"]): readonly ConciliationOption[] =>
  raw.slice(0, MAX_OPTIONS).flatMap((o) => {
    const title = pickText(o, ["title", "option", "nom", "label"]);
    const detail = pickText(o, ["detail", "description", "explication"]);
    if (!title || !detail) return [];
    const affects = Array.isArray(o.affects) ? o.affects.flatMap((a) => (asText(a) ? [a as string] : [])) : [];
    return [{ id: ids.next("opt"), title, detail, affects, requiresHuman: true as const }];
  });

/** Analyse défensive : une réponse invalide produit un échec propre, jamais une option inventée. */
const TITLE_KEYS = ["title", "option", "nom", "label", "intitule", "intitulé"] as const;
const DETAIL_KEYS = ["detail", "description", "explication", "consequence", "conséquence"] as const;

/**
 * Le dossier peut être imbriqué, ou nommer ses champs autrement : on ramasse tout objet
 * qui ressemble à une option (un titre ET un détail), où qu'il soit dans l'arbre.
 */
const findOptions = (raw: unknown, depth = 0): readonly RawOption[] => {
  if (depth > 6) return [];
  if (Array.isArray(raw)) return raw.flatMap((item) => findOptions(item, depth + 1));
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const hasTitle = TITLE_KEYS.some((key) => asText(obj[key]));
  const hasDetail = DETAIL_KEYS.some((key) => asText(obj[key]));
  if (hasTitle && hasDetail) return [obj as RawOption];
  const found: RawOption[] = [];
  for (const value of Object.values(obj)) {
    found.push(...findOptions(value, depth + 1));
    if (found.length >= MAX_OPTIONS) break;
  }
  return found;
};

const findSummary = (raw: unknown): string | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  for (const key of ["summary", "resume", "résumé", "principe_directeur", "conclusion", "description", "contexte"]) {
    const value = asText(obj[key]);
    if (value) return value;
  }
  for (const value of Object.values(obj)) {
    const found = findSummary(value);
    if (found) return found;
  }
  return undefined;
};

export const parseDossier = (
  text: string,
  ids: Deps["ids"],
): { summary: string; options: readonly ConciliationOption[] } | undefined => {
  const raw = parseJsonLoose<RawDossier>(text);
  if (!raw) return undefined;
  const summary = findSummary(raw);
  if (!summary) return undefined;
  const options = parseOptions(findOptions(raw), ids);
  return options.length >= MIN_OPTIONS ? { summary, options } : undefined;
};

export const conciliate = async (
  deps: Deps,
  conflictId: string,
  opts: { llm?: LlmClient } = {},
): Promise<Result<Conciliation>> => {
  const conflict = await deps.store.conflicts.get(conflictId);
  if (!conflict) return refusals.unknownConflict(conflictId);
  const llm = opts.llm ?? deps.llm;
  let answer: string;
  try {
    const res = await llm.complete({
      task: "conciliate_conflict",
      prompt: buildPrompt(conflict),
      cacheKey: deps.hasher.hash(`${conflictId}:${conflict.facts.map((f) => f.subject).join(",")}`),
      json: true,
    });
    answer = res.text;
  } catch (err) {
    return refusals.conciliatorUnavailable(conflictId, (err as Error).message.slice(0, 160));
  }
  const dossier = parseDossier(answer, deps.ids);
  if (!dossier) return refusals.conciliatorUnavailable(conflictId, "réponse du modèle inexploitable");
  return storeConciliation(deps, conflict, llm.name, dossier.summary, dossier.options);
};

const storeConciliation = async (
  deps: Deps,
  conflict: Conflict,
  model: string,
  summary: string,
  options: readonly ConciliationOption[],
): Promise<Result<Conciliation>> => {
  const conciliation: Conciliation = {
    id: deps.ids.next("cnc"),
    conflictId: conflict.id,
    engine: "hermes",
    model,
    summary,
    options,
    createdAt: deps.clock.now(),
  };
  await deps.store.conciliations.insert(conciliation);
  await deps.store.conflicts.update(conflict.id, (c) => ({ ...c, conciliationId: conciliation.id }));
  await deps.store.appendEvent({
    at: conciliation.createdAt,
    kind: "conflict.conciliated",
    subjectRef: conflict.id,
    payload: { conciliationId: conciliation.id, options: options.length, engine: "hermes" },
  });
  return ok(conciliation);
};

/** Décider est un acte humain daté : un agent reçoit le refus canonique. */
export const decideConciliation = async (
  deps: Deps,
  id: string,
  optionId: string,
  by: ActorRef,
): Promise<Result<Conciliation>> => {
  if (by.kind !== "human") return refusals.approvalRequiresHuman(by.id);
  const current = await deps.store.conciliations.get(id);
  if (!current) return refusals.conciliatorUnavailable(id, "dossier introuvable");
  const chosen = current.options.find((o) => o.id === optionId);
  if (!chosen) return refusals.conciliatorUnavailable(id, `option ${optionId} absente du dossier`);
  const decided = await deps.store.conciliations.update(id, (c) => ({
    ...c,
    decidedOptionId: optionId,
    decidedByRef: by.id,
  }));
  if (!decided) return refusals.conciliatorUnavailable(id, "dossier introuvable après mise à jour");
  await deps.store.appendEvent({
    at: deps.clock.now(),
    kind: "conflict.conciliated",
    subjectRef: decided.conflictId,
    actorKind: by.kind,
    payload: { conciliationId: id, decidedOptionId: optionId, by: by.id },
  });
  return ok(decided);
};
