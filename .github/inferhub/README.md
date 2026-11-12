# Agents hermes — la résolution de conflits par InferHub

Le mot « hermes » désigne dans ce dépôt **l'agent qui réconcilie** : il ne tranche
jamais à la place d'un humain, il remet les deux intentions en présence, il cite,
il pousse, il rend compte. Deux chantiers, une même discipline
(voir [`docs/HERMES.md`](../../docs/HERMES.md)) :

| | Conflit de procédures (le produit, § 13) | Conflit de fusion (le chantier) |
|---|---|---|
| Qui détecte | `src/core/conflicts/` — déterministe, cité | `git`, pendant le rebase |
| Qui prépare | le conciliateur `src/core/conciliation/hermes.ts` | **l'agent de ce dossier** |
| Modèle | port `LlmClient` (LLM hébergé Forge, InferHub en local) | InferHub `combo/cheap` |
| Qui décide | un humain, daté et nommé | l'intégrateur, sous le contrat de `docs/CONTRATS.md` |

## Ce que fait l'agent de fusion

Une PR `DIRTY` (`mergeable == CONFLICTING`) attend son auteur : la file Mergify ne
sait ni rebaser ni résoudre. Le workflow
[`conflict-resolver.yml`](../workflows/conflict-resolver.yml) prend le relais :

1. il liste les PR ouvertes en conflit (3 au plus par run) ;
2. il clone, rebase sur `main` ;
3. sur conflit, il délègue **chaque conflit élémentaire** à
   [`conflict_agent.py`](conflict_agent.py) : le hunk des deux côtés, le fichier
   complet, et la consigne « garde les deux apports, ne réécris pas le reste » ;
4. la résolution passe la **porte de compilation** ([`compilation_gate.py`](compilation_gate.py)) :
   sur ce dépôt, `node scripts/check-limits.mjs` — une réconciliation qui fait
   dépasser le plafond de 500 lignes ou qui recolle deux copies d'un helper n'est
   **jamais poussée** ;
5. push avec bail (`--force-with-lease=<branche>:<sha>`), commentaire sur la PR,
   et la file Mergify reprend la main.

Le modèle ne voit qu'un hunk à la fois, dans une fenêtre bornée
(`MAX_HUNKS`, `HUNK_MAX_CHARS`) : le reste du fichier est recopié tel quel, jamais
régénéré. Un gros fichier ne peut donc pas être tronqué par la résolution.

## Garde-fous

| Garde-fou | Effet |
|---|---|
| `REFUSED_PREFIXES` | l'agent refuse de toucher `.github/` et `.mergify.yml` : un agent ne modifie pas son propre garde |
| labels `hold` / `intervention-humaine` | tout s'arrête sur la PR |
| [`quota.py`](quota.py) | cooldown par (PR, tête), plafond horaire, 3 saisines par PR sur 30 min |
| réponse de modèle vide ou inexploitable | `AgentError`, compte rendu sur la PR, **rien n'est poussé** |
| pas de secret `INFERHUB_API_KEY` | le balayeur saute proprement (rebase manuel), aucun échec |
| variable `INFERHUB_AGENT_RESOLVE=0` | coupe-circuit immédiat |
| porte de compilation rouge | push refusé, la branche reste intacte |
| `AUTOMERGE_PAT` pour le push | un push signé `github-actions[bot]` mettrait les workflows en `action_required` : la PR resterait bloquée sans aucun check |

## Réglages (variables et secret du dépôt)

| Nom | Valeur | Rôle |
|---|---|---|
| `INFERHUB_API_KEY` *(secret)* | — | clé InferHub, jamais affichée ni versionnée |
| `INFERHUB_BASE_URL` | `https://api.inferhub.dev/v1/chat/completions` | **URL complète** : `normalize_api_url()` accepte aussi la base nue ou `/v1`, mais c'est l'endpoint complet qui est attendu |
| `INFERHUB_MODEL` | `combo/cheap` | route InferHub vers un modèle économique |
| `INFERHUB_AGENT_RESOLVE` | `1` | `0` = l'agent s'efface, l'humain rebase |
| `CI_RUNNER` | `["self-hosted","gammes-worker"]` | le runner r630 qui exécute le balayeur |

Deux pièges payés ailleurs et évités ici :

- une variable de dépôt **absente du bloc `env:` du job n'arrive jamais à
  l'agent** : elle retombe sur la valeur par défaut du code et l'appel part sur le
  mauvais fournisseur (401/404) ;
- `combo/cheap` rute vers un modèle de raisonnement : si le budget de jetons part
  dans `reasoning_content`, `message.content` revient vide — d'où l'`AgentError`
  explicite plutôt qu'un fichier résolu vide poussé en force.

## Rejouer l'agent à la main

```bash
gh workflow run conflict-resolver.yml -f pr=<numéro>     # une PR précise
gh workflow run conflict-resolver.yml                    # toutes les PR en conflit
```

Le marqueur anti-boucle est porté par la **tête** de la PR : après un échec, il
faut un nouveau SHA (un commit, même vide, sur la branche) ou attendre la fin du
cooldown. Réveils automatiques : cron `*/10`, fin du workflow `ci`
(`workflow_run`).

## Les tests

Bibliothèque standard, aucun réseau, quelques secondes — lancés par le job `ci` :

```bash
cd .github/inferhub && python3 test_conflict_agent.py && python3 test_quota.py && python3 test_union_journal.py
```

Ils couvrent la normalisation de l'URL d'API, la réponse vide, le quota, le refus
des préfixes protégés, la réunion des journaux sans modèle et la porte de
compilation.
