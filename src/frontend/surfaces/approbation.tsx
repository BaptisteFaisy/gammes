/**
 * L'approbation, dans la macro de la page — l'acte humain qui rend la gamme
 * compilée invocable.
 *
 * Compiler ne publie rien : la compilation automatique laisse un **brouillon**
 * dans la page, et l'approbation est un acte séparé, daté et signé par une
 * personne identifiée. C'est l'auteur de la procédure qui l'accomplit, depuis
 * sa page : le composant lit l'état que la macro affiche déjà (`macroState`) et
 * appelle l'action `approve` du resolver par le pont (`src/frontend/bridge.ts`).
 *
 * Trois règles tiennent ici :
 * - le composant ne **décide** rien : il rend l'état, il ne l'invente pas ;
 * - un refus est **dit** (motif du noyau, en français), jamais une exception,
 *   jamais un écran vide muet ;
 * - aucune identité d'acteur n'est affichée (GA-21) : l'écran dit *quand* la
 *   version a été approuvée, pas *par qui*.
 */

import { useState } from "react";
import { Box, Button, Heading, Lozenge, Stack, Text } from "@forge/react";
import { appeler } from "../bridge";

/** Ce que l'action `approve` renvoie quand elle aboutit. */
export type ApprobationResultat = {
  readonly code: string;
  readonly version: number;
  readonly state: string;
  readonly approvedBy: string;
};

/** La réponse du resolver : le `Result` du cœur, tel que le pont le rend. */
export type ReponseApprobation = {
  readonly ok?: boolean;
  readonly value?: ApprobationResultat;
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly messageFr?: string;
    readonly messageEn?: string;
  };
};

/** Ce que l'écran montre, selon l'état de la gamme. */
export type EcranApprobation = {
  /** Un bouton d'approbation est-il proposé ? */
  readonly approuvable: boolean;
  readonly titre: string;
  readonly message: string;
};

/** La lecture d'une réponse d'approbation : réussite, ou refus motivé. */
export type LectureApprobation =
  | { readonly ok: true; readonly resultat: ApprobationResultat }
  | { readonly ok: false; readonly message: string };

/** L'écran selon l'état : un brouillon s'approuve, une version approuvée se dit. */
export const ecranApprobation = (state: string | undefined): EcranApprobation => {
  if (state === "approved") {
    return {
      approuvable: false,
      titre: "Version approuvée",
      message:
        "Cette version est approuvée : elle est invoquable par les agents. Il n'y a rien à approuver ici.",
    };
  }
  if (state === "deprecated") {
    return {
      approuvable: false,
      titre: "Gamme dépréciée",
      message:
        "Cette gamme est dépréciée : elle n'est plus approuvable. On la remplace, on ne la ressuscite pas.",
    };
  }
  if (state !== "draft" && state !== "in_review") {
    return {
      approuvable: false,
      titre: "Approbation indisponible",
      message: `État de la gamme inconnu (« ${state ?? "aucun"} ») : l'approbation n'est pas proposée.`,
    };
  }
  return {
    approuvable: true,
    titre: "Approbation",
    message:
      "Cette version est un brouillon : aucun agent ne peut l'invoquer tant qu'un humain ne l'a pas approuvée.",
  };
};

/** Lit la réponse du resolver : un refus garde son motif, jamais d'exception. */
export const lireApprobation = (reponse: ReponseApprobation | undefined): LectureApprobation => {
  if (!reponse) {
    return {
      ok: false,
      message: "L'approbation n'a pas abouti : le serveur n'a pas répondu. Réessayez.",
    };
  }
  if (reponse.ok && reponse.value) return { ok: true, resultat: reponse.value };
  const motif = reponse.error?.messageFr ?? reponse.error?.messageEn ?? reponse.error?.message;
  return { ok: false, message: motif ?? "Approbation refusée : le noyau n'a pas donné de motif." };
};

export type ApprobationProps = {
  /** Le code de la gamme liée à la page — seul chemin d'approbation. */
  readonly code: string;
  /** Le numéro de la version affichée (pour que l'écran parle de *cette* version). */
  readonly version?: number;
  /** L'état de la gamme : `draft`, `in_review`, `approved`, `deprecated`. */
  readonly state?: string;
  /** Rappelée après une approbation réussie : la macro recharge son état. */
  readonly onApprouve?: (resultat: ApprobationResultat) => void;
};

export const Approbation = ({ code, version, state, onApprouve }: ApprobationProps) => {
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | undefined>(undefined);
  const [approuve, setApprouve] = useState<ApprobationResultat | undefined>(undefined);
  const ecran = ecranApprobation(approuve?.state ?? state);

  const approuver = async () => {
    setEnCours(true);
    setRefus(undefined);
    const lecture = lireApprobation(await appeler<ReponseApprobation>("approve", { code }));
    setEnCours(false);
    if (!lecture.ok) {
      setRefus(lecture.message);
      return;
    }
    setApprouve(lecture.resultat);
    onApprouve?.(lecture.resultat);
  };

  return (
    <Box padding="space.100">
      <Stack space="space.100">
        <Heading as="h3">{ecran.titre}</Heading>
        <Text>{version !== undefined ? `Version v${version}. ` : ""}{ecran.message}</Text>
        {approuve ? (
          <Lozenge appearance="success">Version v{approuve.version} approuvée.</Lozenge>
        ) : null}
        {refus ? <Lozenge appearance="danger">{refus}</Lozenge> : null}
        {ecran.approuvable ? (
          <Button appearance="primary" isDisabled={enCours} onClick={() => void approuver()}>
            {enCours ? "Approbation en cours…" : "Approuver cette version"}
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
};
