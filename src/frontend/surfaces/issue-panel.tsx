/**
 * Encart Jira (GA-16) — « quelle gamme s'applique à ce ticket, la démarrer,
 * voir les traces ».
 *
 * Le rendu reste mince : les données viennent de l'action `issuePanel` du
 * resolver, la logique est dans `src/ui/issue-panel/panel-model.ts` (testée hors
 * navigateur). Un refus de verrou s'affiche comme un refus lisible — jamais
 * comme une erreur technique. Chaque morceau est un composant séparé : la règle
 * de la maison (fonction < 50 lignes) est tenue par découpage, pas par exception.
 */
import { useEffect, useState } from "react";
import { Box, Button, Heading, Lozenge, Stack, Text } from "@forge/react";
import { appeler } from "../bridge";
import type { ExtensionFacts } from "../route";

type Candidate = {
  readonly code: string;
  readonly title: string;
  readonly version: number;
  readonly state: string;
  readonly invocable: boolean;
  readonly requiresHuman: boolean;
  readonly requiresPermit: boolean;
};

type Trace = { readonly runId: string; readonly code: string; readonly version: number; readonly closed: boolean; readonly outcome?: string };

type PanelState = {
  readonly issueKey: string;
  readonly candidates: readonly Candidate[];
  readonly applies: boolean;
  readonly missingInputs: readonly string[];
  readonly traces: readonly Trace[];
};

type ResultatStart = { readonly ok?: boolean; readonly error?: { readonly message?: string } };

const vide: PanelState = { issueKey: "", candidates: [], applies: false, missingInputs: [], traces: [] };

/** Les verrous de la gamme : humain, permis, ou non invocable. */
const Verrous = ({ candidat }: { readonly candidat: Candidate }) => (
  <Stack space="space.100">
    {candidat.requiresHuman ? <Lozenge appearance="warning">réservée à un humain</Lozenge> : null}
    {candidat.requiresPermit ? <Lozenge appearance="warning">permis requis</Lozenge> : null}
    {candidat.invocable ? null : <Lozenge appearance="neutral">non approuvée — non invocable</Lozenge>}
  </Stack>
);

/** La gamme applicable : ce qu'elle exige, et le bouton qui la démarre. */
const Applicable = ({
  candidat,
  manquantes,
  onDemarrer,
}: {
  readonly candidat: Candidate;
  readonly manquantes: readonly string[];
  readonly onDemarrer: () => void;
}) => (
  <Stack space="space.100">
    <Text as="strong">{candidat.title}</Text>
    <Text>
      {candidat.code} · version {candidat.version} · état {candidat.state}
    </Text>
    <Verrous candidat={candidat} />
    {manquantes.length > 0 ? <Text>Entrées à fournir : {manquantes.join(", ")}</Text> : null}
    <Button onClick={onDemarrer} appearance="primary">
      Démarrer la gamme
    </Button>
  </Stack>
);

/** Les traces déjà liées au ticket — le passé, cité. */
const Traces = ({ traces }: { readonly traces: readonly Trace[] }) => (
  <Stack space="space.100">
    <Text as="strong">Traces liées à ce ticket</Text>
    {traces.map((t) => (
      <Text key={t.runId}>
        {t.code}@v{t.version} — {t.closed ? (t.outcome ?? "closee") : "en cours"}
      </Text>
    ))}
  </Stack>
);

/** Le corps de l'encart : la gamme applicable, ou son absence déclarée. */
const Corps = ({ etat, onDemarrer }: { readonly etat: PanelState; readonly onDemarrer: () => void }) => {
  const applicable = etat.candidates.find((c) => c.invocable);
  if (!applicable) {
    return (
      <Text>
        Aucune gamme approuvée ne s'applique à ce ticket : l'encart ne propose rien plutôt
        qu'une approximation.
      </Text>
    );
  }
  return <Applicable candidat={applicable} manquantes={etat.missingInputs} onDemarrer={onDemarrer} />;
};

export const IssuePanel = ({ facts }: { readonly facts: ExtensionFacts }) => {
  const [etat, setEtat] = useState<PanelState>(vide);
  const [refus, setRefus] = useState<string | undefined>(undefined);
  const issueKey = facts.issueKey ?? "";

  const charger = async () => {
    if (!issueKey) return;
    const reponse = await appeler<PanelState>("issuePanelState", { issueKey });
    if (reponse) setEtat(reponse);
  };

  const demarrer = async () => {
    const applicable = etat.candidates.find((c) => c.invocable);
    if (!applicable) return;
    const resultat = await appeler<ResultatStart>("issuePanelStart", {
      code: applicable.code,
      issueKey,
      inputs: {},
      actorKind: "human",
    });
    setRefus(resultat && resultat.ok === false ? (resultat.error?.message ?? "Démarrage refusé.") : undefined);
    await charger();
  };

  useEffect(() => {
    void charger();
  }, [issueKey]);

  if (!issueKey) {
    return (
      <Box padding="space.100">
        <Text>Ticket illisible : l'encart Gammes ne peut pas proposer de gamme.</Text>
      </Box>
    );
  }

  return (
    <Box padding="space.100">
      <Stack space="space.200">
        <Heading as="h2">Gammes — {issueKey}</Heading>
        <Corps etat={etat} onDemarrer={() => void demarrer()} />
        {refus ? <Lozenge appearance="danger">{refus}</Lozenge> : null}
        {etat.traces.length > 0 ? <Traces traces={etat.traces} /> : <Text>Aucune trace liée à ce ticket pour l'instant.</Text>}
      </Stack>
    </Box>
  );
};
