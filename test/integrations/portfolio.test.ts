/**
 * Lot E — adaptateurs réutilisés : permis, preuves, placard, brief (§ 16).
 * Chaque app sœur est consommée via un port ; rien n'est réinventé, rien n'est recopié.
 */

import { describe, expect, it } from "vitest";
import { makeDeps, makeStep } from "../helpers";
import { createPermitRegistry, DEMO_GRANTS } from "../../src/integrations/permis-forge";
import { explain, isStrongEnough, strengthFor, STRENGTH_ORDER } from "../../src/integrations/preuve-a-l-appui";
import { createSecretScanner, resolveFinding, scanSteps } from "../../src/integrations/placard-wiki";
import { fitsBudget, maskUnified, preparePrompt, quoteSpan } from "../../src/integrations/brief-forge";
import { span } from "../helpers";

// Fausse clé construite par concaténation : jamais une valeur réelle.
const fakeKey = (): string => `AKI${"AI"}OSFODNN7EXAMPLE`;

describe("permis-forge", () => {
  it("un agent sans permis est refusé prudemment, avec la demande à créer", async () => {
    const registry = createPermitRegistry({ grants: DEMO_GRANTS, now: () => "2026-11-11T00:00:00.000Z" });
    const denied = await registry.check("agent:1", "agent", "destructive-database", "paiements");
    expect(denied.result).toBe("unknown_service");
    expect(denied.requestUrl).toContain("destructive-database");

    const outOfScope = await registry.check("agent:1", "agent", "production-write", "facturation");
    expect(outOfScope.result).toBe("unknown_service");
  });

  it("un permis valide et dans le périmètre est accordé ; un permis expiré est refusé", async () => {
    const registry = createPermitRegistry({ grants: DEMO_GRANTS, now: () => "2026-11-11T00:00:00.000Z" });
    const granted = await registry.check("agent:1", "agent", "production-write", "paiements");
    expect(granted.result).toBe("granted");
    const expiredRegistry = createPermitRegistry({ grants: DEMO_GRANTS, now: () => "2031-01-01T00:00:00.000Z" });
    const expired = await expiredRegistry.check("agent:1", "agent", "production-write", "paiements");
    expect(expired.result).toBe("denied");
    expect(expired.requestUrl).toContain("production-write");
  });

  it("un humain n'a pas à présenter de permis", async () => {
    const registry = createPermitRegistry({ grants: DEMO_GRANTS });
    const human = await registry.check("ari:cloud:aaid:demo:ana", "human", "production-write", "paiements");
    expect(human.result).toBe("granted");
    expect(registry.requestUrl("production-write")).toContain("production-write");
  });
});

describe("preuve-a-l-appui", () => {
  it("la force attendue suit la nature de la preuve", () => {
    expect(strengthFor("command_output")).toBe("machine");
    expect(strengthFor("command_output", { automated: false })).toBe("attested");
    expect(strengthFor("screenshot")).toBe("attested");
    expect(strengthFor("attestation")).toBe("attested");
    expect(strengthFor("none")).toBe("declared");
    expect(isStrongEnough("machine", "machine")).toBe(true);
    expect(isStrongEnough("machine", "declared")).toBe(false);
    expect(explain("machine", "declared", "fr")).toContain("insuffisante");
    expect(explain("machine", "machine", "en")).toContain("sufficient");
    expect(STRENGTH_ORDER).toEqual(["declared", "attested", "machine"]);
  });
});

describe("placard-wiki", () => {
  it("une étape qui cache une clé est écartée, son signalement masqué", () => {
    const deps = makeDeps();
    const step = makeStep({ id: "stp_secret", text: `Exporter la clé ${fakeKey()} puis vérifier` });
    const outcome = scanSteps(deps, [step, makeStep({ id: "stp_ok" })], "ari:cloud:confluence:demo:page/1001");
    expect(outcome.kept.map((s) => s.id)).toEqual(["stp_ok"]);
    expect(outcome.dropped.map((s) => s.id)).toEqual(["stp_secret"]);
    expect(outcome.findings).toHaveLength(1);
    expect(JSON.stringify(outcome.findings)).not.toContain(fakeKey());
    expect(outcome.findings[0]?.maskedPreview).toBe("AKI…[20]");
  });

  it("le port scanne une page, et un signalement se résout sans jamais avoir contenu la valeur", async () => {
    const deps = makeDeps();
    const scanner = createSecretScanner(deps);
    const findings = scanner.scan(`token: ${fakeKey()}`, "ari:p/9");
    expect(findings).toHaveLength(1);
    expect(createSecretScanner(deps).scan("rien ici", "ari:p/9")).toHaveLength(0);
    // La compilation grave le signalement ; le résoudre n'exige que son identifiant.
    await deps.store.findings.insert(findings[0]!);
    const resolved = await resolveFinding(deps, findings[0]!.id);
    expect(resolved?.state).toBe("resolved");
  });
});

describe("brief-forge", () => {
  it("une citation valide colle aux décalages, et les incohérences sont dites", () => {
    const body = "0123456789ABCDEF";
    const good = span({ pageAri: "ari:p/1", start: 2, end: 6, quote: "2345" });
    expect(quoteSpan(body, good).valid).toBe(true);
    const bad = span({ pageAri: "ari:p/1", start: 2, end: 20, quote: "2345" });
    expect(quoteSpan(body, bad).valid).toBe(false);
  });

  it("le budget de contexte coupe en le disant, jamais en silence", () => {
    const parts = ["a".repeat(30), "b".repeat(30), "c".repeat(30)];
    const result = fitsBudget(parts, 80);
    expect(result.truncated).toBe(true);
    expect(result.kept).toBe(2);
    expect(result.total).toBe(3);
    expect(result.content).toContain("tronqués");
    expect(fitsBudget(parts, 1000).truncated).toBe(false);
  });

  it("le masquage unifié retire les secrets d'une invite avant l'envoi au modèle", () => {
    const prompt = `Voici ma clé ${fakeKey()} dans le texte.`;
    const masked = maskUnified(prompt);
    expect(masked).not.toContain(fakeKey());
    expect(masked).toContain("api_key:AKI…[20]");
    expect(preparePrompt("système", `clé ${fakeKey()}`).content).not.toContain(fakeKey());
  });
});