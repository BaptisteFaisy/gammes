/**
 * Les quatre autres surfaces du manifeste : atelier Confluence, registre Jira,
 * réglages d'espace et action de page. Ce sont les écrans visuels — premiers
 * sacrifiables du § 28, parce que le registre et le site public portent la même
 * information. Un seul composant partagé : pas de rendu dupliqué.
 */
import { Box, Text, Link, Stack } from "@forge/react";
import type { SurfaceKey } from "../route";

const TITRES: Readonly<Record<string, string>> = {
  atelier: "Gammes — Atelier",
  registre: "Gammes — Registre",
  reglages: "Gammes — Réglages d'espace",
  contentAction: "Gammes",
  inconnue: "Gammes — surface non reconnue",
};

export const DEMO_URL = "https://baptistefaisy.github.io/gammes/";

const Surface = ({ surface }: { readonly surface: SurfaceKey }) => (
  <Box padding="space.200">
    <Stack space="space.100">
      <Text as="strong">{TITRES[surface] ?? TITRES.inconnue}</Text>
      <Text>
        Cet écran est servi par la ressource unique de l'app ; son contenu complet
        (16 écrans, données réelles) est démontré sur le site public.
      </Text>
      <Link href={DEMO_URL}>Ouvrir la démonstration</Link>
    </Stack>
  </Box>
);

export const Atelier = () => <Surface surface="atelier" />;
export const Registre = () => <Surface surface="registre" />;
export const Reglages = () => <Surface surface="reglages" />;
export const ContentAction = () => <Surface surface="contentAction" />;
export const Inconnue = () => <Surface surface="inconnue" />;
