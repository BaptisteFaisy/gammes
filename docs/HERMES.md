# Hermes dans Gammes — deux sens, une même discipline

Le mot « conflit » désigne deux choses dans ce dépôt, et **hermes** intervient sur
les deux. Même discipline partout : exposer, citer, ne jamais trancher à la place
d'un humain.

| | Conflit de procédures (produit) | Conflit de fusion (chantier) |
|---|---|---|
| Quoi | deux gammes prescrivent l'incompatible pour la même action | deux branches modifient le même code |
| Qui détecte | `src/core/conflicts/` — déterministe, cité | `git` pendant le rebase/merge |
| Qui prépare | le conciliateur hermes (`src/core/conciliation/`) | l'agent hermes de fusion (`.github/inferhub/`) |
| Qui décide | un humain, daté et nommé (`decideConciliation`, `resolveConflict`) | l'intégrateur, sous la contrainte du contrat (`docs/CONTRATS.md`) et de `npm run verify` |
| Ce qui est interdit | appliquer une option, modifier une gamme, réécrire une citation | garder deux implémentations d'une même logique, supprimer un comportement en silence |

## 1. Le conciliateur de conflits (§ 13 du cahier des charges)

Trois familles de conflits sont détectées, toutes **sans modèle** :

1. **même cible, exigences différentes** — nombre d'approbations, fenêtre horaire,
   ordre des étapes, preuve exigée, verrou humain posé d'un côté et pas de l'autre ;
2. **contradiction avec une page de politique** — la page est déclarée dans les
   réglages d'espace (`SpaceSettings.policyPages`) ;
3. **concurrence sur une ressource exclusive** — deux gammes `exclusive` sur le même
   service, avec renvoi vers la réservation (`chantiers-en-collision`).

Chaque conflit porte des **faits** (`src/core/conflicts/facts.ts`) : un `subject`
comparable, une valeur lisible de chaque côté, et les `SourceSpan` cités de part et
d'autre. On montre le passage, jamais une interprétation.

Le conciliateur (`conciliate`) monte ensuite un dossier : résumé + 2 à 4 options avec
leurs conséquences. Prompt et contrat JSON : [`agents/hermes-conciliator.md`](../agents/hermes-conciliator.md).

Garanties tenues par le code et prouvées par les tests (`test/conflits/`) :

- une réponse de modèle inexploitable ⇒ échec propre `conciliator_unavailable`,
  **aucune option inventée**, le conflit reste porté aux propriétaires ;
- une seule option proposée ⇒ refusée (une option unique est une décision déguisée) ;
- `decideConciliation` et `resolveConflict` refusent un agent
  (`approval_requires_human`) ;
- la détection fonctionne avec `forbiddenLlm()` : zéro appel modèle ;
- politique ou Confluence injoignable ⇒ aucun conflit inventé, aucun crash ;
- un conflit déjà gravé n'est pas gravé deux fois (signature stable).

### Deux moteurs, un seul port

Le conciliateur appelle le port `LlmClient` avec la tâche `conciliate_conflict` :

| Contexte | Adaptateur | Modèle |
|---|---|---|
| Dans Forge | `src/platform/forge/forge-hosted-llm.ts` (lot F) | LLM hébergé (`llm:` au manifeste) |
| Harness local / démo | `src/platform/llm/inferhub-llm.ts` | **InferHub**, `https://api.inferhub.dev/v1`, OpenAI-compatible |
| Tests | `src/platform/llm/fake-llm.ts` | `scriptedLlm` / `forbiddenLlm`, aucun réseau |

La clé InferHub vient **uniquement** de l'environnement (`INFERHUB_API_KEY`) : jamais
commitée, jamais en base, jamais dans une trace ni dans un dossier de conciliation.
Les appels sont cachés par empreinte et comptés dans le budget affiché.

### Lancer le conciliateur en local

```bash
npx tsx scripts/hermes-conciliate.ts --dry                    # aucun appel réseau : conflits + citations
INFERHUB_API_KEY=… npx tsx scripts/hermes-conciliate.ts       # dossiers préparés par le modèle
INFERHUB_API_KEY=… LLM_MODEL=combo/cheap npx tsx scripts/hermes-conciliate.ts --service paiements
```

Sortie : le conflit, ses faits, les passages cités avec leur emplacement, puis le
dossier (résumé + options, chacune marquée « décision humaine requise »).

## 2. Les agents hermes d'intégration

Le dépôt est écrit en parallèle par plusieurs agents, chacun sur sa branche
(`docs/CONTRATS.md` fixe qui possède quoi). Personne ne merge à la main : la file
Mergify merge, un balayeur embarque, et un agent hermes résout les conflits avec
**InferHub** (`combo/cheap`). Le détail du système et de ses garde-fous est dans
[`.github/inferhub/README.md`](../.github/inferhub/README.md).

### Qui fait quoi

| Rôle | Acteur | Fichier |
|---|---|---|
| Mettre en file, mettre à jour, merger | la file Mergify | `.mergify.yml` |
| Embarquer une PR dont les trois checks sont verts | le balayeur | `.github/workflows/file-de-merge.yml` |
| Résoudre une PR en conflit, hunk par hunk | l'agent hermes | `.github/workflows/conflict-resolver.yml` → `.github/inferhub/conflict_agent.py` |
| Refuser une résolution qui ne tient pas debout | la porte de compilation | `.github/inferhub/compilation_gate.py` |
| Borner les saisines du modèle | le quota | `.github/inferhub/quota.py` |
| Vérifier le périmètre déclaré et les motifs interdits | couche0 | `.github/couche0/check_couche0.py` |
| Vérifier le budget de 5 minutes par job | ci-budget | `.github/ci-budget/check_timeouts.py` |

Un seul runner auto-hébergé (r630, étiquette `gammes-worker`) exécute les gardes et
les agents ; `ci` et `web` restent sur les runners GitHub pour ne pas l'affamer.

### La même discipline des deux côtés

L'agent de fusion obéit aux règles du conciliateur de procédures : il **garde les
deux apports** au lieu de choisir un camp, il ne réécrit pas ce qui n'est pas en
conflit (le modèle ne voit qu'un hunk à la fois, le reste du fichier est recopié),
il **cite** ce qu'il a fait dans un commentaire de PR, il pousse avec bail
(`--force-with-lease`), et il s'interdit de toucher à `.github/` et `.mergify.yml` —
un agent ne modifie pas son propre garde. Une résolution qui fait sauter une règle
de la maison (fichier hors plafond, helper dupliqué) n'est pas poussée : la porte de
compilation lance `scripts/check-limits.mjs` avant le push.

### Preuve mesurée

Sonde du 2026-11-12, PR #19 et #20 : deux branches réécrivent **le même paragraphe**
de `CONTRIBUTING.md` avec deux intentions différentes (l'une nomme les cinq
workflows du dépôt, l'autre remet la règle des 5 minutes en tête). La première merge,
la seconde passe en `CONFLICTING`. Le balayeur de conflits, réveillé par la fin de
`ci`, délègue le hunk à InferHub : en 23 secondes l'agent rend une phrase qui porte
**les deux apports**, passe la porte, pousse avec bail et commente la PR. Les trois
checks repassent verts et la file merge. Rien n'a été perdu, rien n'a été tranché à
la place de l'auteur.
