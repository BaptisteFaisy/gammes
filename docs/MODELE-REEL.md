# Brancher un vrai modèle et de vraies données sur le site public

Le site ([https://baptistefaisy.github.io/gammes/](https://baptistefaisy.github.io/gammes/)) est
**statique** : il tourne dans le navigateur, sans backend propre. Deux conséquences mesurées, et
deux réponses.

## 1. Le modèle — pourquoi un proxy est nécessaire pour OpenCode Zen

Le cœur du produit appelle le modèle à travers un seul port (`LlmClient`), et le site réutilise
l'adaptateur OpenAI-compatible du dépôt (`src/platform/llm/inferhub-llm.ts`) : **une seule
implémentation, trois moteurs** (scripté, direct, via proxy).

| Fournisseur | URL | CORS sur POST | Depuis le navigateur |
|---|---|---|---|
| **OpenCode Zen** | `https://opencode.ai/zen/v1` | **aucun** en-tête `Access-Control-Allow-*` (vérifié sur 401/400/429 ; le preflight `OPTIONS` répond 404) | ❌ bloqué → **proxy obligatoire** |
| OpenCode Zen, modèles `-free` | idem | idem | ❌ `429 FreeUsageLimitError` — « Free models work in OpenCode » |
| **InferHub** | `https://api.inferhub.dev/v1` | `Access-Control-Allow-Origin: *`, méthodes `GET, POST, …` | ✅ appel direct possible |
| **OpenRouter** | `https://openrouter.ai/api/v1` | CORS ouvert | ✅ appel direct possible |
| **Proxy du dépôt** | `scripts/llm-proxy.py` | ajouté par le proxy | ✅ (et la clé reste côté serveur) |

Règle de sécurité non négociable : **aucune clé de l'équipe n'est embarquée dans le site**. Une clé
dans un bundle public est une clé perdue. D'où deux voies :

- **Ta propre clé (BYO)** — collée dans l'écran « 16 · Modèle réel », stockée dans le `localStorage`
  de ton navigateur, envoyée uniquement à l'endpoint que tu choisis. Fonctionne en direct avec un
  fournisseur CORS-ouvert.
- **Le proxy** — la clé reste sur le serveur ; le proxy ajoute les en-têtes CORS, borne les jetons et
  limite le débit.

### Lancer le proxy

```bash
export GAMMES_LLM_KEY=…                                   # jamais commité, jamais journalisé
export GAMMES_LLM_UPSTREAM=https://opencode.ai/zen/v1     # ou https://api.inferhub.dev/v1
export GAMMES_LLM_MODEL=claude-haiku-4-5
python3 scripts/llm-proxy.py --port 8901                  # écoute sur 127.0.0.1
```

Garde-fous intégrés (stdlib Python, aucune dépendance) :

| Garde-fou | Valeur par défaut | Variable |
|---|---|---|
| Origines autorisées (tout le reste ⇒ 403) | `https://baptistefaisy.github.io`, `127.0.0.1`, `localhost` | `GAMMES_ALLOWED_ORIGINS` |
| Débit par client | 20 requêtes/minute | `GAMMES_LLM_RATE_PER_MIN` |
| Plafond de jetons par appel | 2 048 | `GAMMES_LLM_MAX_TOKENS` |
| Journal | méthode, statut, modèle — **jamais la clé, jamais le corps** | — |

Exposition publique (à ne faire qu'avec un accord explicite, puisque c'est ton crédit qui répond) :

```bash
tailscale funnel 8901 on        # → https://<hote>.ts.net (HTTPS, nécessaire : le site est en HTTPS)
```

> ⚠️ Un site HTTPS ne peut pas appeler un proxy HTTP (contenu mixte). En production le proxy doit
> être servi en HTTPS — le Funnel Tailscale le fait, un reverse proxy avec certificat aussi.

Dans le site : champ **Proxy** = `https://<hote>.ts.net/v1`, puis « Tester la connexion ».

### Ce que le modèle change vraiment

Le modèle n'intervient **que** sur quatre tâches (`LlmTask`) : `extract_prose` (prose ambiguë),
`qualify_step`, `reword_falsifiable`, `conciliate_conflict`. Tout le reste — détection des candidates,
extraction déterministe, motifs de risque, détecteurs de secrets, verrous, exécutions, traces,
statistiques, conflits — est **déterministe** et fonctionne sans aucun modèle. C'est voulu (§ 23
« déterminisme d'abord ») : un modèle en panne ne bloque pas le produit.

Chaque appel est caché par empreinte de contenu, compté dans le budget affiché, et journalisé dans
l'écran « 16 · Modèle réel » (tâche, modèle annoncé, jetons, cache, issue).

## 2. Les données — comment travailler sur du réel

Le site ne peut pas ouvrir de session Confluence ou Jira à ta place : il n'a pas tes identifiants, et
ces API ne renvoient pas d'en-têtes CORS à un site tiers. Ce qu'il peut faire, et qui suffit :

| Écran « 17 · Tes données réelles » | Ce qui se passe |
|---|---|
| **Ta page** — format storage Confluence, HTML ordinaire, ou texte | Elle entre dans le catalogue comme n'importe quelle page, et le compilateur tourne dessus : étapes, passages sources cités avec leurs décalages, verrous, preuves, secrets écartés |
| **Tes tickets** — JSON de `/rest/api/3/search`, tableau plat, ou lignes `CLE \| résumé \| composant \| créé \| résolu \| commentaires` | Ils remplacent le jeu de démonstration, et la détection de fantômes tourne dessus (motif ≥ 5 tickets semblables) |
| **Exporter / importer l'atelier** (JSON) | Tout l'atelier — gammes, versions, exécutions, traces, déviations, amendements, conflits, fantômes, signalements, réglages — se sauvegarde et se recharge. Aucune clé, aucune valeur de secret : seulement des empreintes et des aperçus masqués |

Rien n'est envoyé nulle part : le traitement a lieu dans le navigateur (seuls les appels au modèle
sortent, vers l'endpoint que **tu** as choisi).

Dans l'app Forge, les mêmes fonctions lisent Confluence, Jira et le graphe **côté serveur**, au nom de
l'utilisateur connecté : `src/platform/forge/atlassian-ports.ts` (`asUser()`, droit manquant = résultat
vide sans erreur).

## 3. Recette vérifiée

Sur un proxy local relayant InferHub (`combo/cheap` → `ali/qwen3.8-max-0902`), la prose réelle

> « Exécuter la rotation en deux temps : d'abord générer la nouvelle clé dans le coffre, puis attendre
> que tous les services l'aient rechargée avant de révoquer l'ancienne clé de signature. »

a été compilée en trois étapes, chacune citant son passage source avec ses décalages :

| # | Nature | Étape | Preuve exigée |
|---|---|---|---|
| 1 | manual | Générer la nouvelle clé dans le coffre | attestation / attestée |
| 2 | check | Attendre que tous les services aient rechargé la nouvelle clé | sortie de commande / machine |
| 3 | manual | Révoquer l'ancienne clé de signature | attestation / attestée |

Le paragraphe suivant (« s'assurer que tout va bien ») a été signalé **non falsifiable** et une
reformulation a été demandée au même modèle. Journal : 5 appels, 5 322 jetons, dont un servi du cache.
