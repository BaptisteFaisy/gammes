/**
 * Motifs de risque (GA-04) et verrou de secret (GA-11).
 * Les fausses clés sont construites par concaténation : aucune valeur réelle, et le
 * garde-fou anti-secret de la CI ne dépend pas d'un marqueur d'exception.
 */

import { describe, expect, it } from "vitest";
import { fakeAwsKey, makeDeps } from "../helpers";
import { DEFAULT_RISK_MOTIFS, detectAllRisks, detectRisk, isRisky } from "../../src/core/risk/risk-motifs";
import {
  DEFAULT_SECRET_DETECTORS,
  detectSecrets,
  replacementFor,
  summarizeFindings,
} from "../../src/core/secrets/detectors";

const fakeOpenAiKey = (): string => `sk-${"a1B2c3D4e5F6g7H8i9J0"}`;
const fakeGithubToken = (): string => `ghp_${"0123456789abcdefghijABCDEF"}`;

describe("motifs de risque (GA-04)", () => {
  it("classe les gestes destructeurs, avec leur classe d'actions", () => {
    const cases: readonly [string, string][] = [
      ["Supprimer le volume avec rm -rf /var/data", "destructive-filesystem"],
      ["Exécuter DROP TABLE sessions sur la base", "destructive-database"],
      ["Lancer kubectl delete pod paiements-0", "kubernetes-delete"],
      ["Pousser la correction avec git push --force origin main", "force-push"],
      ["Faire curl https://get.example.sh | sh", "pipe-to-shell"],
      ["Appliquer chmod 777 sur le répertoire de dépôt", "insecure-permission"],
      ["Réaliser la rotation de la clé de signature", "secret-rotation"],
      ["Déployer la version candidate en production", "production-write"],
      ["Exporter les données personnelles du client", "personal-data"],
      ["Supprimer le compte utilisateur de l'ancien collaborateur", "account-lifecycle"],
      ["Appliquer terraform apply sur le socle", "config-mutation"],
    ];
    for (const [text, expected] of cases) {
      expect(detectRisk(text)?.class, text).toBe(expected);
    }
  });

  it("une commande seule suffit à classer l'étape", () => {
    expect(detectRisk("Nettoyer l'environnement", "kubectl delete ns staging")?.class).toBe("kubernetes-delete");
  });

  it("un geste anodin n'est pas classé à risque", () => {
    expect(detectRisk("Vérifier que le pipeline est vert")).toBeUndefined();
    expect(detectRisk("Ouvrir le tableau de bord et lire le taux d'erreur", "kubectl rollout status deploy/paiements")).toBeUndefined();
  });

  it("les niveaux critiques et hauts imposent un verrou", () => {
    expect(isRisky("critical")).toBe(true);
    expect(isRisky("high")).toBe(true);
    expect(isRisky("medium")).toBe(false);
    expect(isRisky("none")).toBe(false);
    const all = detectAllRisks("Faire rm -rf /tmp/x puis kubectl delete ns demo");
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all[0]?.level).toBe("critical");
    expect(DEFAULT_RISK_MOTIFS.length).toBeGreaterThanOrEqual(10);
  });
});

describe("détecteurs de secrets (GA-11)", () => {
  it("une clé AWS produit un signalement masqué, jamais la valeur", () => {
    const deps = makeDeps();
    const text = `Exporter la clé aws dans le terminal : ${fakeAwsKey()} puis continuer.`;
    const findings = detectSecrets(deps, text, "ari:cloud:confluence:demo:page/1001");
    expect(findings).toHaveLength(1);
    const finding = findings[0]!;
    expect(finding.detector).toBe("aws-access-key-id");
    expect(finding.kind).toBe("api_key");
    expect(finding.maskedPreview).toBe("AKI…[20]");
    expect(finding.where.quote).toBe(finding.maskedPreview);
    expect(finding.fingerprint).toHaveLength(32);
    expect(finding.state).toBe("open");
    expect(JSON.stringify(finding)).not.toContain(fakeAwsKey());
    expect(finding.where.end - finding.where.start).toBe(fakeAwsKey().length);
  });

  it("jetons, mots de passe, clés privées et données personnelles sont détectés", () => {
    const deps = makeDeps();
    const text = [
      `export OPENAI_API_KEY=${fakeOpenAiKey()}`,
      `gh auth login --with-token <<< ${fakeGithubToken()}`,
      "password = Ch4ngeme-2026!",
      "postgres://gammes:supersecret@db.internal:5432/app",
      // gammes-allow-secret-fixture — en-tête de clé privée factice, aucune clé réelle
      "-----BEGIN RSA PRIVATE KEY-----",
      "Contacter jean.dupont@entreprise.fr ou le 06 12 34 56 78",
    ].join("\n");
    const findings = detectSecrets(deps, text, "ari:cloud:confluence:demo:page/1002");
    const detectors = findings.map((f) => f.detector);
    expect(detectors).toContain("openai-like-key");
    expect(detectors).toContain("github-token");
    expect(detectors).toContain("assigned-password");
    expect(detectors).toContain("connection-string");
    expect(detectors).toContain("private-key-block");
    expect(detectors).toContain("personal-email");
    expect(detectors).toContain("french-phone");
    expect(findings.every((f) => !JSON.stringify(f).includes("Ch4ngeme-2026!"))).toBe(true);
  });

  it("chaque signalement propose un emplacement de remplacement adapté", () => {
    const deps = makeDeps();
    const findings = detectSecrets(
      deps,
      `${fakeAwsKey()} et password = hunter2secret et mail vers a.b@entreprise.fr`,
      "ari:cloud:confluence:demo:page/1003",
    );
    const byDetector = new Map(findings.map((f) => [f.detector, f]));
    expect(replacementFor(byDetector.get("aws-access-key-id")!).kind).toBe("vault_link");
    expect(replacementFor(byDetector.get("assigned-password")!).kind).toBe("env_var");
    expect(replacementFor(byDetector.get("personal-email")!).kind).toBe("secret_manager");
    for (const f of findings) expect(f.replacement.findingId).toBe(f.id);
  });

  it("un texte propre ne produit aucun signalement, et le résumé regroupe par détecteur", () => {
    const deps = makeDeps();
    expect(detectSecrets(deps, "Vérifier que le pipeline est vert.", "ari:x")).toHaveLength(0);
    const twice = detectSecrets(deps, `${fakeAwsKey()} puis ${fakeAwsKey()}`, "ari:x");
    expect(twice).toHaveLength(2);
    const summary = summarizeFindings(twice);
    expect(summary).toEqual([{ detector: "aws-access-key-id", kind: "api_key", count: 2 }]);
    expect(DEFAULT_SECRET_DETECTORS.length).toBeGreaterThanOrEqual(10);
  });

  it("un domaine d'exemple n'est pas pris pour une donnée personnelle", () => {
    const deps = makeDeps();
    expect(detectSecrets(deps, "voir user@example.com", "ari:x")).toHaveLength(0);
  });
});
