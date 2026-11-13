/**
 * Point d'entrée UI Kit 2 — UN bundle pour les six modules du manifeste.
 *
 * Aucune logique ici : lire le contexte, choisir la surface, la rendre. La
 * décision est dans `route.ts` (pur, testé) ; chaque surface est dans son
 * fichier, avec son propriétaire déclaré dans `docs/CONTRATS.md`.
 */
import ForgeReconciler, { useProductContext } from "@forge/react";
import { routeSurface, extensionFacts } from "./route";
import { IssuePanel } from "./surfaces/issue-panel";
import { Macro } from "./surfaces/macro";
import { Atelier, Registre, Reglages, ContentAction, Inconnue } from "./surfaces/autres";

const App = () => {
  const ctx = useProductContext();
  const facts = extensionFacts(ctx);
  switch (routeSurface(ctx)) {
    case "issuePanel":
      return <IssuePanel facts={facts} />;
    case "macro":
      return <Macro facts={facts} />;
    case "atelier":
      return <Atelier />;
    case "registre":
      return <Registre />;
    case "reglages":
      return <Reglages facts={facts} />;
    case "contentAction":
      return <ContentAction facts={facts} />;
    default:
      return <Inconnue />;
  }
};

ForgeReconciler.render(<App />);
