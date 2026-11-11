/**
 * Gammes — diff de recompilation (§ 10, GA-10).
 *
 * Quand la page source change, l'app propose un diff : ce qui est ajouté, retiré,
 * modifié, conservé. Le diff est une **proposition** — la republication exige une
 * approbation humaine. Alignement par plus longue sous-séquence commune sur le texte
 * normalisé des étapes : déterministe, lisible, sans modèle.
 */

import type { Step } from "../types";

export type DiffKind = "added" | "removed" | "changed" | "kept";

export type DiffLine = {
  readonly kind: DiffKind;
  readonly text: string;
  readonly ord?: number;
  readonly previous?: string;
};

export const normalizeStepText = (step: Step): string =>
  `${step.text} ${step.command ?? ""}`.toLowerCase().replace(/\s+/g, " ").trim();

const lcsTable = (a: readonly string[], b: readonly string[]): number[][] => {
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      const same = a[i] === b[j] ? 1 : 0;
      table[i]![j] = Math.max((table[i + 1]![j] ?? 0), (table[i]![j + 1] ?? 0), (table[i + 1]![j + 1] ?? 0) + same);
    }
  }
  return table;
};

/** Diff entre deux listes de textes normalisés, dans l'ordre d'origine. */
export const diffTexts = (before: readonly string[], after: readonly string[]): readonly DiffLine[] => {
  const table = lcsTable(before, after);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      out.push({ kind: "kept", text: after[j]!, ord: j + 1 });
      i += 1;
      j += 1;
      continue;
    }
    const dropCost = table[i + 1]?.[j] ?? -1;
    const addCost = table[i]?.[j + 1] ?? -1;
    if (i < before.length && dropCost >= addCost) {
      out.push({ kind: "removed", text: before[i]! });
      i += 1;
      continue;
    }
    if (j < after.length) {
      out.push({ kind: "added", text: after[j]!, ord: j + 1 });
      j += 1;
    }
  }
  return out;
};

/** Diff entre deux versions : même algorithme, textes d'étapes en entrée. */
export const diffSteps = (before: readonly Step[], after: readonly Step[]): readonly DiffLine[] =>
  diffTexts(before.map(normalizeStepText), after.map(normalizeStepText));

export type DiffSummary = {
  readonly added: number;
  readonly removed: number;
  readonly kept: number;
  readonly identical: boolean;
};

export const summarizeDiff = (lines: readonly DiffLine[]): DiffSummary => ({
  added: lines.filter((l) => l.kind === "added").length,
  removed: lines.filter((l) => l.kind === "removed").length,
  kept: lines.filter((l) => l.kind === "kept").length,
  identical: lines.every((l) => l.kind === "kept"),
});

const MARK: Readonly<Record<DiffKind, string>> = {
  added: "+ ",
  removed: "- ",
  changed: "~ ",
  kept: "  ",
};

/** Rendu texte du diff : ce qui est affiché dans l'app et dans la proposition de republication. */
export const renderDiff = (lines: readonly DiffLine[]): string =>
  lines.map((l) => `${MARK[l.kind]}${l.ord ? `${l.ord}. ` : ""}${l.text}`).join("\n");

/** Diff lisible pour une gamme : en-tête de version + lignes. */
export const renderVersionDiff = (
  fromVersion: number | undefined,
  toVersion: number,
  lines: readonly DiffLine[],
): string => {
  const head = fromVersion ? `v${fromVersion} → v${toVersion}` : `nouvelle gamme → v${toVersion}`;
  const summary = summarizeDiff(lines);
  return [
    `# ${head}`,
    `+${summary.added} ajoutée(s) · -${summary.removed} retirée(s) · ${summary.kept} conservée(s)`,
    "",
    renderDiff(lines),
  ].join("\n");
};
