/**
 * Gammes — motifs de risque (§ 6 étage 3, GA-04).
 *
 * Règles d'abord, modèle ensuite : une étape est classée à risque par motif
 * reconnaissable, jamais devinée. Chaque motif porte sa classe d'actions — c'est
 * cette classe que le verrou de permis (`permis-forge`) utilisera au moment de
 * l'exécution. La liste est ordonnée du plus grave au moins grave : le premier
 * motif qui correspond gagne, et sa classe est affichée partout.
 */

import type { RiskLevel } from "../types";

export type RiskMotif = {
  /** Classe d'actions : la clé partagée avec le registre de permis. */
  readonly class: string;
  readonly pattern: RegExp;
  readonly level: RiskLevel;
  /** Raison lisible, affichée à l'opérateur et au propriétaire. */
  readonly label: string;
  /**
   * Vrai pour les gestes destructifs/irréversibles : réservés à un humain (verrou humain).
   * Les autres gestes à risque sont seulement soumis au verrou de permis : un agent muni
   * d'un permis valide peut les exécuter (§ 9). Recette 4 (kubectl delete → verrou humain)
   * et recette 9 (production-write par un agent → verrou de permis) coexistent ainsi.
   */
  readonly humanOnly?: boolean;
};

export const DEFAULT_RISK_MOTIFS: readonly RiskMotif[] = [
  {
    class: "pipe-to-shell",
    pattern: /\b(?:curl|wget)\b[^|\n]*\|\s*(?:ba|z|da)?sh\b/i,
    level: "critical",
    label: "téléchargement exécuté directement par un interpréteur",
    humanOnly: true,
  },
  {
    class: "destructive-filesystem",
    pattern: /\brm\s+(?:-[a-zA-Z]*\s+)*-[a-zA-Z]*r[a-zA-Z]*f|\brm\s+-rf\b|\bshred\b|\bmkfs\b|\bdd\s+if=/i,
    level: "critical",
    label: "suppression récursive ou irréversible du système de fichiers",
    humanOnly: true,
  },
  {
    class: "destructive-database",
    pattern: /\b(?:DROP\s+(?:TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE|DELETE\s+FROM\s+\w+\s*;)/i,
    level: "critical",
    label: "destruction de données en base",
    humanOnly: true,
  },
  {
    class: "force-push",
    pattern: /\bgit\s+push\b[^\n]*(?:--force\b|-f\b)|\bforce-push\b/i,
    level: "high",
    label: "réécriture de l'historique partagé",
    humanOnly: true,
  },
  {
    class: "kubernetes-delete",
    pattern: /\bkubectl\s+(?:delete|drain|cordon)\b|\bhelm\s+(?:uninstall|delete)\b/i,
    level: "high",
    label: "suppression ou retrait d'une charge en production",
    humanOnly: true,
  },
  {
    class: "insecure-permission",
    pattern: /\bchmod\s+(?:-R\s+)?777\b|\bchown\s+-R\b/i,
    level: "high",
    label: "ouverture large des permissions",
  },
  {
    class: "secret-rotation",
    pattern:
      /(?:rotation|révocation|revocation|reset|regenerat\w*|réinitialis\w*|supprim\w+|r[ée]voqu\w+|retir\w+|renouvel\w+|revoke|remove|renew)[^\n]{0,40}(?:clé|cle|key|secret|token|certificat|certificate|credential)/i,
    level: "high",
    label: "rotation ou révocation de secret",
  },
  {
    class: "production-write",
    pattern:
      /(?:déploy\w*|deploy\w*|migrat\w*|bascul\w*|write|écrire|rollback)[^\n]{0,40}(?:production|\bprod\b)|(?:production|\bprod\b)[^\n]{0,40}(?:déploy\w*|deploy\w*|migrat\w*|bascul\w*|write|écrire|rollback)/i,
    level: "high",
    label: "écriture en production",
  },
  {
    class: "personal-data",
    pattern:
      /(?:données?\s+personnelles?|personal\s+data|\bRGPD\b|\bGDPR\b|\bCNIL\b|numéro\s+de\s+sécurité\s+sociale|anonymis\w+|pseudonymis\w+)/i,
    level: "high",
    label: "manipulation de données personnelles",
  },
  {
    class: "account-lifecycle",
    pattern: /(?:supprim\w+|delet\w+|désactiv\w+|deactivat\w+)[^\n]{0,30}(?:compte|account|utilisateur|user|accès|access)/i,
    level: "medium",
    label: "modification d'un compte ou d'un accès",
  },
  {
    class: "config-mutation",
    pattern: /\bkubectl\s+(?:apply|patch|edit|scale|rollout\s+undo)\b|\bterraform\s+(?:apply|destroy)\b/i,
    level: "medium",
    label: "mutation de configuration d'infrastructure",
  },
];

/** Niveaux qui imposent un verrou humain et un permis pour un agent. */
export const RISKY_LEVELS: readonly RiskLevel[] = ["high", "critical"];

export const isRisky = (level: RiskLevel): boolean => RISKY_LEVELS.includes(level);

const matches = (motif: RiskMotif, text: string, command?: string): boolean =>
  motif.pattern.test(text) || (command !== undefined && motif.pattern.test(command));

/** Premier motif correspondant dans l'ordre de gravité — `undefined` si rien. */
export const detectRisk = (
  text: string,
  command?: string,
  motifs: readonly RiskMotif[] = DEFAULT_RISK_MOTIFS,
): RiskMotif | undefined => motifs.find((m) => matches(m, text, command));

/** Tous les motifs correspondants : utile à l'explicabilité du brouillon. */
export const detectAllRisks = (
  text: string,
  command?: string,
  motifs: readonly RiskMotif[] = DEFAULT_RISK_MOTIFS,
): readonly RiskMotif[] => motifs.filter((m) => matches(m, text, command));
