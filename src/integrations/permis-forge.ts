/**
 * Gammes × permis-forge — le verrou de permis (§ 9, GA-12).
 *
 * La gamme dit **quoi** faire, le permis dit **si l'agent a le droit**. Cet adaptateur
 * implémente le port `PermitRegistry` en consommant la logique de l'app sœur
 * `permis-forge` : on ne réinvente ni les classes d'actions, ni les périmètres, ni les
 * durées. Dans Forge, l'appel réel passe par le resolver de `permis-forge` (ou son REST
 * signé) ; ici, un registre en mémoire permet le harness et les tests — et la règle tient
 * toujours : **jamais d'accord par défaut**.
 */

import type { EvidenceStrength, PermitCheck } from "../core/types";
import type { PermitRegistry as PortPermitRegistry } from "../core/ports";

export type PermitGrant = {
  readonly permitClass: string;
  readonly scope: string;
  readonly expiresAt: string;
  readonly autonomy: "full" | "supervised" | "limited";
};

export type PermitRegistryOptions = {
  readonly grants?: readonly PermitGrant[];
  readonly now?: () => string;
  readonly requestBase?: string;
};

const isExpired = (grant: PermitGrant, nowIso: string): boolean => grant.expiresAt <= nowIso;

const inScope = (grant: PermitGrant, scope: string): boolean =>
  grant.scope === "*" || grant.scope === scope || scope.startsWith(`${grant.scope}/`);

/** Registre en mémoire consommé par le cœur : le même dans Forge, remplacé par l'appel réel. */
export const createPermitRegistry = (options: PermitRegistryOptions = {}): PortPermitRegistry => {
  const grants = options.grants ?? [];
  const now = options.now ?? (() => new Date().toISOString());
  const requestBase = options.requestBase ?? "https://permis.example.internal/demande";

  return {
    check: async (actorId, actorKind, permitClass, scope): Promise<PermitCheck> => {
      if (actorKind === "human") {
        return { id: `perm_h_${Date.now().toString(36)}`, stepId: "", permitClass, checkedAt: now(), result: "granted" };
      }
      const grant = grants.find((g) => g.permitClass === permitClass && inScope(g, scope));
      const result = !grant || isExpired(grant, now()) ? (grant ? "denied" : "unknown_service") : "granted";
      return {
        id: `perm_${(actorId + permitClass).length}_${Math.random().toString(36).slice(2, 8)}`,
        stepId: "",
        permitClass,
        checkedAt: now(),
        result,
        ...(grant && result !== "granted" ? { permitId: `${grant.permitClass}:${grant.scope}` } : {}),
        ...(result !== "granted" ? { requestUrl: `${requestBase}/${permitClass}` } : {}),
      };
    },
    requestUrl: (permitClass) => `${requestBase}/${permitClass}`,
  };
};

/** Besoin d'un permis : la classe d'actions et le périmètre, rien de plus à réinventer. */
export const permitRequired = (permitClass: string, scope: string): string =>
  `permis « ${permitClass} » requis sur ${scope}`;

/** Exemple de jeu de permis pour le semis de démonstration. */
export const DEMO_GRANTS: readonly PermitGrant[] = [
  { permitClass: "production-write", scope: "paiements", expiresAt: "2030-01-01T00:00:00.000Z", autonomy: "supervised" },
  { permitClass: "kubernetes-delete", scope: "staging", expiresAt: "2030-01-01T00:00:00.000Z", autonomy: "supervised" },
];