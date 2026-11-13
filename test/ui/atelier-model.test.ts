/**
 * L'atelier (§ 14) — la vue du registre des gammes.
 *
 * La réponse de l'action `atelier` peut arriver nue ou enveloppée, avec un registre
 * plein ou vide : la vue doit lire défensivement et rendre un état lisible dans tous
 * les cas, jamais casser.
 */

import { describe, expect, it } from "vitest";
import { atelierView, type GammeRow } from "../../src/ui/atelier/atelier-model";

const gamme = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  code: "GAM-save-01",
  title: "Sauvegarder la base paiements",
  state: "approved",
  currentVersion: 1,
  spaceKey: "GAM",
  sync: "synced",
  ...over,
});

describe("vue de l'atelier", () => {
  it("un registre vide est un état lisible, pas une erreur", () => {
    const vue = atelierView({ gammes: [], freshness: {}, coverage: {} });
    expect(vue.ranges).toHaveLength(0);
    expect(vue.total).toBe(0);
    expect(vue.message).toMatch(/Aucune gamme/);
  });

  it("une gamme approuvée est comptée et rendue", () => {
    const vue = atelierView({
      gammes: [gamme()],
      freshness: { total: 1, syncedPct: 1 },
      coverage: { scope: "GAM", approvedPct: 1 },
    });
    expect(vue.ranges).toHaveLength(1);
    expect(vue.ranges[0]?.code).toBe("GAM-save-01");
    expect(vue.ranges[0]?.etat).toBe("approuvée");
    expect(vue.approuvees).toBe(1);
    expect(vue.brouillons).toBe(0);
  });

  it("une réponse enveloppée dans `data` est lue pareillement", () => {
    const vue = atelierView({ data: { gammes: [gamme({ state: "draft" })] } });
    expect(vue.ranges[0]?.etat).toBe("brouillon");
  });

  it("une réponse malformée ne casse pas", () => {
    const vue = atelierView(null);
    expect(vue.ranges).toHaveLength(0);
    expect(vue.total).toBe(0);
    const enveloppe = atelierView({ metadata: {}, data: { gammes: "pas une liste" } });
    expect(enveloppe.ranges).toHaveLength(0);
  });

  it("les états et synchronisations bruts deviennent des mots lisibles", () => {
    const vue = atelierView({
      gammes: [
        gamme({ state: "deprecated", sync: "source_gone" }),
        gamme({ state: "in_review", sync: "stale" }),
      ],
    });
    const etats = vue.ranges.map((r: GammeRow) => r.etat);
    expect(etats).toEqual(["dépréciée", "en revue"]);
    expect(vue.ranges[0]?.synchronisation).toBe("source disparue");
  });
});

const assert = (v: GammeRow | undefined): asserts v is GammeRow => {
  if (!v) throw new Error("attendu une gamme");
};