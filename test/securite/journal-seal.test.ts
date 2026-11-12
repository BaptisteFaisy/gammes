/**
 * Le sceau du journal : altérer, réordonner, retirer ou insérer une entrée
 * brise la chaîne, et la vérification désigne la première entrée invalide.
 */
import { describe, expect, it } from "vitest";
import { makeDeps, makeHasherDeps } from "../helpers";
import { sealEvents, verifySeal } from "../../src/core/audit/journal-seal";
import type { DomainEvent } from "../../src/core/ports";

const evt = (seq: number, kind: string, payload: Record<string, unknown> = {}): DomainEvent => ({
  id: `evt_${seq}`,
  at: `2026-11-12T0${seq}:00:00.000Z`,
  kind: kind as DomainEvent["kind"],
  subjectRef: `GAM-${seq}`,
  payload,
});

describe("sceau du journal d'audit", () => {
  it("un journal scellé se vérifie tel quel", () => {
    const hasher = makeHasherDeps();
    const events = [evt(1, "gamme.compiled"), evt(2, "gamme.approved"), evt(3, "run.started")];
    const seal = sealEvents(hasher, events);
    expect(seal.count).toBe(3);
    expect(verifySeal(hasher, seal, events).valid).toBe(true);
  });

  it("la chaîne lie chaque entrée à la précédente", () => {
    const hasher = makeHasherDeps();
    const a = sealEvents(hasher, [evt(1, "gamme.compiled")]);
    const b = sealEvents(hasher, [evt(1, "gamme.compiled"), evt(2, "gamme.approved")]);
    // Ajouter une entrée change la tête.
    expect(b.head).not.toBe(a.head);
  });

  it("altérer une entrée brise la chaîne et la désigne", () => {
    const hasher = makeHasherDeps();
    const events = [evt(1, "gamme.compiled"), evt(2, "gamme.approved"), evt(3, "run.started")];
    const seal = sealEvents(hasher, events);
    const fausses = [events[0]!, { ...events[1]!, subjectRef: "GAM-77" }, events[2]!];
    const verdict = verifySeal(hasher, seal, fausses);
    expect(verdict.valid).toBe(false);
    expect(verdict.firstInvalidId).toBe(events[1]!.id);
  });

  it("réordonner, retirer ou insérer une entrée est détecté", () => {
    const hasher = makeHasherDeps();
    const events = [evt(1, "gamme.compiled"), evt(2, "gamme.approved"), evt(3, "run.started")];
    const seal = sealEvents(hasher, events);
    expect(verifySeal(hasher, seal, [events[1]!, events[0]!, events[2]!]).valid).toBe(false);
    expect(verifySeal(hasher, seal, [events[0]!, events[1]!]).valid).toBe(false);
    expect(verifySeal(hasher, seal, [...events, evt(4, "run.finished")]).valid).toBe(false);
  });

  it("l'ordre des clés du payload ne change pas l'empreinte", () => {
    const hasher = makeHasherDeps();
    const a = sealEvents(hasher, [evt(1, "run.deviated", { b: 1, a: 2 })]);
    const b = sealEvents(hasher, [evt(1, "run.deviated", { a: 2, b: 1 })]);
    expect(a.head).toBe(b.head);
  });
});
