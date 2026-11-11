/**
 * Gammes — budget LLM en mémoire.
 *
 * Le budget est affiché, jamais caché (§ 23 « sobriété ») : pages compilées,
 * appels, jetons, coût estimé. Un appel servi par le cache coûte 0.
 */

import type { LlmBudget, LlmResponse, LlmTask } from "../../core/ports";
import type { BudgetDay } from "../../core/types";

/** Prix indicatifs en centimes pour 1 000 jetons — ordre de grandeur, affiché comme estimation. */
const PRICE_PER_KTOKENS = { in: 0.08, out: 0.4 } as const;

export const memoryBudget = (day: string): LlmBudget & { readonly totals: () => BudgetDay } => {
  let compiled = 0;
  let calls = 0;
  let tokens = 0;
  let cost = 0;

  const snapshot = (): BudgetDay => ({
    day,
    compiled,
    llmCalls: calls,
    tokens,
    costEstimate: Math.round(cost * 1000) / 1000,
  });

  return {
    record: (_task: LlmTask, res: LlmResponse) => {
      if (res.cached) return;
      calls += 1;
      tokens += res.tokensIn + res.tokensOut;
      cost += (res.tokensIn / 1000) * PRICE_PER_KTOKENS.in + (res.tokensOut / 1000) * PRICE_PER_KTOKENS.out;
    },
    snapshot,
    totals: snapshot,
  };
};

/** Compteur de pages compilées : séparé des appels, parce que ce n'est pas la même dette. */
export const withCompiled = (budget: LlmBudget, compiled: number): BudgetDay => ({
  ...budget.snapshot(),
  compiled,
});
