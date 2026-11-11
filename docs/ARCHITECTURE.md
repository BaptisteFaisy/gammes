# Architecture

## Trois couches, une règle

```
┌──────────────────────────────────────────────────────────────────────┐
│ Surfaces Forge          src/ui · src/jira · src/triggers · resolver  │  rendu, aucun calcul
├──────────────────────────────────────────────────────────────────────┤
│ Cœur (domaine)          src/core/*                                   │  TypeScript pur, testable
│   detect → extract → qualify → compile → version → approve           │  hors Forge
│   locks → run → record → deviation → trace                           │
│   stats → amendments · ghosts · conflicts → conciliation             │
│   mcp (16 outils) · export (SKILL.md) · coverage                     │
├──────────────────────────────────────────────────────────────────────┤
│ Adaptateurs             src/platform/* · src/integrations/*          │  Forge SQL, LLM hébergé,
│                                                                      │  InferHub, mémoire, ports
└──────────────────────────────────────────────────────────────────────┘
```

Le cœur ne connaît ni Forge, ni Confluence, ni Jira, ni un fournisseur de modèle : il ne connaît que
les **ports** de `src/core/ports.ts`. Conséquence voulue : les 21 points de recette du cahier des
charges tournent en CI sans site Atlassian, et le même code sert le harness de démonstration.

## Deux couches pour les agents (§ 20 du cahier des charges)

Le manifeste Forge est **statique** : on ne déploie pas un skill par gamme à la volée. Le produit est
donc coupé en deux, et ne dépend d'aucune réponse de la plateforme :

| Couche | Contenu | Pourquoi |
|---|---|---|
| **Outillée (statique)** | un skill générique `derouler-une-gamme`, un agent `le-compagnon`, 16 outils MCP paramétrés | le contenu vient de la base, pas du manifeste ; aucune limite de nombre de gammes |
| **Exportée (dynamique)** | un `SKILL.md` + ses fichiers par gamme approuvée, téléchargeables, en source ouverte | l'équivalent d'un skill par procédure, sans redéploiement ; ajouté aux agents tiers |

## Compilation en cinq étages (§ 6)

```
1 Repérer     detect-candidates   signaux forts/faibles, score + raisons, confirmation humaine obligatoire
2 Extraire    extract-steps       déterministe d'abord (listes, cases, code, tableaux, titres),
                                  modèle sur la prose ambiguë seulement, SourceSpan par étape
3 Qualifier   qualify-steps       nature, preuve attendue, verrous, idempotence, risque, conduite en échec
4 Publier     compile/version     brouillon + diff, approbation humaine datée, version immuable
5 Relier      binding             page ↔ gamme dans les deux sens, désynchronisation, amendement
```

Le LLM est un **repli**, jamais le chemin principal : `makeDeps()` fournit `forbiddenLlm()`, qui fait
échouer un test dès qu'un module appelle le modèle alors que les règles suffisaient. Chaque appel est
caché par empreinte de contenu et compté dans le budget affiché.

## Les trois verrous sont côté serveur (§ 9)

| Verrou | Implémentation | Refus |
|---|---|---|
| Humain | `locks.evaluateStepLocks` compare `actor.kind` | `lock_human_only` + déviation `lock_refusal` |
| Permis | port `PermitRegistry` (registre de `permis-forge`) | `lock_permit_missing` + URL de demande |
| Secret | `secrets.detectSecrets` avant publication | `lock_secret` + `SecretFinding` + emplacement proposé |

Un client (UI, MCP, webtrigger) ne peut pas contourner un verrou : la décision est prise dans le cœur,
et la tentative est **enregistrée**, pas avalée.

## Immuabilité et traçabilité

- Une version approuvée ne change plus (`immutable: true`) ; une exécution est **épinglée** à sa
  version ; déprécier n'est pas supprimer.
- Chaque étape cite son passage source (`SourceSpan`), chaque exécution cite sa version
  (`GAM-deploy-01@v7 · run_3`), chaque statistique cite ses traces.
- `Store.appendEvent` journalise les actes d'autorité : compilation, approbation, refus, déviation,
  amendement, conflit, export. Le journal est en append-only.

## Mesures honnêtes (§ 11)

`Rate.value === undefined` ⇔ « pas assez de recul » : sous le seuil de cohorte (30 exécutions par
défaut), aucun pourcentage n'est rendu, nulle part — ni dans l'atelier, ni dans MCP, ni dans un
export. Aucune table, aucun écran, aucun outil ne porte de mesure par personne (GA-21, vérifié par
`npm run lint`).

## Portefeuille réutilisé (§ 16)

Une seule implémentation par logique : `src/integrations/` contient un adaptateur **par port**, jamais
une recopie. `permis-forge` pour le verrou de permis, `preuve-a-l-appui` pour la grille des preuves,
`placard-wiki` pour les détecteurs de secrets, `deja-vu-ci` pour la signature d'échec des étapes,
`delegable-ou-pas` pour les cohortes, `chantiers-en-collision` pour la ressource exclusive, `vigie`
pour les résultats clés de niveau A.

## Limites de la plateforme respectées (§ 22)

| Limite | Réponse dans le code |
|---|---|
| 25 s par fonction, 55 s pour action/agent/webtrigger | les chemins interactifs ne font que lire ; compilation et recalculs passent par `consumer` (900 s) et le déclencheur planifié |
| 5 déclencheurs planifiés au plus | un seul (`gammes-nightly`) : fraîcheur, statistiques, fantômes, conflits |
| Requête d'UI limitée à 500 Ko | une longue procédure est servie étape par étape (`get-current-step`), jamais en bloc |
| LLM hébergé : 100 invites/min/installation | cache par empreinte + budget affiché + déterministe d'abord |
| Graphe : droit manquant = données omises sans erreur | `GraphPort.readable()` ; l'écran de couverture distingue « pas de droit » de « pas de données » |
| SQL facturé à la consommation | requêtes par code/version, jamais de balayage complet sur un chemin interactif |

## Robustesse

Confluence injoignable : les gammes approuvées continuent de se dérouler depuis la base, et
l'indisponibilité est affichée (`refusals.sourceUnavailable`, `PageDigest.reachable`). Une exécution
longue se reprend, épinglée à sa version ; la page peut changer entre-temps.
