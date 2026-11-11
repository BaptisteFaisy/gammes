/**
 * Gammes — empreintes et masquage.
 *
 * Implémentation pure (aucun module Node) : le même code tourne dans le runtime
 * Forge, dans le harness local et dans les tests.
 *
 * `cyrb128` n'est PAS une fonction cryptographique : elle sert à comparer des
 * contenus (désynchronisation § 10) et à référencer un signalement sans recopier
 * le secret (§ 9). Les détecteurs de secrets, eux, sont dans `src/core/secrets/`.
 */

import type { Hasher } from "../core/ports";
import type { ContentFingerprint } from "../core/types";

const cyrb128 = (input: string): readonly [number, number, number, number] => {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < input.length; i += 1) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 13), 597399067) >>> 0;
  h2 = Math.imul(h2 ^ (h2 >>> 14), 597399067) >>> 0;
  h3 = Math.imul(h3 ^ (h3 >>> 15), 597399067) >>> 0;
  h4 = Math.imul(h4 ^ (h4 >>> 16), 597399067) >>> 0;
  return [h1, h2, h3, h4];
};

const hex = (values: readonly number[]): string =>
  values.map((v) => v.toString(16).padStart(8, "0")).join("");

/** Normalisation : le fond compte, pas la mise en forme (espaces, CDATA, macros vides). */
export const normalizeContent = (body: string): string =>
  body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ac:parameter[^>]*>\s*<\/ac:parameter>/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const hashText = (text: string): string => hex(cyrb128(text));

export const contentFingerprint = (body: string): ContentFingerprint =>
  hashText(normalizeContent(body));

/** Aperçu masqué : on montre la forme, jamais la valeur (`AKI…[32]`). */
export const maskSecret = (value: string): string => {
  const head = value.slice(0, 3);
  return `${head}…[${value.length}]`;
};

export const makeHasher = (): Hasher => ({
  contentHash: contentFingerprint,
  hash: hashText,
});
