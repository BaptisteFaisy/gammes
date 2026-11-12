/**
 * Le resolver déclare exactement les actions qui existent : ni clé fantôme
 * (le resolver répondrait `undefined`), ni action orpheline (injoignable depuis
 * le manifeste). Un lot ajoute une action dans son module et ce test suit.
 */
import { describe, expect, it } from "vitest";
import { makeDeps } from "../helpers";
import { ACTION_KEYS, createActions } from "../../src/resolver/actions";

describe("clés d'actions du resolver", () => {
  const actions = createActions(makeDeps());
  const reelles = Object.keys(actions).sort();
  const declarees: string[] = [...ACTION_KEYS].sort();

  it("toute clé déclarée existe", () => {
    expect(declarees.filter((k) => !reelles.includes(k))).toEqual([]);
  });

  it("toute action existante est déclarée", () => {
    expect(reelles.filter((k) => !declarees.includes(k))).toEqual([]);
  });

  it("aucune clé n'est déclarée deux fois", () => {
    expect(new Set(ACTION_KEYS).size).toBe(ACTION_KEYS.length);
  });
});
