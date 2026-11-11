/**
 * Gammes — détecteurs de secrets et de données personnelles (§ 9, GA-11).
 *
 * Avant publication, chaque étape passe ici. Une clé, un mot de passe ou une
 * donnée personnelle n'est **jamais** publiée : elle devient un signalement
 * (`SecretFinding`) avec son empreinte et un aperçu masqué, et l'app propose un
 * emplacement de remplacement (coffre, variable d'environnement, gestionnaire).
 *
 * La valeur du secret n'est copiée nulle part : ni dans le signalement, ni dans la
 * citation, ni dans un journal. Les détecteurs sont partagés avec `placard-wiki`
 * (§ 16) : une seule implémentation par logique.
 */

import type { Deps } from "../ports";
import type { SecretFinding, SecretReplacement, SourceSpan } from "../types";
import { maskSecret } from "../../platform/hash";

export type SecretDetector = {
  readonly name: string;
  readonly kind: SecretFinding["kind"];
  readonly pattern: RegExp;
  readonly label: string;
};

export const DEFAULT_SECRET_DETECTORS: readonly SecretDetector[] = [
  {
    name: "aws-access-key-id",
    kind: "api_key",
    pattern: /\b(?:AKIA|ASIA|AIDA|AROA|ANPA)[0-9A-Z]{16}\b/g,
    label: "identifiant de clé AWS",
  },
  {
    name: "aws-secret-access-key",
    kind: "api_key",
    pattern: /\baws_secret_access_key\b\s*[:=]\s*[A-Za-z0-9/+=]{30,}/gi,
    label: "clé secrète AWS affectée",
  },
  {
    name: "openai-like-key",
    kind: "api_key",
    pattern: /\bsk-(?:proj-|airo-)?[A-Za-z0-9_-]{20,}\b/g,
    label: "clé d'API de fournisseur de modèle",
  },
  {
    name: "github-token",
    kind: "token",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
    label: "jeton GitHub",
  },
  {
    name: "slack-token",
    kind: "token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    label: "jeton Slack",
  },
  {
    name: "private-key-block",
    kind: "certificate",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
    label: "bloc de clé privée",
  },
  {
    name: "assigned-password",
    kind: "password",
    pattern: /\b(?:password|passwd|pwd|mot[ _-]de[ _-]passe)\b\s*[:=]\s*[^\s<"'`]{6,}/gi,
    label: "mot de passe affecté en clair",
  },
  {
    name: "connection-string",
    kind: "password",
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s"'<]*:[^\s"'@<]+@/gi,
    label: "chaîne de connexion avec identifiants",
  },
  {
    name: "bearer-token",
    kind: "token",
    pattern: /\bBearer\s+[A-Za-z0-9._\-]{20,}\b/g,
    label: "jeton porteur dans un en-tête",
  },
  {
    name: "iban",
    kind: "personal_data",
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
    label: "coordonnées bancaires (IBAN)",
  },
  {
    name: "french-social-security",
    kind: "personal_data",
    pattern: /\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b/g,
    label: "numéro de sécurité sociale",
  },
  {
    name: "personal-email",
    kind: "personal_data",
    pattern: /\b[\w.+-]+@(?!(?:example|test|localhost|users\.noreply)[.\w-]*\b)[\w-]+(?:\.[\w-]+)+\b/gi,
    label: "adresse de courrier électronique personnelle",
  },
  {
    name: "french-phone",
    kind: "personal_data",
    pattern: /\b(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}\b/g,
    label: "numéro de téléphone",
  },
];

/** Emplacement proposé à la place du secret : la gamme pointe, elle ne contient pas. */
export const replacementFor = (finding: Omit<SecretFinding, "replacement">): SecretReplacement => {
  const slug = finding.detector.toUpperCase().replace(/-/g, "_");
  if (finding.kind === "password") {
    return { kind: "env_var", target: `GAMMES_${slug}`, findingId: finding.id };
  }
  if (finding.kind === "personal_data") {
    return { kind: "secret_manager", target: `coffre://donnees-personnelles/${finding.detector}`, findingId: finding.id };
  }
  return { kind: "vault_link", target: `https://vault.example.internal/gammes/${finding.detector}`, findingId: finding.id };
};

const findingOf = (
  deps: Deps,
  detector: SecretDetector,
  value: string,
  index: number,
  pageAri: string,
): SecretFinding => {
  const id = deps.ids.next("sec");
  const where: SourceSpan = {
    pageAri,
    start: index,
    end: index + value.length,
    // La citation est masquée : l'emplacement est utile, la valeur ne l'est jamais.
    quote: maskSecret(value),
  };
  const base = {
    id,
    detector: detector.name,
    kind: detector.kind,
    where,
    fingerprint: deps.hasher.hash(value),
    maskedPreview: maskSecret(value),
    openedAt: deps.clock.now(),
    state: "open" as const,
  };
  return { ...base, replacement: replacementFor(base) };
};

/** Balaye un texte et rend un signalement par occurrence détectée. */
export const detectSecrets = (
  deps: Deps,
  text: string,
  pageAri: string,
  detectors: readonly SecretDetector[] = DEFAULT_SECRET_DETECTORS,
): readonly SecretFinding[] => {
  const out: SecretFinding[] = [];
  for (const detector of detectors) {
    // Un motif global est étatful : on repart de zéro à chaque texte.
    const pattern = new RegExp(detector.pattern.source, detector.pattern.flags);
    for (const m of text.matchAll(pattern)) {
      if (!m[0] || m[0].length < 6) continue;
      out.push(findingOf(deps, detector, m[0], m.index ?? 0, pageAri));
    }
  }
  return out;
};

/** Signalements agrégés par détecteur, pour l'écran de publication. */
export const summarizeFindings = (
  findings: readonly SecretFinding[],
): readonly { detector: string; kind: SecretFinding["kind"]; count: number }[] => {
  const byDetector = new Map<string, { detector: string; kind: SecretFinding["kind"]; count: number }>();
  for (const f of findings) {
    const current = byDetector.get(f.detector);
    byDetector.set(f.detector, { detector: f.detector, kind: f.kind, count: (current?.count ?? 0) + 1 });
  }
  return [...byDetector.values()];
};
