# Contribuer à Gammes

Le dépôt est écrit en parallèle par plusieurs personnes **et plusieurs agents**. Deux règles rendent
cela possible : des contrats écrits avant le code ([`docs/CONTRATS.md`](docs/CONTRATS.md)) et une
propriété stricte des dossiers.

## Avant de coder

```bash
npm ci
npm run verify        # lint (règles de la maison) + typecheck + tests
```

- Node 22, TypeScript 5.9, Vitest 3. Aucune dépendance runtime hors `@forge/*`.
- `makeDeps()` (dans `test/helpers.ts`) construit un monde complet sans Forge ni réseau.
- Un fichier ≥ 500 lignes ou une fonction ≥ 50 lignes **casse la CI** : découper, pas d'exception.
- Pas de duplication : un helper partagé vaut mieux que deux copies.

## Branches

1. `git worktree add ../gammes-wt/<branche> -b feat/<branche>` — un worktree par lot.
2. Écrire **uniquement** dans les dossiers possédés (voir `docs/CONTRATS.md`).
3. Besoin de toucher un fichier partagé ? → `docs/DEMANDES/<branche>.md`, jamais en direct.
4. `npm run verify` vert, puis pousser et **ouvrir la PR dans la minute** (draft si WIP).
5. Une branche meurt avec sa PR : après merge ou fermeture, la branche est supprimée côté GitHub
   *et* en local (`gh pr merge --delete-branch`, `git worktree remove`).

## Fichiers partagés (lecture seule)

`package.json`, `package-lock.json`, `tsconfig.json`, `manifest.yml`, `.github/**`,
`scripts/check-limits.mjs`, `src/core/types.ts`, `src/core/types/*`, `src/core/ports.ts`,
`src/core/result.ts`, `test/helpers.ts`.

## CI

Cinq workflows, une seule porte applicative : `ci.yml` rend le verdict (lint, typecheck,
tests, gardes Python), `ci-budget.yml` et `couche0.yml` gardent le dépôt, `file-de-merge.yml`
embarque les PR vertes et `conflict-resolver.yml` réconcilie les conflits.
Aucun build natif ni E2E dans la CI de PR. On n'allonge jamais un timeout : on découpe le travail.

## Agents hermes — la gestion des conflits

Deux sens au mot « conflit » dans ce dépôt, et un même nom d'agent pour les traiter.

### 1. Conflits de fusion (le chantier)

Les lots avancent en parallèle ; les PR arrivent dans le désordre. Des agents **hermes** (agent
ZeroClaw `hermes`, modèle `combo/cheap` servi par **InferHub**, `https://api.inferhub.dev/v1`) sont
chargés de l'intégration, un par PR :

```bash
git fetch origin && git checkout -b integrer/<branche> origin/<branche>
git rebase origin/main                     # ou merge, au choix de l'intégrateur
# conflits ⇒ résoudre en respectant docs/CONTRATS.md : la signature publiée gagne,
#            la logique dupliquée est factorisée, jamais de « on garde les deux »
npm run verify                             # lint + typecheck + tests, obligatoirement vert
git push -f origin integrer/<branche>      # puis la PR d'origine est fusionnée
```

Règles de l'intégrateur hermes :

- **Le contrat gagne.** Si deux implémentations divergent d'une signature de `docs/CONTRATS.md`,
  c'est le code qui se plie au contrat, pas l'inverse.
- **Aucune duplication tolérée** après fusion : deux helpers équivalents ⇒ un seul, dans le lot
  propriétaire, et l'autre lot l'importe.
- **Rien n'est supprimé en silence** : une perte de comportement se signale en commentaire de PR.
- **Vert avant de rendre** : `npm run verify` complet, pas seulement les tests du lot.
- Deux échecs déterministes identiques ⇒ on arrête et on remonte à l'humain, on n'insiste pas.

### 2. Conflits de procédures (le produit, § 13)

Deux gammes qui prescrivent l'incompatible pour la même action sont portées aux deux propriétaires,
passages sources cités de part et d'autre. L'app **ne tranche jamais** : un conciliateur hermes
prépare le dossier (options, conséquences, citations), un humain décide
(`src/core/conciliation/hermes.ts`, `docs/HERMES.md`).

## Sécurité

- Aucun secret commité, en base, dans une trace ou dans un export. Une fausse clé de fixture porte
  le marqueur `// gammes-allow-secret-fixture`.
- Les clés d'API viennent de l'environnement (`INFERHUB_API_KEY`), jamais d'un fichier versionné.
- Rien ne sort de la machine sans accord : pas de publication Marketplace, pas de courriel, pas de
  déploiement `forge deploy` sur un site de production sans validation humaine.
