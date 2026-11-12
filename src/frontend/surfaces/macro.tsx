/**
 * Macro Confluence (GA-17) — état, version, exécutions et fraîcheur de la gamme
 * compilée depuis cette page.
 *
 * La macro **lit** : elle n'écrit jamais dans la page. Le rendu reste mince, la
 * donnée vient de l'action `macroState` du resolver (`src/ui/macro/macro-model.ts`).
 */
import { useEffect, useState } from "react";
import { Box, Heading, Lozenge, Stack, Text } from "@forge/react";
import { appeler } from "../bridge";
import type { ExtensionFacts } from "../route";

type Freshness = { readonly syncedPct: number; readonly medianGapDays: number; readonly staleOver90d: number; readonly total: number };

type MacroState = {
  readonly bound: boolean;
  readonly sync: string;
  readonly code?: string;
  readonly version?: number;
  readonly runs: number;
  readonly ageDays?: number;
  readonly reviewOverdueDays?: number;
  readonly workshop: Freshness;
  readonly message: string;
};

const vide: MacroState = {
  bound: false, sync: "unbound", runs: 0,
  workshop: { syncedPct: 0, medianGapDays: 0, staleOver90d: 0, total: 0 },
  message: "Chargement de l'état de la gamme…",
};

/** L'apparence du badge suit l'état de synchronisation, jamais l'inverse. */
const apparence = (sync: string): "success" | "warning" | "neutral" | "danger" => {
  if (sync === "synced") return "success";
  if (sync === "stale") return "warning";
  if (sync === "source_gone") return "danger";
  return "neutral";
};

/** La ligne « dette documentaire » : la fraîcheur de l'atelier, mesurée. */
const Atelier = ({ workshop }: { readonly workshop: Freshness }) => (
  <Text>
    Atelier : {workshop.total} gamme(s), {Math.round(workshop.syncedPct * 100)} % synchronisées,
    écart médian {workshop.medianGapDays} j, {workshop.staleOver90d} en retard de plus de 90 j.
  </Text>
);

export const Macro = ({ facts }: { readonly facts: ExtensionFacts }) => {
  const [etat, setEtat] = useState<MacroState>(vide);
  const ari = facts.pageAri ?? "";

  const charger = async () => {
    if (!ari) return;
    const reponse = await appeler<MacroState>("macroState", { ari });
    if (reponse) setEtat(reponse);
  };

  useEffect(() => {
    void charger();
  }, [ari]);

  if (!ari) {
    return (
      <Box padding="space.100">
        <Text>Page illisible : la macro Gammes ne peut pas rendre l'état de la gamme.</Text>
      </Box>
    );
  }

  return (
    <Box padding="space.100">
      <Stack space="space.100">
        <Heading as="h3">État de la gamme</Heading>
        <Lozenge appearance={apparence(etat.sync)}>{etat.sync}</Lozenge>
        <Text>{etat.message}</Text>
        {etat.bound ? (
          <Text>
            {etat.runs} exécution(s) tracée(s)
            {etat.ageDays !== undefined ? ` · écart de ${etat.ageDays} jour(s)` : ""}
            {etat.reviewOverdueDays !== undefined ? ` · révision en retard de ${etat.reviewOverdueDays} jour(s)` : ""}
          </Text>
        ) : null}
        <Atelier workshop={etat.workshop} />
      </Stack>
    </Box>
  );
};
