# Gammes — your runbooks, as tools

> **Procédures packagées** · Atlassian Forge (Confluence + Jira) · Codegeist 2026, catégorie *Apps for Software Teams*
> **Your wiki already knows how to do everything. Your agents don't.**

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

## État

| Exigence | Statut |
|---|---|
| GA-01 … GA-21 (indispensables) | voir [`docs/EXIGENCES.md`](docs/EXIGENCES.md) |
| GA-22 … GA-29 (souhaitables) | voir [`docs/EXIGENCES.md`](docs/EXIGENCES.md) |
| GA-30 … GA-32 (après le hackathon) | non commencées |

Licence MIT — le `SKILL.md` générique est publié en source ouverte, comme le prévoit le bonus MCP.
