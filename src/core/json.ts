/**
 * Gammes — JSON défensif, partagé.
 *
 * Plusieurs modules lisent la réponse d'un modèle (extraction de prose,
 * qualification, reformulation, conciliation). Une seule implémentation : on retire
 * l'éventuelle fence markdown, on analyse, et **un échec rend `undefined`** — jamais
 * d'exception qui remonte, jamais de donnée inventée pour combler le vide.
 */

/** Retire une fence ```json … ``` si le modèle en a mis une, sinon rend le texte tel quel. */
export const stripFence = (text: string): string => {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  return (fenced?.[1] ?? text).trim();
};

/** Analyse tolérante : `undefined` si la réponse n'est pas du JSON exploitable. */
export const parseJsonLoose = <T>(text: string): T | undefined => {
  try {
    return JSON.parse(stripFence(text)) as T;
  } catch {
    return undefined;
  }
};

/** Récupère une chaîne non vide dans un objet inconnu (réponse de modèle non typée). */
export const textField = (value: unknown, key: string): string | undefined => {
  const raw = (value as Record<string, unknown> | undefined)?.[key];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;
};

/** Récupère un tableau dans un objet inconnu, ou un tableau vide. */
export const arrayField = (value: unknown, key: string): readonly unknown[] => {
  const raw = (value as Record<string, unknown> | undefined)?.[key];
  return Array.isArray(raw) ? raw : [];
};
