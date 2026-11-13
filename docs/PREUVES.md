# Preuves — un élément par étape

Le produit tient une règle : **on ne dit jamais qu'une procédure a été respectée
sans trace**. Le chantier obéit à la même règle : chaque étape livrée porte son
élément de preuve — vérifiable par n'importe qui, sans croire le rapport.

Comment lire ce tableau : **l'élément de preuve** est ce qu'on regarde (une URL,
un test, un fichier), **la vérification** est la commande qui le confirme.

## Les étapes du chantier

| # | Étape | Élément de preuve | Vérification |
|---|---|---|---|
| 1 | **Pipeline hermes** : agent de conflits InferHub, quota, porte de compilation, couche0, ci-budget, file Mergify | [PR #13](https://github.com/Tradoooo/gammes/pull/13) · [run `ci`](https://github.com/Tradoooo/gammes/actions/runs/43221963521) · `.github/inferhub/` | `python3 .github/inferhub/test_conflict_agent.py` |
| 2 | **Socle UI Kit 2** : une ressource pour six modules, route pure, trois groupes d'actions | [PR #14](https://github.com/Tradoooo/gammes/pull/14) · [run `ci`](https://github.com/Tradoooo/gammes/actions/runs/43223964802) | `npx vitest run test/surfaces/route.test.ts test/surfaces/action-keys.test.ts` |
| 3 | **Balayeur de file** : une PR verte part en file, une seule commande par tête | [PR #18](https://github.com/Tradoooo/gammes/pull/18) · [PR #21](https://github.com/Tradoooo/gammes/pull/21) · [run `ci`](https://github.com/Tradoooo/gammes/actions/runs/43229987053) | `.github/workflows/file-de-merge.yml` — lire ses logs sur un `workflow_run` |
| 4 | **Schéma Forge 13.9.0** : la version de `@forge/manifest` qui connaît les modules Rovo | [PR #25](https://github.com/Tradoooo/gammes/pull/25) · [run `ci`](https://github.com/Tradoooo/gammes/actions/runs/43233717806) | `node tools/check-manifest.mjs` |
| 5 | **GA-25** : le validateur de transition exige une trace close liée au ticket | [PR #26](https://github.com/Tradoooo/gammes/pull/26) · [run `ci`](https://github.com/Tradoooo/gammes/actions/runs/43235995645) | `npx vitest run test/surfaces/jira-trace-gate.test.ts` |
| 6 | **Manifeste déployable** : 12 modules corrigés, point d'entrée créé, garde en CI | [PR #28](https://github.com/Tradoooo/gammes/pull/28) · [run `ci`](https://github.com/Tradoooo/gammes/actions/runs/43238971170) | `node tools/check-manifest.mjs` → « ✔ manifeste conforme » |
| 7 | **GA-16** : l'encart Jira — gamme applicable, démarrage lié au ticket, traces | [PR #30](https://github.com/Tradoooo/gammes/pull/30) · [run `ci`](https://github.com/Tradoooo/gammes/actions/runs/43241975889) | `npx vitest run test/surfaces/issue-panel.test.ts` |
| 8 | **GA-17** : la macro Confluence — les trois situations du § 10, l'âge de l'écart | [PR #32](https://github.com/Tradoooo/gammes/pull/32) · [run `ci`](https://github.com/Tradoooo/gammes/actions/runs/43243053935) | `npx vitest run test/surfaces/macro.test.ts` |
| 9 | **Une preuve par étape** : la démo et l'encart montrent la preuve attendue et la preuve laissée | ce PR · `test/seed/preuves.test.ts` | `npx vitest run test/seed/preuves.test.ts` |
| 10 | **La preuve à l'écran de la démo** : chaque étape affiche sa carte de preuve (à regarder / constaté) et met en avant l'élément qui la prouve | ce PR · `web/proof.ts` · `web/tour.ts` | `npm run demo` puis lire l'encart, ou `npx vitest run test/demo/preuve.test.ts` |
| 11 | **GA-30 — publication inter-espaces** : instantané d'une version immuable vers un autre espace/org, acte humain daté, réversible sans suppression | ce lot · `src/core/publish/publish.ts` | `npx vitest run test/publication/publication.test.ts` |
| 12 | **GA-31 — connecteur de graphe** : l'app lit (GA-27), l'app jumelle grave ; proposition humaine, gravure datée avec récépissé | ce lot · `src/core/graph-connect/graph-connector.ts` | `npx vitest run test/graph-connect/graph-connector.test.ts` |
| 13 | **GA-32 — gammes composées** : une étape `subGamme` acquittée par la trace close de son enfant, jamais à la main | ce lot · `src/core/composite/composite.ts` | `npx vitest run test/composite/composite.test.ts` |
| 14 | **Déploiement Forge réel** : app créée, manifeste conforme, déployée et installée sur un site de dev | app `22debf64-74af-4b39-a652-206d747b69c3` · [atelier](https://one-atlas-cndz.atlassian.net/wiki/apps/22debf64-74af-4b39-a652-206d747b69c3/4f32b0c3-8131-457c-8f6d-4f7a180d9c48/atelier) · [Jira](https://one-atlas-cndz.atlassian.net/jira/apps/22debf64-74af-4b39-a652-206d747b69c3/4f32b0c3-8131-457c-8f6d-4f7a180d9c48) | `forge lint` puis `forge deploy --environment development` puis `forge install --site one-atlas-cndz.atlassian.net --product confluence` puis `--product jira` |

## Les dix idées de consolidation : ce qui a été fait

Les 1169 idées sont dans [`IDEES-1000.md`](IDEES-1000.md) ; voici ce qui a été
**réalisé** depuis, avec l'élément de preuve de chacune.

| Idée | Ce qui a été fait | Preuve | État |
|---|---|---|---|
| 2 · Confluence réel | Le client API v2 (format `storage`, version figée, labels, espace), la recherche CQL paginée | PR #47 · `test/platform/atlassian-clients.test.ts` | ✅ |
| 3 · Jira réel | Le client API v3 (résumé, composants, étiquettes, dates, commentaires, affectations) et les transitions réelles | PR #47 · idem | ✅ |
| 4 · Preuve du Teamwork Graph | Le client GraphQL : services, projets, propriétaire ; un droit manquant donne un résultat **vide**, jamais une erreur | PR #49 · `test/platform/graph-client.test.ts` | ✅ |
| 5 · La page est une donnée | Deux remparts de prompt : la règle dans **chaque** invite système, l'encadrement du contenu aux quatre points d'entrée | PR #40 · `test/securite/prompt-shield.test.ts` | ✅ |
| 6 · Scellement de l'audit | Chaîne d'empreintes sur le journal append-only : altérer, réordonner, retirer ou insérer une entrée brise la chaîne | PR #41 · `test/securite/journal-seal.test.ts` | ✅ |
| 7 · Provenance des preuves | `Evidence.origin` : « réelle » ou « fixture » ; l'app ne fait jamais passer l'une pour l'autre | PR #42 · `test/seed/preuves.test.ts` | ✅ |
| 9 · Paquet portable | Le paquet scellé (format, version, entrées, étapes, `SKILL.md`) et la **CLI** : `compile` et `verify` hors Forge | PR #45 · `test/export/gamme-bundle.test.ts` | ✅ |
| 10 · Catalogue de gestes | Publication inter-espaces, connecteur de graphe, gammes composées (GA-30/31/32) | PR #39 · `test/publication/`, `test/graph-connect/`, `test/composite/` | ✅ |
| 1 · Déploiement dans un vrai tenant | — | compte Atlassian et ressources facturées (SQL, LLM) : hors de portée ici | ⏸ |
| 8 · La démo en 30 s / la vidéo | — | la vidéo demandée est exclue ; le tableau de preuves (écran « 14 · Preuves ») reste en place | ⏸ |

## Les trois preuves qui ne se réinventent pas

### 1. La preuve de l'agent de conflits — jouée, pas décrite

Le 2026-11-12, deux branches ont réécrit **le même paragraphe** de
`CONTRIBUTING.md` avec deux intentions différentes :

- [PR #19](https://github.com/Tradoooo/gammes/pull/19) — « quels workflows
  gardent le dépôt » ;
- [PR #20](https://github.com/Tradoooo/gammes/pull/20) — « la règle des
  5 minutes d'abord ».

La première a été mergée, la seconde est passée `CONFLICTING`. Le balayeur
[`conflict-resolver.yml`](https://github.com/Tradoooo/gammes/blob/main/.github/workflows/conflict-resolver.yml)
s'est réveillé tout seul et a rendu, en 23 secondes :

```
inferhub-agent: résolution de CONTRIBUTING.md (1 conflits)
inferhub-agent: PR #20 rebasée et poussée (1 fichiers)
PR #20 : conflit résolu par l'agent InferHub
```

**Élément de preuve** : le commentaire laissé sur la PR #20 —
`_inferhub · agent de conflit (combo/cheap)_` avec le marqueur de tête — et le
texte final, qui porte **les deux apports** (la règle des 5 minutes *et*
l'inventaire des cinq workflows) : rien n'a été perdu, rien n'a été tranché à la
place de l'auteur. La PR a ensuite été mergée par la file.

### 2. La preuve du manifeste — le garde, pas la parole

`manifest.yml` ne passait pas le schéma officiel : l'app était inexploitable.
Aujourd'hui, `tools/check-manifest.mjs` le valide à chaque PR (job `ci`, étape
« Manifeste Forge conforme ») et un test le lance aussi. **Élément de preuve** :

```
$ node tools/check-manifest.mjs
✔ schéma @forge/manifest : conforme
✔ 16 outil(s) MCP, 16 action(s), 16 cité(s) par rovo:mcp
✔ 2 function(s) déclarée(s), références et handlers vérifiés
✔ 38 clés de modules uniques, 1 ressource(s) sur disque
✔ manifeste conforme
```

### 3. La preuve par étape — dans le produit

Le produit ne dit jamais qu'une étape est faite sans montrer ce qui l'atteste :

- **la démo** (`web/panels-run.ts`) : les étapes franchies sont listées avec leur
  preuve (`kind · force · référence`), et une étape close **sans** preuve est
  signalée en rouge — jamais comptée comme acquittée ;
- **les traces semées** (`seed/atelier.ts`) : chaque étape franchie porte la
  preuve de sa version (une seule source de vérité) ;
- **l'encart Jira** (`src/ui/issue-panel/panel-model.ts`) : chaque étape affiche
  sa **preuve attendue** (nature, force, obligatoire ou non) et la **preuve
  laissée** quand elle a été franchie.

**Élément de preuve** : `npx vitest run test/seed/preuves.test.ts` — quatre
tests qui vérifient qu'une trace semée porte sa preuve, que la preuve suit la
spec de la version, que l'encart montre la preuve attendue de chaque étape et
qu'une étape franchie montre la preuve laissée (et qu'une étape en attente, non).

## L'infrastructure, et où la regarder

| Élément | Où le vérifier |
|---|---|
| le runner | `gh api repos/Tradoooo/gammes/actions/runners` → `r630-gammes-01`, `online` |
| la file Mergify | https://dashboard.mergify.com/orgs/Tradoooo/repos/gammes/queues/status |
| le ruleset | `gh api repos/Tradoooo/gammes/rulesets` → `main — PR obligatoire, checks requis (ci, ci-budget, couche0)` |
| les secrets | `gh secret list -R Tradoooo/gammes` → `AUTOMERGE_PAT`, `INFERHUB_API_KEY` (jamais affichés) |
| la démo publique | https://tradoooo.github.io/gammes/ — et l'icône `…/icon.png` |
| le garde de manifeste | `node tools/check-manifest.mjs` |
| l'agent de conflits | `.github/inferhub/README.md` — comment le rejouer : `gh workflow run conflict-resolver.yml -f pr=<n>` |

## Ce que la trace ne dit pas

La discipline du produit vaut pour le chantier lui-même : **aucune étape de ce
tableau n'est annoncée sans son élément de preuve**. Si une preuve manque, la
ligne manque — elle n'est pas « presque » vraie.
