/**
 * Macro Confluence (GA-17) — état, version, exécutions et fraîcheur de la gamme
 * compilée depuis la page. Propriétaire : lot L. La donnée vient de l'action
 * `macroState` du resolver ; la mise en forme seulement vit ici.
 */
import { Box, Text, Lozenge, Stack } from "@forge/react";
import type { ExtensionFacts } from "../route";

export const Macro = ({ facts }: { readonly facts: ExtensionFacts }) => (
  <Box padding="space.100">
    <Stack space="space.100">
      <Text as="strong">État de la gamme</Text>
      <Lozenge appearance="inprogress">macro à implémenter (lot L, GA-17)</Lozenge>
      {facts.pageAri ? <Text>page {facts.pageAri}</Text> : <Text>page inconnue</Text>}
    </Stack>
  </Box>
);
