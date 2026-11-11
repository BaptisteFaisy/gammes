/**
 * Gammes × placard-wiki — le verrou de secret (§ 9, § 16).
 *
 * Les détecteurs sont partagés : cet adaptateur les consomme depuis
 * `src/core/secrets/detectors` (lot A) et implémente le port `SecretScanner`. Une clé,
 * un mot de passe ou une donnée personnelle n'est jamais publié : l'étape est écartée,
 * un signalement est ouvert, et un emplacement de remplacement est proposé.
 */

import type { Deps } from "../core/ports";
import type { SecretFinding, Step } from "../core/types";
import type { SecretScanner as SecretScannerPort } from "../core/ports";
import { DEFAULT_SECRET_DETECTORS, detectSecrets, type SecretDetector } from "../core/secrets/detectors";

export type { SecretDetector, SecretFinding };

export const createSecretScanner = (deps: Deps, detectors?: readonly SecretDetector[]): SecretScannerPort => ({
  scan: (text, pageAri) => detectSecrets(deps, text, pageAri, detectors ?? DEFAULT_SECRET_DETECTORS),
});

export type ScanOutcome = {
  readonly kept: readonly Step[];
  readonly dropped: readonly Step[];
  readonly findings: readonly SecretFinding[];
};

/** Avant publication : les étapes dont le texte ou la commande cache un secret sont écartées. */
export const scanSteps = (
  deps: Deps,
  steps: readonly Step[],
  pageAri: string,
  detectors?: readonly SecretDetector[],
): ScanOutcome => {
  const kept: Step[] = [];
  const dropped: Step[] = [];
  const findings: SecretFinding[] = [];
  for (const step of steps) {
    const hay = `${step.text} ${step.command ?? ""}`;
    const found = detectSecrets(deps, hay, pageAri, detectors ?? DEFAULT_SECRET_DETECTORS);
    if (found.length > 0) {
      dropped.push(step);
      findings.push(...found);
      void step;
    } else {
      kept.push(step);
    }
  }
  return { kept, dropped, findings };
};

/** Fermer un signalement après correction de la page : les verrous tombent, la valeur n'a jamais existé. */
export const resolveFinding = async (deps: Deps, findingId: string): Promise<SecretFinding | undefined> =>
  deps.store.findings.update(findingId, (f) => ({ ...f, state: "resolved" }));

/** Les signalements ouverts d'une page — affichés sur l'écran de publication. */
export const openFindingsOf = async (deps: Deps, pageAri: string): Promise<readonly SecretFinding[]> =>
  deps.store.findings.list((f) => f.state === "open" && f.where.pageAri === pageAri);