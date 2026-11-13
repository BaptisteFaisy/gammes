/**
 * L'entrée des événements produit : la forme que la plateforme livre, et ce qu'on en
 * tire (la page concernée, son auteur, la nature de la mutation).
 *
 * L'événement réel (relevé dans les logs de production) est :
 * `{ atlassianId, updateTrigger, content: { id, title, space: { ari, key } } }` —
 * **sans l'ARI de la page** : il faut le reconstruire depuis l'ARI de l'espace.
 */

import { describe, expect, it } from "vitest";
import { ariDePage, auteurDe, natureDe, payloadDe } from "../../src/triggers/entry-shape";

const EVENEMENT = {
  atlassianId: "712020:ba9bbe36-cf26-4e6a-8f5e-2369b742296b",
  eventCreatedDate: "2026-11-13T19:26:49.119Z",
  updateTrigger: "edit_page",
  content: {
    id: "8552450",
    type: "page",
    title: "Procédure : sauvegarder la base paiements",
    space: {
      id: 8454146,
      ari: "ari:cloud:confluence:5f423966-db58-4fe6-b377-b6828aee8db2:space/8454146",
      key: "GAM",
    },
  },
};

describe("entrée des événements", () => {
  it("l'ARI de la page est reconstruit depuis l'ARI de l'espace", () => {
    expect(ariDePage(EVENEMENT)).toBe("ari:cloud:confluence:5f423966-db58-4fe6-b377-b6828aee8db2:page/8552450");
  });

  it("un ARI déjà présent est repris tel quel", () => {
    expect(ariDePage({ ari: "ari:cloud:confluence:x:page/1" })).toBe("ari:cloud:confluence:x:page/1");
    expect(ariDePage({ page: { ari: "ari:cloud:confluence:y:page/2" } })).toBe("ari:cloud:confluence:y:page/2");
  });

  it("sans page, aucun ARI n'est inventé", () => {
    expect(ariDePage({})).toBeUndefined();
    expect(ariDePage({ content: { id: "1" } })).toBeUndefined();
  });

  it("l'auteur de l'événement est lu", () => {
    expect(auteurDe(EVENEMENT)).toBe("712020:ba9bbe36-cf26-4e6a-8f5e-2369b742296b");
    expect(auteurDe({ accountId: "abc" })).toBe("abc");
  });

  it("la nature de la mutation est déduite du déclencheur", () => {
    expect(natureDe(EVENEMENT)).toBe("updated");
    expect(natureDe({ updateTrigger: "create_page" })).toBe("added");
    expect(natureDe({ updateTrigger: "delete_page" })).toBe("deleted");
  });

  it("la charge utile porte la page, son auteur et la nature", () => {
    const charge = payloadDe(EVENEMENT);
    expect(charge.ari).toBe("ari:cloud:confluence:5f423966-db58-4fe6-b377-b6828aee8db2:page/8552450");
    expect(charge.accountId).toBe("712020:ba9bbe36-cf26-4e6a-8f5e-2369b742296b");
    expect(charge.kind).toBe("updated");
  });
});
