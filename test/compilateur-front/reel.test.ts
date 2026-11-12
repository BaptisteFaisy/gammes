/**
 * Régressions trouvées par `scripts/real-check.ts` — le contrôle sur données et modèle réels.
 *
 * Trois défauts réels, corrigés, et verrouillés ici pour qu'ils ne reviennent pas :
 * 1. une prose commençant par « Ensuite s'assurer que… » n'était pas reconnue comme ambiguë :
 *    le paragraphe entier disparaissait de la gamme, sans trace ni signalement ;
 * 2. « Vérifier la date d'expiration avec openssl s_client -connect portail.example.fr:443 »
 *    était déclaré non falsifiable alors qu'il cite un outil, un hôte, un port et un objet mesurable ;
 * 3. « Supprimer l'ancien certificat du frontal » ne remontait aucun risque.
 */

import { describe, expect, it } from "vitest";
import { makeDeps, makePage } from "../helpers";
import { assessFalsifiability } from "../../src/core/falsifiable/falsifiability";
import { detectRisk } from "../../src/core/risk/risk-motifs";
import { extractSteps, parseStorageBody } from "../../src/core/extract/extract-steps";
import { scriptedLlm } from "../../src/platform/llm/fake-llm";

const PAGE_REELLE = [
  "<h1>Procédure : renouveler le certificat TLS du portail clients</h1>",
  "<h2>Étapes</h2><ol>",
  "<li>Vérifier la date d'expiration avec openssl s_client -connect portail.example.fr:443.</li>",
  "<li>Faire valider la fin d'intervention par le responsable d'astreinte.</li>",
  "</ol>",
  "<p>Ensuite s'assurer que tout fonctionne avant de prévenir les équipes concernées, puis supprimer",
  "l'ancien certificat du frontal pour ne pas laisser traîner une clé expirée en production.</p>",
].join("\n");

describe("régression 1 — la prose ambiguë n'est plus perdue", () => {
  it("« Ensuite s'assurer que… » est reconnu comme de la prose à confier au modèle", async () => {
    const page = makePage({ title: "Procédure : renouveler le certificat TLS", storageBody: PAGE_REELLE, labels: ["runbook"] });
    const llm = scriptedLlm({
      extract_prose: JSON.stringify({
        steps: [
          { paragraphIndex: 0, text: "S'assurer que tout fonctionne", kind: "check" },
          { paragraphIndex: 0, text: "Prévenir les équipes concernées", kind: "notification" },
          { paragraphIndex: 0, text: "Supprimer l'ancien certificat du frontal", kind: "manual" },
        ],
      }),
    });
    const deps = makeDeps({ llm });
    const { drafts, usedModel } = await extractSteps(deps, page);
    expect(usedModel).toBe(true);
    expect(llm.calls.map((c) => c.task)).toEqual(["extract_prose"]);
    expect(drafts.filter((d) => d.inferredBy === "model")).toHaveLength(3);
    // Les étapes issues de la prose citent le paragraphe dont elles viennent.
    for (const draft of drafts.filter((d) => d.inferredBy === "model")) {
      expect(draft.source.quote).toContain("s'assurer que tout fonctionne");
      expect(draft.inferredReason).toContain("prose ambiguë");
    }
  });

  it("le paragraphe est bien présent dans le corps analysé", () => {
    const page = makePage({ storageBody: PAGE_REELLE });
    const blocks = parseStorageBody(page);
    expect(blocks.some((b) => b.kind === "paragraph" && b.text.startsWith("Ensuite s'assurer"))).toBe(true);
  });
});

describe("régression 2 — un contrôle outillé est falsifiable", () => {
  it("openssl + hôte + port + objet mesurable ⇒ falsifiable", () => {
    const assessed = assessFalsifiability("Vérifier la date d'expiration avec openssl s_client -connect portail.example.fr:443.");
    expect(assessed.falsifiable).toBe(true);
    expect(assessed.measurable?.length).toBeGreaterThan(0);
  });

  it("une durée chiffrée, un nom d'hôte, un outil : autant de critères observables", () => {
    expect(assessFalsifiability("Attendre 5 minutes puis relire le tableau de bord").falsifiable).toBe(true);
    expect(assessFalsifiability("Vérifier le certificat de portail.example.fr").falsifiable).toBe(true);
    expect(assessFalsifiability("Lancer systemctl status frontal").falsifiable).toBe(true);
  });

  it("« s'assurer que tout va bien » reste non falsifiable", () => {
    const vague = assessFalsifiability("S'assurer que tout va bien");
    expect(vague.falsifiable).toBe(false);
    expect(vague.note).toContain("invérifiable");
  });
});

describe("régression 3 — supprimer un certificat est un geste à risque", () => {
  it("classe le geste et lui donne une classe d'actions", () => {
    const motif = detectRisk("Supprimer l'ancien certificat du frontal");
    expect(motif?.class).toBe("secret-rotation");
    expect(motif?.level).toBe("high");
    expect(detectRisk("Révoquer la clé de signature")?.class).toBe("secret-rotation");
    expect(detectRisk("Renouveler le certificat TLS")?.class).toBe("secret-rotation");
    expect(detectRisk("Lire le journal du frontal")).toBeUndefined();
  });
});
