/**
 * Gammes — site public : « Déploiement réel » — la provenance de l'app installée.
 *
 * L'écran ne montre pas une capture d'écran : il montre **l'identifiant de l'app, le
 * tenant où elle est installée, l'environnement, la version déployée et la date du
 * relevé**, plus les deux liens d'installation (l'atelier Confluence, l'encart Jira) et
 * les trois environnements Forge. Le juge peut les ouvrir — ou les vérifier dans le
 * manifeste, dont un test compare chaque ligne.
 */

import { badge, code, details, h, kv, note, panel, table } from "./dom";
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
    kv("Environnement", badge(DEPLOIEMENT.environnement, "ok")),
    kv("Portée", DEPLOIEMENT.portee),
    kv("Version déployée", DEPLOIEMENT.version),
    kv("Relevé le", DEPLOIEMENT.releveLe),
  );

/** Les trois environnements Forge : c'est l'identifiant d'environnement qui fait l'URL. */
const environnements = (): HTMLElement =>
  h(
    "div",
    {},
    h("h3", {}, "Les trois environnements de l'app"),
    table(
      ["Environnement", "Identifiant", "Installé sur le site"],
      DEPLOIEMENT.environnements.map((e) => [
        e.nom,
        code(e.id),
        e.installe ? badge("oui", "ok") : badge("non", "warn"),
      ]),
    ),
    note(
      "C'est la ligne « production » qui compte : une version de production est visible par tous les " +
        "utilisateurs du site, quand une version de développement n'est visible que de son développeur. " +
        "Les URL ci-dessous portent l'identifiant de l'environnement production.",
      "info",
    ),
  );

/** Les deux installations : l'atelier et l'encart. Ce sont eux qu'on ouvre. */
const installations = (): HTMLElement =>
  h(
    "div",
    {},
    kv("Atelier (Confluence)", lien(DEPLOIEMENT.urls.confluence, "Ouvrir l'atelier dans Confluence")),
    kv("Encart (Jira)", lien(DEPLOIEMENT.urls.jira, "Ouvrir l'encart dans Jira")),
    kv("Déploiement", lien(DEPLOIEMENT.pullRequest, "La PR qui a porté le déploiement en production")),
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
        "et la CI rougit s'ils divergent.",
      "info",
    ),
  );

export const deploiementPanel = (): HTMLElement => {
  const root = panel("Déploiement réel — l'app installée, où, et depuis quand");
  root.append(
    note(
      "Cette app n'est pas une maquette : elle est déployée dans l'environnement production de Forge et " +
        "installée dans les deux produits que le manifeste déclare. Voici son identité, ses trois " +
        "environnements, ses installations et la date du relevé — pas une capture d'écran.",
      "ok",
    ),
    identites(),
    environnements(),
    installations(),
    rejouer(),
    note(
      "Ce que cet écran ne dit pas : le site n'est pas un tenant de jury dédié, et le code de l'app " +
        "n'est pas la seule chose déployée — les gammes que l'app compile depuis les pages de ce site " +
        "sont dans sa base, et c'est ce qu'elle affiche quand on l'ouvre.",
      "info",
    ),
  );
  return root;
};
