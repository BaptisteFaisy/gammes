# Gammes — your runbooks, as tools

> **Procédures packagées** · Atlassian Forge (Confluence + Jira) · Codegeist 2026, catégorie *Apps for Software Teams*
> **Your wiki already knows how to do everything. Your agents don't.**

## 🔗 Démo en ligne (accessible à tous)

**https://tradoooo.github.io/gammes/** — le produit complet qui tourne dans le navigateur,
en **20 écrans** : vue d'ensemble de l'atelier, détection des candidates (scores et raisons),
compilation (étapes citant leur passage source, verrous, secrets écartés, étapes non falsifiables,
diff), fiche de gamme (toute la structure du § 7, versions immuables, cycle de vie, effet réel des
verrous sur un humain et sur un agent), « avant d'agir » (le verdict rendu à un agent ou à un CI),
déroulé pas à pas (preuves, refus, déviations, reprise, mode urgence, trace citable fr/en), liaison
page ↔ gamme (désynchronisation, âge de l'écart, recompilation, page disparue), mesures (taux avec
effectif et fourchette, comparaison de versions, étapes délégables), amendements, conflits et
conciliateur hermes, gammes fantômes et adoption, les 16 outils MCP avec un appelant interactif,
export `SKILL.md` téléchargeable, encarts Jira et macro Confluence, **le tableau de preuves**
(pour chaque étape : la preuve attendue, les preuves réellement laissées, et l'extrait que le
juge peut lire), journal d'audit append-only, réglages d'espace, et **« 19 · Déploiement réel »** :
l'app telle qu'elle est réellement installée dans un tenant Atlassian (ARI, tenant, environnement,
version déployée, date du relevé, les deux liens d'installation).

L'app est **déployée et installée** dans un tenant Atlassian, dans Confluence et dans Jira :
[ouvrir l'atelier](https://one-atlas-cndz.atlassian.net/wiki/apps/22debf64-74af-4b39-a652-206d747b69c3/4f32b0c3-8131-457c-8f6d-4f7a180d9c48/atelier) ·
[ouvrir l'encart Jira](https://one-atlas-cndz.atlassian.net/jira/apps/22debf64-74af-4b39-a652-206d747b69c3/4f32b0c3-8131-457c-8f6d-4f7a180d9c48).
Cette provenance n'est pas une capture d'écran : un test la compare au `manifest.yml`, donc l'écran
ne peut pas annoncer une app qui n'existe plus.

Le vrai cœur TypeScript (`src/core`) tourne dans le navigateur, sur un magasin en mémoire.
Source dans [`web/`](web/), déployé par GitHub Pages ([`.github/workflows/web.yml`](.github/workflows/web.yml)).

**Deux façons de passer sur du réel** (écran « 17 · Modèle réel » et « 18 · Tes données réelles »,
détails dans [`docs/MODELE-REEL.md`](docs/MODELE-REEL.md)) :

- **un vrai modèle** — ta propre clé (InferHub, OpenRouter : CORS ouvert, appel direct) ou le proxy
  du dépôt (`scripts/llm-proxy.py`, la clé reste côté serveur). **OpenCode Zen exige le proxy** : il ne
  renvoie aucun en-tête CORS sur POST, et ses modèles `-free` répondent `429 FreeUsageLimitError`.
  Aucune clé de l'équipe n'est embarquée dans le site. Sans modèle, tout ce qui est déterministe
  fonctionne quand même — le modèle ne sert qu'à la prose ambiguë, à la qualification fine, à la
  reformulation et à la conciliation.
- **tes vraies données** — colle ta page Confluence (format storage, HTML ou texte) et le compilateur
  tourne dessus ; colle tes tickets Jira (JSON ou lignes) et la détection de fantômes tourne dessus ;
  l'atelier entier s'exporte et se réimporte en JSON. Rien ne quitte ton navigateur.

Une page de procédure Confluence est de la prose : les humains la survolent, les agents ne la lisent
pas, et personne ne sait quelle version a été suivie le jour de l'incident. **Gammes compile cette
page en gamme exécutable** — étapes, entrées typées, preuves attendues, verrous, version immuable —
la publie comme outil invocable par n'importe quel agent (MCP + `SKILL.md`), et referme la boucle en
proposant de corriger la page à partir des échecs réellement observés.

```
page Confluence ──▶ compilateur ──▶ gamme (brouillon + diff) ──▶ approbation humaine
                     déterministe d'abord,                        version immuable
                     modèle sur l'ambigu                                    │
                                                                            ▼
   proposition de modification de la page ◀── amendement ◀── traces ◀── exécutions (MCP, agent, humain)
```

Ce que le produit ne fait **jamais** : publier sans approbation humaine, laisser un agent attester une
étape réservée à un humain, exécuter une commande lui-même, stocker un secret, effacer une version ou
une trace, noter une personne, conclure sans effectif.

---

## Démarrer en 60 secondes (sans Forge, sans Confluence)

Le cœur du produit est du TypeScript pur derrière des ports : il tourne hors plateforme, ce qui rend
toute la recette testable.

```bash
npm ci
npm run verify     # règles de la maison + typecheck + tests
npm run demo       # déroule le scénario complet sur le magasin en mémoire
npm run seed       # sème l'espace de démonstration des juges (§ 27)
```

Démo avec un vrai modèle (optionnel, pour le conciliateur de conflits et l'extraction de prose) :

```bash
export INFERHUB_API_KEY=...        # jamais commité
export LLM_BASE_URL=https://api.inferhub.dev/v1
export LLM_MODEL=combo/cheap
npm run demo -- --llm inferhub
```

Dans un site de développement Atlassian :

```bash
npm i -g @forge/cli
forge lint && forge deploy         # manifest.yml
```

## Les trois verrous

| Verrou | Règle | Ce que voit l'agent |
|---|---|---|
| **Humain** | une étape `human_only` n'est acquittée que par une personne authentifiée | refus explicite, tentative enregistrée comme déviation |
| **Permis** | une étape à risque exige un permis valide (`permis-forge`) | refus + demande de permis à créer |
| **Secret** | aucune clé, mot de passe ou donnée personnelle n'est publié | signalement ouvert, emplacement de remplacement proposé |

Les refus sont tranchés **côté serveur**, pas côté client.

## Ce que les agents en font

1. **Outils MCP** (`rovo:mcp`) : `find-procedure`, `check-before-acting`, `get-procedure`,
   `list-procedures`, `start-run`, `get-current-step`, `record-step`, `report-deviation`,
   `finish-run`, `get-run-trace`, `get-procedure-stats`, `propose-amendment`, `compile-page`,
   `export-skill`, `get-missing-procedures`, `get-conflicts`. Un jeu d'outils sert **toutes** les
   gammes : le contenu vient de la base, pas du manifeste.
2. **`SKILL.md` exporté** par gamme approuvée, plus le skill générique
   [`skills/derouler-une-gamme/SKILL.md`](skills/derouler-une-gamme/SKILL.md) — la conduite attendue
   de tout agent : chercher avant d'agir, respecter les verrous, déclarer les déviations, ne jamais
   improviser une étape à risque, citer la version.
3. **Point d'entrée externe signé** (`webtrigger`) : un hook d'agent de code ou un pipeline CI
   demande « existe-t-il une procédure pour ce que je m'apprête à faire ? » avant un geste sensible.

La démonstration la plus parlante : **un agent refuse d'improviser parce qu'une page Confluence,
compilée, le lui a dit.**

## Dépôt

```
src/core/         le domaine : détection, extraction, qualification, compilation, versions,
                  verrous, exécutions, traces, statistiques, amendements, fantômes, conflits,
                  conciliation, outils MCP, export SKILL.md — aucune dépendance à Forge
src/platform/     les adaptateurs : mémoire (tests), Forge SQL, LLM hébergé, InferHub, horloges,
                  empreintes, ids, webtrigger
src/integrations/ le portefeuille réutilisé : permis-forge, preuve-a-l-appui, placard-wiki,
                  deja-vu-ci, delegable-ou-pas, chantiers-en-collision, brief-forge, vigie
src/ui/, src/jira/, src/triggers/, src/resolver/   les surfaces Forge
skills/, agents/  le skill générique et les prompts Rovo (source ouverte)
seed/, scripts/   l'espace de démonstration, la démo, les garde-fous
test/             la recette du § 25, un dossier par module
docs/             contrats, architecture, démo, juges, anglais, vidéo, Marketplace
```

- [`docs/CONTRATS.md`](docs/CONTRATS.md) — qui possède quel module, signatures publiques, règles d'intégration.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — couches, ports, limites de la plateforme.
- [`CAHIER-DES-CHARGES.md`](CAHIER-DES-CHARGES.md) — le cahier des charges complet (français).
- [`docs/SPEC-EN.md`](docs/SPEC-EN.md) — English summary for the judges.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — règles de la maison, branches, agents hermes.
- [`docs/PREUVES.md`](docs/PREUVES.md) — une preuve par étape : l'élément à regarder et la commande qui le vérifie.
- [`docs/IDEES-1000.md`](docs/IDEES-1000.md) — plus de 1000 idées pour consolider le projet, et les 10 meilleures.

## État (v0.1.0)

| | |
|---|---|
| **32 exigences** | faites et testées (GA-01 à GA-32 — y compris les trois « C ») |
| **293 tests** | `npm run verify` : garde-fous + typecheck + tests, en moins de 2 minutes |
| **recette § 25** | les 21 points sont automatisés (`test/recette/`) |
| **manifeste Forge** | conforme au schéma officiel `@forge/manifest` 13.9.0, sous garde en CI |
| **déploiement réel** | app déployée et installée dans Confluence **et** Jira sur un tenant Atlassian — la provenance est dans l'écran « 19 · Déploiement réel », comparée au manifeste par un test |

Matrice détaillée et à jour : [`docs/EXIGENCES.md`](docs/EXIGENCES.md).
**Un élément de preuve par étape** : [`docs/PREUVES.md`](docs/PREUVES.md) — ce qui
prouve que chaque étape a fonctionné, et la commande qui le vérifie.

```bash
npm ci && npm run verify   # 293 tests, vert
node tools/check-manifest.mjs   # le manifeste est conforme au schéma Forge
npm run cli -- compile procedure.html   # une page de wiki devient un paquet portable
npm run cli -- verify out/gamme.json   # l'empreinte du paquet est-elle encore bonne ?
npm run demo               # le scénario complet, en mémoire, sans réseau
npm run seed               # l'espace de démonstration des juges
```

Licence MIT — le `SKILL.md` générique est publié en source ouverte, comme le prévoit le bonus MCP.
