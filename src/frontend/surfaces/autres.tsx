/**
 * Gammes — les surfaces Forge : atelier, registre, réglages d'espace et action de page.
 *
 * Ces quatre écrans sont servis par l'app **dans Atlassian** : ils lisent le tenant
 * (le stockage de l'app, les pages du site) et disent ce qu'ils trouvent. Un registre
 * vide est un état affiché, jamais une pancarte qui renvoie ailleurs.
 *
 * Une seule source de vérité pour la forme affichée : `src/ui/atelier/atelier-model.ts`
 * (pur, testé) ; ce fichier ne fait que rendre.
 */
import { useEffect, useState } from "react";
import { Box, Heading, Link, List, ListItem, Spinner, Stack, Text } from "@forge/react";
import { appeler } from "../bridge";
import { atelierView, type AtelierView } from "../../ui/atelier/atelier-model";
import type { ExtensionFacts } from "../route";

export const DEMO_URL = "https://tradoooo.github.io/gammes/";

const VIDE: AtelierView = {
  ranges: [],
  total: 0,
  approuvees: 0,
  brouillons: 0,
  message: "Chargement du registre du tenant…",
  freshness: "",
  coverage: "",
};

/** Le registre, tel que l'app le lit : la donnée vient du resolver, pas d'une image. */
const useAtelier = (): AtelierView => {
  const [vue, setVue] = useState<AtelierView>(VIDE);
  useEffect(() => {
    let vivant = true;
    void appeler("atelier", {}).then((reponse) => {
      if (vivant) setVue(atelierView(reponse));
    });
    return () => {
      vivant = false;
    };
  }, []);
  return vue;
};

/** Une ligne de gamme : code, titre, état, version, synchronisation. */
const Ligne = ({ range }: { readonly range: AtelierView["ranges"][number] }) => (
  <ListItem>
    <Stack space="space.100">
      <Text as="strong">{range.code}</Text>
      <Text>{range.titre}</Text>
      <Text>
        {range.etat} · version {range.version} · espace {range.espace} · source {range.synchronisation}
        {range.verrou ? ` · ${range.verrou}` : ""}
      </Text>
    </Stack>
  </ListItem>
);

/** Le corps commun : le registre, ou pourquoi il est vide. */
const RegistreCorps = ({ titre }: { readonly titre: string }) => {
  const vue = useAtelier();
  return (
    <Box padding="space.200">
      <Stack space="space.150">
        <Heading>{titre}</Heading>
        {vue.ranges.length === 0 ? (
          <Text>{vue.message}</Text>
        ) : (
          <List type="unordered">
            {vue.ranges.map((range) => (
              <Ligne key={range.code} range={range} />
            ))}
          </List>
        )}
        {vue.freshness ? <Text>{vue.freshness}</Text> : null}
        {vue.coverage ? <Text>{vue.coverage}</Text> : null}
        <Text>
          {vue.total} gamme(s) au total — {vue.approuvees} approuvée(s), {vue.brouillons} brouillon(s).
        </Text>
        <Text>
          <Link href={DEMO_URL}>Ouvrir la démonstration complète</Link>
        </Text>
      </Stack>
    </Box>
  );
};

/** L'atelier Confluence : le registre des gammes du tenant. */
export const Atelier = () => <RegistreCorps titre="Gammes — Atelier" />;

/** Le registre Jira : le même registre, vu depuis Jira. */
export const Registre = () => <RegistreCorps titre="Gammes — Registre" />;

/** Les réglages d'espace : ce que l'app sait de cet espace, et rien de plus. */
export const Reglages = ({ facts }: { readonly facts?: ExtensionFacts }) => {
  const vue = useAtelier();
  return (
    <Box padding="space.200">
      <Stack space="space.150">
        <Heading>Gammes — Réglages d'espace</Heading>
        <Text>Espace : {facts?.spaceKey ?? "(contexte non fourni par la plateforme)"}</Text>
        <Text>
          L'app garde pour cet espace {vue.total} gamme(s) compilée(s) depuis ses pages — {vue.approuvees}{" "}
          approuvée(s), {vue.brouillons} brouillon(s).
        </Text>
        <Text>
          Les réglages fins (verrous, pages de politique, seuils) se règlent dans la démonstration :{" "}
          <Link href={DEMO_URL}>ouvrir la démonstration</Link>.
        </Text>
      </Stack>
    </Box>
  );
};

/** L'action de page : ce que la page courante a comme procédure liée. */
export const ContentAction = ({ facts }: { readonly facts?: ExtensionFacts }) => {
  const vue = useAtelier();
  const liees = facts?.pageAri ? vue.ranges.filter((r) => r.espace === facts.spaceKey) : [];
  return (
    <Box padding="space.200">
      <Stack space="space.150">
        <Heading>Gammes</Heading>
        <Text>
          {liees.length
            ? `${liees.length} gamme(s) compilée(s) depuis les pages de cet espace.`
            : "Aucune gamme n'est encore compilée depuis les pages de cet espace."}
        </Text>
        <Text>
          <Link href={DEMO_URL}>Ouvrir la démonstration complète</Link>
        </Text>
      </Stack>
    </Box>
  );
};

/** Une surface inconnue le dit : elle ne devine pas. */
export const Inconnue = () => (
  <Box padding="space.200">
    <Stack space="space.100">
      <Heading>Gammes — surface non reconnue</Heading>
      <Text>Cette page ne correspond à aucun écran de l'app.</Text>
    </Stack>
  </Box>
);

/** Le composant de chargement, si la plateforme le demande. */
export const Chargement = () => (
  <Box padding="space.200">
    <Spinner size="medium" />
  </Box>
);
