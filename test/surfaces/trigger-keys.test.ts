/**
 * Les clés d'événements : le manifeste les déclare, le resolver doit les connaître.
 *
 * Un module `trigger`, `scheduledTrigger`, `consumer` ou `webtrigger` appelle une
 * fonction **avec la clé du module** ; si le resolver n'a pas de définition pour
 * cette clé, la plateforme refuse l'appel et l'événement ne produit rien.
 *
 * Le test lit le manifeste et vérifie qu'aucune clé déclarée n'est orpheline — le
 * bug qu'il garde (les déclencheurs n'étaient pas câblés) ne peut pas revenir.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CONSUMER_KEYS, EVENT_KEYS, TRIGGER_KEYS, WEBTRIGGER_KEYS } from "../../src/triggers/keys";

const manifest = parse(readFileSync("manifest.yml", "utf8")) as {
  modules?: {
    trigger?: readonly { key?: string }[];
    scheduledTrigger?: readonly { key?: string }[];
    consumer?: readonly { key?: string }[];
    webtrigger?: readonly { key?: string }[];
  };
};

const cles = (type: string): readonly string[] =>
  (manifest.modules?.[type as "trigger"] ?? []).map((m) => m.key ?? "").filter(Boolean);

describe("clés d'événements", () => {
  it("le manifeste déclare des déclencheurs, un planifié, des consommateurs et un point d'entrée", () => {
    expect(cles("trigger").length).toBeGreaterThan(0);
    expect(cles("scheduledTrigger").length).toBeGreaterThan(0);
    expect(cles("consumer").length).toBeGreaterThan(0);
    expect(cles("webtrigger").length).toBeGreaterThan(0);
  });

  it("toute clé déclarée a une définition dans le resolver", () => {
    const declarees = [
      ...cles("trigger"),
      ...cles("scheduledTrigger"),
      ...cles("consumer"),
      ...cles("webtrigger"),
    ];
    for (const key of declarees) {
      expect(EVENT_KEYS).toContain(key);
    }
    expect(EVENT_KEYS.length).toBe(declarees.length);
  });

  it("les tables de clés correspondent au manifeste", () => {
    expect([...TRIGGER_KEYS].sort()).toEqual([...cles("trigger"), ...cles("scheduledTrigger")].sort());
    expect([...CONSUMER_KEYS].sort()).toEqual([...cles("consumer")].sort());
    expect([...WEBTRIGGER_KEYS].sort()).toEqual([...cles("webtrigger")].sort());
  });
});
