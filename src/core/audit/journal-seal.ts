/**
 * Le sceau du journal d'audit (idée de consolidation n° 6).
 *
 * Le journal est append-only (« déprécier n'est pas effacer »), mais être
 * append-only ne suffit pas à PROUVER qu'il n'a pas été altéré. Le sceau le
 * fait : chaque entrée est hachée avec l'empreinte de la précédente. Altérer,
 * réordonner, retirer ou insérer une entrée change la tête du sceau — et la
 * vérification le dit, en désignant la première entrée invalide.
 *
 * Le journal lui-même n'est pas dupliqué : `events()` reste la seule source.
 * Le sceau est un lecteur du journal, calculable puis vérifiable n'importe
 * quand (le webtrigger de CI ou l'écran d'audit le fait en une requête).
 */

import type { Hasher } from "../ports";
import type { DomainEvent } from "../ports";

export type SealedEntry = {
  readonly id: string;
  readonly kind: string;
  readonly at: string;
  readonly subjectRef: string;
  readonly hash: string;
};

/** Le sceau : la tête (hash du dernier événement) et la liste chaînée. */
export type Seal = {
  readonly head: string;
  readonly entries: readonly SealedEntry[];
  readonly count: number;
};

export type SealVerdict = {
  readonly valid: boolean;
  readonly checked: number;
  /** La première entrée dont le hash ne correspond plus, si le sceau est rompu. */
  readonly firstInvalidId?: string;
};

const GENESE = "GENESIS";

/** Canonise une valeur pour un empreinte stable, quel que soit l'ordre des clés. */
const canon = (valeur: unknown): unknown => {
  if (Array.isArray(valeur)) return valeur.map(canon);
  if (valeur && typeof valeur === "object") {
    const trie: Record<string, unknown> = {};
    for (const cle of Object.keys(valeur as Record<string, unknown>).sort()) {
      trie[cle] = canon((valeur as Record<string, unknown>)[cle]);
    }
    return trie;
  }
  return valeur;
};

/** L'empreinte d'une entrée, chaînée à la précédente. */
const empreinte = (hasher: Hasher, precedente: string, e: DomainEvent): string =>
  hasher.hash([precedente, e.id, e.kind, e.at, e.subjectRef, JSON.stringify(canon(e.payload))].join("|"));

/** Scelle le journal : une tête qui lie chaque entrée à la précédente. */
export const sealEvents = (hasher: Hasher, events: readonly DomainEvent[]): Seal => {
  let precedent = GENESE;
  const entries: SealedEntry[] = [];
  for (const e of events) {
    precedent = empreinte(hasher, precedent, e);
    entries.push({ id: e.id, kind: e.kind, at: e.at, subjectRef: e.subjectRef, hash: precedent });
  }
  return { head: precedent, entries, count: entries.length };
};

/** Rejoue la chaîne et compare : une entrée altérée brise la chaîne après elle. */
export const verifySeal = (hasher: Hasher, seal: Seal, events: readonly DomainEvent[]): SealVerdict => {
  let precedent = GENESE;
  const attendus = seal.entries.map((e) => e.hash).slice(0, events.length);
  for (let i = 0; i < events.length; i += 1) {
    precedent = empreinte(hasher, precedent, events[i]!);
    if (precedent !== attendus[i]) {
      return { valid: false, checked: i + 1, firstInvalidId: events[i]!.id };
    }
  }
  return { valid: precedent === seal.head && events.length === seal.count, checked: events.length };
};
