/**
 * Gammes — site public : les preuves générées par la CI.
 *
 * `web/generated/preuves.json` est produit par `scripts/generate-preuves.ts` **pendant le
 * build des Pages** : la CI joue la suite de tests, note le résultat de chaque test, puis
 * rejoue le scénario de la démo avec le modèle réel branché sur le secret du dépôt. Ce que
 * le site affiche est donc le résultat réel du build, pas une promesse.
 *
 * Sans génération (développement local, ou secret absent), le fichier reste le gabarit
 * vide : la démo tourne en direct et affiche « test à vérifier » plutôt qu'un faux vert.
 */

import preuvesJson from "./generated/preuves.json";

export type TestStatus = "passed" | "failed" | "unknown";

export type PreuveStep = {
  readonly proof: string;
  readonly test?: {
    readonly file: string;
    readonly name: string;
    readonly status: TestStatus;
  };
};

export type Preuves = {
  readonly generatedAt: string | null;
  readonly engine: string | null;
  readonly model: string | null;
  readonly suite: { readonly tests: number; readonly passed: number; readonly failed: number };
  readonly steps: Readonly<Record<string, PreuveStep>>;
};

export const PREUVES = preuvesJson as unknown as Preuves;

/** Le statut du test d'une étape, tel que mesuré par la CI — `unknown` si non mesuré. */
export const statusFor = (stepId: string): TestStatus => PREUVES.steps[stepId]?.test?.status ?? "unknown";

export const proofFor = (stepId: string): string | undefined => PREUVES.steps[stepId]?.proof;

export const isGenerated = (): boolean => PREUVES.generatedAt !== null;

export const suiteSummary = (): string =>
  PREUVES.generatedAt === null
    ? "preuves non générées (build local) — la démo tourne en direct, les tests sont à vérifier"
    : `preuves générées le ${PREUVES.generatedAt.slice(0, 16).replace("T", " ")} · moteur ${PREUVES.engine ?? "?"} (${PREUVES.model ?? "?"}) · ${PREUVES.suite.passed}/${PREUVES.suite.tests} tests passés, ${PREUVES.suite.failed} en échec`;
