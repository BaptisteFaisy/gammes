/**
 * Lot E — adaptateurs réutilisés : cohortes, signatures d'échec, réservations,
 * résultats clés et lecture du graphe (§ 16, GA-27).
 */

import { describe, expect, it } from "vitest";
import { makeDeps } from "../helpers";
import type { StepStat } from "../../src/core/types";
import { DEFAULT_THRESHOLD, rate } from "../../src/core/stats/rates";
import { DELEGATION_FAIL_CEILING, delegableSteps, renderDelegation } from "../../src/integrations/delegable-ou-pas";
import { createFailureSignatures, groupErrors, normalizeError, signatureOfError } from "../../src/integrations/deja-vu-ci";
import { createReservationRegistry, reservationKey } from "../../src/integrations/chantiers-en-collision";
import { keyResults, toVigiePayload } from "../../src/integrations/vigie";
import { createGraphPort } from "../../src/integrations/graph";

const stat = (stepId: string, failures: number, n: number): StepStat => ({
  id: `stt_${stepId}`,
  versionId: "ver_1",
  stepId,
  period: "trimestre",
  n,
  failRate: rate(failures, n),
  skipRate: rate(0, n),
  deviations: 0,
  computedAt: "2026-11-11T00:00:00.000Z",
});

describe("delegable-ou-pas", () => {
  it("une étape fiable pour un agent seulement si ses traces le prouvent", () => {
    const stats = [
      stat("stp_1", 2, 40), // déléguable
      stat("stp_2", 24, 40), // trop d'échecs : humaine
      stat("stp_3", 0, 3), // pas de recul
    ];
    const verdicts = delegableSteps(stats);
    expect(verdicts.find((v) => v.stepId === "stp_1")?.verdict).toBe("delegable");
    expect(verdicts.find((v) => v.stepId === "stp_2")?.verdict).toBe("needs_human");
    expect(verdicts.find((v) => v.stepId === "stp_3")?.verdict).toBe("not_enough_history");
    expect(DELEGATION_FAIL_CEILING).toBe(0.2);
    expect(renderDelegation(verdicts, "fr")).toContain("sans recul suffisant");
    expect(renderDelegation(verdicts, "en")).toContain("without enough history");
  });

  it("sous le seuil de cohorte : aucune conclusion, aucun pourcentage", () => {
    const small = stat("stp_1", 1, 3);
    const verdict = delegableSteps([small])[0]!;
    expect(verdict.verdict).toBe("not_enough_history");
    expect(verdict.failRate).toBeUndefined();
    expect(small.failRate.value).toBeUndefined();
    expect(DEFAULT_THRESHOLD).toBe(30);
  });
});

describe("deja-vu-ci", () => {
  it("deux échecs identiques à l'horodatage et à l'id près portent la même signature", () => {
    const a = "2026-11-11T09:00:00Z pipeline 42 échoue sur /builds/42 à 10.0.0.1";
    const b = "2026-11-12T10:30:00Z pipeline 91 échoue sur /builds/91 à 10.0.0.2";
    expect(signatureOfError(a)).not.toContain("42");
    expect(signatureOfError(a)).toBe(signatureOfError(b));
    expect(normalizeError(a)).toContain("<date>");
    expect(signatureOfError("erreur complètement différente")).not.toBe(signatureOfError(a));
  });

  it("les erreurs se groupent par signature, avec effectif et exemple", () => {
    const groups = groupErrors([
      "2026-11-11T09:00:00Z timeout sur connexion 10.0.0.1",
      "2026-11-11T09:01:00Z timeout sur connexion 10.0.0.2",
      "clé invalide pour le coffre",
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.count).toBe(2);
    expect(createFailureSignatures().signatureOf("x y z 123")).toBe(signatureOfError("x y z 123"));
  });
});

describe("chantiers-en-collision", () => {
  it("une réservation refuse poliment le second, nomme le détenteur, et se libère", async () => {
    const registry = createReservationRegistry({ now: () => "2026-11-11T09:00:00.000Z" });
    const key = reservationKey("gam_1", "paiements");
    const first = await registry.tryReserve(key, "run_1");
    expect(first.reserved).toBe(true);
    const second = await registry.tryReserve(key, "run_2");
    expect(second.reserved).toBe(false);
    expect(second.holder).toBe("run_1");
    await registry.release(key, "run_1");
    expect((await registry.tryReserve(key, "run_3")).reserved).toBe(true);
    expect(registry.holders().length).toBe(1);
  });
});

describe("vigie", () => {
  it("les résultats clés sont stables et ne nomment personne", async () => {
    const deps = makeDeps();
    const results = await keyResults(deps, "*");
    expect(results.scope).toBe("*");
    expect(results.tracedPct).toBe(0);
    const payload = toVigiePayload(results);
    const keys = JSON.stringify(payload);
    expect(keys).not.toMatch(/(actor|assignee|person|owner|user|byRef|name)/i);
    expect(payload.scope).toBe("*");
    expect(payload).toHaveProperty("taux_echec_etapes");
  });
});

describe("graph", () => {
  it("droit manquant : résultats vides sans erreur, readable() à false", async () => {
    const port = createGraphPort(async () => ({ errors: [{ message: "permission denied for software-service" }] }));
    expect(await port.readable()).toBe(false);
    expect(await port.servicesFor("ari:p/1")).toEqual([]);
    expect(await port.projectsFor("ari:p/1")).toEqual([]);
    expect(await port.ownerOf("ari:p/1")).toBeUndefined();
  });

  it("sans fetcher (hors Forge) : rien n'est inventé", async () => {
    const port = createGraphPort();
    expect(await port.readable()).toBe(false);
    expect(await port.servicesFor("ari:p/1")).toEqual([]);
  });

  it("lecture nominale : services, projets et propriétaire", async () => {
    const fetcher = async (_query: string, variables: { ari?: unknown }) => {
      if (String(_query).includes("owners")) return { data: { ari: { owners: [{ accountId: "ari:cloud:aaid:demo:ana" }] } } };
      if (String(_query).includes("project")) return { data: { ari: { connectedObjects: [{ key: "PAY" }] } } };
      return { data: { ari: { connectedObjects: [{ name: "paiements" }, { name: "facturation" }] } } };
    };
    const port = createGraphPort(fetcher);
    expect(await port.readable()).toBe(true);
    expect(await port.servicesFor("ari:p/1")).toEqual(["paiements", "facturation"]);
    expect(await port.projectsFor("ari:p/1")).toEqual(["PAY"]);
    expect(await port.ownerOf("ari:p/1")).toBe("ari:cloud:aaid:demo:ana");
  });
});