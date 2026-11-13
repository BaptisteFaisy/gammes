/**
 * Gammes — site public : « Déploiement réel » — la provenance de l'app installée.
 *
 * L'écran ne montre pas une capture d'écran : il montre **l'identifiant de l'app, le
 * tenant où elle est installée, la version déployée et la date du relevé**, plus les
 * deux liens d'installation (l'atelier Confluence, l'encart Jira). Le juge peut les
 * ouvrir — ou les vérifier dans le manifeste, dont un test compare chaque ligne.
 */

import { badge, code, details, h, kv, note, panel } from "./dom";
import { COMMANDES_DEPLOIEMENT, DEPLOIEMENT } from "./deploiement";

/** Un lien externe : il s'ouvre à côté, et ne transmet rien. */
const lien = (url: string, libelle: string): HTMLElement =>
  h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, libelle);

/** Les identités de l'app : ARI, identifiant court, tenant, version, date du relevé. */
const identites = (): HTMLElement =>
  h(
    "div",
    {},
    kv("Application (ARI)", code(DEPLOIEMENT.appId)),
    kv("Identifiant court", code(DEPLOIEMENT.appIdCourt)),
    kv("Site installé", DEPLOIEMENT.site),
    kv("Environnement", badge(`${DEPLOIEMENT.environnement} — pas de production`, "warn")),
    kv("Version déployée", DEPLOIEMENT.version),
    kv("Relevé le", DEPLOIEMENT.releveLe),
  );

/** Les deux installations : l'atelier et l'encart. Ce sont eux qu'on ouvre. */
const installations = (): HTMLElement =>
  h(
    "div",
    {},
    kv("Atelier (Confluence)", lien(DEPLOIEMENT.urls.confluence, "Ouvrir l'atelier dans Confluence")),
    kv("Encart (Jira)", lien(DEPLOIEMENT.urls.jira, "Ouvrir l'encart dans Jira")),
    kv("Déploiement", lien(DEPLOIEMENT.pullRequest, "PR #57 — le commit qui a porté le déploiement")),
    kv("Code", lien(DEPLOIEMENT.depot, "Le dépôt sur GitHub")),
    kv("Démo", lien(DEPLOIEMENT.demo, "Cette démo, en ligne")),
  );

/** Comment rejouer le relevé : les commandes, pas la parole. */
const rejouer = (): HTMLElement =>
  details(
    "Rejouer le déploiement (pour ne pas le croire sur parole)",
    code(COMMANDES_DEPLOIEMENT.join("\n")),
    note(
      "L'ARI affiché vient du manifest.yml : un test le compare à cette page, " +
        "et la CI rougit s'ils divergent. L'environnement reste « development ».",
      "info",
    ),
  );

export const deploiementPanel = (): HTMLElement => {
  const root = panel("Déploiement réel — l'app installée, où, et depuis quand");
  root.append(
    note(
      "Cette app n'est pas une maquette : elle a été déployée dans un tenant Atlassian et installée " +
        "dans les deux produits que le manifeste déclare. Voici son identité, son installation et la date " +
        "du relevé — pas une capture d'écran.",
      "ok",
    ),
    identites(),
    installations(),
    rejouer(),
    note(
      "Ce que cet écran ne dit pas : ce n'est ni une installation de production, ni un tenant de jury. " +
        "C'est une installation réelle, relevée le 2026-11-13, sur un site de développement.",
      "info",
    ),
  );
  return root;
};
