/**
 * Encart Jira (GA-16) — « quelle gamme s'applique à ce ticket, la démarrer,
 * voir les traces ». Propriétaire : lot K. Le rendu reste mince : ce qui se
 * calcule vit dans `src/ui/issue-panel-model.ts` et se teste hors navigateur.
 */
import { Box, Text, Lozenge, Stack } from "@forge/react";
import type { ExtensionFacts } from "../route";

export const IssuePanel = ({ facts }: { readonly facts: ExtensionFacts }) => (
  <Box padding="space.100">
    <Stack space="space.100">
      <Text as="strong">Gammes — {facts.issueKey ?? "ticket inconnu"}</Text>
      <Lozenge appearance="inprogress">encart à implémenter (lot K, GA-16)</Lozenge>
    </Stack>
  </Box>
);
