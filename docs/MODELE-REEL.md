# Brancher un vrai modèle et de vraies données sur le site public

Le site ([https://tradoooo.github.io/gammes/](https://tradoooo.github.io/gammes/)) est
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
| Origines autorisées (tout le reste ⇒ 403) | `https://tradoooo.github.io`, `127.0.0.1`, `localhost` | `GAMMES_ALLOWED_ORIGINS` |
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

### La voie « ZeroClaw » : le modèle est un agent

Une troisième voie, et la plus interessante : **le modèle n'est pas une API, c'est un
agent ZeroClaw** — dont le modèle est lui-même InferHub (`[agents.b].model_provider =
"custom.inferhub"` dans la config ZeroClaw). L'agent apporte ce qu'une API n'a pas :
ses outils, ses compétences, sa discipline.

Côté Node (le cœur, la CLI, les tests) :

```ts
import { zeroClawLlm } from "./src/platform/llm/zeroclaw-llm";

const llm = zeroClawLlm({ agent: "b" });   // zeroclaw agent --agent b -m "<message>"
```

Côté navigateur (le site public passe par le proxy, qui lance l'agent côté serveur) :

```bash
export GAMMES_LLM_BACKEND=zeroclaw        # au lieu de « inferhub »
export GAMMES_LLM_ZEROCLAW_AGENT=b        # l'alias de l'agent ZeroClaw
python3 scripts/llm-proxy.py --port 8901  # la clé ne passe plus par le proxy :
                                          # c'est le binaire ZeroClaw qui la lit
```

Le proxy renvoie la même forme OpenAI, donc **rien ne change du côté du site** : mêmes
quotas, mêmes origines autorisées, même journal (jamais la clé, jamais le corps).

⚠️ Un binaire ZeroClaw refuse de démarrer un second agent si un **daemon** détient
l'état de configuration (`owns the config state`). L'erreur est traduite en français et
dit quoi faire : arrêter le daemon, ou repasser sur le backend `inferhub`.

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

## 3. Contrôle sur données et modèle réels

```bash
INFERHUB_API_KEY=… npm run real-check     # scripts/real-check.ts
```

Même chemin de code que le site et que l'app Forge : le vrai compilateur, le vrai adaptateur
OpenAI-compatible, une vraie procédure (renouvellement d'un certificat TLS), un vrai modèle.
**Sans clé, le script s'arrête** : il ne retombe pas sur un bouchon pour faire joli.

### Ce qui est sorti (InferHub `combo/cheap` → `ali/qwen3.8-max-0902`)

6 étapes, dont 3 extraites par le modèle à partir d'un paragraphe de prose, chacune citant son
passage source avec ses décalages (`794-985`) :

| # | Nature | Étape | Preuve | Risque / verrou |
|---|---|---|---|---|
| 1 | check | Vérifier la date d'expiration avec `openssl s_client -connect portail.example.fr:443` | sortie machine, exigée | — |
| 2 | command | Déployer le nouveau certificat sur le frontal | sortie machine, exigée | — |
| 3 | manual | Faire valider la fin d'intervention par le responsable d'astreinte | attestation, exigée | **humain** |
| 4 | check | S'assurer que tout fonctionne *(extrait par le modèle)* | sortie machine, exigée | — |
| 5 | notification | Prévenir les équipes concernées *(extrait par le modèle)* | référence de journal | — |
| 6 | manual | Supprimer l'ancien certificat du frontal *(extrait par le modèle)* | attestation, exigée | **high / `secret-rotation` → permis** |

Préconditions et repli reconnus comme tels (pas mélangés avec les étapes). Quatre étapes non
falsifiables signalées, chacune avec une reformulation **réellement proposée par le modèle**, par
exemple : « S'assurer que tout fonctionne » → « Exécuter la commande de vérification disponible et
vérifier qu'elle se termine avec un code de retour nul. »

### Les trois défauts que ce contrôle a fait tomber

Un test sur du réel ne vaut que s'il casse quelque chose. Ici, trois défauts — corrigés, et
verrouillés par `test/compilateur-front/reel.test.ts` :

1. **Prose perdue.** Un paragraphe commençant par « Ensuite s'assurer que… » n'était pas reconnu
   comme ambigu : il disparaissait de la gamme sans trace. Le motif impératif a été élargi
   (s'assurer, supprimer, révoquer, renouveler, installer, configurer, sauvegarder…).
2. **Faux positif de non-falsifiabilité.** « Vérifier la date d'expiration avec `openssl s_client
   -connect portail.example.fr:443` » était déclaré invérifiable alors qu'il cite un outil, un hôte,
   un port et un objet mesurable. Les marqueurs observables ont été élargis (outils, hôte:port,
   domaines, durées en toutes lettres, vocabulaire d'expiration).
3. **Risque non détecté.** « Supprimer l'ancien certificat du frontal » ne remontait rien : le motif
   `secret-rotation` couvre désormais supprimer / révoquer / retirer / renouveler un certificat ou
   une clé. L'étape ressort en risque `high` avec un verrou de permis — ce que le contrôle réel a
   confirmé.

### État de l'exposition publique du proxy

`tailscale funnel` exige root sur r630 (`no_new_privs` ⇒ `sudo` impossible), donc le proxy n'est pas
exposé publiquement pour l'instant. Deux conséquences assumées :

- le site public fonctionne **en direct avec InferHub ou OpenRouter** (CORS ouvert) dès que le
  visiteur colle sa propre clé — vérifié en conditions réelles depuis
  `https://tradoooo.github.io/gammes/` : test de connexion « Connexion établie. Réponse : « ok »
  (modèle annoncé : ali/qwen3.8-max-0902) » ;
- dès qu'un proxy est joignable sur l'une des adresses de `PROXY_CANDIDATES` (`web/llm.ts`), le site
  passe **tout seul** sur le modèle réel, sans rien demander au visiteur. La commande manquante :
  `sudo tailscale funnel --bg --yes --set-path=/gammes-llm 8901`.
