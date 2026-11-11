/**
 * Gammes × deja-vu-ci — la signature d'échec des étapes (§ 11, § 16).
 *
 * Les erreurs d'étape se regroupent comme les builds rouges : on normalise le texte
 * (horodatages, identifiants, adresses, chemins, nombres, hex) puis on l'empreinte.
 * Deux échecs identiques à l'horodatage près portent la même signature.
 */

import type { FailureSignatures as FailureSignaturesPort } from "../core/ports";
import { hashText } from "../platform/hash";

const NORMALIZATIONS: readonly (readonly [RegExp, string])[] = [
  [/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g, "<DATE>"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<UUID>"],
  [/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "<IP>"],
  [/\/[^\s"'<>|]+\/[^\s"'<>|]+/g, "<PATH>"],
  [/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+:\d+/g, "<FILE:LN>"],
  [/\b0x[0-9a-f]+\b/gi, "<HEX>"],
  [/\b\d+\b/g, "<N>"],
];

/** Le texte d'erreur réduit à sa structure : ce qui le rend comparable sans être identique. */
export const normalizeError = (errorText: string): string => {
  let out = errorText;
  for (const [pattern, replacement] of NORMALIZATIONS) out = out.replace(pattern, replacement);
  return out.replace(/\s+/g, " ").trim().toLowerCase();
};

export const signatureOfError = (errorText: string): string => hashText(normalizeError(errorText));

export type ErrorGroup = {
  readonly signature: string;
  readonly count: number;
  readonly example: string;
};

export const groupErrors = (errors: readonly string[]): readonly ErrorGroup[] => {
  const groups = new Map<string, { count: number; example: string }>();
  for (const error of errors) {
    const signature = signatureOfError(error);
    const current = groups.get(signature);
    groups.set(signature, { count: (current?.count ?? 0) + 1, example: current?.example ?? error });
  }
  return [...groups.entries()]
    .map(([signature, { count, example }]) => ({ signature, count, example }))
    .sort((a, b) => b.count - a.count);
};

export const createFailureSignatures = (): FailureSignaturesPort => ({
  signatureOf: signatureOfError,
});

export const failureSignature = signatureOfError;