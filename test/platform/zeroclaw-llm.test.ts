/**
 * Le client LLM « ZeroClaw » : le modèle est un agent ZeroClaw (servi par
 * InferHub). Le test ne lance aucun binaire : l'exécuteur est injecté.
 */
import { describe, expect, it } from "vitest";
import { zeroClawLlm } from "../../src/platform/llm/zeroclaw-llm";
import { memoryBudget } from "../../src/platform/llm/budget";
import { SHIELD_RULE } from "../../src/platform/llm/prompt-shield";

describe("client LLM ZeroClaw", () => {
  it("replie la consigne système dans le message, règle du rempart comprise", async () => {
    let recu = "";
    const client = zeroClawLlm({ agent: "b", run: async (message) => { recu = message; return "{\"steps\":[]}"; } });
    const res = await client.complete({ task: "extract_prose", prompt: "Extrais les étapes.", json: true });
    expect(res.text).toContain("{\"steps\":[]}");
    expect(recu).toContain("Extrais les étapes.");
    expect(recu).toContain(SHIELD_RULE);
    expect(recu).toContain("JSON strict");
  });

  it("nettoie l'habillage du binaire et met en cache par empreinte", async () => {
    let appels = 0;
    const client = zeroClawLlm({
      agent: "b",
      run: async () => { appels += 1; return "\u001b[32m« la réponse »\u001b[0m\n"; },
    });
    const premier = await client.complete({ task: "qualify_step", prompt: "x", cacheKey: "abc" });
    expect(premier.text).toBe("« la réponse »");
    const second = await client.complete({ task: "qualify_step", prompt: "x", cacheKey: "abc" });
    expect(second.cached).toBe(true);
    expect(appels).toBe(1);
    expect(client.cacheSize()).toBe(1);
  });

  it("une réponse vide est une erreur franche, pas un résultat vide", async () => {
    const client = zeroClawLlm({ agent: "b", run: async () => "   " });
    await expect(client.complete({ task: "qualify_step", prompt: "x" })).rejects.toThrow(/réponse vide/);
  });

  it("le budget du jour reçoit l'appel", async () => {
    const budget = memoryBudget("2026-11-12");
    const client = zeroClawLlm({ agent: "b", budget, run: async () => "ok" });
    await client.complete({ task: "qualify_step", prompt: "x" });
    expect(budget.snapshot().llmCalls).toBe(1);
  });

  it("le nom du client dit l'agent et le modèle de la config", async () => {
    const client = zeroClawLlm({ agent: "b", run: async () => "ok" });
    expect(client.name).toBe("zeroclaw:@b");
  });
});
