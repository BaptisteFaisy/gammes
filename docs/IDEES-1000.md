# 1000 idées pour consolider Gammes

> Générées le 2026-11-12, à partir de l'état réel du dépôt (30/32 exigences M/S,
> 238 tests, manifeste conforme au schéma `@forge/manifest` 13.9.0, app **jamais
> déployée** dans un tenant Forge, ports Atlassian bouchonnés).
> 18 catégories, une passe par catégorie, dédoublonnage à la lecture.

**Format d'une idée** : `titre | ce qu'elle touche (fichier réel du dépôt) | effort S/M/L | impact 1-5 | risque principal`.
Une idée qui cite un fichier qui n'existe pas encore est une **proposition de
fichier** — c'est voulu : le dépôt est la source de vérité du nommage.


## Les 10 meilleurs

Classement par **impact au jury × faisabilité avant le 22 décembre**, en partant de
l'état réel : 30/32 exigences faites, 238 tests, manifeste conforme au schéma
officiel — mais **l'application n'a jamais été déployée dans un tenant Forge**, et
les ports Atlassian sont bouchonnés. Tout ce qui suit est trié en conséquence :
d'abord l'existence, ensuite la preuve, puis la sécurité, l'ouverture.

| # | Idée | Ce que ça change | Origine | Effort |
|---|---|---|---|---|
| 1 | **Déployer l'app dans un vrai tenant Forge** (créer l'app, figer l'app.id/ARI, `forge lint` bloquant en CI, environnements staging/production, `forge install` Confluence **et** Jira, smoke test post-déploiement) | Sans ça, le reste est de la théorie : l'app n'existe nulle part pour le jury. Tout le reste du classement en découle | 1.001→1.015 | S/M |
| 2 | **Brancher la lecture Confluence réelle** (REST v2, corps au format `storage`, version de page figée dans l'empreinte, macros, CQL paginé) | Le cœur du produit compile aujourd'hui des pages bouchonnées : la compilation ne s'exerce sur aucune vraie procédure | 2.001, 2.002, 2.007, 2.008 | M |
| 3 | **Brancher Jira réel** (issue, `editmeta`, transitions, validation de workflow) et brancher le validateur de transition dessus | La preuve au ticket — le cœur de GA-25 — devient un vrai refus de transition Jira, pas une règle interne | 2.015→2.020, 2.028 | M |
| 4 | **Faire venir la preuve du Teamwork Graph** (attester une étape par le déploiement ou le build réellement observé, corrélé au run par identité, fenêtre temporelle et relation métier ; un déploiement en échec contredit une étape déclarée réussie) | La preuve devient **objective** : l'app ne se fie plus à ce que l'agent déclare. C'est le bonus « T », et c'est le moment qui emporte le jury | 3.045→3.055 | M/L |
| 5 | **Traiter le contenu d'une page comme une donnée non fiable** (assainir le storage compilé, isoler les directives système, liste blanche des commandes exécutables, aucun shell arbitraire pour l'agent) | Un wiki hostile ne doit pas pouvoir piloter l'agent. C'est la sécurité de tout le produit, et c'est ce qui rend « le compagnon » crédible | 10.018, 10.019, 10.020, 5.014, 5.015 | M |
| 6 | **Sceller la chaîne d'audit** (journal append-only scellé par hachage chaîné, vérification de l'intégrité au démarrage, aucune suppression pendant la rétention) | La preuve ne se contente pas d'exister : elle est inaltérable et vérifiable. C'est l'argument RSSI, et le § 5 le promet (« elle n'efface jamais une version ni une trace ») | 9.001, 9.062, 9.072 | M |
| 7 | **Rendre la provenance des preuves visible** (tableau de preuves : quelles preuves sont réelles, quelles sont des fixtures ; captures datées du tenant installé) | Le juge ne doit pas avoir à croire sur parole. C'est la contre-mesure directe à « la démo, c'est du simulé » | 1.053, 1.057, 1.012 | S/M |
| 8 | **Préparer la démonstration en 30 secondes** (parcours guidé vers le refus qui dit quoi faire, script de 3 minutes centré sur ce moment, captures du tenant) | Le jury ne regarde pas 28 écrans. Il faut un moment qui marque — l'app qui dit non — et une preuve immédiatement lisible | 1.054, 14.018, 14.030 | S/M |
| 9 | **Publier le paquet portable** (`SKILL.md` standardisé + les 16 outils MCP en CLI autonome) consommable par des agents tiers | C'est littéralement le bonus « M » du hackathon (MCP **combinable** avec des `skill.md` en source ouverte) — et la preuve que la valeur du produit ne s'arrête pas à l'app | 14.009, 14.010, 5.004, 5.020 | S/M |
| 10 | **Ouvrir le catalogue de gestes** (paquet signé, import guarded, isolation par tenant, publication vers un autre espace avec approbation datée — GA-30) | Le produit devient un actif d'organisation et pas un outil d'équipe : les gestes se partagent, avec leurs statistiques d'usage comme preuve de valeur. C'est le critère « impact potentiel » | 7.001, 7.007, 7.010, 7.013, 7.021 | M/L |

**Pourquoi pas GA-32 (composition) dans le top 10 ?** — c'est une belle idée, mais elle
exige un modèle d'exécution récursif que le reste du produit n'a pas encore
éprouvé ; à cinq semaines, mieux vaut un déploiement réel et une preuve réelle.
Elle reste entièrement listée en § 4.


## 1. Déploiement et crédibilité Forge

0001. Créer l'application Forge et figer son app.id | manifest.yml : app.id ; .github/ : identifiants de déploiement | M | 5 | UUID non provisionné ou non associé au bon projet Forge
0002. Exécuter forge lint avant toute livraison | package.json : script forge:lint ; manifest.yml | S | 5 | Manifeste valide localement mais dépendances ou modules invalides en CI
0003. Bloquer la CI sur forge lint | .github/workflows/ci.yml : job lint avec @forge/manifest 13.9.0 | S | 5 | Version du CLI différente entre le poste et GitHub Actions
0004. Déclarer un environnement staging | manifest.yml : app.environments, clé staging | S | 5 | Ressources staging reliées par erreur aux données de production
0005. Déclarer un environnement production | manifest.yml : app.environments, clé production | S | 5 | Exposition prématurée de l'application dans le tenant de jury
0006. Séparer les commandes de déploiement par environnement | .github/workflows/deploy.yml : paramètres staging et production | M | 5 | Commande exécutée dans le mauvais environnement faute de garde-fou
0007. Déployer le commit fusionné sur staging | .github/workflows/deploy.yml : forge deploy --environment staging --non-interactive | M | 5 | Artefact issu d'une branche non fusionnée ou d'un commit divergent
0008. Promouvoir le commit exact de staging vers production | .github/workflows/deploy.yml : comparaison des empreintes avant et après déploiement | M | 5 | Artefact reconstruit différent entre staging et production
0009. Installer l'application dans Confluence réel | manifest.yml : scopes Confluence ; .github/workflows/deploy.yml : forge install --product confluence | M | 5 | Tenant sans administrateur Confluence ou mauvais produit installé
0010. Installer l'application dans Jira réel | manifest.yml : scopes Jira ; .github/workflows/deploy.yml : forge install --product jira | M | 5 | Application invisible dans Jira malgré un déploiement réussi
0011. Capturer l'ARI et l'app id installés | .github/workflows/deploy.yml : artefact des sorties forge install et forge deploy | S | 5 | Confusion entre app id, ARI, version et environnement
0012. Exposer l'ARI dans l'À propos in-app | src/ui/ : écran À propos ; manifest.yml : app.version | S | 4 | Identifiants affichés sans préciser le tenant ni l'environnement
0013. Publier un lien d'installation épinglé | manifest.yml : app.home.url ; web/ : bouton d'installation | S | 5 | Lien vers staging ou nécessitant un rôle administrateur absent
0014. Comparer la version déployée à la version attendue | src/core/ : version de build ; .github/workflows/deploy.yml : contrôle post-déploiement | S | 5 | Réponse servie depuis un cache ou une ancienne version
0015. Effectuer un smoke test post-déploiement | .github/workflows/deploy.yml : job de fumée ; src/core/ : endpoint de santé | M | 5 | Test réduit à l'ouverture de l'UI sans appel Confluence ou Jira réel
0016. Répéter le cycle désinstaller–réinstaller | manifest.yml : app.storage ; src/core/ : cycle de vie et nettoyage | M | 4 | Données SQL résiduelles ou installation impossible après désinstallation
0017. Centraliser la configuration par environnement | src/core/ : chargeur de configuration ; manifest.yml : app.environments | M | 5 | Divergence entre staging et production par duplication de constantes
0018. Déclarer les variables non secrètes | src/core/ : configuration ; .github/workflows/deploy.yml : variables Forge | S | 4 | URL ou feature flag absente du manifeste
0019. Pousser les variables du staging | .github/workflows/deploy.yml : forge variables set --environment staging | S | 4 | Commande visant la production ou écrasement de variables existantes
0020. Pousser les variables de production | .github/workflows/deploy.yml : forge variables set --environment production | M | 5 | Valeurs affichées dans les logs ou appliquées à un mauvais tenant
0021. Injecter le secret Teamwork Graph | src/resolver/ : connecteur Teamwork Graph ; .github/ : secret de déploiement | M | 5 | Secret présent dans le bundle, le manifeste ou une trace de commande
0022. Refuser le démarrage sur variable critique absente | src/core/ : validation de configuration au démarrage | M | 5 | Panne différée jusqu'à la première résolution d'une étape
0023. Tester la rotation du secret Teamwork Graph | src/resolver/ : client OAuth ; .github/workflows/deploy.yml : job de rotation | M | 4 | Cache conservant un jeton révoqué après la rotation
0024. Scanner les artefacts contre les secrets | .github/workflows/ci.yml : scan avant package et déploiement | S | 5 | Secret encodé ou variable sensible non détectée par le scanner
0025. Restreindre le credential de déploiement | .github/workflows/deploy.yml : token minimal ; .github/ : environments protégées | M | 5 | Token capable de modifier tous les environnements ou organisations
0026. Journaliser les variables manquantes sans leur valeur | src/core/ : erreurs de configuration et journalisation | S | 4 | Valeur secrète copiée dans les logs par le message d'exception
0027. Activer la ressource SQL du manifeste | manifest.yml : app.storage, type SQL et clé de stockage | S | 5 | Clé absente, dupliquée ou dépassant le quota de stockage
0028. Créer la table de version des migrations | src/core/ : migration 0001 et table de versions | M | 5 | Démarrages concurrents créant deux fois la même migration
0029. Exécuter les migrations SQL de façon idempotente | src/core/ : migration runner avec verrou | L | 5 | Schéma partiellement appliqué après interruption ou concurrence
0030. Tester la migration sur une base vide | src/core/ : tests de migration ; .github/workflows/ci.yml : environnement isolé | M | 5 | Valeurs par défaut absentes ou contraintes uniquement testées sur une base peuplée
0031. Tester la migration sur une base peuplée | src/core/ : migrations de données ; .github/workflows/ci.yml : job sur tenant de staging | L | 5 | Troncature, conversion ou perte de preuves lors du changement de schéma
0032. Exporter un instantané logique avant migration sensible | src/core/ : export versionné des données SQL | M | 5 | Sauvegarde inexistante, incomplète ou jamais restaurée
0033. Interdire les migrations destructives en production | src/core/ : classification des migrations ; .github/workflows/deploy.yml : garde-fou | M | 5 | DROP ou troncature exécutée automatiquement pendant le déploiement
0034. Restaurer l'instantané dans un tenant isolé | src/core/ : import versionné ; .github/workflows/ci.yml : test de restauration | M | 5 | Procédure de restauration incapable de reproduire le schéma attendu
0035. Supprimer les données à la désinstallation | manifest.yml : app.storage ; src/core/ : suppression contrôlée | M | 4 | Données conservées contre la politique annoncée ou suppression prématurée des preuves
0036. Publier la durée de conservation réelle | docs/ : politique de conservation ; src/ui/ : encart vie privée | S | 4 | Engagement réglementaire différent du comportement technique
0037. Réduire les scopes Confluence et Jira | manifest.yml : permissions minimales par acteur | M | 5 | Accès en écriture accordé alors que seule la lecture est nécessaire
0038. Déclarer les URL distantes autorisées | manifest.yml : listes remote et egress ; src/resolver/ : domaines appelés | M | 5 | Appels bloqués par Forge ou domaine générique surdimensionné
0039. Autoriser uniquement l'egress Teamwork Graph | manifest.yml : app.egress ; src/resolver/ : Teamwork Graph | S | 5 | Exfiltration de données vers un domaine non contrôlé
0040. Configurer OAuth Teamwork Graph | src/resolver/ : connexion OAuth ; manifest.yml : callback distant autorisé | L | 5 | Callback incorrect, consentement non accordable ou refresh token perdu
0041. Déployer le connecteur GA-31 en staging | src/resolver/ : connecteur Teamwork Graph ; .github/workflows/deploy.yml : smoke GA-31 | L | 5 | Connecteur fonctionnel uniquement avec des mocks et jamais contre l'API réelle
0042. Tester GA-30 dans un autre espace | src/core/ : publication multi-espaces ; src/resolver/ : Confluence | L | 5 | Identifiant d'espace codé en dur ou droits insuffisants
0043. Tester GA-30 dans une autre organisation | src/core/ : publication multi-orgs ; .github/workflows/deploy.yml : recette admin externe | L | 5 | Fuite de données entre organisations ou approbation multi-tenant omise
0044. Déployer un scénario composé GA-32 | src/core/ : composition de gammes ; .github/workflows/deploy.yml : fixture composée | L | 5 | Ordre des résolutions ou versionnement composé incorrect en production
0045. Figer l'empreinte d'une gamme composée | src/core/ : empreinte et version immuable ; src/core/ : composition | M | 5 | Gamme composée mutée après publication ou recalculée avec des entrées différentes
0046. Publier et tester l'agent Rovo | manifest.yml : configuration Rovo ; src/core/ : export de l'agent | M | 5 | Agent absent du tenant ou référençant une version antérieure
0047. Exposer les seize outils MCP | src/resolver/ : publication des outils ; manifest.yml : routes et modules | L | 5 | Outils publiés partiellement, dupliqués ou renommés entre versions
0048. Valider l'export SKILL.md dans une installation vierge | src/core/ : export SKILL.md ; web/ : téléchargement | M | 4 | Export obsolète, lien cassé ou dépendance absente après installation
0049. Compléter l'À propos du manifeste Forge | manifest.yml : app.about, description et version | S | 5 | Application peu crédible ou métadonnées obligatoires absentes
0050. Publier la politique de confidentialité | manifest.yml : app.privacy ; docs/ : politique Gammes | M | 4 | Politique générique ne décrivant ni Forge, ni les preuves, ni Teamwork
0051. Publier les liens de support et les conditions | manifest.yml : app.support et app.terms ; src/ui/ : liens À propos | S | 4 | Juge ou admin sans contact utilisable face à un incident
0052. Afficher un état réel du tenant | src/core/ : endpoint de santé ; src/ui/ : badge de statut | M | 5 | Badge vert basé sur un cache, un mock ou un ancien déploiement
0053. Capturer l'interface dans le tenant installé | web/ : captures datées ; docs/ : dossier de démonstration | M | 4 | Capture présentée comme réelle alors qu'elle provient de la démo statique
0054. Prouver le fonctionnement en trente secondes | web/ : parcours guidé ; docs/ : script jury | M | 5 | Démonstration dépendant d'un compte privilégié ou d'une donnée absente
0055. Activer le repli statique en cas de panne | web/ : démo existante ; src/ui/ : détection de disponibilité | S | 4 | Juge confond le repli avec une preuve de déploiement réel
0056. Prouver la provenance de la version déployée | src/ui/ : écran À propos ; .github/workflows/deploy.yml : SHA de release | M | 4 | Commit affiché différent de l'artefact effectivement déployé
0057. Distinguer les preuves réelles des fixtures | src/ui/ : tableau de preuves ; src/core/ : origine des données | M | 5 | Données de démonstration présentées comme des preuves de production
0058. Tester le mode urgence sans contourner l'approbation | src/core/ : mode urgence ; src/core/ : approbation de publication datée | M | 5 | Déclenchement manuel faisant publier une version non approuvée
0059. Authentifier Forge avec un token minimal | .github/workflows/deploy.yml : authentification API ; .github/ : secret | M | 5 | Token trop large, copié dans les logs ou réutilisé hors CI
0060. Protéger la production par une approbation GitHub | .github/workflows/deploy.yml : environment production ; .github/ : reviewers | S | 5 | Déploiement production déclenché sans validation humaine
0061. Enregistrer l'approbation humaine datée | src/core/ : approbation de publication ; manifest.yml : version publiée | M | 5 | Approbation sans date, auteur, version ou empreinte de l'artefact
0062. Verrouiller les déploiements concurrents | .github/workflows/deploy.yml : concurrency group par environnement | S | 4 | Deux déploiements simultanés produisant un état frontal incohérent
0063. Figer Node, Forge CLI et dépendances | package.json : versions et scripts ; manifest.yml : schéma 13.9.0 | S | 5 | Déploiement reproductible uniquement sur la machine du développeur
0064. Construire un artefact déterministe | package.json : build ; .github/workflows/deploy.yml : empreinte de l'artefact | M | 4 | Timestamp ou contenu généré aléatoirement changeant entre staging et production
0065. Joindre la provenance à chaque release | .github/workflows/deploy.yml : SHA, tag et artefact ; .github/ : release | S | 4 | Version déployée non traçable jusqu'au commit source
0066. Scanner dépendances et artefacts | .github/workflows/ci.yml : audit npm et scan de l'artefact | M | 4 | Vulnérabilité bloquante ignorée ou faux positif faisant échouer chaque déploiement
0067. Maintenir la CI sous cinq minutes | .github/workflows/ci.yml : cache, jobs parallèles et contrôles <500 lignes, <50 lignes, zéro duplication | M | 5 | Déploiement annulé par timeout avant publication du verdict
0068. Isoler le runner self-hosted | .github/ : runner r630 et configuration éphémère ; .github/workflows/ci.yml | M | 5 | Credentials, cache ou fichiers d'un autre projet persistés sur le runner
0069. Simuler un rollback applicatif | src/core/ : sélection de version ; .github/workflows/deploy.yml : rollback Forge | M | 5 | Ancienne version incompatible avec le schéma SQL déjà migré
0070. Inventorier les quotas de déploiement et d'exécution | docs/ : matrice des quotas Forge, SQL, API et Teamwork ; manifest.yml : configuration | M | 5 | Quota de forge deploy ou de résolution dépassé sans anticipation
0071. Instrumenter les limites avec repli contrôlé | src/core/ : budgets d'appels et gestion des 429/403 ; src/ui/ : métriques agrégées | M | 5 | Panne en cascade ou statistiques individuelles contredisant la contrainte de confidentialité
0072. Répéter la recette finale et joindre les preuves | docs/ : dossier de soumission Codegeist 2026 ; .github/workflows/deploy.yml : logs Forge ; web/ : capture réelle | L | 5 | Dossier incomplet, obsolète ou contenant un secret avant le 22/12/2026

## 2. Brancher le vrai Atlassian

0073. Brancher la lecture des pages Confluence | src/integrations/ : client REST v2, GET /wiki/api/v2/pages/{id} | M | 5 | Confusion entre page supprimée et page inaccessible
0074. Lire le corps au format storage | src/integrations/ : GET /wiki/api/v2/pages/{id}/body?format=storage | M | 5 | Conversion storage trop permissive ou destruction de macros
0075. Résoudre l'espace source | src/integrations/ : GET /wiki/api/v2/spaces/{spaceId} | S | 3 | Espace supprimé ou renommé après compilation
0076. Lire les labels de page | src/integrations/ : GET /wiki/api/v2/pages/{id}/labels | S | 3 | Labels absents ou paginés sur les grandes pages
0077. Rechercher les pages Gammes par CQL | src/integrations/ : GET /wiki/rest/api/content/search avec CQL sur les labels Gammes | M | 4 | Injection CQL ou résultats non accessibles
0078. Paginer les résultats CQL | src/integrations/ : suivre _links.next de l'API Confluence | M | 4 | Arrêt après la première page de résultats
0079. Figer la version de la page source | src/core/ : synchronisation, store version, bodyHash et pageId | M | 5 | Empreinte calculée sur un corps incomplet
0080. Parser les macros Confluence | src/core/ : parseur storage des macros, checklists et panels | L | 4 | Macros inconnues interprétées comme du texte
0081. Détecter les pages supprimées ou renommées | src/core/ : dérive entre pageId, titre et version Confluence | M | 4 | Faux positif après déplacement de page
0082. Normaliser les liens wiki Confluence | src/core/ : résolution des liens storage vers pageId et spaceKey | M | 3 | Lien ambigu vers une page homonyme
0083. Créer une page dans un autre espace | src/integrations/ : POST /wiki/api/v2/pages avec spaceId et body storage | M | 5 | Publication dans un espace non autorisé
0084. Mettre à jour sans écraser une version | src/integrations/ : relire la version puis PUT /pages/{id}/body | L | 4 | Modification concurrente perdue entre lecture et écriture
0085. Synchroniser les labels publiés | src/integrations/ : POST et DELETE /wiki/api/v2/pages/{id}/labels | M | 3 | Publication partielle si un label échoue
0086. Tracer la lignée dans les content properties | src/integrations/ : properties Confluence pour rangeId, version et empreinte | M | 4 | Property absente ou écrasée par un autre outil
0087. Lire une issue Jira Cloud | src/integrations/ : GET /rest/api/3/issue/{issueIdOrKey} | M | 5 | Champs ou issue non visibles avec le jeton courant
0088. Mapper les champs Jira typés | src/core/ : mapping des champs Jira vers les entrées de gamme | M | 5 | Conversion silencieusement incompatible avec le schéma
0089. Récupérer les champs d'édition Jira | src/integrations/ : GET /rest/api/3/issue/{issueIdOrKey}/editmeta | M | 4 | Champs requis non détectés avant transition
0090. Lister les transitions autorisées | src/integrations/ : GET /rest/api/3/issue/{issueIdOrKey}/transitions | M | 4 | Transition indisponible dans le workflow courant
0091. Exécuter une transition Jira | src/integrations/ : POST /rest/api/3/issue/{issueIdOrKey}/transitions | L | 5 | Transition répétée ou exécutée avec champs incomplets
0092. Valider le workflow avant mutation | src/integrations/ : Jira Cloud workflow validator sur /issue/{issueIdOrKey}/validate | M | 4 | Endpoint indisponible selon la version Cloud
0093. Soumettre l'amendement en brouillon Jira | src/integrations/ : POST /rest/api/3/issue après approbation, avec libellé de proposition | L | 4 | Proposition appliquée automatiquement au lieu de rester brouillon
0094. Mettre à jour les champs d'une issue | src/integrations/ : PUT /rest/api/3/issue/{issueIdOrKey} | M | 4 | Écrasement de champs modifiés entre-temps
0095. Publier la preuve en commentaire Jira | src/integrations/ : POST /rest/api/3/issue/{issueIdOrKey}/comment | M | 3 | Secrets ou données sensibles dans la preuve
0096. Joindre une preuve volumineuse | src/integrations/ : POST /rest/api/3/issue/{issueIdOrKey}/attachments | M | 3 | Limite de taille ou MIME non accepté
0097. Retrouver les issues liées à une gamme | src/integrations/ : GET /rest/api/3/search/jql avec labels et clés de gamme | M | 4 | JQL trop large ou property Jira non indexée
0098. Paginer les résultats JQL | src/integrations/ : suivre nextPageToken de /rest/api/3/search/jql | M | 4 | Perte de la page suivante lors d'une rotation de token
0099. Résoudre projets et types d'issue | src/integrations/ : GET /rest/api/3/project/search et endpoint issue createmeta | M | 4 | Projet supprimé ou type d'issue indisponible
0100. Construire un panneau Forge Jira | src/platform/forge/ : panneau affichant issue, transitions et preuves | L | 4 | Résolution de contexte Jira trop lente ou incomplète
0101. Rendre l'écran de transition Jira | src/platform/forge/ : formulaire Forge bâti depuis editmeta et transitions.fields | L | 4 | Champs conditionnels mal restitués
0102. Relier l'issue Jira et la page Confluence | src/integrations/ : POST /rest/api/3/issue/{issueIdOrKey}/remotelink avec URL Confluence | M | 4 | Lien créé avec une page non canonique
0103. Demander les scopes Confluence minimaux | manifest.yml : read/write page, space, label | M | 4 | Scope trop large rejeté ou scope manquant
0104. Demander les scopes Jira minimaux | manifest.yml : read issue, project, issue-type, field, workflow, jql | M | 4 | Action Jira bloquée par un scope absent
0105. Ouvrir le flux OAuth 3LO | src/platform/forge/ : route d'autorisation Atlassian avec state, PKCE et cloudId | L | 5 | Liaison du mauvais tenant ou state réutilisable
0106. Valider le callback OAuth 3LO | src/platform/forge/ : route de callback, vérification state, PKCE et code à usage unique | M | 4 | Interception du code d'autorisation
0107. Isoler les sessions OAuth par organisation | src/platform/forge/ : registre cloudId, organisation, produit et référence de jeton | L | 5 | Fuite de jeton ou mélange de credentials
0108. Rafraîchir les tokens expirés | src/platform/forge/ : refresh OAuth avec offline_access, rotation et verrou de refresh | M | 4 | Refresh concurrents invalidant le token
0109. Exécuter les appels Atlassian asUser | src/platform/forge/ : wrapper asUser pour Confluence et Jira, avec identité explicite | L | 5 | Action exécutée avec de mauvais privilèges
0110. Vérifier les permissions déléguées | src/integrations/ : preflight des accessible-resources et droits de page, espace et issue | M | 4 | Faux positif sur les ressources partagées
0111. Router les appels multi-organisation | src/platform/forge/ : api.atlassian.com/ex/{jira|confluence}/{cloudId} selon le token | L | 5 | Requête envoyée à la mauvaise organisation
0112. Connecter le client Teamwork Graph | src/integrations/ : transport GraphQL, bearer 3LO et timeout | L | 5 | Schéma Graph différent de celui du tenant
0113. Valider le schéma Teamwork Graph | src/integrations/ : capability check des types Confluence, Jira et relations | M | 3 | Introspection bloquée ou schéma partiel
0114. Interroger le nœud page Teamwork Graph | src/integrations/ : query Graph ciblant pageId, space et version | M | 4 | Nœud page indisponible dans certains produits
0115. Interroger le nœud issue Teamwork Graph | src/integrations/ : query Graph ciblant issueKey et champs projet | M | 4 | Champs différents du schéma Jira Cloud
0116. Traverser les relations Atlassian | src/integrations/ : query Graph reliant page, gamme, issue et preuve | L | 4 | Traversal excessif ou relation ambiguë
0117. Paginer le graphe Teamwork | src/integrations/ : suivre endCursor et hasNextPage | M | 4 | Relations distantes manquées après la première page
0118. Borner les requêtes Teamwork Graph | src/integrations/ : opérations autorisées, profondeur maximale et limite de nœuds | M | 4 | Query coûteuse ou exploitable via les paramètres
0119. Basculer vers REST si Graph échoue | src/integrations/ : fallback Confluence v2 et Jira v3 pour les capacités absentes | M | 4 | Divergence silencieuse entre Graph et REST
0120. Lister les espaces accessibles en externe | src/integrations/ : GET /wiki/api/v2/spaces via api.atlassian.com/ex/confluence/{cloudId} | M | 4 | Espace visible mais non inscriptible
0121. Créer une page dans une autre organisation | src/integrations/ : POST /wiki/api/v2/pages avec le cloudId externe | L | 5 | Page créée dans l'organisation source
0122. Reporter les labels entre organisations | src/integrations/ : labels API sur la page externe | M | 3 | Label non autorisé ou divergent entre tenants
0123. Conserver la provenance multi-organisation | src/integrations/ : content property avec cloudId, pageId, version et bodyHash | M | 4 | Provenance ambiguë entre plusieurs publications
0124. Rendre la publication idempotente | src/core/ et src/integrations/ : rechercher la property avant POST, sans créer de doublon | L | 4 | Double publication après reprise ou timeout
0125. Réconcilier une publication partielle | src/integrations/ : détecter page créée, labels manquants, puis reprendre sans recréer | L | 4 | État intermédiaire impossible à reconstruire
0126. Bloquer toute publication sans approbation | src/core/ : garde API exigeant approbation humaine datée et version immuable | M | 5 | Publication déclenchée par un état ancien ou une page différente
0127. Tester les droits de publication externe | src/integrations/ : dry-run des droits page, space et labels avant le POST | M | 4 | Dry-run concluant différemment de l'écriture réelle
0128. Résoudre les références Confluence composées | src/core/ : composition hydratant chaque page par pageId et version | L | 5 | Référence résolue vers une page homonyme
0129. Résoudre les références Jira composées | src/core/ : composition hydratant chaque issue par issueKey et champs courants | L | 5 | Issue supprimée ou changée depuis la compilation
0130. Topologiser les gammes composées | src/core/ : graphe de dépendances issu des références Confluence et Jira | L | 4 | Ordre d'exécution non déterministe
0131. Détecter les cycles de composition | src/core/ : parcours DFS avec cycle et chemin fautif | M | 4 | Cycle masqué par une dépendance conditionnelle
0132. Fusionner les entrées typées | src/core/ : fusion des schémas d'entrée des gammes composées | L | 4 | Types compatibles mais valeurs contradictoires
0133. Valider les transitions Jira composées | src/integrations/ et src/core/ : workflow validator sur chaque transition issue | L | 4 | Transition valide isolément mais impossible après composition
0134. Publier la composition immuable | src/integrations/ : content property et page Confluence portant la version composée | L | 4 | Version publiée différente de la version exécutée
0135. Chronométrer les resolvers standard | src/platform/forge/ : budget strict de 25 s et annulation des appels Atlassian | M | 4 | Timeout après mutation déjà engagée
0136. Étendre la fenêtre des actions et webtriggers | src/platform/forge/ : fenêtre de 55 s, continuation asynchrone et statut de job | M | 4 | Requête HTTP Atlassian laissée sans consommateur
0137. Déléguer les traitements longs au consumer | src/platform/forge/ : trigger consumer jusqu'à 900 s pour pagination et publication multi-tenant | L | 4 | Job consumer non reprenable après expiration
0138. Fragmenter les payloads de 5 Mo | src/platform/forge/ : store des références, upload direct et pagination des preuves | M | 4 | Preuve volumineuse rejetée par Forge
0139. Brider les appels Atlassian à 100 par minute | src/integrations/ : token bucket par utilisateur, cloudId et produit | L | 5 | Quota épuisé ou appels rejetés par Jira
0140. Reprendre seulement les requêtes sûres | src/integrations/ : retry 429 et 5xx avec Retry-After, journal avant rejeu des POST | M | 5 | Transition ou publication dupliquée
0141. Normaliser les erreurs HTTP Atlassian | src/integrations/ : mapping 400, 401, 403, 404, 409, 429 et 5xx | M | 4 | 404 interprété à tort comme page supprimée
0142. Servir le cache et bloquer les écritures hors ligne | src/core/ et src/integrations/ : cache stale-if-error par cloudId, URL, version et ETag | L | 5 | Donnée périmée utilisée pour une mutation
0143. Diffuser la progression en Realtime | src/platform/forge/ : publication des étapes, preuves et déviations via Forge Realtime | M | 4 | Client déconnecté perdant l'état d'exécution
0144. Déployer et prouver un tenant réel | manifest.yml et src/platform/forge/ : installation Forge, OAuth 3LO, smoke tests Confluence/Jira et ARI capturé | L | 5 | Pollution du tenant ou secret exposé pendant le test

## 3. Teamwork Graph (GA-31) et consommation du graphe

0145. Implémenter l'adaptateur GraphQL du port | src/integrations/graph.ts : exécuter les lectures via api.asUser() et normaliser les réponses | M | 5 | Portée ou jeton incompatible avec le tenant
0146. Déclarer la lecture GraphQL minimale | manifest.yml : scope de lecture requis et domaine de sortie autorisé, sans droit d'écriture ni secret | S | 5 | Scope insuffisant ou trop large bloquant Forge
0147. Modéliser les sept nœuds Teamwork Graph | src/integrations/graph.ts : typer document, software-service, project, work-item, deployment, build et pull-request | M | 5 | Schéma GraphQL évolutif mal aligné
0148. Centraliser les opérations GraphQL autorisées | src/integrations/graph.ts : registre de fragments en lecture seule (recherches, relations, propriétaires, preuves) | M | 4 | Duplication ou requête hors des droits accordés
0149. Regrouper les recherches par identifiants | src/integrations/graph.ts : lookup batch des nœuds pour limiter les appels sur une gamme multi-ressources | M | 4 | Limite de taille ou de coût GraphQL
0150. Paginer les collections Graph | src/integrations/graph.ts : parcourir les curseurs documents, work-items, builds, deployments avec plafond d'itérations | M | 4 | Pagination incomplète ou consommation excessive
0151. Convertir un droit manquant en résultat vide | src/integrations/graph.ts : filtrer les objets non accessibles par type, sans erreur ni détail sensible | M | 5 | Confusion entre absence de droit et panne technique
0152. Distinguer vide, inaccessible et erreur technique | src/integrations/graph.ts : taxonomie d'erreurs distincte pour l'interface, les tests et la reprise | M | 4 | Masquage d'une panne réseau par un faux résultat vide
0153. Propager le contexte utilisateur et site | src/integrations/graph.ts + src/core/run/ : transmettre cloudId, site et utilisateur connecté, sans élévation | M | 5 | Contexte absent pendant une reprise ou une exécution automatisée
0154. Borner les appels GraphQL | src/integrations/graph.ts : timeout, nouvelle tentative avec backoff et limite stricte des lectures répétées | S | 4 | Saturation du tenant ou latence excessive en démonstration
0155. Cacher par utilisateur et site | src/integrations/graph.ts : cache des lectures avec clé utilisateur-site-objet et TTL, sans partage entre comptes | M | 4 | Fuite croisée de données entre utilisateurs
0156. Invalider le cache après une liaison | src/core/binding/ + src/integrations/graph.ts : invalider les entrées concernées par type d'objet et empreinte | S | 4 | Snapshot périmé conduisant à un faux conflit
0157. Refuser Cypher brut et requête libre | src/integrations/graph.ts + manifest.yml : liste blanche de documents GraphQL, aucune chaîne injectée | M | 5 | Contournement des droits par requête non contrôlée
0158. Tester le contrat GraphQL | src/integrations/graph.ts : fixtures couvrant les sept types, la pagination, les relations et les variantes de permission | M | 5 | Mocks trop simplistes ne reproduisant pas les réponses réelles
0159. Introduire une liaison Graph immuable | src/core/binding/ : GraphBinding avec type, identifiant, empreinte, source, date et version observée | M | 5 | Format de liaison incompatible avec les liaisons existantes
0160. Lier un document Confluence au graphe | src/core/binding/ + src/integrations/graph.ts : associer une page à son document GraphQL sans modifier sa source | M | 5 | Page Confluence et document Graph désalignés
0161. Lier un software-service | src/core/binding/ + src/integrations/graph.ts : rattacher la gamme au service réellement visé | M | 5 | Mauvais service sélectionné par homonymie
0162. Lier un project | src/core/binding/ + src/integrations/graph.ts : rattacher la gamme au projet propriétaire du périmètre d'exécution | M | 4 | Confusion entre projet conteneur et projet fournisseur
0163. Lier des work-items | src/core/binding/ + src/integrations/graph.ts : conserver plusieurs work-items avec clé, statut et relation au service | M | 4 | Work-item résolu comme simple texte
0164. Lier des builds | src/core/binding/ + src/integrations/graph.ts : référencer les builds par identifiant, commit et statut | M | 4 | Build homonyme associé à un mauvais commit
0165. Lier des déploiements | src/core/binding/ + src/integrations/graph.ts : référencer les déploiements avec service, environnement, version et horodatage | M | 5 | Déploiement antérieur choisi à la place du déploiement courant
0166. Lier des pull-requests | src/core/binding/ + src/integrations/graph.ts : référencer les PR par clé, branche, commit et état de fusion | M | 4 | PR ancienne ou branche réinitialisée
0167. Découvrir les services candidats | src/integrations/graph.ts + src/core/binding/ : proposer les services liés au document, projet et work-items sans liaison automatique | M | 4 | Faux positif issu d'une correspondance de texte
0168. Traverser les relations du service | src/integrations/graph.ts : assemble work-items, builds, déploiements et PR autour du service lié | M | 5 | Relations transitives trop larges ou coûteuses
0169. Déduire le propriétaire réel | src/integrations/graph.ts + src/core/binding/ : déduire l'owner depuis document, project puis service, avec source et confiance | M | 5 | Owner hérité d'un objet non représentatif
0170. Tracer l'origine du propriétaire | src/core/binding/ : conserver propriétaire Graph, propriétaire déduit, override manuel et raison du choix | M | 4 | Valeur juste mais inexplicable ou contestable
0171. Empreindre les liaisons Graph | src/core/binding/ : empreinte à partir de l'identifiant et de la version Graph pour détecter toute dérive | M | 5 | Version absente rendant la dérive indétectable
0172. Revalider une liaison inaccessible | src/core/binding/ + src/integrations/graph.ts : marquer la liaison obsolète ou non vérifiée si le droit disparaît | M | 5 | Suppression involontaire d'une liaison valide
0173. Étendre la clé des ressources en conflit | src/core/conflicts/ : intégrer type, identifiant et version Graph dans la clé canonique | M | 5 | Collisions entre homonymes ou objets de types différents
0174. Modéliser l'exclusivité des ressources | src/core/conflicts/ : définir par type les ressources mutuellement exclusives, fenêtres et exceptions | M | 5 | Règle trop large générant des conflits fictifs
0175. Détecter les collisions de services | src/core/conflicts/ + src/integrations/graph.ts : signaler deux gammes visant le même service exclusif | M | 5 | Récurrence légitime confondue avec une concurrence
0176. Détecter les collisions de work-items | src/core/conflicts/ + src/integrations/graph.ts : deux gammes revendiquant le même work-item actif | M | 4 | Work-item clos encore compté comme concurrent
0177. Détecter les collisions de déploiement | src/core/conflicts/ + src/integrations/graph.ts : comparer service, environnement, version et fenêtre | M | 5 | Fenêtre incorrecte ou données incomplètes
0178. Comparer les étapes qui se chevauchent | src/core/conflicts/ + src/core/binding/ : corréler les étapes ordonnées de deux gammes sur la même ressource | M | 5 | Chevauchement textuel sans véritable concurrence
0179. Pondérer la sévérité des conflits | src/core/conflicts/ : niveau bloquant ou consultatif selon exclusivité, chevauchement, propriétaire et fraîcheur | M | 4 | Score arbitraire produisant trop de faux positifs
0180. Détecter les propriétaires divergents | src/core/conflicts/ : comparer les owners Graph de deux gammes et expliquer la divergence | M | 4 | Divergence légitime entre contextes d'équipe
0181. Détecter les périmètres contradictoires | src/core/conflicts/ : confronter un work-item d'un projet à un service d'un autre projet | M | 4 | Relation de projet inexistante ou mal traduite
0182. Figer les preuves de conflit | src/core/conflicts/ : enregistrer identifiants, versions, owners et horodatages observés | M | 5 | Conflit non reproductible après changement du graphe
0183. Mesurer l'âge de chaque conflit | src/core/conflicts/ + src/integrations/graph.ts : fraîcheur depuis la dernière version Graph observée | S | 4 | Âge calculé sur l'heure du serveur et non sur l'objet
0184. Expliquer chaque conflit | src/core/conflicts/ : ressource commune, gammes, étapes, owners, relation et niveau de confiance | M | 4 | Explication trop abstraite pour être actionnable
0185. Vérifier les conflits avant exécution | src/core/run/ + src/core/conflicts/ : preflight GraphQL, blocage des chevauchements exclusifs confirmés | M | 5 | Contrôle disruptif ou faux blocage lors d'un droit manquant
0186. Résoudre les conflits périmés | src/core/conflicts/ + src/core/binding/ : revalider puis relier ou confirmer manuellement une ressource devenue ambiguë | M | 4 | Revalidation coûteuse ou action corrective non tracée
0187. Résoudre le périmètre Graph d'une exécution | src/core/run/ + src/core/binding/ : limiter les lectures aux ressources liées et accessibles | M | 5 | Élargissement implicite du périmètre du run
0188. Figer le contexte Graph au lancement | src/core/run/ : enregistrer identifiants, empreintes, owners et version observée au démarrage | M | 5 | Dérive entre le lancement et la preuve recherchée
0189. Corréler un run à un deployment | src/core/run/ + src/integrations/graph.ts : rapprocher service, environnement, version et fenêtre | M | 5 | Déploiement non lié choisi comme preuve
0190. Corréler un run à un build | src/core/run/ + src/integrations/graph.ts : rapprocher le commit et la version du build observé | M | 4 | Build ancien reconstruit avec le même nom
0191. Corréler un run à une pull-request | src/core/run/ + src/integrations/graph.ts : associer branche, commit et work-items à la PR fusionnée | M | 4 | PR ancienne ou branche réinitialisée
0192. Attester une étape par un deployment réussi | src/core/trace/ + src/integrations/graph.ts : preuve seulement pour une étape de déploiement du même service | M | 5 | Succès de déploiement utilisé pour attester une autre étape
0193. Attester une étape par un build réussi | src/core/trace/ + src/integrations/graph.ts : preuve de compilation sans la confondre avec une mise en production | M | 4 | Confusion entre build vert et mise en production réussie
0194. Attester une étape par une pull-request fusionnée | src/core/trace/ + src/integrations/graph.ts : relier la fusion au commit et au work-item de l'étape | M | 4 | Fusion sans relation avec le changement déployé
0195. Vérifier identité et cohérence temporelle | src/core/trace/ : exiger identité Graph, proximité temporelle et relation métier avant d'accepter une preuve | M | 5 | Preuve exacte mais observée hors de la fenêtre du run
0196. Traiter une preuve absente comme non démontrée | src/core/trace/ + src/integrations/graph.ts : distinguer objet introuvable, droit manquant et étape non prouvée | M | 5 | Absence de droit transformée en échec métier
0197. Détecter les preuves contradictoires | src/core/trace/ : signaler un deployment en échec ou un build rouge face à une étape déclarée réussie | M | 5 | État Graph retardé provoquant un faux signalement
0198. Lever les ambiguïtés de preuve | src/core/trace/ : classer les candidats par identité, temps et relation, ne valider qu'au-dessus d'un seuil | M | 5 | Score de correspondance non explicable
0199. Consigner les preuves immuables | src/core/trace/ : source, identifiant, version, statut, horodatage et empreinte, sans secret inutile | M | 5 | Charge de trace excessive ou exposition de jetons
0200. Comparer prévu et observé dans le graphe | src/core/trace/ + src/core/run/ : mettre en regard étapes attendues, relations Graph et déviations | M | 4 | Dérive fonctionnelle masquée par un statut global réussi
0201. Restreindre le mode urgence | src/core/run/ + src/core/binding/ : n'autoriser que les ressources Graph explicitement liées, tracer chaque contournement | M | 5 | Urgence élargissant le périmètre au-delà des liens validés
0202. Repérer les work-items récurrents | src/integrations/graph.ts + src/core/binding/ : agréger récurrence par type, projet et service, sans ventilation par personne | M | 5 | Récurrence naturelle confondue avec une procédure manquante
0203. Regrouper les séquences récurrentes | src/core/binding/ : clusteriser les work-items récurrents selon relations service-work-item-build-deployment et proximité temporelle | L | 5 | Regroupement artificiel de flux métier distincts
0204. Proposer des procédures fantômes | src/core/binding/ : suggérer une procédure absente quand une séquence récurrente ne correspond à aucune page liée | M | 5 | Création suggérée à tort d'une procédure non nécessaire
0205. Corréler les fantômes avec les pages | src/core/binding/ + src/integrations/graph.ts : rapprocher candidats et pages orphelines sans auto-liaison | M | 4 | Homonymie de page produisant un faux rapprochement
0206. Classer les candidats fantômes | src/core/binding/ : pondérer récurrence, couverture Graph, fraîcheur et échec agrégé, validation humaine exigée | M | 4 | Score présenté comme une preuve de procédure manquante
0207. Mesurer la couverture et la fraîcheur Graph | src/core/binding/ + src/core/trace/ : taux de gammes liées, liaisons valides, âge moyen des écarts, sans statistique par personne | M | 4 | Métrique trompeuse si une absence de droit compte comme absence de liaison
0208. Mesurer la couverture des preuves | src/core/trace/ + src/core/run/ : preuves Graph par type d'étape, étapes non prouvées, taux d'échec agrégé | M | 5 | Dénominateur incluant des étapes non éligibles aux preuves
0209. Afficher les droits et états vides | src/core/binding/ + manifest.yml : matrice par type d'objet, état connecté et raison d'un vide, sans stack trace | M | 4 | Fuite d'information sur les permissions d'un autre utilisateur
0210. Présenter le panneau de liaison | src/core/binding/ : ressources liées, owner, source, confiance, empreinte, fraîcheur et actions | M | 4 | Interface surchargée obscurant le conflit actionnable
0211. Ouvrir les objets Graph dans Jira | src/core/binding/ + src/core/trace/ : liens profonds vers work-items, builds, déploiements et PR | M | 4 | Lien non ouvrable ou droit manquant
0212. Rédiger le runbook de consommation | docs/graph-consumption.md : installation, scopes, matrice des droits, résultat vide, requêtes, cache, dépannage, rollback | M | 4 | Runbook reproduisant la confidentialité du tenant
0213. Simuler Teamwork Graph dans la démo | src/integrations/graph.ts + docs/ : fixtures déterministes couvrant liaison, conflit, permission absente, build et deployment | M | 5 | Démo cassée par des données statiques non représentatives
0214. Étendre la démo guidée de 28 étapes | docs/ : ajouter connexion, liaison de service, owner, conflit, preuve deployment et procédure fantôme | M | 5 | Scénario trop long ou droits simulés non visibles
0215. Garantir le budget de qualité | src/integrations/graph.ts, src/core/conflicts/, src/core/run/, src/core/trace/ : mocker GraphQL, tester les permissions, garder fichiers <500 lignes, fonctions <50 lignes, CI ≤5 min | M | 5 | Tests lents ou budget CI dépassé
0216. Valider GA-31 sur un tenant pilote | manifest.yml + src/integrations/graph.ts + docs/graph-consumption.md : déployer, consentir un utilisateur, vérifier chaque droit, documenter le rollback | L | 5 | Revue Forge, consentement ou droit manquant absent du tenant

## 4. Composition de gammes (GA-32) et orchestration

0217. Typiser le contrat d'appel de sous-gamme | src/core/types/run.ts (invocation, sémantique, version, contexte) | M | 5 | Schéma incompatible avec les runs existants
0218. Résoudre la sous-gamme multi-espaces | src/resolver/ (index page Confluence → gamme, GA-30) | M | 4 | Collision d'identifiants entre espaces
0219. Valider le graphe d'appels sans cycle | src/resolver/ (DAG des gammes compilées) | L | 5 | Cycle non détecté avant publication
0220. Exécuter le mode « continuer » | src/core/run/ (résultat enfant→parent sans arrêt) | M | 5 | Confusion entre réussite et simple terminaison
0221. Exécuter le mode « interrompre » | src/core/run/ (suspension parent au point enfant) | M | 5 | Reprise sur un nœud déjà validé
0222. Exécuter le mode « repli » | src/core/run/ (branche fallback de la sous-gamme) | L | 5 | Repli déclenché après une preuve déjà acceptée
0223. Valider les entrées typées du parent | src/core/types/run.ts + src/core/run/ (schéma d'entrée enfant) | M | 5 | Données absentes ou mal typées à l'exécution
0224. Brancher les sorties typées vers le parent | src/core/types/run.ts (liaisons output→input) | M | 5 | Liaison ambiguë entre plusieurs sorties
0225. Construire l'arbre de trace | src/core/trace/ (parent, enfants, corrélation) | L | 5 | Traces plates impossibles à auditer
0226. Marquer le point de rupture exact | src/core/trace/ (nœud, étape, appel, cause) | M | 5 | Reprise au mauvais niveau de la hiérarchie
0227. Reprendre au point de rupture | src/core/run/ (reprise ciblée du sous-état) | L | 5 | État non idempotent rejoué
0228. Propager le mode urgence | src/core/run/ (héritage parent→enfant→repli) | M | 5 | Mode d'urgence activé trop tard
0229. Plafonner la profondeur de récursion | src/core/run/ + src/core/types/run.ts (profondeur max configurable) | S | 5 | Dépassement de pile ou boucle indirecte
0230. Faire remonter le verrou humain | src/core/run/ (lockPolicy bulle par défaut) | M | 5 | Attente croisée entre parent et enfant
0231. Suspendre le parent après refus humain | src/core/run/ (gate waiting_human/rejected) | M | 5 | Verrou orphelin après reprise
0232. Intersecter les permissions parent-enfant | src/core/run/ (intersection des scopes Confluence/Jira) | L | 5 | Élévation de privilèges via une sous-gamme
0233. Isoler les références de secrets | src/core/run/ + src/core/trace/ (secretRef uniquement) | M | 5 | Valeur secrète copiée dans la trace
0234. Épingler et propager la version | src/core/version/ (pin enfant transmis au parent) | M | 5 | Dérive silencieuse entre page et gamme
0235. Refuser une empreinte de version divergente | src/core/version/ (comparaison page↔gamme) | M | 5 | Faux positif lors d'une republication multi-espaces
0236. Composer rotation, déploiement et vérification | src/core/run/ (pipeline rotation→deployment→verification) | L | 5 | Ordre des étapes non garanti
0237. Normaliser les échecs de sous-gamme | src/core/types/run.ts (code, couche, reprise possible) | M | 4 | Parent incapable de distinguer erreur métier et technique
0238. Appliquer la politique d'échec du parent | src/core/run/ (retry, stop ou fallback par sémantique) | M | 5 | Politique ambiguë lors d'un échec enfant
0239. Dédupliquer les reprises idempotentes | src/core/run/ (clé parentRunId+callNodeId) | M | 4 | Double rotation ou double déploiement
0240. Renvoyer les déviations au parent | src/core/trace/ (événement deviation-liée) | M | 4 | Déviations locales masquées dans la vue globale
0241. Laisser Rovo choisir la sous-gamme | src/core/mcp/tools.ts (sélection parmi les candidats approuvés) | L | 5 | Sélection non déterministe ou hors périmètre
0242. Justifier le choix de Rovo | src/core/trace/ (critères, candidats, décision) | M | 4 | Audit impossible de la décision agent
0243. Refuser une sous-gamme non approuvée | src/resolver/ + src/core/version/ (contrôle du statut d'approbation) | M | 5 | Exécution d'une gamme obsolète
0244. Épingler l'encart Jira GA-16 | src/core/mcp/tools.ts (lien Jira↔nœud↔exécution) | M | 4 | Dérive entre ticket Jira et trace
0245. Appliquer le validateur de transition GA-25 | src/core/run/ + src/resolver/ (gate avant et après sous-gamme) | L | 5 | Transition Jira contournée par un appel direct
0246. Relier les preuves aux nœuds | src/core/trace/ (preuve attendue, pièce reçue, verdict) | M | 5 | Preuve acceptée rattachée à la mauvaise étape
0247. Exposer la composition dans les 16 outils MCP | src/core/mcp/tools.ts (schéma compose_run) | M | 5 | Rupture du contrat des 16 outils publiés
0248. Formaliser les règles Rovo dans le SKILL.md | skills/derouler-une-gamme/SKILL.md (choix, approbation, urgence, limites) | S | 4 | Agent divergent du moteur
0249. Mesurer l'orchestration sans données personnelles | src/core/trace/ (agrégats étape/version, aucun acteur) | M | 4 | Fuite de statistiques individuelles
0250. Couvrir GA-32 par une matrice de tests | test/ (récursion, reprise, repli, choix Rovo) | L | 5 | Régression sur les 238 tests existants
0251. Déployer l'app en environnement de test | manifest.yml + src/core/mcp/tools.ts (forge deploy et smoke test compose_run) | M | 5 | Permissions distantes absentes ou manifeste invalide
0252. Fragmenter le moteur et borner la CI | src/core/run/ (fichier <500 lignes, fonction <50 lignes, zéro duplication, CI ≤5 min) | M | 5 | CI >5 min ou violations structurelles

## 5. Agent Rovo, MCP, skills et point d'entrée externe

0253. Définir le rôle et les pouvoirs du compagnon | agents/le-compagnon.md : rôle d'orchestrateur, questions autorisées et interdiction de modifier la gamme | S | 5 | Confusion entre conseil et exécution
0254. Restreindre l'agent à une machine d'états | agents/le-compagnon.md : états ENTRÉE, EN_COURS, VERROUILLÉ, ÉCHEC, REPRISE et TERMINÉ | M | 5 | Transition hors séquence
0255. Récupérer les entrées typées par MCP | src/core/mcp/tools.ts et src/platform/llm/ : lecture par inputKey, validation du type, aucun défaut inventé | M | 5 | Entrée manquante inventée
0256. Bloquer l'improvisation d'une étape à risque | agents/le-compagnon.md : refus explicite des actions non couvertes et demande d'amendement | M | 5 | Action non approuvée
0257. Refuser une gamme non approuvée | agents/le-compagnon.md et src/core/mcp/tools.ts : contrôle du statut d'approbation et de l'empreinte de version avant action | S | 5 | Exécution prématurée
0258. Suspendre l'agent sur un verrou de permission | src/core/mcp/tools.ts : résultat PERMISSION_REQUIRED avec permissionKey et reprise identifiable | S | 4 | Contournement des droits
0259. Demander une validation humaine explicite | src/core/mcp/tools.ts : résultat HUMAN_APPROVAL_REQUIRED avec approverKey et preuve de validation | S | 4 | Validation usurpée
0260. Masquer les secrets durant leur déverrouillage | src/core/mcp/tools.ts et src/platform/llm/ : valeurs masquées et transmission par secretKey uniquement | M | 5 | Fuite de secret
0261. Exiger une preuve pour clôturer chaque étape | src/core/mcp/tools.ts : preuve attendue, type, empreinte et statut de présence | M | 5 | Faux positif de réussite
0262. Classifier toute déviation avant reprise | agents/le-compagnon.md et agents/hermes-conciliator.md : DÉVIATION, ÉCHEC ou INTERRUPTION avec cause | M | 4 | Reprise non justifiée
0263. Reprendre une étape de façon idempotente | src/core/mcp/tools.ts : stepAttemptId, version attendue et réutilisation d'une tentative existante | M | 4 | Double effet métier
0264. Encadrer le mode urgence | agents/le-compagnon.md : conditions d'entrée, actions en liste blanche, confirmation humaine et journalisation | M | 5 | Bypass des contrôles
0265. Proposer un amendement après échec | agents/hermes-conciliator.md : diff en brouillon, justification de l'écart et validation humaine obligatoire | M | 5 | Amendement appliqué sans revue
0266. Interdire les commandes shell arbitraires | agents/le-compagnon.md et src/platform/llm/ : outils MCP uniquement, aucun shell ni accès réseau direct | M | 5 | Exécution de code arbitraire
0267. Neutraliser les instructions malveillantes de la procédure | src/platform/llm/ : contenu Confluence encadré comme donnée non fiable et opérations en liste blanche | M | 5 | Injection de prompt
0268. Stabiliser le schéma des seize outils | src/core/mcp/tools.ts : schémas mutualisés et versionnés, réponses uniformes, modules sous 500 lignes | L | 5 | Rupture de contrat MCP
0269. Rendre les seize outils découvrables | src/core/mcp/tools.ts : noms explicites, action, risque et exemple minimal pour chacun | S | 5 | Sélection ambiguë d'un outil
0270. Publier les seize modules dans rovo:mcp | manifest.yml et src/core/mcp/tools.ts : correspondance un-à-un entre modules action et outils rovo:mcp | M | 5 | Outil absent ou dupliqué
0271. Déclarer la source du skill Rovo | manifest.yml : bloc rovo:skill avec source.dir pointant vers skills/derouler-une-gamme | S | 5 | Skill non découvert
0272. Exporter un SKILL.md générique | src/core/export/skill-md.ts : sortie autonome, frontmatter valide et absence de dépendance à un outil Rovo unique | M | 5 | Incompatibilité avec un agent tiers
0273. Encoder le contrat du skill | skills/derouler-une-gamme/SKILL.md : nom, description, entrées requises, sorties, erreurs et conditions de refus | M | 4 | Interprétation incorrecte par un tiers
0274. Plafonner le contexte du skill | skills/derouler-une-gamme/SKILL.md et src/platform/llm/ : budget de jetons et chargement de la seule gamme active | M | 5 | Saturation de la fenêtre de contexte
0275. Isoler les détails non actifs du prompt | skills/derouler-une-gamme/SKILL.md : historique, options et preuves archivées hors du contexte initial | M | 4 | Chargement d'une version périmée
0276. Relier la page et la gamme | src/core/mcp/tools.ts : chaque résultat porte l'identifiant de page, de gamme et de version | S | 4 | Traçabilité rompue
0277. Authentifier le webtrigger par HMAC | src/platform/webtrigger.ts : HMAC-SHA256, comparaison à temps constant et secret dans Forge Secrets | M | 5 | Déclenchement forgé
0278. Canonicaliser la requête avant signature | src/platform/webtrigger.ts : méthode, chemin, horodatage, nonce et empreinte du corps inclus | M | 4 | Signature rejetée à tort
0279. Empêcher le rejeu du webtrigger | src/platform/webtrigger.ts : fenêtre temporelle bornée, nonce consommé une seule fois | M | 5 | Réexécution d'une commande
0280. Lier le webtrigger au tenant | src/platform/webtrigger.ts : concordance tenantId, installationId et code de gamme avec le contexte Forge | M | 5 | Accès inter-tenant
0281. Valider strictement la charge utile | src/platform/webtrigger.ts : champs autorisés, types stricts, tailles maximales et rejet des propriétés inconnues | S | 5 | Payload malformé ou inattendu
0282. Dédupliquer les exécutions externes | src/platform/webtrigger.ts : clé d'idempotence persistée et réutilisation du même executionId | M | 5 | Exécution métier en double
0283. Répondre immédiatement au webtrigger | src/platform/webtrigger.ts : réponse 202 avec executionId et traitement asynchrone | M | 4 | Expiration du délai client
0284. Exposer le statut de l'exécution | src/core/mcp/tools.ts et src/platform/webtrigger.ts : consultation en lecture seule de l'état, des verrous et de la dernière preuve | M | 4 | Absence de suivi après le 202
0285. Borner appels MCP et durée totale | src/platform/llm/ : helpers sous 50 lignes, maximum d'appels, timeout et budget de jetons | M | 5 | Boucle ou traitement incontrôlé
0286. Tracer les appels sans données sensibles | src/platform/llm/ et src/platform/webtrigger.ts : audit des preuves et erreurs, aucun secret ni statistique par personne | M | 4 | Donnée personnelle exposée
0287. Tester les seize contrats MCP | test/mcp/ : tests de contrat par outil, fixtures typées et CI ciblée terminée en moins de cinq minutes | M | 5 | Régression silencieuse
0288. Déployer un pilote dans un tenant | manifest.yml et src/core/mcp/tools.ts : validation 13.9.0, déploiement staging et smoke test rovo:mcp, skill et webtrigger | L | 5 | Écart entre manifeste et tenant réel

## 6. Qualité du cœur (src/core)

0289. Rejeter les blocs de code imbriqués non parsables | src/core/extract/codeBlocks.ts | S | 4 | Faux positifs bloquant des extractions valides
0290. Valider l'ordonnancement strict des étapes numérotées | src/core/compile/stepOrderValidator.ts | S | 4 | Rejet de listes Confluence à numérotation lâche
0291. Valider formellement le schéma Zod des entrées typées | src/core/compile/schemaValidator.ts | M | 5 | Incompatibilité de schémas complexes en runtime
0292. Refuser toute preuve sans critère d'acceptation falsifiable | src/core/falsifiable/proofCriterion.ts | M | 5 | Blocage de procédures purement déclaratives
0293. Détecter les masquages de secrets dans les payloads JSON | src/core/secrets/patternDetector.ts | S | 4 | Faux positifs sur des tokens synthétiques de test
0294. Isoler l'évaluation des expressions de garde dans une sandbox | src/core/compile/guardEvaluator.ts | M | 4 | Perte de performance sur les grosses gammes
0295. Calculer le hash SHA-256 canonique pour l'empreinte de gamme | src/core/version/fingerprint.ts | S | 5 | Invalidation involontaire suite à réordonnancement de clés
0296. Refuser la compilation si un verrou humain n'a aucun rôle cible | src/core/locks/humanGateValidator.ts | S | 4 | Rejet de gammes génériques sans affectation
0297. Vérifier l'orthogonalité sémantique entre étapes successives | src/core/compile/stepOrthogonality.ts | M | 3 | Complexité d'analyse lexicale excessive
0298. Tracer l'horodatage exact et immuable de chaque transition | src/core/run/stateMachine.ts | S | 5 | Divergence d'horloge entre agents et Forge
0299. Empêcher l'exécution concurrente d'une même instance de gamme | src/core/run/concurrencyLock.ts | M | 4 | Verrous orphelins en cas de crash de worker
0300. Calculer le taux d'échec par étape avec seuil de recul minimum | src/core/stats/failureRateCalculator.ts | S | 4 | Affichage tronqué pour gammes récentes
0301. Détecter les étapes fantômes sautées systématiquement | src/core/ghosts/detector.ts | M | 4 | Bruit statistique sur les chemins conditionnels rares
0302. Rejeter les boucles infinies dans la composition de gammes | src/core/compile/dependencyGraph.ts (GA-32) | M | 5 | Récursion non détectée sur graphes indirects
0303. Détecter les conflits d'accès aux ressources partagées | src/core/conflicts/resourceDetector.ts | M | 4 | Sur-détection de conflits sur des locks permissifs
0304. Valider l'intégrité cryptographique de la trace d'exécution | src/core/run/auditTrail.ts | M | 5 | Coût CPU de hachage chaîné sur exécutions longues
0305. Interdire les amendements automatiques sans validation humaine | src/core/amendments/proposer.ts | S | 5 | Accumulation d'amendements en attente non traités
0306. Rapprocher les empreintes Confluence et Gamme pour la dérive | src/core/binding/driftDetector.ts | S | 4 | Alertes intempestives sur modifications cosmétiques
0307. Exporter le SKILL.md sans métadonnées sensibles ni secrets | src/core/export/skillMarkdown.ts | S | 4 | Omission de directives indispensables au LLM
0308. Valider la conformité MCP Schema 2024-11-05 des 16 outils | src/core/mcp/toolDefinitions.ts | M | 5 | Rupture de compatibilité avec les clients MCP stricts
0309. Borner la mémoire consommée lors de l'extraction de macro Confluence | src/core/extract/confluenceMacroParser.ts | M | 3 | Tronquage de pages volumineuses (>2 Mo)
0310. Typage strict des déviations d'exécution avec cause racine | src/core/run/deviationLogger.ts | S | 4 | Catégorisation imprécise choisie par l'opérateur
0311. Restreindre le mode urgence à un quorum explicite d'acteurs | src/core/run/emergencyMode.ts | M | 4 | Blocage d'une remédiation critique en astreinte
0312. Calculer la fraîcheur temporelle relative d'une gamme publiée | src/core/stats/freshnessScore.ts | S | 3 | Dépréciation injustifiée de gammes stables non modifiées
0313. Réconcilier les divergences sémantiques entre deux versions | src/core/conciliation/diffEngine.ts | L | 4 | Échecs d'alignement sur restructuration majeure
0314. Uniformiser les erreurs de qualification en codes machine lisibles | src/core/qualify/errorCodes.ts | S | 3 | Rupture des assertions de tests existants
0315. Vérifier la complétude de couverture des étapes par tests unitaires | src/core/coverage/testMatrix.ts | M | 3 | Métriques faussées par des mocks incomplets
0316. Interdire les doubles liaisons actives pour une même page | src/core/binding/bindingRegistry.ts | S | 4 | Conflits lors de duplication de pages Confluence
0317. Sécuriser l'injection de contexte dans les prompts d'amendement | src/core/amendments/promptBuilder.ts | M | 4 | Prompt injection via le contenu de page Confluence
0318. Extraire formellement les préconditions requises avant étape 1 | src/core/extract/preconditions.ts | M | 4 | Mauvaise interprétation de phrases en langage naturel
0319. Forcer l'idempotence des commandes d'exécution rejouées | src/core/run/idempotencyGuard.ts | M | 5 | Effets de bord non détectés sur outils externes
0320. Valider l'unicité des identifiants d'étapes dans la gamme | src/core/compile/stepIdValidator.ts | S | 5 | Collision sur des étapes clonées manuellement
0321. Refuser les dépendances circulaires entre gammes importées | src/core/compile/importResolver.ts (GA-32) | M | 4 | Verrouillage mutuel au moment de l'édition
0322. Normaliser la sérialisation JSON pour un hash déterministe | src/core/version/deterministicJson.ts | S | 5 | Différences subtiles selon les types non sérialisables
0323. Mesurer le temps d'exécution effectif hors temps d'attente humain | src/core/stats/durationMetrics.ts | S | 3 | Biais si les pauses opérateur sont mal étiquetées
0324. Contrôler la signature de l'approbateur humain lors de la release | src/core/version/releaseGate.ts | S | 5 | Falsification si l'identifiant n'est pas vérifié Forge
0325. Filtrer les regex de secrets pour éliminer le déni de service ReDoS | src/core/secrets/safeRegex.ts | S | 4 | Ralentissement ou timeout sur chaînes complexes
0326. Vérifier la cohérence des types d'entrées avec les outils MCP | src/core/mcp/parameterMapper.ts | M | 4 | Incohérence de casting string/number par le client
0327. Valider les permissions requises avant d'exécuter un outil | src/core/locks/permissionChecker.ts | M | 4 | Défaillance silencieuse si le scope Jira/Confluence manque
0328. Détecter l'obsolescence d'une étape via l'historique d'échecs | src/core/stats/obsolescenceDetector.ts | M | 3 | Recommandation erronée due à une panne d'infrastructure
0329. Découper la logique d'extraction de tableaux Confluence trop longue | src/core/extract/tableExtractor.ts | S | 3 | Régression sur tableaux à cellules fusionnées
0330. Séparer l'évaluation des risques opérationnels en matrice dédiée | src/core/risk/riskMatrix.ts | M | 4 | Complexification de l'algorithme de scoring global
0331. Rejeter explicitement les scripts inline non autorisés | src/core/compile/scriptSanitizer.ts | S | 5 | Blocage de snippets bash légitimes mais non échappés
0332. Assurer la traçabilité des reprises après incident avec preuve | src/core/run/resumeHandler.ts | M | 4 | Perte de contexte entre le crash et la reprise
0333. Éviter la duplication de logique entre MCP et export de gammes | src/core/export/sharedDefinitions.ts | S | 3 | Couplage excessif entre formats externes
0334. Bloquer l'export de gammes ayant des erreurs de qualification | src/core/export/exportGuard.ts | S | 4 | Frustration utilisateur sur avertissements mineurs
0335. Valider que les critères falsifiables contiennent une assertion | src/core/falsifiable/assertionChecker.ts | S | 4 | Rejet de validations textuelles informelles
0336. Structurer les logs d'erreurs internes sans fuite d'arguments | src/core/run/safeLogger.ts | S | 4 | Perte d'éléments contextuels pour le diagnostic
0337. Détecter les conflits d'intention entre deux gammes concurrentes | src/core/conflicts/intentComparator.ts | L | 3 | Faux positifs sur termes polysémiques
0338. Interdire la modification rétroactive d'une exécution terminée | src/core/run/immutableRun.ts | S | 5 | Blocage d'annotations a posteriori légitimes
0339. Valider la conformité du manifest MCP généré dynamiquement | src/core/mcp/manifestGenerator.ts | M | 4 | Invalidation par les parseurs de clients stricts
0340. Refuser la compilation d'une gamme sans propriétaire désigné | src/core/qualify/ownershipValidator.ts | S | 4 | Gammes orphelines non maintenables
0341. Isoler l'extraction des blocs Jira des blocs Confluence | src/core/extract/jiraIssueParser.ts | M | 3 | Régression sur les formats hybrides Jira-Confluence
0342. Définir des seuils configurables pour la détection de fantômes | src/core/ghosts/thresholdConfig.ts | S | 3 | Paramétrage trop lâche rendant l'outil muet
0343. Découper la machine à états d'exécution dépassant 400 lignes | src/core/run/runStateMachineTransitions.ts | M | 3 | Risque de désynchronisation de l'état global
0344. Calculer l'impact de risque composite avant toute publication | src/core/risk/compositeScore.ts | M | 4 | Score disproportionné sur étapes d'infrastructure
0345. Neutraliser les injections de balises HTML dans les descriptions | src/core/compile/htmlSanitizer.ts | S | 5 | Dégradation de l'affichage riche Confluence
0346. Vérifier la complétude des paramètres de sortie après exécution | src/core/run/outputValidator.ts | S | 4 | Rejet d'étapes produisant des sorties optionnelles
0347. Encapsuler la gestion d'empreinte sous une interface immuable | src/core/version/fingerprintService.ts | S | 4 | Nécessité de refactorer l'ensemble des consumers
0348. Filtrer les métriques individuelles pour respecter l'anonymat | src/core/stats/privacyFilter.ts | S | 5 | Fuite involontaire d'identifiants d'opérateur
0349. Établir une convention stricte de nommage des outils MCP exposés | src/core/mcp/toolNaming.ts | S | 4 | Rupture de compatibilité pour les intégrations Rovo
0350. Valider la robustesse du typage sur les preuves de type webhook | src/core/qualify/webhookProofValidator.ts | M | 3 | Rejet de payloads tiers non standardisés
0351. Optimiser l'algorithme de conciliation de gammes concurrentes | src/core/conciliation/conflictGraph.ts | L | 3 | Explosion combinatoire sur portefeuilles denses
0352. Tester aux limites l'extracteur avec documents malformés | src/core/extract/__tests__/fuzzParser.spec.ts | M | 4 | Temps d'exécution CI accru au-delà de 5 minutes
0353. Refuser les gammes dont l'estimation dépasse la limite de temps | src/core/risk/durationGuard.ts | S | 3 | Blocage de procédures batch longues valides
0354. Uniformiser les types de résultats d'exécution en discriminants | src/core/run/executionResult.ts | S | 4 | Refactoring lourd de la couche UI associée
0355. Restreindre l'inclusion de fragments externes aux gammes vérifiées | src/core/compile/fragmentIncluder.ts (GA-32) | M | 4 | Dépendance bloquée sur fragment en cours d'audit
0356. Ajouter un contrôle de version sémantique stricte sur les gammes | src/core/version/semverValidator.ts | S | 4 | Rejet de releases basées sur horodatage seul
0357. Détecter les ruptures de contrat dans les amendements proposés | src/core/amendments/contractBreakDetector.ts | M | 4 | Rejet d'amendements pourtant nécessaires
0358. Assurer la non-nullité des contextes d'exécution propagés | src/core/run/executionContext.ts | S | 4 | Crash inattendu sur étapes sans entrées définies
0359. Modulariser les 16 validateurs d'outils MCP pour lisibilité | src/core/mcp/validators/ | M | 3 | Multiplication excessive de micro-fichiers
0360. Interdire la suppression de traces tant que la rétention court | src/core/run/retentionPolicy.ts | S | 5 | Risque de saturation du stockage Forge KVS

## 7. Publication, multi-espaces, multi-tenant et Marketplace

0361. Structurer le schéma JSON du paquet portable d'une gamme | src/core/models/bundle.ts (GA-30) | M | 5 | Incompatibilité de schéma lors des montées de version futures
0362. Coder l'export d'une gamme compilée en archive zip signée | src/core/bundle/exporter.ts | M | 4 | Inclusion accidentelle de métadonnées sensibles de l'espace source
0363. Valider l'intégrité SHA-256 du paquet à l'importation | src/core/bundle/validator.ts | S | 4 | Rejet de paquets valides suite à normalisation des sauts de ligne
0364. Générer le fichier SKILL.md standardisé à la racine du paquet | src/integrations/mcp/skill_generator.ts | S | 5 | Divergence sémantique entre le SKILL.md et le graphe d'étapes
0365. Injecter la licence Apache-2.0 / MIT dans le header du SKILL.md exporté | src/integrations/mcp/license_header.ts | S | 3 | Conflit de propriété intellectuelle avec le contenu Confluence
0366. Signer cryptographiquement les paquets avec une clé Ed25519 locale | src/core/security/signer.ts | M | 4 | Perte ou mauvaise gestion du cycle de vie de la clé privée
0367. Vérifier la signature de l'auteur avant import dans un espace tiers | src/core/security/verifier.ts | S | 5 | Blocage d'imports légitimes en cas d'absence de clé publique
0368. Masquer les identifiants d'espace et clés Jira dans le bundle exporté | src/core/bundle/sanitizer.ts | M | 4 | Fuite d'identifiants internes de l'organisation émettrice
0369. Coder la substitution automatique des rôles et mentions lors de l'import | src/core/bundle/mapper.ts | M | 4 | Assignation par défaut à un rôle inexistant dans l'espace cible
0370. Définir le contrat d'importation sans écrasement de gamme existante | src/core/ports/import_port.ts (GA-30) | S | 5 | Écrasement silencieux d'une gamme locale active de même nom
0371. Implémenter l'aperçu différentiel avant validation de l'import | src/ui/screens/ImportDiffModal.tsx | M | 4 | Rendu illisible sur des gammes de plus de vingt étapes
0372. Bloquer l'importation de gammes dont les verrous secrets sont non résolus | src/core/bundle/preflight.ts | S | 5 | Déploiement d'une procédure non exécutable par manque de secrets
0373. Isoler les clés Forge Storage par préfixe d'espace Confluence | src/platform/forge/storage_isolation.ts | M | 5 | Fuite de données d'exécution entre espaces du même tenant
0374. Encapsuler les quotas d'espace sur le nombre de gammes actives | src/core/atelier/quota_manager.ts | S | 3 | Dépassement silencieux des limites de stockage Forge
0375. Implémenter un purgeur de paquets orphelins non validés après 48h | src/resolver/bundle_cleanup_job.ts | S | 2 | Suppression d'un import en attente de revue humaine
0376. Adapter le manifest Forge pour déclarer les scopes multi-espaces requis | manifest.yml | S | 5 | Rejet de soumission Forge pour scopes excessifs ou non justifiés
0377. Définir le sélecteur d'espace cible pour la publication cross-space | src/ui/components/SpaceTargetSelector.tsx | M | 4 | Sélection d'un espace où l'utilisateur n'a pas les droits d'écriture
0378. Valider les permissions Confluence de l'utilisateur sur l'espace cible | src/integrations/confluence/permission_check.ts | M | 5 | Échec silencieux de création de page par manque de droits Confluence
0379. Créer la page de procédure miroir dans l'espace Confluence distant | src/integrations/confluence/page_publisher.ts (GA-30) | L | 4 | Désynchronisation immédiate si le template distant diffère
0380. Consigner l'empreinte de publication distante pour le suivi de drift | src/core/models/federation.ts | S | 4 | Faux positifs de désynchronisation dus aux macros Confluence
0381. Forcer l'approbation humaine datée du responsable de l'espace cible | src/core/engine/cross_space_gate.ts | M | 5 | Contournement du workflow d'approbation locale de l'équipe réceptrice
0382. Enregistrer l'historique de provenance d'une gamme importée | src/core/models/provenance.ts | S | 3 | Rupture de la chaîne de traçabilité lors d'imports successifs
0383. Notifier l'espace source lorsqu'une gamme dérivée détecte un échec | src/resolver/cross_space_notifier.ts | M | 3 | Spam de notifications vers l'équipe source sur pannes d'infrastructure
0384. Désactiver la mise à jour automatique d'une gamme importée sans revue | src/core/engine/update_policy.ts | S | 4 | Régression opérationnelle introduite par un changement distant
0385. Construire le catalogue des gestes partagés au niveau de l'instance | src/core/atelier/gestures_catalog.ts (GA-30) | M | 4 | Lenteur de requêtage du catalogue sur un grand volume de gammes
0386. Afficher l'écran de navigation du catalogue de gestes transverses | src/ui/screens/GlobalCatalogScreen.tsx | M | 4 | Interface surchargée en l'absence de filtres par tags et domaines
0387. Filtrer le catalogue selon les autorisations de lecture de l'utilisateur | src/resolver/catalog_resolver.ts | M | 5 | Divulgation de titres de gammes confidentielles à des tiers
0388. Calculer l'indice de réutilisation transverse d'une gamme | src/core/atelier/reuse_metrics.ts | S | 3 | Métrique biaisée par des gammes importées mais jamais exécutées
0389. Générer le badge de popularité d'une gamme sans métrique individuelle | src/ui/components/ReuseBadge.tsx | S | 2 | Évaluation subjective assimilée à un classement de créateurs
0390. Comparer les taux de succès d'une même gamme entre deux espaces | src/core/atelier/benchmark_comparator.ts | M | 3 | Conclusions erronées dues à des volumes d'exécution très asymétriques
0391. Alerter l'atelier si une déviation récurrente est résolue dans l'espace source | src/core/atelier/upstream_drift.ts | M | 4 | Propositions d'amendements obsolètes sur gamme locale personnalisée
0392. Découpler la définition de gamme du schéma Confluence propriétaire | src/core/compiler/portable_ast.ts | L | 5 | Perte d'éléments riches lors de la conversion vers le format pivot
0393. Référencer les dépendances externes d'une gamme dans son manifeste | src/core/models/manifest_deps.ts | S | 3 | Dépendance déclarée introuvable sur l'instance de destination
0394. Empêcher l'export d'une gamme en état brouillon ou non compilée | src/core/bundle/export_guard.ts | S | 4 | Diffusion de procédures instables ou partiellement testées
0395. Configurer la politique d'isolation Forge multi-tenant pour le cloud | docs/architecture/multi_tenancy.md | S | 4 | Mauvaise interprétation des frontières de locataires Atlassian Cloud
0396. Encapsuler les requêtes k-v store sous une clé racine tenant/installation | src/platform/forge/tenant_store.ts | M | 5 | Fuite de configuration d'un client Forge vers un autre
0397. Valider l'étanchéité des données de déviations entre installations | test/platform/tenant_isolation.test.ts | M | 5 | Régression de sécurité non détectée en intégration continue
0398. Implémenter le switch d'espace dans l'atelier Forge sans recharger l'app | src/ui/hooks/useActiveSpace.ts | M | 3 | État résiduel de l'espace précédent affiché par erreur de cache
0399. Fournir un script de purge des données lors de la désinstallation Forge | src/resolver/lifecycle_uninstall.ts | M | 4 | Conservation indue de traces après désinstallation de l'application
0400. Définir le modèle de quotas d'exécutions archivées par organisation | src/core/models/tenant_quotas.ts | S | 3 | Blocage strict des exécutions urgentes lors du dépassement de quota
0401. Alerter l'administrateur Forge en cas d'approche du quota de stockage | src/resolver/quota_alert.ts | S | 3 | Notification ignorée causant un échec brutal d'enregistrement de preuve
0402. Rédiger la politique de confidentialité spécifique à l'application Forge | docs/marketplace/privacy_policy.md | S | 4 | Non-conformité aux exigences Atlassian Marketplace Cloud
0403. Générer l'écran Forge "À propos et conformité des données" | src/ui/screens/AboutPrivacyScreen.tsx | S | 3 | Absence d'informations obligatoires lors de l'audit Atlassian
0404. Documenter les flux réseau sortants pour le questionnaire Marketplace | docs/marketplace/data_residency.md | S | 4 | Déclaration inexacte entraînant le refus de publication Marketplace
0405. Établir la matrice de prix et paliers utilisateurs pour la Marketplace | docs/marketplace/pricing_strategy.md | S | 2 | Tarification inadaptée aux petites équipes logicielles
0406. Générer programmatiquement les captures d'écran de l'app pour la fiche | web/scripts/generate_marketplace_assets.ts | M | 3 | Captures désynchronisées de la version réelle de l'interface
0407. Préparer les textes marketing et arguments software teams de la fiche | docs/marketplace/listing_copy.md | S | 2 | Promesse produit floue ne mettant pas en avant la compilation de gammes
0408. Structurer le changelog public conforme aux normes Atlassian Marketplace | CHANGELOG.md | S | 3 | Historique de versions incompréhensible pour les administrateurs
0409. Définir les profils de déploiement multi-environnements Forge dans la CI | .github/workflows/forge_deploy.yml | M | 4 | Déploiement involontaire en environnement de production
0410. Valider la syntaxe du manifest selon l'environnement ciblé (dev/prod) | scripts/validate_manifest_env.sh | S | 4 | Déploiement avec des URL de webhook de développement en production
0411. Automatiser l'attribution des versions semver sur Forge CLI | scripts/forge_version_bump.ts | S | 3 | Conflit de numéros de build bloquant le pipeline de déploiement
0412. Exécuter un test de fumée post-déploiement sur tenant de staging | scripts/smoke_test_staging.sh | M | 4 | Fausse confirmation de succès sur tenant non provisionné
0413. Gérer l'exportation sélective d'une version historique figée | src/core/bundle/version_exporter.ts | M | 4 | Export d'un snapshot incohérent si des preuves sont en cours d'écriture
0414. Intégrer un filigrane numérique d'immuabilité dans le zip exporté | src/core/bundle/watermark.ts | S | 3 | Altération du filigrane invalidant les vérifications de conformité
0415. Bloquer l'export de données personnelles présentes dans les déviations | src/core/bundle/pii_scrubber.ts | M | 5 | Violation RGPD lors du transfert de retours d'expérience hors de l'UE
0416. Définir le schéma d'échange pour l'interopérabilité avec d'autres orgs | src/core/ports/cross_org_schema.ts (GA-30) | M | 4 | Rupture du format lors de l'adoption par une organisation partenaire
0417. Implémenter l'importation via glisser-déposer d'un fichier .gamme | src/ui/components/PackageDropzone.tsx | M | 3 | Blocage de l'UI du navigateur sur traitement d'un fichier corrompu
0418. Ajouter un rapport de validation pré-import listant les outils MCP manquants | src/ui/screens/ImportPreflightReport.tsx | M | 4 | Validation superficielle occultant une dépendance MCP critique
0419. Signaler les versions d'outils MCP divergentes entre org source et cible | src/core/bundle/mcp_compat.ts | S | 4 | Exécution échouée à l'étape 1 due à une signature d'outil obsolète
0420. Sauvegarder les paramètres de publication cross-space par défaut | src/platform/forge/publication_preferences.ts | S | 2 | Perte des préférences utilisateur après mise à jour de l'app
0421. Configurer la gestion du rate-limit de l'API Confluence lors d'exports massifs | src/integrations/confluence/rate_limiter.ts | M | 4 | Blocage API 429 lors de la synchronisation de plusieurs espaces
0422. Mettre en place un indicateur visuel de gamme "Origine externe" | src/ui/components/ExternalOriginBadge.tsx | S | 2 | Confusion entre gamme d'origine interne et gamme importée
0423. Tracer les modifications locales apportées à une gamme importée | src/core/engine/fork_tracker.ts | M | 4 | Perte du lien vers la gamme parente en cas de renommage local
0424. Implémenter la fusion assistée d'une mise à jour de gamme externe | src/core/compiler/three_way_merge.ts | L | 5 | Corruption du graphe de transition lors d'une fusion conflictuelle
0425. Publier automatiquement le SKILL.md sur un dépôt git public configuré | .github/workflows/publish_skills.yml | M | 3 | Divulgation accidentelle de procédures opérationnelles internes
0426. Tester la conformité du SKILL.md exporté avec la spécification MCP | test/integrations/skill_compliance.test.ts | S | 4 | Incompatibilité de parsing avec les clients MCP tiers (Claude Desktop)
0427. Restreindre la publication externe aux utilisateurs ayant le rôle Admin Gammes | src/core/security/rbac_publication.ts | S | 5 | Élévation de privilège permettant l'exfiltration de gammes
0428. Vérifier la compatibilité des versions de manifest Forge lors des imports | src/core/bundle/schema_version_check.ts | S | 4 | Plantage de l'app sur chargement d'un bundle d'une version trop récente
0429. Fournir une commande CLI pour empaqueter une gamme sans passer par l'UI | scripts/pack_gamme_cli.ts | M | 3 | Écart de comportement entre l'empaquetage CLI et le compilateur web
0430. Créer un mock complet de réponse multi-espaces pour la suite vitest | test/mocks/mock_cross_space_confluence.ts | M | 3 | Faux sentiment de sécurité sur un bouchon trop permissif
0431. Journaliser les transferts de paquets dans le journal d'audit Atlassian | src/platform/forge/audit_logger.ts | M | 4 | Dépassement des quotas d'appels d'audit Forge lors d'imports groupés
0432. Présenter le flux complet export-import dans la démo statique GitHub Pages | web/demo/cross_space_flow.json | S | 3 | Incohérence entre la démo statique et le comportement réel de Forge

## 8. Tests, CI et garde-fous

0433. Valider par AST la limite de 50 lignes par fonction | scripts/check-limits.mjs | S | 4 | Faux positifs sur les déclarations de types TypeScript imbriquées
0434. Bloquer les fichiers dépassant 500 lignes brutes en pré-commit | scripts/check-limits.mjs | S | 3 | Blocage intempestif lors de la génération de fixtures de test
0435. Détecter statiquement toute agrégation par identifiant utilisateur | scripts/check-limits.mjs | M | 5 | Contournement par renommage dynamique de clés dans src/core/metrics/
0436. Bannir les chaînes typiques de secrets et tokens Forge dans le code | scripts/check-limits.mjs | S | 4 | Faux positifs sur les tokens factices des tests unitaires
0437. Valider le manifest Forge contre le schéma officiel 13.9.0 | tools/check-manifest.mjs | S | 5 | Désynchronisation si la version du schéma distant change sans préavis
0438. Vérifier la cohérence entre les 16 outils MCP et le manifest | tools/check-manifest.mjs | M | 4 | Oubli d'un outil MCP déclaré dans src/integrations/mcp/ non exposé
0439. Valider les définitions de l'agent Rovo dans le manifest | tools/check-manifest.mjs | S | 4 | Syntaxe d'action Rovo non reconnue par le validateur hors-ligne
0440. Auditer les permissions Confluence et Jira requises dans le manifest | tools/check-manifest.mjs | S | 3 | Déclaration de permissions superflues violant le moindre privilège
0441. Figer le périmètre invariant de la couche 0 par hash SHA-256 | .github/couche0/verify-perimeter.mjs | M | 5 | Blocage des évolutions légitimes de l'architecture de base
0442. Interdire la modification de la couche 0 sans double revue | .mergify.yml | S | 4 | Ralentissement des correctifs urgents touchant le cœur
0443. Mesurer et borner le temps d'exécution total de la CI à 270 secondes | .github/ci-budget/check-budget.mjs | S | 4 | Échec de build dû à une gigue réseau transitoire sur GitHub
0444. Alerter sur Slack/GitHub Issues dès que la CI dépasse 4 minutes | .github/ci-budget/reporter.mjs | S | 2 | Bruit excessif en cas de contention temporaire de runners
0445. Mettre en cache les dépendances npm sur le runner self-hosted r630 | .github/workflows/ci.yml | S | 3 | Corruption de cache nécessitant une purge manuelle sur le serveur
0446. Isoler le runner r630 dans un conteneur sans accès internet aux tests | .github/workflows/ci.yml | M | 4 | Échec des tests nécessitant des fixtures téléchargées à la volée
0447. Mettre en place un basculement automatique vers ubuntu-latest si r630 est indisponible | .github/workflows/ci.yml | M | 3 | Dépassement du quota gratuit de minutes GitHub Actions
0448. Nettoyer les processus Node orphelins avant chaque exécution sur r630 | .github/workflows/ci.yml | S | 2 | Suppression accidentelle de processus d'un autre job concurrent
0449. Détecter les conflits sémantiques entre PRs sur le moteur d'exécution | .github/inferhub/conflict-detector.mjs | L | 4 | Faux conflits sur des refactorisations purement syntaxiques
0450. Simuler la fusion anticipée dans la file Mergify avant merge final | .mergify.yml | M | 4 | Temps d'attente accru dans la file en cas de volume élevé de PRs
0451. Exécuter les tests en ordre aléatoire pour traquer l'état partagé | vitest.config.ts | S | 4 | Difficulté à reproduire localement un échec dépendant de l'ordre
0452. Figer l'horloge système via un mock global pour les tests d'empreinte | test/setup.ts | S | 5 | Désynchronisation des tests d'âge d'écart si le mock est mal restauré
0453. Tester la compilation d'une procédure Confluence complexe par tests de propriétés | test/core/parser/confluence-parser.spec.ts | M | 5 | Explosion combinatoire ralentissant l'exécution au-delà de 30 secondes
0454. Valider l'idempotence stricte du moteur d'exécution pas-à-pas | test/core/engine/runner.spec.ts | M | 5 | Non-détection d'un effet de bord asynchrone non attendu
0455. Vérifier le calcul du taux d'échec par étape sans données individuelles | test/core/metrics/atelier.spec.ts | S | 4 | Régression laissant fuiter l'identifiant de l'exécuteur
0456. Tester l'affichage de la mention pas assez de recul sous le seuil d'effectif | test/core/metrics/confidence.spec.ts | S | 3 | Mauvais paramétrage du seuil minimum d'exécutions
0457. Valider la détection des étapes fantômes jamais complétées | test/core/metrics/ghost-steps.spec.ts | S | 3 | Faux diagnostic sur des étapes optionnelles légitimes
0458. Vérifier l'algorithme de détection des conflits entre gammes concurrentes | test/core/metrics/conflicts.spec.ts | M | 4 | Complexité algorithmique quadratique sur grand nombre de gammes
0459. Valider le calcul de fraîcheur basé sur l'âge de l'écart Confluence | test/core/engine/freshness.spec.ts | S | 3 | Erreur de fuseau horaire faussant le calcul du delta
0460. Tester le verrouillage strict en mode urgence sans contournement possible | test/core/engine/emergency.spec.ts | M | 5 | Risque de faille permettant d'exécuter sans trace de déviation
0461. Vérifier l'immuabilité d'une version de gamme après publication approuvée | test/core/models/gamme-version.spec.ts | S | 5 | Mutation involontaire par référence en mémoire
0462. Valider le rejet de toute proposition d'amendement sans action humaine | test/core/amendments/approval.spec.ts | S | 5 | Auto-application accidentelle d'une correction de gamme
0463. Tester la génération conforme du fichier SKILL.md pour agents Rovo | test/integrations/mcp/skill-export.spec.ts | S | 4 | Markdown invalide non interprétable par le parser Rovo
0464. Valider les 16 schémas d'outils MCP selon la spécification JSON-RPC | test/integrations/mcp/tools-schema.spec.ts | M | 5 | Typage incomplet d'un paramètre d'entrée provoquant un crash MCP
0465. Simuler le comportement bouchonné du KVS Forge et ses limites de taille | test/platform/kvs-mock.spec.ts | M | 4 | Bouchon trop permissif masquant un dépassement de quota 32 Ko réel
0466. Émuler les erreurs réseau transitoires sur les ports Confluence | test/platform/confluence-ports.spec.ts | S | 3 | Boucle infinie dans la stratégie de retry
0467. Émuler la création de tickets d'anomalie Jira via le port bouchonné | test/platform/jira-ports.spec.ts | S | 3 | Payload JSON incompatible avec les champs obligatoires Jira
0468. Tester le port bouchonné Teamwork Graph pour l'exigence GA-31 | test/integrations/graph/graph-port.spec.ts | M | 3 | Inadéquation avec la structure réelle de données GraphQL Atlassian
0469. Valider le contrat de composition de gammes pour l'exigence GA-32 | test/core/composition/composer.spec.ts | M | 4 | Références circulaires non interceptées entre gammes parent/enfant
0470. Vérifier la portabilité des gammes exportées pour l'exigence GA-30 | test/integrations/export/cross-org.spec.ts | M | 4 | Dépendance résiduelle à un identifiant d'espace local non purgé
0471. Tester le verrou humain exigeant une signature crypt

## 9. Observabilité, exploitation et coûts

0472. Sceller les entrées d'audit par hachage SHA-256 chaîné | src/core/audit/journal.ts | M | 5 | Collision d'écriture concurrente lors d'exécutions simultanées
0473. Bloquer tout enregistrement d'identifiant nominatif dans les métriques | src/core/metrics/sanitizer.ts | S | 5 | Fuite indirecte d'identité via l'accountId Jira/Confluence
0474. Limiter les payloads de preuves envoyés via le bridge UI à 450 Ko | src/ui/bridge/evidence-transport.ts | S | 4 | Rejet silencieux de la preuve côté Forge Bridge
0475. Découper les gros artefacts de preuve vers Forge Storage en blocs de 4 Mo | src/platform/forge/storage/blob.ts | M | 4 | Latence accrue lors du réassemblage des preuves volumineuses
0476. Implémenter un backoff exponentiel avec gigue sur les erreurs 429 et 503 | src/integrations/atlassian/client.ts | M | 5 | Blocage temporaire d'un thread résolveur proche des 25 secondes
0477. Router les exécutions longues (>20 s) vers un Forge Async Event Consumer | manifest.yml | M | 5 | Perte d'état si la file async d'Atlassian accumule du retard
0478. Surveiller le quota d'invocations par installation (7 000/min) avec fenêtre glissante | src/platform/forge/limiter.ts | M | 4 | Faux positifs bloquant des ateliers légitimes en pic d'activité
0479. Compter les jetons LLM consommés par compilation de gamme avec un plafond mensuel | src/platform/llm/budget.ts | S | 4 | Compilation avortée si le prompt Confluence est verbeux
0480. Publier les transitions d'étapes de gamme sur Forge Realtime pour l'UI | src/platform/forge/realtime.ts | M | 4 | Déconnexion silencieuse du canal WebSocket côté navigateur
0481. Dégrader gracieusement le journal en mode append-only local si Forge SQL est indisponible | src/platform/forge/sql/fallback.ts | L | 4 | Désynchronisation temporaire des index d'atelier
0482. Archiver automatiquement les exécutions terminées de plus de 90 jours | src/platform/forge/sql/retention.ts | M | 3 | Verrouillage de table SQL pendant la purge massive
0483. Tronquer les traces de déviation à 64 Ko avant écriture dans le journal | src/core/engine/deviation.ts | S | 3 | Tronquage de logs critiques pour le diagnostic post-mortem
0484. Mesurer l'utilisation CPU et mémoire du runner r630 après chaque build | .github/workflows/bench.yml | S | 3 | Disque saturé par l'accumulation des métriques de benchmark
0485. Encadrer l'appel REST Confluence d'un timeout strict de 8 secondes | src/integrations/confluence/client.ts | S | 4 | Échec de récupération de page sur instance Confluence lente
0486. Émettre une alerte d'exploitation si l'âge de l'écart page/gamme dépasse 30 jours | src/core/atelier/drift-detector.ts | S | 3 | Fatigue d'alertes si plusieurs gammes sont délaissées
0487. Agréger les taux d'échec par étape sans ventilateur d'équipe sous le seuil K-anonymat | src/core/metrics/k-anonymity.ts | M | 5 | Calcul bloqué en cas d'effectif inférieur au minimum requis
0488. Gérer le quota de 100 requêtes/min par produit Atlassian avec un seau à jetons | src/platform/forge/token-bucket.ts | M | 4 | Mise en attente artificielle des requêtes Jira critiques
0489. Mettre en cache mémoire Forge l'empreinte de la page Confluence pendant 60 secondes | src/integrations/confluence/cache.ts | S | 3 | Retard d'une minute sur la détection d'une désynchronisation
0490. Mesurer le temps d'exécution de chaque étape dans le moteur d'exécution | src/core/engine/timer.ts | S | 3 | Biais de mesure induit par la latence interne du moteur
0491. Activer un coupe-circuit si Confluence répond par 5xx pendant plus de 30 secondes | src/integrations/confluence/circuit-breaker.ts | M | 4 | Blocage prématuré lors d'un simple hoquet réseau transitoire
0492. Valider la taille JSON du manifest d'export SKILL.md avant sérialisation | src/core/mcp/skill-export.ts | S | 2 | Export partiel non détecté lors d'un téléchargement utilisateur
0493. Suivre la taille globale occupée dans Forge SQL contre le quota maximal | src/platform/forge/sql/monitor.ts | M | 4 | Coûts imprévus si la volumétrie dépasse le forfait inclus
0494. Injecter un identifiant de corrélation unique par exécution de gamme | src/core/engine/correlation.ts | S | 5 | Absence de transmission de l'en-tête vers les sous-modules MCP
0495. Surveiller l'espace disque résiduel du runner self-hosted r630 en pré-build | .github/workflows/ci.yml | S | 3 | Échec brutal de CI sans diagnostic explicite en cas de disque plein
0496. Réduire les charges utiles des requêtes bridge UI en supprimant les champs nuls | src/ui/bridge/serializer.ts | S | 2 | Casse de désérialisation sur un composant attendant une clé nulle
0497. Alerter si un appel Rovo agent consomme plus de 8 000 jetons sur un amendement | src/integrations/rovo/budget.ts | S | 3 | Amendement tronqué en cas de prompt d'erreur très long
0498. Exécuter un vacuum régulier sur les tables SQLite / Forge SQL pour réclamer l'espace | src/platform/forge/sql/maintenance.ts | M | 3 | Dégradation temporaire des temps de réponse SQL
0499. Isoler le journal d'audit des pannes Jira via une file d'attente mémoire tampon | src/platform/forge/storage/queue.ts | M | 4 | Perte de messages tamponnés si l'instance Forge Lambda recycle
0500. Empêcher l'écriture d'un secret détecté par regex dans les preuves d'exécution | src/core/engine/secret-scrubber.ts | M | 5 | Faux positifs masquant des identifiants non confidentiels
0501. Basculer l'atelier en mode lecture seule si les quotas Forge Storage atteignent 90% | src/core/atelier/guard.ts | M | 4 | Frustration utilisateur lors d'une campagne de mise à jour
0502. Journaliser les latences de chaque outil MCP Gammes pour identifier les goulets | src/core/mcp/telemetry.ts | S | 4 | Surcharge de logs sur des invocations MCP à très haute fréquence
0503. Définir un timeout de 45 secondes sur les webtriggers d'amendement | manifest.yml | S | 4 | Échec de l'action si l'analyse d'amendement est trop complexe
0504. Restreindre les métriques d'étapes fantômes aux gammes ayant au moins 10 runs | src/core/atelier/ghost-steps.ts | S | 3 | Mauvaise interprétation d'une gamme récemment introduite
0505. Capturer les codes d'erreur HTTP Atlassian dans le journal pour calcul du SLO | src/integrations/atlassian/errors.ts | S | 4 | Fuite potentielle d'URL sensible dans le message d'erreur
0506. Mesurer le coût d'hébergement statique des assets GitHub Pages de démo | web/scripts/build-metrics.sh | S | 1 | Risque minime, simple surveillance de dépassement bande passante
0507. Rejeter les fichiers de preuve supérieurs à 5 Mo avant envoi réseau | src/core/engine/evidence.ts | S | 4 | Blocage d'un utilisateur fournissant une capture vidéo trop lourde
0508. Tracer les reprises après incident avec mention explicite du motif | src/core/engine/recovery.ts | S | 4 | Omission du motif par contournement en mode urgence
0509. Surveiller les invocations Forge par utilisateur (plafond 1 200/min) | src/platform/forge/user-limiter.ts | M | 4 | Blocage d'un administrateur effectuant des tests intensifs
0510. Agréger les temps de cycle des gammes sans afficher les extrêmes individuels | src/core/metrics/cycle-time.ts | S | 3 | Moyennes tronquées non représentatives en présence de pannes
0511. Simuler l'indisponibilité de Confluence dans un test de chaos sur l'atelier | src/resolver/__tests__/chaos.test.ts | M | 4 | Faux échecs intermittents en CI si le mock n'est pas réinitialisé
0512. Détecter les requêtes N+1 vers Jira lors de la vérification des permis | src/integrations/jira/permis.ts | M | 3 | Ralentissement de la validation si la gamme compte 20 étapes
0513. Indexer la table SQL des exécutions uniquement sur (gamme_id, version, date) | src/platform/forge/sql/migrations/001_indexes.sql | S | 4 | Ralentissement des requêtes ad-hoc non couvertes par l'index
0514. Compacter les diffs Confluence stockés lors des détections de désynchronisation | src/core/compiler/diff-compressor.ts | S | 3 | Temps CPU additionnel sur les pages Confluence massives
0515. Limiter la file d'attente d'événements Realtime à 50 messages non acquittés | src/platform/forge/realtime-buffer.ts | S | 3 | Écran de runner désynchronisé en cas de perte réseau longue
0516. Établir une jauge de coût estimé des appels LLM par exécution de gamme | src/core/metrics/cost-estimator.ts | S | 2 | Écart entre le modèle de calcul interne et la facture Atlassian
0517. Purger les conteneurs Docker orphelins sur le runner r630 après exécution de la suite | .github/workflows/cleanup.yml | S | 3 | Suppression accidentelle d'un conteneur persistant utile
0518. Interrompre une compilation si la taille de la page Confluence dépasse 1 Mo | src/core/compiler/size-guard.ts | S | 4 | Rejet de documentations volumineuses mais structurées
0519. Enregistrer les transitions d'état du mode urgence dans l'audit non modifiable | src/core/engine/emergency.ts | S | 5 | Tentative d'écriture concurrente sans verrou distribué
0520. Surveiller la durée totale de CI pour respecter le seuil strict de 5 minutes | .github/workflows/ci.yml | S | 3 | Flaky tests coupés au milieu lors de variations de charge CI
0521. Calculer le taux de succès global des outils MCP par tranche horaire | src/core/mcp/metrics.ts | S | 3 | Absence d'agrégation si aucun run n'a eu lieu dans l'heure
0522. Standardiser la structure d'erreur RFC 7807 pour les réponses du résolveur | src/resolver/errors.ts | S | 4 | Incompatibilité avec d'anciens composants UI attendant du texte brut
0523. Bloquer les recalculs d'atelier si aucune exécution n'a eu lieu depuis la veille | src/resolver/atelier.ts | S | 3 | Données d'atelier perçues comme figées par les utilisateurs
0524. Mesurer l'impact mémoire du parser markdown sur des gammes de 100 étapes | src/core/compiler/__tests__/memory.bench.ts | M | 2 | Fuite mémoire non détectée par vitest en exécution séquentielle
0525. Tracer les conflits entre gammes concurrentes sans nommer les auteurs des verrous | src/core/atelier/conflicts.ts | S | 4 | Difficulté à négocier la résolution du conflit sans tiers
0526. Notifier l'équipe de supervision si le circuit-breaker Confluence reste ouvert 5 min | src/integrations/notifications.ts | M | 3 | Tempête de notifications si l'incident Atlassian se prolonge
0527. Limiter les requêtes de recherche de gammes à 50 résultats paginés côté Forge SQL | src/platform/forge/sql/queries.ts | S | 4 | Expérience dégradée si l'utilisateur scroll au-delà de 50 items
0528. Auditer les rejets de conformité du manifest Forge en pré-commit CI | .github/workflows/manifest-check.yml | S | 4 | Faux blocage lors d'une mise à jour de schéma @forge/manifest
0529. Configurer un kill-switch désactivant l'agent Rovo en cas de dérive budgétaire | src/integrations/rovo/kill-switch.ts | S | 4 | Arrêt complet de l'assistance Rovo pour tous les utilisateurs
0530. Mesurer la dérive temporelle de l'horloge système du runner r630 par chrony | scripts/runner-health.sh | S | 2 | Échecs de validation de tokens OAuth en cas d'écart >1 seconde
0531. Réduire le niveau de log du resolver en production à WARN pour économiser l'I/O | src/resolver/logger.ts | S | 3 | Diagnostic d'incident plus complexe sans les logs de niveau INFO
0532. Éviter la double écriture d'événements identiques dans le flux Realtime | src/platform/forge/realtime-dedup.ts | S | 3 | Suppression par erreur de deux événements consécutifs valides
0533. Valider l'intégrité de la chaîne de hachage de l'audit au démarrage de l'app | src/core/audit/verifier.ts | M | 5 | Blocage de l'application si un hachage ancien a été corrompu
0534. Interdire l'usage de variables dynamiques non typées dans les requêtes SQL | src/platform/forge/sql/sanitizer.ts | S | 5 | Rejet de requêtes légitimes contenant des filtres composites
0535. Suivre l'âge de la dernière vérification d'empreinte Confluence par gamme | src/core/atelier/freshness.ts | S | 3 | Détection tardive de modifications hors des heures d'ouverture
0536. Imposer un délai minimal de 500 ms entre deux requêtes successives vers Jira | src/integrations/jira/throttle.ts | S | 3 | Allongement inutile de l'exécution globale d'une gamme
0537. Isoler les métriques de la démo GitHub Pages du stockage Forge de production | web/src/mock-storage.ts | S | 4 | Données fictives polluant les calculs réels si la bascule échoue
0538. Enregistrer le volume total d'octets de preuves stockées par gamme | src/core/metrics/storage-rollup.ts | S | 3 | Erreur d'arrondi sur les gros volumes cumulés de mégaoctets
0539. Vérifier que la stack d'appel d'erreur ne fuite aucune variable d'environnement | src/platform/forge/error-handler.ts | S | 5 | Masquage excessif d'informations rendant le débogage opaque
0540. Déclencher une exécution d'atelier en tâche de fond asynchrone la nuit | manifest.yml | M | 3 | Timeout Forge Consumer (900 s) si l'espace compte 500 gammes
0541. Mesurer le temps d'attente d'une exécution bloquée sur verrou humain | src/core/metrics/gate-wait.ts | S | 3 | Biais de mesure si l'approbateur est en congé prolongé
0542. Journaliser les échecs de désérialisation du protocole MCP sans corps brut | src/core/mcp/parser-logger.ts | S | 4 | Difficulté à reproduire le message malformé pour le correctif
0543. Créer un tableau de bord d'exploitation statique résumant la santé du système | web/src/screens/system-health.ts | M | 4 | Données affichées obsolètes si le rafraîchissement n'est pas déclenché

## 10. Sécurité, conformité et gouvernance

0544. Valider l'identité non-agent dans l'attestation de verrou humain | src/core/locks/humanLock.ts (GA-08) | S | 5 | Faux positif si le contexte d'exécution Forge masque le type de principal (User vs App)
0545. Rejeter toute signature d'étape émise par un token d'assistant Rovo | src/core/locks/attestationValidator.ts (GA-08) | S | 5 | Blocage accidentel d'un utilisateur humain authentifié au travers du panneau Rovo
0546. Vérifier le hachage cryptographique SHA-256 de la version immuable avant exécution | src/core/execution/versionGuard.ts (GA-12) | S | 5 | Échec d'exécution lors de migrations mineures de schéma de gamme sans re-hachage
0547. Verrouiller les modifications de gamme après approbation formelle datée | src/core/compilation/approvalLock.ts (GA-14) | S | 5 | Blocage des corrections urgentes de coquilles sans repasser par le cycle complet
0548. Interdire l'auto-approbation d'une gamme par son propre compilateur | src/core/compilation/roleSeparation.ts (GA-14) | S | 4 | Blocage des solos-devs lors de tests locaux si aucun bypass admin n'est prévu
0549. Chiffrer les références de secrets au repos dans Forge K/V Storage | src/core/secrets/secretStorage.ts (GA-09) | M | 4 | Perte de clé de déchiffrement rendant orphelins les pointeurs de secrets existants
0550. Masquer systématiquement les valeurs de secrets dans les payloads d'erreur et logs | src/core/secrets/secretMasker.ts | S | 5 | Masquage excessif corrompant des messages de diagnostic non sensibles
0551. Imposer un jeton à usage unique éphémère pour l'accès aux secrets d'étape | src/core/secrets/ephemeralToken.ts | M | 4 | Désynchronisation temporelle entre Forge et le gestionnaire tiers de secrets
0552. Valider la signature HMAC-SHA256 des requêtes entrantes sur le webtrigger Forge | src/platform/webtrigger/hmacValidator.ts | M | 5 | Rejet légitime si l'horodatage dérive de plus de 300 secondes entre émetteur et Forge
0553. Réduire les scopes Atlassian Forge au strict minimum requis pour Jira et Confluence | manifest.yml | S | 4 | Défaillance silencieuse d'un appel API REST Confluence non couvert par les scopes minimisés
0554. Imposer une structure append-only inviolable sur le journal d'audit des exécutions | src/core/audit/auditTrail.ts (GA-18) | M | 5 | Débordement de la limite de stockage 32 Ko par entité dans Forge K/V Storage
0555. Chaîner cryptographiquement les entrées d'audit par hachage de l'entrée précédente | src/core/audit/hashChain.ts | M | 4 | Rupture de la chaîne en cas d'écriture concurrente non synchronisée
0556. Assurer la conformité RGPD en anonymisant tout identifiant personnel dans les métriques | src/core/metrics/gdprSanitizer.ts | S | 5 | Impossibilité de contacter l'auteur en cas de signalement de faille sur une étape
0557. Bannir l'agrégation et l'affichage de métriques de performance par compte utilisateur | src/core/metrics/metricPolicy.ts | S | 4 | Contournement indirect via le recoupement des horodatages d'audit
0558. Épurer automatiquement les preuves d'exécution selon une politique TTL paramétrable | src/core/proofs/retentionCleaner.ts (GA-22) | M | 3 | Suppression prématurée de preuves requises pour un audit de conformité externe
0559. Valider les transitions d'états d'exécution via une machine à états finis stricte | src/core/execution/transitionValidator.ts (GA-25) | S | 5 | Blocage d'une reprise après incident si la transition d'urgence n'est pas modélisée
0560. Refuser les transitions d'états déclenchées sans identifiant d'opérateur vérifié | src/core/execution/transitionValidator.ts (GA-25) | S | 4 | Rejet des étapes automatisées de transition par webhook système
0561. Assainir le contenu Confluence compilé pour neutraliser les injections de prompt indirectes | src/core/compilation/promptSanitizer.ts | M | 5 | Altération non désirée d'instructions de code légitimes contenant du pseudo-markdown
0562. Isoler les directives système des données non fiables dans les prompts d'agents Rovo | src/integrations/rovo/promptShield.ts | M | 5 | Baisse de pertinence de l'agent Rovo si le cloisonnement est trop rigide
0563. Restreindre la liste blanche des commandes shell exécutables par les outils MCP | src/integrations/mcp/commandWhitelist.ts | M | 5 | Rejet de commandes légitimes mais exotiques nécessaires à un déploiement logiciel
0564. Forcer la confirmation humaine préalable pour toute commande MCP à impact destructeur | src/integrations/mcp/destructiveGuard.ts | S | 5 | Interruption des flux CI/CD totalement automatisés la nuit
0565. Rédiger le modèle de menace STRIDE couvrant les vecteurs Confluence, Rovo et MCP | docs/threat-model.md | M | 4 | Documentation déconnectée des évolutions rapides du code source
0566. Journaliser dans l'audit chaque arbitrage et décision de l'agent de conflits | src/core/conflict/conflictAudit.ts | S | 4 | Saturation du log d'audit lors de merges massifs de gammes divergentes
0567. Exiger une double validation humaine pour la résolution de conflits critiques | src/core/conflict/conflictResolver.ts | M | 4 | Allongement excessif du délai de mise à disposition des correctifs d'urgence
0568. Révoquer immédiatement les verrous d'étapes lors de la révocation d'un utilisateur Jira | src/platform/jira/userLifecycle.ts | M | 3 | Latence de détection de la révocation si les webhooks Jira user_deleted sont différés
0569. Contrôler l'origine et l'intégrité du SKILL.md exportable via une signature Ed25519 | src/integrations/rovo/skillSigner.ts | M | 4 | Incompatibilité de vérification si le client d'exécution externe n'embarque pas la clé
0570. Vérifier la conformité CSP des iframes et ressources chargées dans Forge Custom UI | manifest.yml | S | 4 | Régression d'affichage sur les composants Custom UI dépendant de polices externes
0571. Interdire la lecture de variables d'environnement non déclarées dans le resolver Forge | src/resolver/gammeResolver.ts | S | 4 | Crash inopiné en runtime si un fallback n'est pas fourni pour les environnements de test
0572. Scanner les expressions régulières de compilation contre les attaques ReDoS | src/core/compilation/regexGuard.ts | S | 3 | Rejet de patterns valides de parsing Confluence jugés vulnérables à tort
0573. Isoler le contexte mémoire des exécutions concurrentes de gammes dans le runner | src/core/execution/runnerSandbox.ts | M | 4 | Surcharge mémoire sur le runner self-hosted r630 lors de charges simultanées
0574. Détecter et bloquer le rejeu de webtriggers par vérification de nonce et timestamp | src/platform/webtrigger/replayGuard.ts | S | 5 | Faux rejets en cas de requêtes réémises légitimement suite à un timeout réseau
0575. Tronquer et chiffrer les sorties standard capturées comme preuves textuelles | src/core/proofs/textProofProcessor.ts | S | 4 | Tronquage de lignes d'erreur vitales situées en toute fin de journal
0576. Restreindre l'accès au tableau de preuves aux seuls rôles d'audit accrédités | src/ui/proofs/proofAccessControl.ts | S | 4 | Frustration des opérateurs d'étape ne pouvant vérifier leurs propres soumissions
0577. Refuser l'importation de gammes externes GA-30 sans vérification d'empreinte d'origine | src/core/compilation/crossOrgValidator.ts (GA-30) | M | 4 | Blocage d'échanges légitimes entre filiales aux configurations Forge distinctes
0578. Valider les schémas d'entrées d'étape via un parser strict empêchant la pollution de prototype | src/core/models/inputValidator.ts | S | 5 | Rejet de payloads JSON valides contenant des clés réservées inoffensives
0579. Assigner un niveau de sensibilité (interne/confidentiel/secret) à chaque étape de gamme | src/core/models/classification.ts | S | 3 | Complexité d'usage accrue décourageant la documentation des gammes simples
0580. Rejeter les amendements générés par IA GA-20 s'ils touchent aux verrous de sécurité | src/core/amendments/securityAmendGuard.ts (GA-20) | S | 5 | Blocage d'amendements valides visant justement à renforcer un verrou obsolète
0581. Limiter le débit d'exécution (rate limiting) des outils MCP par identifiant d'opérateur | src/integrations/mcp/rateLimiter.ts | S | 4 | Ralentissement d'opérations de maintenance de masse légitimes
0582. Auditer l'intégrité des liaisons Teamwork Graph avant d'autoriser une transition GA-31 | src/integrations/teamwork/graphIntegrity.ts (GA-31) | M | 3 | Temps de réponse accru de la transition si Teamwork Graph est sous forte charge
0583. Imposer le principe de moindre privilège sur l'accès aux artefacts de démo statique | web/index.html | S | 2 | Faux sentiment de sécurité sur un site statique public GitHub Pages
0584. Séparer cryptographiquement les clés de stockage K/V Forge par tenant et par gamme | src/platform/storage/tenantNamespace.ts | M | 5 | Risque de fuite transverse si le préfixe de compartimentage est mal formé
0585. Consigner tout accès en lecture au journal d'audit dans un registre d'accès dédié | src/core/audit/accessLogger.ts | S | 3 | Boucle infinie d'audit si le journal d'accès tente de s'auditer lui-même
0586. Vérifier que les paramètres d'URL injectés dans les requêtes Jira ne contiennent aucun CRLF | src/platform/jira/urlSanitizer.ts | S | 4 | Échec de requêtes Jira JQL complexes avec retours à la ligne légitimes
0587. Désactiver les fonctionnalités d'exécution dynamique (eval, new Function) dans les validateurs | src/core/compilation/evalBlocker.ts | S | 5 | Nécessité de réécrire les validateurs d'expressions personnalisées sans moteur dynamique
0588. Émettre une alerte d'intégrité si l'empreinte Confluence ne correspond plus à l'empreinte gamme | src/core/freshness/desyncAlert.ts (GA-28) | S | 4 | Alertes intempestives lors d'éditions mineures de mise en page dans Confluence
0589. Exclure des logs CI toute trace de variables d'environnement secrètes ou sensibles | .github/workflows/ci.yml | S | 5 | Masquage de variables de build non secrètes gênant le débogage de la CI
0590. Révoquer les attestations d'étape en cas de modification concurrente de la session | src/core/locks/sessionConcurrency.ts | M | 4 | Déconnexion involontaire d'un opérateur lors d'un basculement réseau
0591. Bloquer les inclusions circulaires malveillantes lors de la composition de gammes GA-32 | src/core/compilation/compositionGuard.ts (GA-32) | S | 4 | Faux positifs sur des topologies de gammes complexes mais acycliques
0592. Signer numériquement le journal d'audit exporté pour garantir son inaltérabilité | src/core/audit/auditExporter.ts | M | 4 | Invalidation de signature si le format d'export subit une conversion de fin de ligne CRLF
0593. Interdire à l'agent Rovo de modifier unilatéralement le statut d'une gamme sans revue | src/integrations/rovo/rovoPermissionGuard.ts | S | 5 | Blocage de scénarios de démonstration automatisés pour le hackathon
0594. Valider l'extension et le type MIME réel des preuves binaires téléversées | src/core/proofs/mimeValidator.ts | S | 4 | Rejet de formats propriétaires de logs logiciels ou dumps binaires valides
0595. Purger les métadonnées EXIF et de géolocalisation des captures d'écran de preuve | src/core/proofs/exifStripper.ts | S | 4 | Corruption d'images compressées non standard lors de la réécriture des octets
0596. Forcer le re-verrouillage d'une gamme lors de l'invalidation d'un certificat d'auteur | src/core/compilation/certRevoker.ts | M | 3 | Indisponibilité immédiate de gammes critiques de production sans préavis
0597. Restreindre la délégation de signature d'étapes à des suppléants explicitement désignés | src/core/locks/delegationGuard.ts | M | 3 | Blocage opérationnel complet en cas d'absence imprévue de l'ensemble des suppléants
0598. Neutraliser les tags HTML et balises script lors du rendu Markdown des étapes | src/ui/renderer/markdownSanitizer.ts | S | 5 | Perte de mise en forme sur des snippets de code contenant des chevrons XML légitimes
0599. Auditer les dépendances npm via un job bloquant contre les CVE critiques en CI | .github/workflows/security-audit.yml | S | 4 | Blocage intempestif de la CI sur une CVE sans exploit avéré dans le code utilisé
0600. Limiter l'accès aux métriques d'atelier aux seuls utilisateurs autorisés de l'espace | src/ui/workshop/workshopAccess.ts | S | 3 | Visibilité restreinte limitant la prise de conscience des équipes sur la fraîcheur
0601. Vérifier la conformité du manifest Forge aux exigences de sécurité du marketplace Atlassian | manifest.yml | S | 4 | Risque de rejet de la soumission Codegeist si une permission facultative est oubliée
0602. Sceller l'état de la gamme en lecture seule dès le déclenchement du mode urgence | src/core/execution/emergencyLock.ts (GA-24) | S | 4 | Impossibilité de corriger une instruction erronée en plein milieu de crise
0603. Imposer un délai de grâce d'expiration sur les sessions d'exécution inactives | src/core/execution/sessionTimeout.ts | S | 3 | Perte du travail d'étape non sauvegardé par un opérateur interrompu dans son action
0604. Enregistrer dans l'audit chaque tentative infructueuse de levée de verrou de secret | src/core/secrets/secretAccessAudit.ts | S | 4 | Bruit d'audit excessif lors de retries automatiques de scripts mal configurés
0605. Valider l'intégrité de la chaîne de compilation Confluence-Gamme contre l'injection d'AST | src/core/compilation/astValidator.ts | M | 5 | Rejet de macros Confluence tierces complexes non répertoriées dans le parseur
0606. Interdire le chargement de modules dynamiques non signés dans les runners de tâches | src/core/execution/moduleLoader.ts | M | 5 | Impossibilité de brancher des extensions locales personnalisées sans recompilation
0607. Exiger l'horodatage certifié RFC 3161 pour sceller les approbations majeures de gamme | src/core/compilation/timestampSigner.ts | L | 3 | Dépendance externe envers une autorité d'horodatage pouvant ralentir la compilation
0608. Contrôler le périmètre de recherche de conflits pour empêcher l'exfiltration cross-gammes | src/core/conflict/scopeFence.ts | S | 4 | Non-détection de conflits réels entre gammes appartenant à des espaces distincts
0609. Isoler les jetons d'accès API Atlassian dans le contexte d'exécution backend Forge | src/platform/forge/tokenIsolation.ts | S | 5 | Échec d'authentification sur les requêtes asynchrones en arrière-plan sans user context
0610. Restreindre la modification du registre d'outils MCP aux seuls administrateurs déclarés | src/resolver/mcpResolver.ts | S | 4 | Retard dans la mise à disposition de nouveaux outils de diagnostic pour l'équipe
0611. Vérifier systématiquement que l'agent d'amendements GA-20 ne contourne pas GA-08 | src/core/amendments/agentBypassCheck.ts (GA-08) | S | 5 | Faux positif bloquant des propositions d'amendements améliorant la clarté du verrou
0612. Appliquer une politique de non-conservation des payloads bruts après extraction de preuve | src/core/proofs/payloadMinimizer.ts | S | 4 | Impossibilité de reconstituer le contexte exact d'une anomalie en cas de réclamation
0613. Valider la non-régression des règles de gouvernance via un jeu de tests d'intrusion dédié | tests/security/governanceFuzz.test.ts | M | 4 | Augmentation du temps de build CI au-delà du seuil strict des 5 minutes
0614. Forcer la journalisation de la raison de rejet lors d'une transition refusée par GA-25 | src/core/execution/rejectionLogger.ts (GA-25) | S | 4 | Réticence des utilisateurs à documenter le motif lors de blocages fréquents
0615. Révoquer les autorisations d'exécution d'une gamme lors de la détection d'une étape fantôme | src/core/freshness/ghostStepGuard.ts | S | 4 | Arrêt immédiat de procédures métier opérationnelles pour des divergences purement visuelles

## 11. UX et adoption du produit

0616. Guider la première compilation avec un calque d'accueil interactif | web/panels-overview.ts | M | 5 | Surcharger visuellement l'interface pour un utilisateur déjà expérimenté
0617. Illustrer l'état vide d'une page Confluence sans gamme par un extrait de syntaxe | src/ui/confluence-panel.ts | S | 4 | Proposer un squelette Markdown trop générique non adapté au contexte
0618. Styliser l'état vide du panneau Jira lorsqu'aucun run n'est lié au ticket | src/ui/jira-panel.ts | S | 3 | Confondre absence d'exécution et échec silencieux de détection de gamme
0619. Bannir l'usage de la couleur seule pour les statuts de désynchronisation | web/panels-surfaces.ts | S | 4 | Alourdir les cartes avec trop de pictogrammes redondants
0620. Afficher un motif hachuré distinctif pour le statut désynchronisé en mode daltonien | web/panels-overview.ts | S | 3 | Rendre la grille visuellement dense ou confuse sur petit écran
0621. Expliquer textuellement le motif exact d'un refus de verrou d'étape | src/core/engine/executor.ts | M | 5 | Divulguer des détails de sécurité sensibles dans le message d'erreur
0622. Structurer un panneau de remédiation guidée lors d'un échec de preuve | web/panels-trace.ts | M | 4 | Inciter l'utilisateur à contourner le verrou au lieu de corriger l'action
0623. Traduire le vocabulaire technique gamme/verrou/preuve dans une infobulle lexique | web/panels-overview.ts | S | 3 | Masquer des éléments cliquables sous les bulles d'aide contextuelles
0624. Différencier visuellement une gamme orpheline d'une gamme obsolète dans le registre | src/core/coverage.ts | M | 4 | Faux sentiment d'urgence sur des gammes stables rarement modifiées
0625. Proposer une action de réassignation de propriétaire en un clic sur gamme orpheline | web/panels-surfaces.ts | S | 4 | Assigner accidentellement un utilisateur sans son accord explicite
0626. Matérialiser la poussière procédurale par un compteur d'inactivité explicite | src/core/stats/workshop.ts | S | 3 | Stigmatiser des procédures de crise critiques mais rarement exécutées
0627. Masquer les toiles d'araignées derrière un filtre d'archive réversible | web/panels-surfaces.ts | M | 3 | Oublier définitivement des gammes de conformité réglementaire obligatoires
0628. Générer un résumé en langage naturel d'une gamme pour les lecteurs non-techniques | src/core/compiler/ast.ts | M | 4 | Simplifier à l'excès et omettre un verrou de sécurité humain capital
0629. Exposer l'estimation de durée d'exécution calculée dans la vue humaine de la gamme | web/panels-overview.ts | S | 3 | Induire en erreur si les données historiques sont sous le seuil d'échantillonnage
0630. Injecter un rappel textuel quand le recul statistique est insuffisant (<5 runs) | src/core/stats/workshop.ts | S | 4 | Décourager l'analyse de l'atelier sur des équipes débutantes
0631. Expliciter les causes d'une étape fantôme dans le rapport de santé de l'atelier | src/core/stats/workshop.ts | M | 4 | Proposer la suppression hâtive d'une étape de secours conditionnelle
0632. Alerter l'opérateur avec une bannière d'urgence accessible et contrastée WCAG AA | src/ui/confluence-panel.ts | S | 5 | Provoquer un stress visuel excessif lors d'un contournement justifié
0633. Afficher un guide pas-à-pas pour relier un espace Confluence vierge au premier run | docs/onboarding.md | S | 4 | Devenir obsolète lors de retouches du parcours d'installation Forge
0634. Rendre les contrastes de texte du tableau de preuves conformes au ratio 4.5:1 | web/tableau-preuves.ts | S | 3 | Réduire la compacité du tableau sur un affichage standard 1080p
0635. Proposer un sélecteur de persona (opérateur, scribe, auditeur) au premier lancement | web/panels-overview.ts | M | 4 | Cloisonner des fonctionnalités transverses derrière des vues rigides
0636. Ajouter des raccourcis clavier ARIA pour naviguer entre étapes lors d'un run | web/panels-trace.ts | M | 4 | Entrer en conflit avec les raccourcis natifs de Confluence ou du navigateur
0637. Signaler visuellement une gamme gelée en attente d'approbation humaine datée | web/panels-surfaces.ts | S | 4 | Bloquer l'opérateur sans afficher l'identité de l'approbateur attendu
0638. Afficher le diff unifié entre page Confluence et gamme lors d'un écart détecté | web/panels-diff.ts | L | 5 | Ralentir le chargement si la page Confluence comporte des milliers de lignes
0639. Notifier l'utilisateur de l'âge exact de la dérive entre page Confluence et gamme | src/core/sync/drift.ts | S | 4 | Créer une anxiété injustifiée sur un brouillon en cours de révision
0640. Récapituler les 3 actions prioritaires du lundi matin sur le tableau de bord atelier | src/core/stats/workshop.ts | M | 4 | Calculer des priorités non pertinentes sur des jeux de données réduits
0641. Uniformiser la dénomination des types de verrous dans toutes les chaînes UI | src/core/models/locks.ts | S | 3 | Casser la rétrocompatibilité des traductions ou tests d'intégration textuels
0642. Afficher une carte d'invitation à exécuter pour les tickets Jira nouvellement créés | src/ui/jira-panel.ts | M | 4 | Polluer les tickets hors périmètre logiciel ou purement organisationnels
0643. Rendre explicite le verrou de secret sans afficher la valeur masquée | src/ui/components/lock-badge.ts | S | 5 | Laisser fuiter le nom interne du secret dans l'attribut title du badge
0644. Prévisualiser les preuves attendues sous forme de gabarit avant d'exécuter l'étape | src/core/compiler/schema.ts | M | 3 | Complexifier l'écran avec trop de blocs de code préformatés
0645. Fournir un filtre de recherche floue par mot-clé pour le panneau d'exploration Rovo | src/integrations/search.ts | M | 4 | Renvoyer trop de faux positifs sur des noms de procédures similaires
0646. Présenter les métadonnées MCP de chaque gamme dans un onglet dédié à l'agent | web/panels-overview.ts | S | 3 | Confondre l'utilisateur humain avec du jargon destiné aux LLM
0647. Structurer le message de refus d'amendement avec justification obligatoire | src/core/amendments/engine.ts | M | 4 | Décourager les contributeurs de soumettre des retours d'échec d'étape
0648. Accompagner la création manuelle d'une gamme via un formulaire guidé sans code | web/panels-editor.ts | L | 4 | Créer une divergence de structure avec le compilateur AST officiel
0649. Ajouter un badge d'attestation d'immuabilité avec hash SHA-256 visible au survol | web/panels-trace.ts | S | 3 | Encombrer l'en-tête de run avec des identifiants hexadécimaux bruts
0650. Configurer un état de chargement skeleton accessible aux lecteurs d'écran | web/panels-overview.ts | S | 3 | Mal synchroniser la disparition du skeleton avec la fin du fetch Forge
0651. Fournir une vue chronologique des déviations subies lors d'une session de crise | web/panels-trace.ts | M | 4 | Rendre la vue illisible si un grand nombre de déviations mineures s'empilent
0652. Préciser le rôle exact manquant lors d'un échec de verrou de permis utilisateur | src/resolver/permissions.ts | S | 5 | Exposer l'organigramme interne des permissions à un utilisateur externe
0653. Proposer un export Markdown d'une gamme pour relecture hors ligne par un auditeur | src/core/export/markdown.ts | M | 3 | Encourager la désynchronisation en éditant le fichier hors de Confluence
0654. Afficher un taux de complétion global d'outillage des procédures de l'équipe | src/core/coverage.ts | S | 4 | Pousser à la création de gammes superficielles pour gonfler le score
0655. Alerter si un utilisateur tente de valider un formulaire avec une preuve vide | src/ui/components/proof-uploader.ts | S | 4 | Bloquer une procédure légitime ne nécessitant qu'une confirmation visuelle
0656. Mettre en exergue l'absence totale de traces d'exécution avec un bouton d'essai | web/panels-trace.ts | S | 4 | Déclencher un run réel en production au lieu d'une simulation sandbox
0657. Donner le choix entre vue compacte et vue détaillée pour les listes de gammes | web/panels-surfaces.ts | S | 3 | Doubler le travail de maintenance CSS sur les deux variantes de liste
0658. Expliciter les étapes skippables vs obligatoires avec des icônes explicites | src/ui/components/step-card.ts | S | 4 | Réduire la rigueur perçue des procédures si trop d'étapes semblent facultatives
0659. Documenter le rituel hebdomadaire de revue d'atelier dans un modèle Confluence | docs/workshop-guide.md | M | 4 | Créer une lourdeur cérémonielle rejetée par les équipes de développement
0660. Identifier les conflits potentiels entre gammes concurrentes dans l'atelier | src/core/stats/conflicts.ts | L | 4 | Générer de fausses alertes sur des gammes partageant des noms d'étapes usuels
0661. Indiquer la fraîcheur d'une gamme sous forme de temps relatif avec date absolue | src/core/stats/freshness.ts | S | 3 | Dépendre du fuseau horaire du client Forge mal configuré
0662. Harmoniser la terminologie entre le prompt système Rovo et l'interface humaine | src/integrations/rovo/agent.ts | S | 4 | Restreindre le vocabulaire naturel de l'agent lors de conversations libres
0663. Structurer un message d'erreur d'amendement automatique rejeté par le compilateur | src/core/compiler/validator.ts | M | 4 | Dérouter l'utilisateur avec des termes d'arbre syntaxique abstrait (AST)
0664. Ajouter un bandeau d'information lorsque Gammes fonctionne en mode bouchonné | web/panels-overview.ts | S | 3 | Provoquer un doute sur la fiabilité des données affichées lors d'une démo

## 12. Données, persistance et performance

0665. Indexer les exécutions par gamme et statut | src/platform/forge/schema.sql | S | 5 | Verrouillage de table temporaire lors de l'application de la migration DDL
0666. Partitionner logiquement les traces par espace Confluence | src/platform/forge/schema.sql | M | 5 | Requêtes cross-espaces plus complexes pour l'exigence GA-30
0667. Compacter le journal des événements de trace en instantané | src/core/trace/trace.ts | M | 4 | Perte de granularité temporelle fine en cas de reprise après incident
0668. Déporter les preuves binaires volumineuses vers Forge Storage | src/platform/forge/forge-sql.ts | L | 5 | Dépassement des quotas de transfert de l'API de stockage Forge
0669. Optimiser la requête d'agrégation des taux d'échec par étape | src/platform/forge/forge-sql.ts | M | 4 | Écart de calcul entre agrégats SQL pré-calculés et recalcul en mémoire
0670. Implémenter un cache LRU en mémoire pour l'AST compilé | src/platform/forge/forge-sql.ts | S | 4 | Invalidation manquée si la page Confluence change hors webhook
0671. Ajouter un index composite sur l'empreinte et l'âge de dérive | src/platform/forge/schema.sql | S | 3 | Augmentation de la taille de stockage d'index pour peu d'écritures
0672. Paginer par curseur opaque la liste des exécutions récentes | src/resolver/trace-resolver.ts | M | 4 | Incompatibilité ascendante avec les composants UI existants
0673. Sérialiser les traces en format JSON compressé zlib | src/core/trace/trace.ts | M | 4 | Surcoût CPU modéré lors des lectures fréquentes dans l'écran de déroulé
0674. Découper les gros états d'exécution pour respecter la limite 256 Ko | src/platform/forge/forge-sql.ts | L | 5 | Risque d'incohérence si l'un des fragments échoue à persister
0675. Pré-calculer la métrique de fraîcheur dans une table dérivée | src/platform/forge/schema.sql | M | 4 | Risque de désynchronisation en cas de crash du worker asynchrone
0676. Valider l'idempotence des scripts de migration de schéma | src/platform/forge/schema.sql | S | 5 | Échec du démarrage de l'app si un dialecte Forge SQL strict rejette IF NOT EXISTS
0677. Mettre en cache les permissions et verrous humains vérifiés | src/platform/forge/forge-sql.ts | S | 3 | Tolérance de latence sur la révocation immédiate d'un droit utilisateur
0678. Nettoyer les traces de brouillon non finalisées vieilles de 7 jours | src/resolver/maintenance-resolver.ts | S | 3 | Suppression accidentelle d'une trace d'urgence suspendue
0679. Définir des bornes strictes VARCHAR sur les identifiants et hashs | src/platform/forge/schema.sql | S | 2 | Tronquage silencieux si un futur algorithme de hash change de taille
0680. Optimiser la sérialisation des déviations dans la trace | src/core/trace/trace.ts | S | 4 | Régression sur la conformité de l'export d'audit réglementaire
0681. Implémenter un verrou optimiste via numéro de version | src/platform/forge/forge-sql.ts | M | 5 | Rejet conflictuel plus fréquent en cas d'accès concurrents sur la même trace
0682. Isoler strictement les tenants via une clé organisationnelle forcée | src/core/ports.ts | M | 5 | Fuite de données si un port bouchonné omet le filtre tenantId
0683. Mettre en place un plan d'archivage annuel des exécutions archivées | src/resolver/maintenance-resolver.ts | L | 4 | Complexité de consultation des audits froids depuis l'UI
0684. Réduire la charge utile du composant de déroulé d'étape | src/ui/run-view.tsx | S | 4 | Nécessité de requêtes complémentaires pour afficher les détails d'erreur
0685. Ajouter un index partiel sur les gammes marquées actives | src/platform/forge/schema.sql | S | 3 | Non support des index partiels selon la version exacte de Forge SQL
0686. Batcher les insertions d'étapes lors de la compilation | src/platform/forge/forge-sql.ts | M | 4 | Dépassement de la taille maximale autorisée par paquet SQL Forge
0687. Détecter les étapes fantômes par jointure gauche optimisée | src/platform/forge/forge-sql.ts | M | 3 | Temps d'exécution élevé si la table d'événements n'est pas partitionnée
0688. Mesurer la latence P95 des requêtes SQL via un wrapper de port | src/platform/forge/forge-sql.ts | S | 3 | Bruit télémétrique excessif si tous les pings sont enregistrés
0689. Remplacer les requêtes N+1 de l'atelier par un GROUP BY unique | src/platform/forge/forge-sql.ts | M | 5 | Complexité accrue du mapping vers les structures TypeScript du domaine
0690. Mettre en cache la table de correspondance empreinte-gamme | src/resolver/compile-resolver.ts | S | 4 | Dérive fantôme si Confluence modifie l'empreinte sans notification
0691. Tronquer intelligemment la preuve brute affichée dans le tableau | src/ui/evidence-table.tsx | S | 3 | Tronquage de données critiques si le format de preuve est binaire
0692. Normaliser les statuts d'exécution sous forme d'énumérations entières | src/platform/forge/schema.sql | S | 2 | Perte de lisibilité lors du débogage direct par requête SQL brute
0693. Implémenter une stratégie de reprise sur timeout de transaction Forge | src/platform/forge/forge-sql.ts | M | 4 | Risque de blocage prolongé en cas de boucle de réessais agressive
0694. Différer la mise à jour des statistiques de l'atelier hors du chemin chaud | src/resolver/trace-resolver.ts | M | 4 | Affichage temporairement décalé des compteurs dans l'UI atelier
0695. Limiter la taille maximale d'un payload d'amendement suggéré | src/core/trace/trace.ts | S | 3 | Rejet injustifié d'une proposition d'amendement structurel volumineuse
0696. Éliminer les lectures redondantes lors de l'évaluation des verrous | src/resolver/execution-resolver.ts | S | 4 | Utilisation d'un état de verrou périmé si un autre acteur valide en parallèle
0697. Créer un index sur la clé composite gamme_id et version | src/platform/forge/schema.sql | S | 4 | Ralentissement marginal des insertions de nouvelles versions de gamme
0698. Alléger le payload JSON de l'arbre d'exécution exporté | src/core/trace/trace.ts | M | 3 | Incompatibilité de schéma lors de l'import dans un outil tiers
0699. Mettre en place un pool virtuel de connexions réutilisables | src/platform/forge/forge-sql.ts | M | 3 | Gestion manuelle délicate du cycle de vie sous l'environnement serverless
0700. Exclure les champs de preuve lourds des listes de synthèse | src/platform/forge/forge-sql.ts | S | 5 | Nécessite un second appel réseau pour consulter une preuve ciblée
0701. Valider l'intégrité référentielle des étapes orphelines par contrainte SQL | src/platform/forge/schema.sql | S | 4 | Blocage d'insertions légitimes si l'ordre d'écriture est asynchrone
0702. Découper la compilation des très longues pages en micro-tâches | src/resolver/compile-resolver.ts | L | 4 | Risque d'incohérence si une sous-tâche de compilation échoue
0703. Mémoriser les métadonnées de macro Confluence en cache mémoire | src/platform/forge/forge-sql.ts | S | 3 | Risque de fuite mémoire si la taille du cache n'est pas bornée
0704. Définir un format binaire compact pour l'export citable de trace | src/core/trace/trace.ts | M | 3 | Dépendance externe nécessaire pour le décodage hors plateforme Forge
0705. Établir une politique de rétention configurable par espace Confluence | src/resolver/maintenance-resolver.ts | M | 3 | Risque de non-conformité si un espace écrase la durée légale par erreur
0706. Remplacer les SELECT * résiduels par des projections explicites | src/platform/forge/forge-sql.ts | S | 4 | Oubli d'un champ requis après refactorisation d'une structure core
0707. Ajouter une table d'audit immuable avec hachage chaîné | src/platform/forge/schema.sql | M | 5 | Ralentissement de chaque écriture de trace pour calculer le hash chaîné
0708. Détecter automatiquement les conflits de gammes par requête matricielle | src/platform/forge/forge-sql.ts | L | 4 | Explosion combinatoire sur les espaces contenant plus de cent gammes
0709. Optimiser la désérialisation du modèle de trace pour l'UI | src/ui/run-view.tsx | S | 3 | Erreurs de parsing non gérées si des champs optionnels manquent
0710. Gérer la migration douce des données lors du passage à GA-30 | src/platform/forge/forge-sql.ts | L | 4 | Incohérence momentanée entre espaces partageant les mêmes gammes
0711. Supprimer les doublons d'événements de reprise dans le store | src/core/trace/trace.ts | S | 3 | Masquage accidentel d'une réelle séquence d'hésitation humaine
0712. Créer une table de compteurs atomiques pour éviter les COUNT(*) | src/platform/forge/schema.sql | M | 4 | Désynchronisation possible des compteurs lors de rollbacks inattendus
0713. Sauvegarder l'état courant de l'exécution à chaque validation d'étape | src/resolver/execution-resolver.ts | S | 5 | Multiplication du nombre d'écritures SQL par parcours de gamme
0714. Filtrer les statistiques atelier dès la requête selon le seuil de recul | src/platform/forge/forge-sql.ts | S | 4 | Risque de masquer des anomalies graves survenant sur des gammes récentes
0715. Éviter le rechargement complet de la gamme lors d'un simple acquittement | src/resolver/execution-resolver.ts | S | 4 | Décalage visuel si un verrou distant s'est déclenché simultanément
0716. Implémenter un mécanisme de purge des brouillons d'amendements rejetés | src/resolver/maintenance-resolver.ts | S | 2 | Perte de traçabilité sur les idées d'amélioration refusées par l'équipe
0717. Mesurer l'empreinte de sérialisation JSON des traces en CI | .github/workflows/ci.yml | S | 3 | Faux positifs de CI si les données de test générées fluctuent
0718. Indexer la table des déviations par étape et date | src/platform/forge/schema.sql | S | 4 | Augmentation modérée de l'empreinte disque de la base Forge SQL
0719. Remplacer la sérialisation récursive par une itérative sans dépassement de pile | src/core/trace/trace.ts | M | 4 | Complexité de maintenance du code de parcours d'arbre
0720. Factoriser le schéma relationnel entre gammes simples et gammes composées GA-32 | src/platform/forge/schema.sql | M | 4 | Réécriture nécessaire des requêtes existantes de déroulé simple
0721. Optimiser le format de stockage des verrous de secrets d'exécution | src/platform/forge/schema.sql | S | 4 | Révélation accidentelle de métadonnées de secret dans les logs SQL
0722. Prévérifier les quotas de requêtes Forge SQL avant transactions lourdes | src/platform/forge/forge-sql.ts | S | 3 | Faux blocage d'une exécution si l'API d'estimation de quota est imprécise
0723. Diffuser les invalidations de cache via Forge Events | src/platform/forge/forge-sql.ts | M | 4 | Latence de propagation de l'événement créant une fenêtre de lecture sale
0724. Structurer les logs de trace pour un export streaming sans buffer complet | src/core/trace/trace.ts | M | 4 | Gestion d'erreur asynchrone complexe si le client interrompt le flux
0725. Isoler les requêtes analytiques de l'atelier sur un port en lecture seule | src/core/ports.ts | S | 3 | Risque d'interblocage évité mais duplication mineure du code de connexion
0726. Minifier les schémas JSON stockés dans la table de métadonnées | src/platform/forge/forge-sql.ts | S | 2 | Coût CPU de minification à chaque mise à jour de gamme
0727. Réindexer périodiquement les tables d'historique de déviation | src/platform/forge/schema.sql | S | 2 | Indisponibilité brève possible sur les bases SQL mutualisées Forge
0728. Protéger l'écran de déroulé contre les saccades par chargement différé des preuves | src/ui/run-view.tsx | S | 4 | Expérience dégradée si l'utilisateur clique rapidement sur une étape non prête
0729. Valider la cohérence des empreintes de page Confluence sans recalcul complet | src/resolver/compile-resolver.ts | M | 4 | Risque de faux nég

## 13. Phase 2 et différenciation (§ 33)

0730. Générer un script Bash exécutable idempotent depuis l'AST | src/core/exporters/cli-bash.ts | M | 4 | Incompatibilité de syntaxe entre shells POSIX et Bash spécifique
0731. Compiler la gamme en flux de transitions Jira avec validateurs de champs | src/core/exporters/jira-workflow.ts | L | 4 | Complexité de l'API de configuration des workflows Jira Cloud
0732. Exporter une checklist interactive Confluence au format ADF natif | src/core/exporters/confluence-storage.ts | M | 3 | Perte d'interactivité dynamique si la page Confluence n'est pas modifiable
0733. Produire un SKILL.md autonome prêt pour agents Rovo et assistants locaux | src/core/exporters/skill-md.ts | S | 5 | Désynchronisation entre les types JSON schema et la syntaxe SKILL.md
0734. Packager un bundle de 16 outils MCP typés depuis les étapes de la gamme | src/integrations/mcp/tool-builder.ts | M | 5 | Explosion du contexte JSON-RPC si les descriptions d'étapes sont verbeuses
0735. Générer un workflow GitHub Actions déclenchant les vérifications d'étape | src/core/exporters/github-actions.ts | M | 3 | Risque d'injection dans les expressions de variables dynamiques
0736. Exporter un diagramme d'états Mermaid annoté des verrous et preuves | src/core/exporters/mermaid.ts | S | 3 | Diagramme illisible sur des gammes excédant 15 étapes ou bifurcations
0737. Compiler un fichier de test Postman/Bruno validant les endpoints d'une gamme | src/core/exporters/api-collection.ts | S | 2 | Endpoints cibles non disponibles en environnement d'exécution local
0738. Générer des snippets VS Code interactifs pour saisie des preuves en local | src/core/exporters/vscode-snippets.ts | S | 2 | Maintien fastidieux des snippets lors des montées de version d'IDE
0739. Générer un conteneur d'exécution Dockerfile avec dépendances de vérification | src/core/exporters/dockerfile.ts | M | 3 | Poids excessif de l'image de base pour des tests légers
0740. Calculer les propositions de réordonnancement basées sur l'ordre réel des traces | src/core/learner/reorder-suggest.ts | M | 4 | Faux positifs causés par des exécutions dégradées en mode urgence
0741. Détecter et suggérer la fusion d'étapes consécutives à latence nulle | src/core/learner/fusion-suggest.ts | M | 3 | Perte de granularité sur les preuves intermédiaires requises
0742. Inférer des étapes manquantes depuis les justifications textuelles de déviation | src/core/learner/step-inference.ts | L | 4 | Hallucinations lors de l'extraction sémantique des commentaires de trace
0743. Détecter les étapes fantômes jamais exécutées pour proposer leur suppression | src/core/learner/dead-steps.ts | S | 4 | Suppression d'étapes de sécurité dormantes prévues pour cas rares
0744. Émettre des brouillons d'amendements versionnés avec approbation humaine obligatoire | src/core/models/amendment.ts | S | 5 | Contournement du workflow d'approbation si l'UI masque les diffs
0745. Calculer un score de confiance statistique sur les suggestions d'amendement | src/core/learner/confidence.ts | M | 3 | Biais statistique si l'échantillon d'exécutions est inférieur à 10 traces
0746. Fournir un simulateur de rejeu des traces passées sur un amendement proposé | src/core/learner/dry-run-simulator.ts | L | 4 | Coût CPU du simulateur en cas de volume massif de traces d'exécution
0747. Classer les échecs par clusters de similarité lexicale des erreurs levées | src/core/learner/failure-clusters.ts | M | 3 | Regroupement erroné d'erreurs ayant le même code mais des causes distinctes
0748. Restreindre l'application des amendements aux seuls propriétaires de la gamme | src/resolver/gamme-resolver.ts | S | 4 | Blocage des améliorations si le propriétaire initial a quitté l'équipe
0749. Définir le schéma JSON des post-conditions exécutables par étape | src/core/models/post-condition.ts | S | 5 | Schémas trop permissifs ne détectant pas les états d'échec subtils
0750. Exécuter des sondes HTTP automatisées pour vérifier les post-conditions | src/core/verifier/http-probe.ts | M | 4 | Timeout ou faux négatifs sur des cibles réseau non accessibles par Forge
0751. Valider l'état d'un ticket Jira comme post-condition de validation d'étape | src/core/verifier/jira-field-probe.ts | M | 4 | Désynchronisation de cache si le ticket Jira est modifié hors processus
0752. Contrôler l'empreinte SHA-256 d'une pièce jointe Confluence comme preuve | src/core/verifier/attachment-hash.ts | S | 4 | Échec de validation si l'encodage du fichier est altéré à l'upload
0753. Vérifier une assertion CQL Confluence après mise à jour de la documentation | src/core/verifier/cql-probe.ts | M | 3 | Latence d'indexation du moteur CQL de Confluence Cloud
0754. Déclencher une alerte d'intégrité si une post-condition échoue silencieusement | src/core/verifier/alert-dispatcher.ts | S | 4 | Tempête de notifications en cas d'incident d'infrastructure généralisé
0755. Consigner les résultats de vérification dans un registre immuable de preuves | src/core/models/evidence-ledger.ts | M | 5 | Saturation du stockage Forge App Storage lors de preuves volumineuses
0756. Sceller cryptographiquement chaque trace d'exécution avec l'ID de gamme | src/core/verifier/crypto-attestation.ts | S | 4 | Dégradation des performances lors de signatures en série côté backend
0757. Modéliser le triplet de temps standard (optimiste, modal, pessimiste) par étape | src/core/models/gamme.ts | S | 4 | Saisie arbitraire déconnectée de la réalité par manque de repères
0758. Calculer automatiquement les percentiles P50/P90 de durée depuis les traces | src/core/metrics/duration-distribution.ts | M | 4 | Pollution des métriques par des sessions laissées ouvertes en pause
0759. Filtrer les sessions aberrantes lors du calcul du temps standard d'étape | src/core/metrics/outlier-filter.ts | S | 3 | Élimination à tort de sessions d'incident réel ayant nécessité un délai
0760. Prédire le dépassement de SLA en cours d'exécution selon l'allure courante | src/core/engine/sla-predictor.ts | M | 3 | Fausse alerte si l'étape la plus longue est simplement traitée en fin de flux
0761. Générer une estimation de charge pour le planificateur Jira issue | src/platform/jira-client.ts | M | 3 | Conflit avec les champs d'estimation natifs Jira (Story Points vs Heures)
0762. Restituer visuellement l'allure d'avancement par étape dans l'UI d'exécution | src/ui/components/PaceIndicator.tsx | S | 3 | Interface surchargée pour l'opérateur en situation de stress opérationnel
0763. Exposer la fourchette de durée restante dans les métadonnées d'outil MCP | src/integrations/mcp/tool-builder.ts | S | 3 | Incompréhension des modèles LLM sur la distinction P50 vs P90
0764. Reconstruire une gamme candidate à partir des événements Jira et git observés | src/core/learner/reverse-compiler.ts | L | 5 | Bruit causé par des actions parasites non liées à la procédure ciblée
0765. Calculer la distance structurelle (diff AST) entre gamme écrite et pratiquée | src/core/learner/ast-diff.ts | M | 4 | Complexité de calcul exponentielle si l'ordre des étapes est chaotique
0766. Colorer une page Confluence selon l'écart entre le texte et les faits réels | src/platform/confluence-client.ts | M | 4 | Altération du rendu Confluence ADF si les macros ne sont pas supportées
0767. Fournir un prompt système Rovo pour synthétiser une gamme inversée | src/integrations/rovo/prompts.ts | S | 4 | Non-reproductibilité des synthèses Rovo selon les versions du modèle
0768. Identifier les contournements récurrents de verrous humains dans les traces | src/core/learner/bypass-detector.ts | M | 5 | Risque de stigmatisation si l'audit n'est pas strictement anonymisé
0769. Détecter les flux Jira parallèles non documentés dans la gamme Confluence | src/platform/jira-client.ts | M | 3 | Permissions insuffisantes pour scanner tous les projets Jira liés
0770. Proposer un assistant de réconciliation pas-à-pas gamme écrite vs observée | src/ui/screens/ReconciliationWizard.tsx | L | 4 | Découragement de l'utilisateur devant un nombre excessif d'écarts
0771. Émettre un score de dérive documentaire basé sur la gamme inversée | src/core/metrics/drift-score.ts | S | 4 | Baisse artificielle du score lors de phases d'expérimentation légitimes
0772. Vérifier la validité d'un permis nominatif via le client permis-forge | src/integrations/permis/permis-client.ts | M | 5 | Panne réseau rendant permis-forge indisponible au moment de l'action
0773. Lier le permis d'exécution à l'empreinte SHA-256 de la version de la gamme | src/integrations/permis/verifier.ts | S | 5 | Invalidation involontaire des permis lors d'une simple correction de typo
0774. Bloquer l'exécution d'une étape critique si le rôle requis n'est pas certifié | src/core/engine/executor.ts | S | 5 | Blocage total d'une astreinte de nuit si aucun titulaire n'est joignable
0775. Gérer l'expiration d'un permis en cours d'exécution d'une étape longue | src/integrations/permis/session-guard.ts | S | 3 | Déconnexion brutale de l'opérateur en plein milieu d'une manipulation
0776. Afficher une modale de demande d'habilitation expresse vers permis-forge | src/ui/components/PermitRequestModal.tsx | M | 3 | Multiplication des requêtes inutiles si le validateur est absent
0777. Enregistrer les délégations temporaires de permis dans le journal de trace | src/core/models/trace.ts | S | 4 | Risque de non-répudiation contestée si l'identité n'est pas scellée
0778. Bloquer l'accès aux outils MCP si le contexte d'appel n'a pas le permis requis | src/integrations/mcp/permis-guard.ts | M | 5 | Erreurs opaques renvoyées au client MCP sans explication actionnable
0779. Ingérer le brief produit de brief-forge pour renseigner les entrées de gamme | src/integrations/portfolio/brief-adapter.ts | M | 3 | Désalignement de structure si le brief produit évolue sans préavis
0780. Vérifier l'état de gel documentaire placard-wiki avant toute modification | src/integrations/portfolio/placard-adapter.ts | S | 4 | Blocage d'une publication urgente de gamme par un placard oublié
0781. Corréler les échecs de builds deja-vu-ci avec les étapes déviées d'une gamme | src/integrations/portfolio/deja-vu-adapter.ts | M | 4 | Faux positifs liant un bug logiciel indépendant à une déviation d'étape
0782. Consulter delegable-ou-pas pour recommander une exécution humaine ou agent | src/integrations/portfolio/delegable-adapter.ts | M | 4 | Mauvaise appréciation du risque si le contexte opérationnel est imprévu
0783. Détecter les collisions de chantiers-en-collision sur les ressources cibles | src/integrations/portfolio/collision-adapter.ts | M | 5 | Interblocage mutuel entre deux gammes nécessitant le même environnement
0784. Notifier vigie en cas de blocage prolongé d'une gamme en cours d'exécution | src/integrations/portfolio/vigie-adapter.ts | S | 4 | Inondation du canal d'astreinte si le seuil de délai est trop bas
0785. Ancrer les attestations de preuve dans l'archive immuable de preuve-a-l-appui | src/integrations/portfolio/preuve-adapter.ts | M | 5 | Latence d'ancrage dégradant le ressenti interactif de l'opérateur
0786. Déclarer le bus d'événements unifié du portefeuille d'applications Forge | src/integrations/portfolio/event-bus.ts | L | 4 | Conflits de schéma d'événements entre applications maintenues séparément
0787. Intégrer les liens profonds contextuels vers les apps sœurs dans l'UI atelier | src/ui/screens/AtelierScreen.tsx | S | 3 | Rupture de navigation si une app sœur n'est pas installée sur le site
0788. Fusionner les journaux d'audit de Gammes et de permis-forge pour conformité | src/platform/storage.ts | M | 4 | Volume de données excédant les quotas de Forge App Storage
0789. Publier une gamme sur le registre central de savoir-faire inter-espaces | src/platform/teamwork-graph.ts | L | 4 | Fuite accidentelle d'instructions confidentielles hors de l'espace source
0790. Importer un package de gamme vérifié avec validation de schéma strict | src/core/compiler/package-importer.ts | M | 4 | Exécution de code malveillant si des scripts arbitraires sont injectés
0791. Calculer l'indice de maturité d'une gamme selon sa densité de preuves | src/core/metrics/maturity-index.ts | S | 4 | Biais valorisant les gammes bureaucratiques au détriment des gammes agiles
0792. Afficher le catalogue visuel des savoir-faire dans l'UI globale Forge | src/ui/screens/CatalogueScreen.tsx | M | 3 | Lenteur d'affichage en cas de catalogue dépassant plusieurs centaines d'items
0793. Gérer le fork et la réconciliation amont des gammes entre départements | src/core/compiler/fork-sync.ts | L | 4 | Conflits de fusion insolubles sur des arbres d'étapes trop divergents
0794. Anonymiser les métriques de fiabilité pour publication dans le benchmark interne | src/core/metrics/anonymizer.ts | S | 4 | Réidentification possible des équipes par croisement des horaires de trace
0795. Indexer les gammes dans Teamwork Graph selon les compétences requises | src/platform/teamwork-graph.ts | M | 3 | Schémas de nœuds Teamwork Graph expérimentaux sujets à dépréciation
0796. Afficher l'écran interactif de benchmark face aux runbooks Confluence natifs | web/screens/BenchmarkComparison.tsx | S | 5 | Réaction défensive des utilisateurs attachés à leurs pages Confluence libres
0797. Fournir un bouton d'audit express vérifiant l'intégrité pour le jury Codegeist | web/screens/JuryAuditDemo.tsx | S | 5 | Échec inattendu en live démo si l'environnement bouchonné est désynchronisé
0798. Chiffrer le gain ROI en heures économisées entre le temps réel et théorique | src/core/metrics/roi-calculator.ts | S | 4 | Calculs de rentabilité contestés par le management si le salaire horaire varie
0799. Générer un rapport d'audit PDF/JSON scellé téléchargeable en un clic | src/core/exporters/audit-report.ts | M | 4 | Rendu PDF instable dans l'environnement d'exécution contraint de Forge
0800. Différencier l'agent Rovo Gammes par l'obligation de preuve formelle d'étape | src/integrations/rovo/guardrails.ts | M | 5 | Lenteur perçue de l'agent Rovo forcé d'attendre la validation de preuve
0801. Permettre le rejeu hors-ligne interactif d'une exécution de crise sur GitHub Pages | web/screens/OfflineReplay.tsx | S | 5 | Divergence entre le simulateur statique web et le runtime Forge réel

## 14. Les bonus du hackathon et ce qui fait gagner des points au jury

0802. Scénariser l'action Rovo « Exécuter Gamme » avec confirmation bloquante | src/integrations/rovo/action-runner.ts | S | 5 | Rovo contourne la validation en mode conversationnel libre
0803. Publier la définition de l'agent Rovo « Auditeur de Gamme » dans manifest.yml | manifest.yml | S | 4 | Rejet du manifest si les scopes d'actions Rovo changent
0804. Générer automatiquement un prompt système Rovo ancré sur la gamme compilée | src/integrations/rovo/prompt-builder.ts | M | 4 | Prompt trop volumineux dépassant la limite de contexte
0805. Brancher la détection de dérive Confluence directement dans l'agent Rovo | src/integrations/rovo/drift-detector.ts | M | 5 | Faux positifs d'incohérence texte sur des modifications cosmétiques
0806. Exposer un outil Rovo pour réclamer une preuve d'étape manquante | src/integrations/rovo/proof-requester.ts | S | 4 | Blocage de la conversation si l'utilisateur n'a pas de fichier sous la main
0807. Valider les filtres de contexte Jira dans l'action Rovo de transition | src/integrations/rovo/jira-context.ts | S | 3 | Divergence d'état entre Jira et le runtime Gammes
0808. Ajouter le déclenchement Rovo sur incident P1 pour injecter la gamme d'astreinte | src/integrations/rovo/incident-trigger.ts | M | 5 | Spam d'invocations sur faux incidents P1
0809. Simuler la conversation Rovo complète dans la démo statique GitHub Pages | web/screens/rovo-chat-simulator.ts | M | 5 | Décalage visuel avec l'interface réelle d'Atlassian Rovo
0810. Exporter le SKILL.md standardisé depuis le compilateur pour Claude et Cursor | src/core/skill-exporter.ts | S | 5 | Schéma SKILL.md incompatible avec de futures versions d'outils tiers
0811. Packager les 16 outils MCP sous forme de binaire CLI standalone distribuable | src/integrations/mcp/cli-server.ts | M | 4 | Dépendances Node.js lourdes pour un simple runner local
0812. Implémenter l'outil MCP `execute_step` avec vérification stricte du verrou secret | src/integrations/mcp/tools/execute-step.ts | M | 5 | Fuite involontaire du payload secret dans les logs MCP
0813. Fournir un runner de tests d'intégration vitest vérifiant la conformité des 16 outils MCP | vitest.config.ts | S | 4 | Faux sentiment de couverture si les mocks MCP masquent les erreurs RPC
0814. Diffuser un repo GitHub modèle « gammes-community-skills » avec des gammes réutilisables | docs/skills/sample-release-skill.md | S | 4 | Éparpillement des compétences sans gouvernance centralisée
0815. Connecter les relations de Gammes vers les entités Jira dans le Teamwork Graph | src/platform/teamwork-graph-client.ts | M | 4 | Schéma d'arêtes non supporté par la version de l'API GraphQL Teamwork
0816. Émettre l'événement `gamme_executed` vers Teamwork Graph pour matérialiser la conformité | src/integrations/teamwork-graph/event-emitter.ts | M | 4 | Latence d'ingestion Teamwork Graph faussant les démos en direct
0817. Lier automatiquement les Jira epics et Confluence pages via Teamwork Graph (GA-31) | src/core/teamwork-binder.ts | L | 4 | Droits d'accès transverses refusés sur l'organisation cliente
0818. Rédiger le fichier manifest.yml Marketplace avec icônes, tags et captures conformes | manifest.yml | S | 4 | Rejet lors de l'examen de sécurité automatisé d'Atlassian
0819. Créer une vidéo de 3 minutes axée sur le refus d'exécution sans preuve | docs/demo/video-script-3min.md | M | 5 | Vidéo trop touffue masquant la proposition de valeur principale
0820. Insérer une bannière de statut Marketplace « Cloud Fortified Candidate » dans l'UI Forge | src/ui/components/marketplace-badge.tsx | S | 3 | Allégation trompeuse pénalisée par le jury Atlassian
0821. Générer la page de politique de confidentialité et de rétention zéro secret | docs/legal/privacy-policy.md | S | 3 | Mentions légales non adaptées au RGPD pour une app Forge
0822. Polir le thème Design System Atlassian avec @atlaskit/tokens dans chaque écran | src/ui/theme/tokens.ts | M | 4 | Conflits de styles CSS injectés par Confluence
0823. Construire un composant visuel de tableau de bord d'atelier sans métriques individuelles | src/ui/screens/workshop-dashboard.tsx | M | 4 | Risque de réintroduction indirecte de métriques de performance nominatives
0824. Ajouter un composant de comparaison visuelle côte à côte page Confluence vs Gamme | src/ui/components/diff-viewer.tsx | M | 5 | Ralentissement du rendu sur les diffs de documents Confluence géants
0825. Créer une micro-animation d'empreinte cryptographique lors du scellement d'une version | src/ui/components/version-badge.tsx | S | 4 | Animation bloquant le fil d'exécution de l'UI
0826. Illustrer l'absence de recul statistique par un badge pédagogique transparent | src/ui/components/confidence-pill.tsx | S | 4 | Confusion des utilisateurs novices sur le sens du badge
0827. Structurer l'arborescence des erreurs selon les codes RFC 7807 dans l'API Forge | src/resolver/errors.ts | S | 4 | Messages d'erreur trop techniques pour un utilisateur métier
0828. Prouver la contrainte <500 lignes et <50 lignes par fonction via un script CI strict | .github/workflows/lint-metrics.yml | S | 4 | Blocage de la CI sur des refactorisations urgentes avant la deadline
0829. Isoler les 30 exigences M/S dans une suite de tests unitaires taggés pour le jury | vitest.config.ts | S | 4 | Redondance de tests ralentissant la CI au-delà des 5 minutes
0830. Rendre le moteur de compilation déterministe au bit près avec seed immuable | src/core/compiler.ts | M | 5 | Instabilité sur l'ordonnancement non déterministe des clés JSON
0831. Concevoir le scénario « Avant/Après » : la release catastrophe devenue anodine | docs/demo/before-after-story.md | S | 5 | Récit trop long diluant l'impact technique
0832. Développer l'écran de confrontation « La gamme a dit NON » en cas de preuve invalide | src/ui/screens/execution-refused.tsx | M | 5 | Frustration utilisateur si la cause du refus n'est pas évidente
0833. Implémenter l'amendement interactif issu d'un échec récurrent sur l'étape 3 | src/core/amendment-suggester.ts | M | 5 | Suggestion de modifications circulaires ou incohérentes
0834. Simuler l'incident majeur où le « Mode Urgence » est débrayé sous double signature | src/core/emergency-override.ts | M | 5 | Risque de contournement non auditable si la signature échoue
0835. Mettre en scène la désynchronisation Confluence en modifiant un titre en direct | web/screens/drift-live-demo.ts | S | 5 | Échec du webhook en démo directe nécessitant un rafraîchissement
0836. Afficher un résumé de valeur en 10 secondes sur l'écran d'accueil Forge | src/ui/screens/ten-second-pitch.tsx | S | 5 | Surcharge d'informations sur mobile ou petits écrans
0837. Câbler la vérification cryptographique des preuves téléversées (hachage SHA-256) | src/core/proof-hasher.ts | S | 4 | Incompatibilité de l'API crypto native Forge sur certains runtimes
0838. Restreindre strictement la publication d'amendement à une validation humaine datée | src/core/amendment-validator.ts | S | 5 | Blocage complet si l'approbateur désigné est absent du tenant
0839. Traquer les étapes fantômes dans les gammes pour nettoyer les vieilles procédures | src/core/ghost-steps-detector.ts | M | 4 | Détection erronée d'étapes conditionnelles légitimes mais rares
0840. Fournir une visite guidée interactive de 28 étapes en mode sandbox hors-ligne | web/guided-demo.ts | L | 5 | Désynchronisation entre le code réel de l'app et les mocks du parcours guidé
0841. Packager l'extension Jira Issue Panel affichant le statut de certification de la release | src/ui/jira/release-panel.tsx | M | 4 | Temps de chargement de l'iframeForge sur les tickets Jira chargés
0842. Bloquer la transition Jira « Done » si la gamme associée n'est pas exécutée à 100% | src/platform/jira-workflow-validator.ts | M | 5 | Blocage intempestif d'équipes de dev en pleine release d'urgence
0843. Référencer le fichier de métadonnées SKILL.md dans le référentiel des outils Rovo | src/integrations/rovo/skill-reference.ts | S | 4 | Désalignement de version entre SKILL.md et le code compilé
0844. Générer un audit trail exportable en JSON immuable pour conformité SOC2 / ISO 27001 | src/core/audit-exporter.ts | S | 4 | Fichier JSON volumineux dépassant les quotas de mémoire Forge
0845. Matérialiser visuellement les verrous de sécurité actifs (humain, secret, licence) | src/ui/components/lock-indicators.tsx | S | 4 | Confusion entre verrous bloquants et simples prérequis informatifs
0846. Écrire le test d'acceptation simulant l'injection de code malveillant dans Confluence | src/core/compiler-sanitizer.test.ts | S | 4 | Échappement incomplet sur des syntaxes Confluence Storage Format exotiques
0847. Afficher l'indicateur d'âge de dérive entre Confluence et la gamme déployée | src/ui/components/drift-age.tsx | S | 4 | Horloge client désynchronisée faussant l'âge affiché
0848. Intégrer un bouton de rollback instantané vers la version de gamme précédente | src/core/version-rollback.ts | M | 5 | Restauration d'une version obsolète réintroduisant une vulnérabilité
0849. Ajouter un filtre de recherche cross-gammes détectant les étapes concurrentes | src/core/conflict-detector.ts | M | 4 | Faux conflits sur des libellés d'étapes banals comme « Valider »
0850. Déployer un mock local zéro latence pour la soutenance vidéo sans réseau | web/static-backend-mock.ts | M | 5 | Masquage de bogues asynchrones propres à l'environnement Atlassian Forge
0851. Valider le comportement du runtime face à un certificat de secret révoqué | src/core/secret-vault.ts | S | 4 | Crash inattendu si le message d'erreur du vault est mal intercepté
0852. Démonstration de l'auto-réparation : l'amendement transforme une étape manuelle en script | docs/demo/auto-repair-scenario.md | S | 5 | Proposition d'automatisation irréaliste générée par le système
0853. Bloquer toute tentative de modification directe de la gamme sans passer par Confluence | src/core/write-barrier.ts | S | 5 | Sentiment de rigidité excessive chez les développeurs pressés
0854. Configurer un rapport visuel de non-régression de l'atelier pour le reviewer Forge | docs/reviewer-guide.md | S | 4 | Le jury survole la documentation sans exécuter le pas-à-pas
0855. Implémenter l'alerte Rovo proactive quand une gamme critique approche de sa péremption | src/integrations/rovo/freshness-alert.ts | M | 4 | Notification perçue comme un spam si le seuil est trop agressif
0856. Découper les gros états d'exécution en checkpoints sérialisés pour reprise sur crash | src/core/execution-checkpoints.ts | M | 5 | Incohérence d'état si le checkpoint est écrit pendant une coupure réseau
0857. Concevoir l'animation de déblocage d'un verrou humain par approbation cryptographique | src/ui/components/approval-modal.tsx | S | 3 | Modal non responsive sur petits écrans
0858. Exposer une commande slash Confluence `/gamme-compile` pour compiler in situ | src/integrations/confluence/slash-command.ts | M | 4 | Erreur de rendu si le template Confluence contient des macros non supportées
0859. Tracer l'écart de conformité dans l'audit sans enregistrer le nom de l'opérateur | src/core/anonymized-trace.ts | S | 4 | Difficulté d'audit interne si l'anonymisation est totale sans UID hashé
0860. Démontrer l'auto-amélioration par l'historique des gains de temps réels observés | src/ui/screens/improvement-history.tsx | M | 5 | Biais d'interprétation si les conditions d'exécution changent
0861. Verrouiller la CI GitHub Actions avec échec si un mock n'a pas de test associé | .github/workflows/mock-integrity.yml | S | 4 | Alerte intempestive lors de l'ajout rapide de stubs de prototypage
0862. Optimiser la taille du bundle Forge UI sous la limite stricte de 5 Mo d'Atlassian | manifest.yml | S | 4 | Compression supprimant des sourcemaps indispensables au débogage
0863. Présenter dans la démo l'erreur exacte : « Refus : Secret manquant sur étape 4 » | web/screens/error-secret-missing.ts | S | 5 | Le spectateur peut croire à un bug de l'application
0864. Fournir une vue « Matrice de conformité » exportable en SVG pour les Comités de Direction | src/ui/screens/matrix-export.tsx | M | 4 | Dégradation de mise en page SVG sur les rapports très larges
0865. Lier le cycle de vie de la gamme à l'état de déploiement Jira Service Management | src/platform/jsm-change-link.ts | M | 4 | Incompatibilité d'API entre les versions Cloud et Enterprise de JSM
0866. Créer le panneau d'avertissement de désynchronisation persistant sur Confluence | src/integrations/confluence/drift-banner.tsx | S | 5 | Cécité aux bannières de la part des rédacteurs de documentation
0867. Vérifier par test de mutation (Stryker) la solidité du compilateur de gammes | vitest.config.ts | M | 3 | Temps d'exécution du test de mutation explosant la contrainte CI ≤5 min
0868. Démontrer un scénario de composition de deux gammes distinctes sans cycle (GA-32) | src/core/range-composer.ts | L | 4 | Explosion combinatoire lors de la validation des graphes d'appels
0869. Implémenter l'exportation vers un autre espace Confluence distant sécurisé (GA-30) | src/platform/cross-space-publisher.ts | L | 3 | Fuite de données vers un espace aux permissions moins restrictives
0870. Documenter la matrice comparative « Gammes vs Scripts CI/CD vs Confluence seul » | docs/marketing/differentiation-matrix.md | S | 5 | Argumentation perçue comme condescendante envers les outils existants
0871. Présenter le tableau des preuves avec aperçu interactif des pièces téléversées | src/ui/screens/proof-ledger.tsx | M | 5 | Rendu des miniatures d'images ou logs bruts saturant le navigateur
0872. Afficher l'indicateur d'impact potentiel : réduction estimée de 80% des post-mortems | docs/pitch/impact-metrics.md | S | 4 | Suspicion de chiffres inventés non étayés par des métriques d'atelier
0873. Simuler en vidéo une validation de reprise après panne à l'étape exacte d'échec | docs/demo/video-resumption-scene.md | S | 5 | Démonstration paraissant scriptée si la reprise est instantanée

## 15. L'agenda des cinq semaines avant le 22 décembre

0874. Geler le périmètre en documentant l'abandon formel de GA-30, GA-31 et GA-32 | docs/decisions/ADR-014-scope-cut-codegeist.md | S | 5 | Frustration interne sur les fonctionnalités non livrées
0875. Configurer les variables d'environnement de staging Forge | .github/workflows/forge-deploy.yml | S | 4 | Fuite accidentelle de jeton d'authentification CI
0876. Tenter le premier déploiement forge deploy en développement sur tenant réel | manifest.yml | M | 5 | Rejet complet du manifest par l'API Forge CLI
0877. Créer le wrapper d'isolation Confluence avec bascule automatique sur mock | src/platform/confluence-client.ts | M | 4 | Désynchronisation des types entre mock et API réelle
0878. Créer le wrapper d'isolation Jira pour basculer sur les mocks locaux | src/platform/jira-client.ts | M | 4 | Incohérence des payloads d'issues Jira simulées
0879. Implémenter le commutateur Plan B d'activation des mocks distants | src/platform/environment.ts | S | 5 | Activation involontaire des mocks en production
0880. Verrouiller la suite des 238 tests vitest comme barrière infranchissable en CI | .github/workflows/ci.yml | S | 5 | Blocage des PR légitimes par faux positif de couverture
0881. Auditer la taille du compilateur pour respecter le seuil des 500 lignes | src/core/compiler.ts | S | 3 | Découpage artificiel réduisant la lisibilité
0882. Ajouter un smoke test de déploiement d'app Forge minimale | tests/smoke/forge-install.test.ts | M | 4 | Dépendance externe flaky dans la pipeline CI
0883. Auditer les scopes OAuth Atlassian déclarés pour éliminer le superflu | manifest.yml | S | 4 | Révocation d'un scope critique bloquant les appels UI
0884. Purger les traces d'exécution de tout champ sensible ou jeton temporaire | src/core/execution-tracer.ts | S | 4 | Omission d'une métadonnée d'en-tête HTTP
0885. Mesurer et borner le temps d'exécution CI sur le runner self-hosted r630 | .github/workflows/ci.yml | S | 3 | File d'attente saturée lors des pushes simultanés
0886. Valider le jalon J-35 (23 nov) de décision go/no-go sur le tenant Forge | docs/status/milestones.md | S | 5 | Persistance obstinée sur un tenant non fonctionnel
0887. Automatiser l'interdiction des fonctions de plus de 50 lignes via ESLint | .eslintrc.cjs | S | 3 | Refactoring de masse déstabilisant le code stable
0888. Activer le tunnel local Forge pour déboguer le resolver d'appels UI | src/resolver/index.ts | M | 4 | Déconnexion intempestive du tunnel WebSocket
0889. Valider l'enregistrement unitaire des 16 outils MCP | src/integrations/mcp-server.ts | M | 5 | Incompatibilité de schéma JSON avec le client MCP
0890. Tester la conformité du contrat d'exportation du fichier de compétences | src/integrations/skill-generator.ts | S | 4 | Format Markdown non interprété par les agents Rovo
0891. Configurer la déclaration formelle de l'agent Rovo dans le manifest | manifest.yml | M | 5 | Rejet du schéma agent par la version 13.9.0 de Forge
0892. Brancher la détection de désynchronisation sur l'empreinte sha256 de page | src/core/fingerprint.ts | M | 4 | Faux positifs de désynchronisation dus aux retours chariot
0893. Ajouter les tests de non-régression sur l'âge de l'écart de synchronisation | tests/unit/fingerprint.test.ts | S | 3 | Tests sensibles au décalage d'horloge système
0894. Remplacer l'atelier visuel par une vue tabulaire simplifiée | src/ui/workshop-metrics.tsx | M | 4 | Dégradation de l'attrait graphique pour le jury
0895. Sécuriser les métriques d'atelier pour bannir toute statistique par personne | src/core/workshop-analyzer.ts | S | 5 | Violation d'une contrainte non négociable du projet
0896. Coder le script d'application de schéma de stockage Forge Storage | src/core/storage-migrator.ts | M | 4 | Corruption irrémédiable de l'état persistant des gammes
0897. Créer le script de retour arrière immédiat de migration de schéma | scripts/rollback-storage.ts | M | 4 | Script non testé échouant lors d'une vraie panne
0898. Ajuster la concurrence Mergify pour limiter la charge de revue | .mergify.yml | S | 3 | Ralentissement excessif de la file d'intégration
0899. Borner les interventions de l'agent de conflits InferHub sur les PRs | .github/inferhub-rules.json | S | 2 | Conflits non résolus bloquant la file Mergify
0900. Exporter le tableau de preuves interactif pour le site de secours | web/screens/proof-table.html | S | 4 | Divergence de style avec l'interface Confluence
0901. Valider le jalon J-28 (30 nov) sur l'état opérationnel du serveur MCP | docs/status/milestones.md | S | 5 | Report de diagnostic masquant une défaillance critique
0902. Rédiger le script chronométré de 3 minutes pour la vidéo officielle | docs/submission/video-script.md | M | 5 | Dépassement de la durée imposée par le règlement
0903. Mapper les 28 étapes de la démo guidée sur le storyboard de démonstration | web/guided-demo.js | S | 4 | Déconnexion entre le scénario vidéo et le code de démo
0904. Implémenter l'étiquette « pas assez de recul » sous le seuil de 5 runs | src/core/workshop-analyzer.ts | S | 4 | Mauvais calcul sur les jeux de données limites
0905. Écrire le test unitaire validant la détection des étapes fantômes | tests/unit/workshop-analyzer.test.ts | S | 3 | Non-détection des étapes renommées entre versions
0906. Créer le composant de visualisation des échecs sans donnée nominative | src/ui/step-failure-card.tsx | S | 3 | Dépassement de la limite des 50 lignes par composant
0907. Verrouiller le mécanisme d'immuabilité des versions publiées | src/core/gamme-versioning.ts | M | 5 | Écrasement accidentel d'une version validée
0908. Bloquer toute publication dépourvue d'approbation humaine datée | src/core/approval-gate.ts | S | 5 | Bypass logique dans le flux de compilation directe
0909. Couvrir la gestion du mode urgence par des assertions strictes | tests/unit/emergency-execution.test.ts | M | 4 | Échec de capture des déviations en mode dégradé
0910. Supprimer les résidus de code liés aux exigences C du modèle de données | src/core/types.ts | S | 3 | Rupture de typage TypeScript dans les resolvers
0911. Optimiser les caches de dépendances pour maintenir la CI sous 5 minutes | .github/workflows/ci.yml | S | 3 | Invalidation fréquente annulant le gain de cache
0912. Figer le format des propositions d'amendements issues des échecs | src/core/amendment-generator.ts | M | 4 | Amendements générés syntaxiquement invalides
0913. Revalider la stricte conformité du manifest après nettoyage des modules | scripts/validate-manifest.js | S | 4 | Incompatibilité silencieuse détectée trop tard
0914. Produire le jeu de captures d'écran de l'extension pour le dossier | docs/submission/screens/ | S | 3 | Captures obsolètes après retouche de l'interface
0915. Valider le jalon J-21 (07 déc) du scénario vidéo validé et tests au vert | docs/status/milestones.md | S | 5 | Écriture du code non alignée sur la vidéo enregistrée
0916. Capturer les séquences d'exécution de gamme dans l'interface Confluence | docs/submission/raw-footage/ | M | 4 | Artefacts visuels ou temps de chargement trop longs
0917. Enregistrer la session MCP en direct avec Claude Desktop | docs/submission/raw-footage/mcp-demo.mp4 | M | 5 | Erreur d'exécution de commande en plein enregistrement
0918. Monter l'audio et poser la voix-off rythmée avec sous-titres anglais | docs/submission/gammes-demo-cut.mp4 | L | 5 | Audio inaudible ou débit trop rapide pour le jury
0919. Exécuter un stress-test de migration de données sur 100 gammes simulées | tests/integration/storage-migration.test.ts | M | 3 | Dépassement de mémoire sur le runner r630
0920. Vérifier le fonctionnement autonome hors-ligne du site GitHub Pages | web/index.html | S | 5 | Dépendance CDN externe bloquée par un pare-feu
0921. Mettre à jour les 20 écrans statiques de la galerie de démonstration | web/screens/ | M | 4 | Écrans affichant des données mockées contradictoires
0922. Compacter le bundle de l'interface Forge pour respecter la limite de taille | src/ui/index.tsx | M | 4 | Dépendance transitive faisant exploser le bundle web
0923. Restreindre la file Mergify à un traitement strictement séquentiel | .mergify.yml | S | 3 | Ralentissement des intégrations de dernière minute
0924. Lancer un balayage automatisé des secrets sur l'historique git | .github/workflows/security.yml | S | 5 | Découverte tardive d'un token imposant un rebase
0925. Tester la reprise après échec partiel et enregistrement des preuves | src/core/execution-engine.ts | M | 4 | Perte de la trace des étapes déjà validées
0926. Tenter le déploiement de pré-production sur environnement Forge distant | manifest.yml | M | 5 | Échec d'autorisation OAuth sur l'instance cible
0927. Harmoniser le README avec le lien de secours GitHub Pages et la doc MCP | README.md | S | 4 | Jury suivant des instructions d'installation erronées
0928. Rédiger le premier jet du texte d'impact Software Teams pour Devpost | docs/submission/devpost-draft.md | M | 5 | Discours trop technique masquant la valeur métier
0929. Valider le jalon J-14 (14 déc) du premier rendu vidéo complet finalisé | docs/status/milestones.md | S | 5 | Absence de vidéo complète à une semaine du terme
0930. Contrôler la grille de conformité des exigences du hackathon Codegeist | docs/submission/criteria-checklist.md | S | 5 | Disqualification sur un critère formel ignoré
0931. Raccourcir le texte de soumission pour respecter les quotas de caractères | docs/submission/devpost-draft.md | S | 3 | Suppression d'arguments clés pour les jurés
0932. Exécuter la répétition générale de la démo de bout en bout sur machine vierge | docs/status/dry-run.md | M | 4 | Échec de démarrage du serveur MCP sans cache npm
0933. Réduire les suites de tests unitaires lentes sans baisser la couverture | tests/unit/compiler.test.ts | S | 3 | Faux sentiment de rapidité masquant des régressions
0934. Vérifier le traçage bidirectionnel entre ticket Jira et gamme exécutée | src/integrations/jira-gamme-linker.ts | M | 4 | Erreur 404 lors du rappel de l'URL de gamme
0935. Supprimer toute référence d'URL de tenant privé dans le template SKILL.md | src/integrations/skill-generator.ts | S | 4 | Révélation d'informations d'infrastructure privée
0936. Téléverser la vidéo finale sur YouTube en non-répertoriée avec chapitres | docs/submission/video-link.txt | S | 5 | Traitement HD YouTube non terminé avant la clôture
0937. Activer la protection stricte interdisant tout push direct sur main | .github/workflows/branch-protection.yml | S | 4 | Push destructeur écrasant la version de release
0938. Valider le jalon J-3 (19 déc) du gel total du code source applicatif | docs/status/milestones.md | S | 5 | Tentative de correctif de dernière minute risquée
0939. Exécuter l'ultime passe de validation complète sur le tag de release | .github/workflows/ci.yml | S | 5 | Échec inattendu d'un test vitest sur node clean
0940. Remplir les champs du formulaire Devpost en mode brouillon sécurisé | docs/submission/devpost-draft.md | S | 4 | Perte de session entraînant la perte des champs
0941. Contrôler l'accessibilité publique de tous les liens web et vidéo | web/index.html | S | 5 | Vidéo privée ou page GitHub Pages retournant une 404
0942. Poser le tag git immuable v1.0.0-codegeist sur le commit vérifié | package.json | S | 5 | Tag posé sur un commit non testé par la CI
0943. Générer l'archive miroir complète des 20 écrans statiques et de la démo | docs/submission/gammes-snapshot.zip | S | 4 | Fichiers d'assets JavaScript manquants dans le zip
0944. Transmettre la soumission officielle sur la plateforme Devpost | docs/submission/devpost-draft.md | S | 5 | Panne de serveur Devpost dans la dernière heure
0945. Archiver l'accusé de réception officiel de la soumission Codegeist 2026 | docs/submission/confirmation-receipt.pdf | S | 3 | Absence de preuve de dépôt horodatée en cas de litige

## 16. Le transversal et l'après-hackathon

0946. Figer les règles de non-chevauchement des PR apprises par InferHub | .github/inferhub-rules.json | S | 4 | Faux positifs bloquant des PR urgentes
0947. Détecter les merges hors fuseau de travail dans la file Mergify | .github/mergify.yml | S | 3 | Décrochage de merge queue en période d'astreinte
0948. Isoler le générateur SKILL.md dans un package npm autonome sous Apache-2.0 | src/integrations/rovo/skill-generator.ts | M | 5 | Divergence entre le spec MCP interne et le format public
0949. Calculer l'empreinte carbone et coût d'invocation Forge Cloud Compute | src/platform/forge-cost-tracker.ts | M | 4 | Sous-estimation des invocations asynchrones Teamwork Graph
0950. Modéliser la grille tarifaire Atlassian Marketplace au-delà du palier gratuit | docs/monetization/pricing-tiers.md | S | 4 | Tarification dissuasive pour les PME sur Confluence Standard
0951. Auditer les dépendances pour conformité stricte SPDX et licence MIT transitive | .github/workflows/license-compliance.yml | S | 3 | Blocage légal par une sous-dépendance copyleft (GPL)
0952. Formaliser le runbook de reprise après incident pour équipe tierce | docs/runbooks/operator-handbook.md | M | 5 | Procédure obsolète dès la mise à jour du manifest Forge
0953. Intégrer un dictionnaire de traduction pour les 20 écrans de l'UI | web/src/locales/fr-en-de.json | M | 4 | Régression visuelle sur les tableaux de preuves étroits
0954. Adapter le schéma de gamme aux exigences de traçabilité DORA et PCI-DSS | src/core/gamme-schema.ts | L | 5 | Alourdissement du modèle pour les équipes hors secteur financier
0955. Ajouter l'export attesté FDA 21 CFR Part 11 avec horodatage RFC 3161 | src/core/compliance/audit-pack-exporter.ts | L | 4 | Complexité de signature cryptographique sans HSM distant
0956. Restreindre la portée des PR touchant le compilateur Confluence vers gamme | .github/workflows/ci.yml | S | 3 | Frustration des contributeurs face aux rejets automatiques
0957. Mesurer l'utilisation CPU et mémoire réelle sur le runner r630 bare-metal | .github/scripts/bench-runner.sh | S | 3 | Biais de mesure si d'autres conteneurs tournent en parallèle
0958. Packager les 16 outils MCP en binaire CLI local via stdio | src/integrations/mcp/cli-server.ts | M | 5 | Incompatibilité de transport entre stdio et Server-Sent Events
0959. Monitorer la consommation des Forge Storage Quotas par org | src/platform/forge-storage-adapter.ts | M | 4 | Blocage brutal en production lors d'un pic d'exécutions
0960. Définir le contrat d'interface pour sous-traiter la maintenance L3 | docs/architecture/handover-contract.md | S | 4 | Manque de granularité sur les responsabilités d'astreinte
0961. Découper les modules Confluence UI pour internationaliser les libellés | src/ui/confluence-macro.tsx | M | 3 | Conflits de re-rendu Forge UI Kit lors du changement de langue
0962. Bloquer les merges Mergify pendant la fenêtre d'interdiction de gel Codegeist | .github/mergify.yml | S | 4 | Retard de merge pour un correctif critique de dernière minute
0963. Tracer les amendements rejetés pour calibrer la roadmap de version 2 | src/core/amendments/stats-collector.ts | M | 4 | Bruit statistique causé par des erreurs de saisie utilisateur
0964. Encadrer les contributions open source via guide CONTRIBUTING.md strict | CONTRIBUTING.md | S | 3 | Découragement des contributeurs externes par des linters stricts
0965. Configurer un kill-switch dynamique pour les requêtes Rovo trop coûteuses | src/integrations/rovo/rate-limiter.ts | M | 4 | Dégradation de l'expérience utilisateur lors de pics de charge
0966. Générer une matrice d'alignement ISO 9001:2015 depuis l'atelier de mesures | src/core/metrics/iso9001-report.ts | M | 4 | Rapport contesté lors d'un audit de conformité réel
0967. Structurer le multi-tenant pour scinder les données de test et de prod | src/platform/tenant-context.ts | L | 5 | Fuite d'état entre tenants lors d'invocations concurrentes
0968. Ajouter un test de charge simulant 500 exécutions d'urgence simultanées | tests/stress/emergency-burst.test.ts | M | 4 | OOM killer déclenché sur le runner r630
0969. Publier une démo interactive WebAssembly sans backend Forge actif | web/public/wasm-gammes-runtime.js | L | 5 | Divergence d'exécution entre le runtime Wasm et Forge V8
0970. Établir une politique de rétention et purge des preuves conformes RGPD | src/core/execution/proof-retention-job.ts | M | 4 | Suppression accidentelle de preuves requises pour un litige
0971. Mettre en place un pipeline de canary release sur tenant Atlassian pilote | .github/workflows/deploy-canary.yml | L | 4 | Absence de tenant Atlassian de staging fourni gratuitement
0972. Alerter sur Slack/Discord lors du décrochage de la file Mergify | .github/scripts/mergify-watchdog.py | S | 3 | Faux positifs fréquents en cas de mise en attente normale
0973. Définir un catalogue d'extensions partenaires pour outils CI/CD tiers | docs/ecosystem/partner-plugins.md | S | 3 | Éparpillement des efforts hors du coeur Jira/Confluence
0974. Interdire le scope changeant dans les PR via linter de conventional commits | .github/workflows/commit-lint.yml | S | 3 | Rejets massifs des PR issues de contributeurs occasionnels
0975. Intégrer un estimateur de facture mensuelle Forge dans l'écran d'atelier | src/ui/atelier-billing-summary.tsx | M | 4 | Décalage entre l'estimation locale et la facture Atlassian
0976. Documenter l'arbre décisionnel pour l'adoption d'une gamme par une BU | docs/governance/gamme-adoption-matrix.md | S | 3 | Rejet par les équipes habituées aux wikis libres non structurés
0977. Formaliser l'export HL7/FHIR pour le suivi des procédures biomédicales | src/integrations/health/fhir-audit.ts | L | 3 | Coût de maintenance d'un schéma normatif très verbeux
0978. Créer un mock server Forge offline pour tester sans authentification cloud | src/platform/mock-forge-runtime.ts | M | 5 | Désynchronisation avec les évolutions d'API Forge officielles
0979. Évaluer le Net Promoter Score et temps moyen d'exécution d'une gamme | src/core/metrics/kpi-evaluator.ts | M | 4 | Métriques biaisées si les utilisateurs contournent l'outil
0980. Mettre à jour manifest.yml pour supporter l'installation inter-organisations | manifest.yml | M | 5 | Risque de failles de sécurité lors de partages transverses
0981. Rédiger le plan de reprise d'activité (PRA) lors d'une panne Atlassian Cloud | docs/runbooks/disaster-recovery.md | S | 4 | Impossibilité de garantir le RPO en cas de blackout Atlassian
0982. Automatiser la détection des dérives sémantiques dans les PR de doc | .github/workflows/doc-semantic-drift.yml | S | 2 | Alertes intempestives sur des changements stylistiques mineurs
0983. Factoriser le contrat MCP dans un standard ouvert soumis à ModelContextProtocol | docs/standards/mcp-gammes-spec.md | M | 5 | Refus de standardisation par les instances de gouvernance MCP
0984. Implémenter le switch de devise et taxes régionales pour abonnements Jira | src/platform/monetization-tax.ts | M | 3 | Complexité légale sur la TVA intracommunautaire et Stripe
0985. Dériver une gamme industrielle pour chaîne de production ISO 26262 | docs/use-cases/automotive-iso26262.md | M | 3 | Inapplicabilité sans capteurs IoT physiques connectés
0986. Imposer la signature GPG obligatoire sur tous les commits post-hackathon | .github/workflows/gpg-enforce.yml | S | 3 | Blocage de contributeurs n'ayant pas configuré de clé GPG
0987. Extraire les métriques clés de déploiement réel sous format OpenTelemetry | src/platform/opentelemetry-exporter.ts | M | 4 | Surcharge de la CI et dépendances externes lourdes
0988. Refactoriser les 238 tests pour découpler la logique métier de Vitest | tests/core/runtime-agnostic.test.ts | M | 3 | Risque de régression silencieuse pendant la migration
0989. Traduire les prompts du Rovo Agent en allemand, japonais et espagnol | src/integrations/rovo/prompts/i18n-prompts.json | M | 4 | Hallucinations accrues du modèle sur les langues non-anglaises
0990. Créer un tableau de bord Grafana pour visualiser les déviations en vol | docs/observability/grafana-dashboard.json | S | 3 | Données sensibles de processus exposées dans des dashboards
0991. Rédiger la politique de gestion des vulnérabilités et divulgation coordonnée | SECURITY.md | S | 4 | Afflux de signalements non pertinents de scanners automatisés
0992. Calculer le seuil de rentabilité par utilisateur actif mensuel (MAU) | docs/monetization/mau-breakeven.md | S | 4 | Hypothèses trop optimistes sur le volume d'invocations Rovo
0993. Mettre en place un simulateur de panne réseau Confluence dans les tests | tests/chaos/confluence-disconnect.test.ts | M | 4 | Flaky tests introduits dans la suite de CI rapide de 5 min
0994. Auditer l'absence totale de métriques individuelles pour conformité CSE | src/core/metrics/anti-surveillance-guard.ts | S | 5 | Fuite indirecte de productivité via les horodatages d'étapes
0995. Séparer le dépôt en monorepo Core, Forge App et Connecteur MCP | .github/workflows/split-monorepo.yml | L | 4 | Rupture brutale de l'historique git et complexification de la CI
0996. Documenter la stratégie de reprise du projet par un repreneur industriel | docs/governance/succession-plan.md | S | 4 | Manque d'implication des repreneurs sans garantie de support
0997. Mesurer la dégradation de performance de l'UI en cas de 10 000 exécutions | web/src/benchmarks/dom-render.bench.ts | M | 3 | Lenteur sur les machines clients d'entrée de gamme
0998. Créer une passerelle de notification webhook vers PagerDuty et Opsgenie | src/integrations/alerts/incident-webhook.ts | M | 4 | Tempête d'alertes lors d'exécutions d'urgence en cascade
0999. Éliminer les dates hardcodées apprises comme interdites par InferHub | src/resolver/gamme-date-sanitizer.ts | S | 4 | Blocage injustifié de plages calendaires de maintenance
1000. Concevoir un programme de bêta-test fermé pour dix DSI partenaires | docs/community/beta-program-pilot.md | S | 4 | Demandes de fonctionnalités contradictoires fragmentant le core
1001. Remplacer les ports Confluence bouchonnés par un adaptateur GraphQL réel | src/platform/confluence-graphql-port.ts | L | 5 | Incompatibilité de schémas selon les versions Confluence Cloud
1002. Optimiser les assets SVG et bundles JS pour respecter le quota Forge 5MB | web/vite.config.ts | S | 4 | Dépassement silencieux de la taille maximale de l'UI custom
1003. Imposer un délai de grâce de 48h sur les suppressions de gammes obsolètes | src/core/lifecycle/tombstone-handler.ts | S | 4 | Accumulation de données zombies dans le Forge Storage
1004. Publier une charte d'utilisation éthique interdisant les procédures d'armement | ETHICS.md | S | 3 | Risque juridique sur l'interprétation des clauses d'usage
1005. Structurer les logs JSON pour ingestion sans filtre dans Datadog/Splunk | src/platform/logger.ts | S | 4 | Coût élevé d'ingestion de logs verbeux en production
1006. Implémenter l'isolation des secrets d'étapes via Forge Encrypted Storage | src/platform/encrypted-secrets-vault.ts | M | 5 | Perte d'accès définitive en cas de rotation de clés Atlassian
1007. Comparer les performances d'exécution Rovo Agent vs CLI MCP stdio | docs/benchmarks/rovo-vs-mcp-latency.md | S | 3 | Dépendance aux variations de latence de l'API OpenAI/Atlassian
1008. Écrire le protocole de qualification logicielle GAMP 5 pour l'industrie pharma | docs/compliance/gamp5-validation.md | L | 4 | Charge documentaire disproportionnée par rapport au hackathon
1009. Vérifier la stricte atomicité des transactions d'amendements approuvés | src/core/amendments/atomic-committer.ts | M | 5 | État corrompu si l'approbation humaine survient pendant un redémarrage
1010. Préparer le pitch deck investisseur pour spin-off post-hackathon | docs/business/seed-deck-structure.md | S | 3 | Perte de focus sur la valeur technique open source
1011. Bloquer l'élargissement de scope dans Mergify si plus de 5 fichiers changent | .github/mergify.yml | S | 3 | Obligation de découper artificiellement des refactorings propres
1012. Créer un connecteur d'ingestion de gammes depuis des référentiels Word/PDF | src/integrations/importers/doc-parser.ts | L | 4 | Taux élevé d'erreurs de parsing sur des documents non formatés
1013. Exposer un endpoint de healthcheck exhaustif pour orchestrateurs Kubernetes | src/platform/healthz-endpoint.ts | S | 3 | Exposition involontaire de détails d'architecture interne
1014. Définir le cycle de vie semver des gammes indépendant de l'app Gammes | docs/architecture/versioning-policy.md | S | 4 | Confusion des opérateurs entre version du schéma et version de procédure
1015. Développer un outil CLI pour synchroniser un dossier local de gammes avec Confluence | src/integrations/cli/sync-local-gammes.ts | M | 4 | Conflits de concurrence bidirectionnels écrasant des modifications
1016. Réduire le temps de cold start des fonctions résolveurs sous 200ms | src/resolver/cold-start-optimizer.ts | M | 4 | Complexification du bootstrapping avec cache mémoire instable
1017. Organiser une revue de code croisée avec l'équipe Core Atlassian Forge | docs/governance/atlassian-architect-review.md | S | 5 | Refus ou délai de disponibilité des architectes Atlassian post-concours

## 17. Idées de refonte du produit

1018. Renommer « gamme » en « contrat opérationnel » typé | src/core/models/gamme.ts | S | 3 | Confusion sémantique pour les utilisateurs habitués au vocabulaire Confluence classique
1019. Remplacer la notion de procédure par celle de « runbook réversible » | src/core/models/step.ts | M | 4 | Complexité d'imposer une étape de rollback obligatoire à chaque action
1020. Définir l'unité centrale comme un « protocole d'habilitation » éphémère | src/core/models/gamme.ts | M | 3 | Restriction du produit aux seuls cas d'usage de sécurité et d'accès
1021. Abandonner le terme gamme pour « scénario de crise » unifié | docs/glossary.md | S | 2 | Réduction perçue du champ d'application aux seuls incidents majeurs
1022. Remplacer la procédure séquentielle par un contrat d'invariants système | src/core/compiler/validator.ts | L | 4 | Vérification statique difficile sans moteur formel lourd
1023. Adopter le modèle « playbooks exécutables » aligné sur Ansible/Terraform | src/integrations/mcp/server.ts | M | 3 | Risque de dériver vers un outil d'infrastructure plutôt qu'un outil d'équipe
1024. Transformer l'unité en « recette de livraison logicielle certifiée » | src/core/compiler/ast.ts | S | 3 | Spécialisation excessive vers la release logicielle au détriment des opérations
1025. Structurer l'unité sous forme d'une « clause de service interne » (SLA opérationnel) | src/core/metrics/stats.ts | M | 3 | Résistance culturelle des équipes face à une contractualisation rigide
1026. Remplacer le tableau linéaire d'étapes par un graphe orienté acyclique (DAG) | src/core/compiler/ast.ts | L | 5 | Explosion de la complexité du moteur d'exécution et de l'UI de suivi
1027. Supporter les embranchements conditionnels évalués par prédicats MCP | src/core/engine/runner.ts | L | 4 | Risque de non-déterminisme lors des exécutions partiellement déconnectées
1028. Implémenter l'exécution parallèle d'étapes indépendantes avec synchronisation | src/core/engine/runner.ts | L | 4 | Conditions de course lors de l'enregistrement des preuves dans le stockage Forge
1029. Remplacer la vue liste de l'atelier par un visualiseur de graphe interactif | src/ui/atelier/App.tsx | M | 4 | Dépassement potentiel des quotas de bundle frontend Forge Custom UI
1030. Compiler les clauses « En cas d'erreur » en branches de rattrapage explicites | src/core/compiler/parser.ts | M | 4 | Pages sources Confluence rendues illisibles si la syntaxe de branchement est lourde
1031. Ajouter des points de jonction stricts nécessitant un consensus multi-signatures | src/core/engine/runner.ts | M | 3 | Blocage prolongé de l'exécution en attente d'approbateurs absents
1032. Détecter automatiquement les cycles et impasses lors de la compilation du graphe | src/core/compiler/validator.ts | S | 3 | Faux positifs bloquants sur des motifs complexes intentionnels
1033. Permettre le saut en avant contrôlé (« fast-forward ») basé sur graphe d'états | src/core/engine/deviation.ts | M | 3 | Risque de contournement non tracé d'étapes de sécurité critiques
1034. Élever la preuve au rang d'entité autonome dotée de son propre cycle de vie | src/core/models/proof.ts | M | 5 | Surcoût de stockage et de jointures dans Forge KVS
1035. Créer un « classeur de preuves scellé » exportable en archive signée | src/platform/forge/storage.ts | L | 5 | Limite stricte de taille des blobs et mémoire serveur dans Atlassian Forge
1036. Exiger une contre-preuve contradictoire pour chaque validation critique | src/core/models/proof.ts | S | 3 | Frustration utilisateur accrue face au dédoublement des saisies
1037. Intégrer un mécanisme d'horodatage notarié RFC 3161 pour chaque preuve | src/core/engine/runner.ts | M | 4 | Dépendance réseau externe interdite par les runtimes Forge isolés
1038. Transformer le tableau de preuves en explorateur forensique d'audit | web/demo/index.html | M | 4 | Interface trop dense masquant la progression en temps réel
1039. Valider cryptographiquement la chaîne des empreintes de preuves successives | src/core/engine/runner.ts | M | 4 | Perte de performance sur les gammes dépassant plusieurs dizaines d'étapes
1040. Attacher des artefacts multimédias (vidéos de logs, dumps JSON) comme preuves | src/integrations/jira/client.ts | M | 3 | Épuisement rapide des quotas de stockage pièces jointes Jira
1041. Permettre l'invalidation a posteriori d'une preuve avec révocation en chaîne | src/core/models/execution.ts | L | 4 | Remise en cause de l'immutabilité fondamentale de l'exécution
1042. Inverser le flux : capturer les commandes bash/CLI pour synthétiser la gamme | src/integrations/mcp/server.ts | L | 5 | Injection involontaire de tokens ou secrets sensibles dans la synthèse
1043. Observer passivement les résolutions de tickets Jira pour induire des patterns | src/integrations/jira/client.ts | L | 4 | Inférence de règles bruitées à partir de comportements humains irréguliers
1044. Miner les historiques Git pour proposer automatiquement des gammes de release | src/core/compiler/parser.ts | M | 3 | Manque de visibilité sur les actions hors-dépôt non versionnées
1045. Enregistrer les sessions MCP non structurées et proposer une extraction d'étapes | src/resolver/index.ts | M | 4 | Génération de gammes trop verbeuses et difficiles à maintenir
1046. Extraire automatiquement des gammes depuis les tickets post-mortem Jira | src/integrations/teamwork-graph/client.ts | L | 4 | Qualité médiocre des textes libres rédigés sous stress
1047. Convertir les incidents Opsgenie résolus en squelettes de procédures d'urgence | src/core/models/gamme.ts | M | 3 | Absence d'enrichissement sémantique sur les étapes implicites
1048. Agréger les logs d'erreurs récurrents pour suggérer l'ajout d'une étape garde-fou | src/core/metrics/stats.ts | S | 3 | Bruit de suggestions non pertinentes sur des incidents transitoires
1049. Détecter les étapes informelles répétées dans les commentaires Jira | src/integrations/jira/client.ts | M | 3 | Problèmes de confidentialité et de conformité RGPD sur l'analyse de texte
1050. Déléguer entièrement la compilation AST de la page Confluence à un agent Rovo | src/integrations/rovo/agent.ts | M | 4 | Perte de reproductibilité déterministe garantie par le compilateur TypeScript
1051. Permettre à l'agent Rovo de corriger seul la syntaxe Confluence erronée | src/integrations/confluence/client.ts | M | 3 | Modifications inattendues non validées par les rédacteurs de la documentation
1052. Créer un dialogue interactif Rovo pour expliciter les préconditions ambiguës | src/integrations/rovo/agent.ts | M | 4 | Frustration utilisateur si le dialogue bloque la publication rapide
1053. Utiliser un agent Rovo pour synthétiser les amendements basés sur 10 déviations | src/core/engine/deviation.ts | M | 4 | Risque d'hallucination d'étapes opérationnelles inexistantes
1054. Confier la détection des étapes fantômes à l'inférence contextuelle Rovo | src/core/metrics/stats.ts | S | 3 | Instabilité des métriques entre deux runs de modèles de langage
1055. Implémenter un agent de revue contradictoire validant la sécurité du SKILL.md | src/integrations/mcp/server.ts | M | 4 | Temps de réponse élevé bloquant le flux de déploiement CI/CD
1056. Générer automatiquement le prompt système de l'agent à partir de l'historique | src/integrations/rovo/agent.ts | S | 3 | Dérive progressive du comportement de l'agent au fil des exécutions
1057. Laisser l'agent compiler des gammes prédictives avant même la fin de l'incident | src/core/engine/runner.ts | L | 3 | Risque de prescrire des actions d'urgence inadaptées ou destructrices
1058. Substituer Custom UI par des panneaux d'activité 100% natifs Jira Issue Panel | manifest.yml | M | 5 | Dépendance aux limitations graphiques et d'interactivité du framework natif Forge
1059. Modéliser chaque étape d'une gamme comme une sous-tâche Jira dynamique | src/integrations/jira/client.ts | L | 4 | Pollution massive du backlog et des tableaux agiles par des sous-tâches éphémères
1060. Piloter l'exécution exclusivement via les transitions de workflow Jira | src/core/engine/runner.ts | M | 4 | Rigidité des workflows Jira empêchant la gestion fluide des déviations
1061. Afficher la progression de la gamme via les Jira Issue Glances et Badges | manifest.yml | S | 3 | Manque d'espace pour visualiser les détails contextuels d'une preuve
1062. Remplacer l'approbation web par des approbations natives Jira Service Management | src/core/engine/runner.ts | M | 4 | Restriction de l'app aux seules licences Jira Service Management
1063. Enregistrer les preuves sous forme de champs personnalisés Jira verrouillés | src/platform/forge/storage.ts | M | 3 | Risque de heurter le plafond du nombre de custom fields par instance Jira
1064. Synchroniser l'état d'urgence d'une gamme avec le niveau de priorité du ticket | src/integrations/jira/client.ts | S | 3 | Escalade intempestive de tickets sans validation humaine du lead incident
1065. Utiliser les commandes rapides Jira (slash commands) pour injecter des preuves | src/integrations/jira/client.ts | S | 3 | Risque d'erreurs de parsing de texte non structuré
1066. Embarquer un émulateur Forge local exécutant la démo sans backend ni tenant | web/demo/index.html | M | 5 | Écart de comportement possible avec l'environnement d'exécution réel Forge
1067. Générer des scénarios d'exécution auto-joués à vitesse variable pour le jury | web/demo/index.html | S | 4 | Illusion d'une application figée si l'utilisateur tente d'interagir pendant le replay
1068. Remplacer les captures d'écran de démo par un bac à sable interactif prérempli | web/index.html | M | 4 | Poids du bundle statique accru pouvant ralentir le chargement initial
1069. Créer un mode visite guidée piloté par les événements du runner de test | web/demo/index.html | S | 3 | Fragilité du guidage en cas de modification de la structure DOM
1070. Intégrer un générateur de données synthétiques réalistes pour l'atelier | src/core/metrics/stats.ts | S | 3 | Génération de métriques trop parfaites trahissant l'absence de données réelles
1071. Fournir un bouton « Démonstration en 60 secondes » déroulant une release complète | web/demo/index.html | S | 4 | Défilement trop rapide empêchant l'évaluation de la rigueur technique
1072. Permettre le basculement instantané entre mock local et instance Forge connectée | src/platform/forge/storage.ts | M | 4 | Risque de fuite de données de test vers l'environnement de production
1073. Auto-diagnostiquer la conformité du manifest en live dans la page de démo | web/demo/index.html | S | 3 | Confusion des évaluateurs entre statut de l'app et statut de la démo
1074. Transformer Gammes en outil d'attestation de conformité SOC2 / ISO 27001 | docs/compliance.md | M | 5 | Exigence de preuves juridiques opposables dépassant le cadre du hackathon
1075. Verrouiller la modification des gammes par une politique d'intégrité WORM | src/platform/forge/storage.ts | L | 4 | Impossibilité de corriger des coquilles bénignes sans forker la gamme
1076. Générer un rapport d'audit formel consolidant conformité et taux de déviation | src/core/metrics/stats.ts | M | 4 | Surcharge de travail sur la mise en page PDF/A exportable
1077. Produire un score de conformité d'équipe mesurant le respect des procédures | src/core/metrics/stats.ts | S | 2 | Violation de la règle d'or maison : aucune statistique individualisée
1078. Imposer un certificat d'audit signé numériquement à chaque version publiée | src/core/compiler/validator.ts | M | 3 | Gestion complexe du cycle de vie des clés de signature en environnement Forge
1079. Valider l'adéquation continue entre gamme publiée et exigences réglementaires | src/core/compiler/validator.ts | L | 4 | Complexité d'exprimer des normes de conformité sous forme de règles formelles
1080. Fournir une trace inaltérable des refus d'approbation et des contournements | src/core/engine/deviation.ts | S | 4 | Résistance des utilisateurs à consigner leurs hésitations opérationnelles
1081. Interdire la reprise après incident sans visa formel de l'officier de sécurité | src/core/engine/runner.ts | S | 3 | Blocage critique en situation d'urgence nocturne sans astreinte sécurité
1082. Découpler entièrement le compilateur de Confluence pour lire du Markdown Git | src/core/compiler/parser.ts | M | 5 | Perte du public cible non technique utilisant le traitement de texte Confluence
1083. Compiler les gammes directement à partir des fichiers SKILL.md d'un dépôt | src/integrations/mcp/server.ts | M | 4 | Conflits de synchronisation entre l'état Confluence et l'état Git
1084. Permettre la soumission de procédures via API REST sans passer par l'éditeur web | src/resolver/index.ts | S | 4 | Risque de contournement de la validation humaine obligatoire avant publication
1085. Rendre le moteur d'exécution autonome sous forme de package NPM importable | src/core/engine/runner.ts | M | 4 | Dispersion de l'effort de maintenance hors de l'écosystème Forge Atlassian
1086. Faire de Jira Service Management le seul point d'entrée pour la saisie de texte | src/integrations/jira/client.ts | M | 3 | Perte des fonctionnalités de mise en page riche offertes par Confluence
1087. Stocker les définitions de gammes dans un dépôt de secrets distant | src/platform/forge/storage.ts | L | 3 | Violation de la contrainte maison : aucun secret dans la solution
1088. Remplacer Confluence par un tableau blanc Atlassian Loom / Whiteboard | manifest.yml | L | 2 | Difficulté extrême à extraire des séquences ordonnées fiables depuis un canvas libre
1089. Distribuer les gammes via une registry décentralisée inter-entreprises | src/resolver/index.ts | L | 3 | Complexité de gouvernance et risques de sécurité liés au partage externe

## 18. Les parcours métier de bout en bout

1090. Valider la compilation Confluence vers AST avec vérification stricte des types d'entrées | src/core/compiler/gammeCompiler.ts | M | 5 | Rejet silencieux d'une syntaxe Confluence mal formée |
1091. Bloquer toute publication d'une gamme sans approbation humaine datée et signée | src/core/approval/approvalGate.ts | S | 5 | Bipasse accidentel de la validation lors d'un appel API direct |
1092. Générer le fichier SKILL.md et le manifeste des 16 outils MCP après approbation | src/integrations/mcp/skillExporter.ts | M | 4 | Incohérence entre les paramètres MCP générés et les types d'entrées de la gamme |
1093. Simuler l'exécution pas-à-pas par un agent Rovo avec verrouillage d'étape | src/integrations/rovo/rovoRunner.ts | M | 5 | Désynchronisation de session agent lors d'une étape bloquante |
1094. Refuser le passage à l'étape suivante en cas d'absence ou non-conformité de la preuve attendue | src/core/engine/proofValidator.ts | S | 5 | Faux positif validant une preuve textuelle vide ou tronquée |
1095. Sceller la trace d'exécution avec calcul d'empreinte SHA-256 et lien citable Jira | src/core/engine/traceRecorder.ts | M | 5 | Collision d'identifiants ou altération de l'horodatage UTC |
1096. Visualiser en direct le franchissement d'un verrou humain dans le composant de déploiement | src/ui/components/DeploymentFlow.tsx | M | 4 | Latence d'actualisation masquant la demande de déblocage |
1097. Détecter l'écart d'empreinte Confluence et calculer l'âge de la désynchronisation | src/core/sync/fingerprintDetector.ts | M | 5 | Faux écarts provoqués par des métadonnées de page sans impact logique |
1098. Interdire l'exécution d'une gamme désynchronisée sans acquittement explicite de dérive | src/core/engine/executionGuard.ts | S | 5 | Blocage intempestif d'un déploiement urgent suite à une coquille Confluence |
1099. Enregistrer une reprise sur incident avec conservation des étapes déjà validées | src/core/engine/executionRecovery.ts | M | 4 | Réexécution accidentelle d'une étape destructrice lors de la reprise |
1100. Activer le mode urgence avec consignation obligatoire du motif et notification d'écart | src/core/engine/emergencyBypass.ts | S | 5 | Utilisation banalisée du mode urgence pour contourner un verrou d'approbation |
1101. Reconstituer l'historique complet d'une exécution passée ciblée au 3 mars | src/resolver/executionResolver.ts | M | 5 | Omission d'une preuve attachée stockée hors de la partition de trace |
1102. Isoler les déviations constatées pendant un incident pour alimenter l'atelier | src/core/models/deviationTracker.ts | S | 4 | Perte de contexte opérationnel lors du rattachement de la déviation |
1103. Générer une proposition d'amendement post-incident sur la base des échecs observés | src/core/engine/amendmentGenerator.ts | M | 4 | Proposition d'amendement contradictoire avec une politique de sécurité |
1104. Refuser strictement l'application autonome d'un amendement sans révision humaine | src/core/approval/amendmentGatekeeper.ts | S | 5 | Régression critique en production causée par une auto-mise à jour |
1105. Exporter l'archive scellée d'audit RSSI contenant traces, empreintes et preuves | src/core/audit/auditBundleExporter.ts | L | 5 | Taille mémoire excessive lors du compactage d'artefacts volumineux |
1106. Contrôler l'intégrité cryptographique WORM de toutes les traces historisées | src/core/audit/integrityChecker.ts | M | 5 | Non-détection d'une falsification de trace sur un stockage bouchonné |
1107. Filtrer et masquer tout secret ou jeton injecté dans les preuves ou traces | src/core/security/secretRedactor.ts | S | 5 | Fuite d'un mot de passe ou d'une clé API dans le journal d'audit |
1108. Prouver formellement l'absence d'agrégation de métriques ou classements individuels | src/core/metrics/anonymizerGuard.ts | S | 4 | Fuite indirecte de statistiques de performance personnelle via l'UI |
1109. Démontrer le parcours de déploiement en 60 secondes sur le site statique de démo | web/src/scenarios/deployScenario.ts | M | 5 | Script de démo trop long dépassant la fenêtre d'attention du juge |
1110. Démontrer l'investigation post-incident en 60 secondes avec reconstitution au 3 mars | web/src/scenarios/incidentScenario.ts | M | 5 | Navigation confuse entre la gamme active et la version historique |
1111. Démontrer la conformité RSSI en 60 secondes via le tableau de preuves interactif | web/src/scenarios/auditScenario.ts | M | 5 | Données simulées non synchronisées avec les définitions d'exigences GA |
1112. Restituer l'état de gel immuable d'une version de gamme après sa publication | src/core/models/gammeVersion.ts | S | 5 | Mutation involontaire d'une version publiée via une référence partagée |
1113. Rejeter toute compilation d'étape orpheline sans sortie typée ni preuve exigée | src/core/compiler/stepValidator.ts | S | 4 | Échec de compilation non explicite pour le rédacteur de la gamme |
1114. Référencer le ticket Jira de changement dans la trace de déploiement pour citation | src/integrations/jira/jiraLinker.ts | S | 4 | Rupture du lien si la clé de ticket Jira contient un format atypique |
1115. Alerter sur la présence d'étapes fantômes identifiées lors d'exécutions d'incident | src/core/metrics/atelierGhostSteps.ts | M | 4 | Faux diagnostic d'étape fantôme sur une procédure exceptionnellement rare |
1116. Bloquer la modification rétroactive d'une trace après terminaison de l'exécution | src/platform/storage/immutableTraceStore.ts | M | 5 | Écrasement potentiel d'un enregistrement existant sur une collision de clé |
1117. Restituer visuellement la chaîne de confiance acteur-horodatage-verrou dans l'audit | src/ui/components/AuditChainView.tsx | M | 4 | Complexité graphique rendant la vérification illisible pour l'auditeur |
1118. Déclarer les 16 points de terminaison MCP dans le contrat d'interface Forge | manifest.yml | M | 4 | Non-respect des quotas ou du schéma Forge entraînant un échec de validation |
1119. Interdire le déclenchement d'un déploiement si le permis requis n'est pas actif | src/core/engine/permitVerifier.ts | S | 5 | Évaluation erronée de la validité temporelle d'un permis de déploiement |
1120. Calculer le taux d'échec par étape sans biaiser les effectifs faibles d'incident | src/core/metrics/failureRateCalculator.ts | S | 4 | Sur-interprétation d'un échec unique sous forme de statistique alarmiste |
1121. Enregistrer l'approbation humaine datée avec horodatage source UTC non modifiable | src/core/approval/timestampProof.ts | S | 5 | Écart d'horloge locale invalidant l'ordre chronologique de l'audit |
1122. Simuler la réponse bouchonnée Confluence pour le scénario de dérive documentaire | src/platform/ports/confluenceMock.ts | S | 4 | Divergence de structure entre le mock Confluence et l'API Forge réelle |
1123. Empêcher l'exécution concurrente de deux gammes en conflit sur la même cible | src/core/engine/conflictDetector.ts | M | 4 | Faux blocage de deux déploiements visant des environnements distincts |
1124. Afficher le badge « Pas assez de recul » lors d'un audit sur une gamme récente | src/ui/components/MetricReculBadge.tsx | S | 3 | Déclenchement de décisions erronées par manque de mise en garde visuelle |
1125. Fournir une trace exportable au format JSON-LD pour conformité réglementaire RSSI | src/core/audit/jsonldFormatter.ts | M | 4 | Incompatibilité de schéma avec les outils d'ingestion de logs SIEM |
1126. Rejeter la preuve si son empreinte ne correspond pas au hash de l'artefact produit | src/core/engine/artifactHashMatcher.ts | S | 5 | Rejet à tort d'un artefact valide suite à une conversion fin-de-ligne |
1127. Vérifier la complétude des 28 étapes du guide de démo interactive web | docs/demo/guidedWalkthrough.json | S | 4 | Étape de démo brisée par une incohérence d'identifiant d'état |
1128. Consigner les dérogations d'urgence dans un registre inviolable dédié à la RSSI | src/core/audit/emergencyLedger.ts | M | 5 | Perte d'un événement d'urgence en cas de fermeture brutale de session |
1129. Synthétiser les trois parcours dans un rapport de conformité prêt pour le juge Codegeist | web/src/components/JudgeSummaryReport.tsx | M | 5 | Densité d'information trop forte empêchant la validation en trois minutes |

## 19. Les parcours agent et dette documentaire

1130. Valider le manifest MCP lors du hand-shake initial de l'agent | src/integrations/mcp/manifest.ts | S | 4 | Incompatibilité de schéma de transport json-rpc avec certains clients tiers
1131. Rejeter une étape critique si l'agent tente une exécution sans token de déverrouillage humain | src/core/execution/guards.ts | S | 5 | Blocage silencieux d'agents automatisés légitimes en CI/CD
1132. Exporter dynamiquement le fichier SKILL.md annoté des exigences de preuves par étape | src/integrations/rovo/skillGenerator.ts | M | 4 | Tronquage de contexte LLM si la gamme contient plus de cinquante étapes
1133. Générer une trace d'exécution signée et citable dans le journal d'audit Atlassian | src/core/audit/traceSigner.ts | M | 5 | Collision de hash ou lenteur d'ancrage cryptographique en mémoire
1134. Enregistrer une déviation explicite déclarée par l'agent MCP avec sa justification textuelle | src/core/execution/deviations.ts | S | 4 | Abus de déviations triviales masquant une régression fonctionnelle
1135. Bloquer l'exécution MCP si la gamme active est décrétée obsolète par dérive d'empreinte | src/integrations/mcp/tools/executeStep.ts | S | 4 | Faux positifs d'invalidation lors d'une simple retouche cosmétique de Confluence
1136. Structurer le contrat d'entrée typée d'une étape pour interdire toute hallucination d'argument | src/core/compilation/stepInputSchema.ts | M | 4 | Rejet excessif de formats valides non documentés dans la procédure wiki
1137. Déclarer la capture de preuve obligatoire avant passage à l'étape suivante via MCP | src/integrations/mcp/tools/submitProof.ts | S | 5 | Agent bloqué indéfiniment sans outil natif pour collecter la preuve exigée
1138. Fournir le diagnostic d'échec standardisé aux outils MCP sans fuite de secret d'environnement | src/integrations/mcp/errors.ts | S | 5 | Masquage accidentel de variables utiles au débogage technique
1139. Interdire la reprise d'une gamme interrompue sans revalidation de l'état des verrous préalables | src/core/execution/recovery.ts | M | 4 | Régression d'état si le contexte sous-jacent a muté durant l'interruption
1140. Détecter les gestes Jira récurrents orphelins pour instancier des gammes fantômes candidates | src/core/ghosts/jiraSignalDetector.ts | L | 4 | Explosion du bruit d'analyse sur les projets à fort volume d'automatisations
1141. Calculer le score de poussière documentaire basé sur l'âge de l'écart Confluence-Gamme | src/core/metrics/staleness.ts | S | 4 | Affichage alarmiste sur des procédures stables ne nécessitant aucune retouche
1142. Modéliser l'indice de toiles d'araignée sur les gammes sans exécution depuis six mois | src/core/metrics/cobwebs.ts | S | 3 | Biais négatif contre les plans de reprise d'activité testés annuellement
1143. Cartographier la couverture documentaire réelle en croisant composants Jira et gammes actives | src/core/metrics/coverageCalculator.ts | M | 4 | Incohérence des nomenclatures de composants entre Confluence et Jira
1144. Refuser formellement l'application automatique d'un amendement déduit d'un échec répété | src/core/amendments/engine.ts | S | 5 | Frustration utilisateur nécessitant une double validation manuelle
1145. Matérialiser l'alerte d'écart de hash Confluence sur l'écran d'accueil de l'atelier | src/ui/components/DriftWarningBanner.tsx | S | 3 | Dégradation perçue de l'interface par accumulation d'alertes visuelles
1146. Exposer un outil MCP dédié à la consultation de l'arbre des étapes sans droit d'exécution | src/integrations/mcp/tools/describeGamme.ts | S | 3 | Divulgation de métadonnées sensibles de procédures internes
1147. Restreindre l'exécution du mode urgence aux seuls agents porteurs d'un permis explicite | src/core/execution/emergencyMode.ts | M | 5 | Risque d'utilisation abusive du mode urgence pour contourner les preuves
1148. Mesurer le taux de déviation moyen par agent tiers dans l'agrégateur d'atelier | src/core/metrics/deviationAggregator.ts | M | 3 | Risque de métrique perçue comme un jugement individuel malgré l'anonymisation
1149. Isoler les preuves non textuelles fournies par l'agent dans le stockage forge scellé | src/platform/forgeStorageAdapter.ts | M | 4 | Dépassement des quotas de stockage par clé imposés par Atlassian Forge
1150. Simuler l'onboarding MCP pas-à-pas dans le parcours de démonstration statique | web/demo/steps/mcpOnboardingStep.ts | S | 3 | Désynchronisation entre le parcours simulé et le payload réel json-rpc
1151. Signaler les étapes de contournement observées dans les logs de gammes fantômes | src/core/ghosts/shadowWorkflowTracer.ts | M | 4 | Inférence incorrecte sur des flux Jira personnalisés non linéaires
1152. Restituer le graphe de dépendance documentaire pour visualiser les procédures isolées | src/ui/views/DocumentaryDebtDashboard.tsx | L | 4 | Rendu SVG lourd dépassant le budget CPU du navigateur client
1153. Imposer un délai de rétractation après proposition d'un amendement post-incident | src/core/amendments/approvalWorkflow.ts | S | 3 | Retard dans la correction urgente d'une coquille sur une procédure critique
1154. Émettre un événement d'alerte Teamwork Graph lors de l'abandon prématuré d'une gamme | src/integrations/teamworkGraph/events.ts | M | 3 | Échec silencieux si l'API Teamwork Graph est instable ou mockée
1155. Refuser la compilation d'une page Confluence exempte de critères de preuve explicites | src/core/compilation/parser.ts | S | 5 | Rejet massif des pages existantes rédigées sous forme de texte libre
1156. Afficher la mention de recul insuffisant sur les métriques à moins de dix exécutions | src/ui/components/MetricBadge.tsx | S | 4 | Masquage de tendances émergentes sur les gammes très peu sollicitées
1157. Traduire les verrous de sécurité en invites contextuelles interprétables par l'agent Rovo | src/integrations/rovo/guardPromptAdapter.ts | S | 4 | Biais d'interprétation du modèle LLM ignorant une contrainte ferme
1158. Consigner les refus d'obtempérer de l'agent face à une étape non sécurisée | src/core/audit/agentRefusalLogger.ts | S | 4 | Faux positifs d'incidents si l'agent refuse pour simple indisponibilité réseau
1159. Comparer le texte wiki révisé avec la gamme compilée pour calculer l'âge de dérive | src/core/compilation/driftTracker.ts | M | 4 | Faux calcul de dérive causé par des modifications de macros Confluence tierces
1160. Visualiser les toiles d'araignée sur les procédures orphelines dans l'interface atelier | src/ui/components/CobwebIndicator.tsx | S | 2 | Dissonance visuelle avec le système de design Atlassian (Atlaskit)
1161. Déclarer formellement une exception de couverture documentaire approuvée par le responsable | src/core/debt/coverageException.ts | S | 3 | Risque de dérive bureaucratique masquant la dette réelle sous des exceptions
1162. Restreindre la liste des 16 outils MCP selon le profil et les permissions du runner | src/integrations/mcp/toolFilter.ts | M | 4 | Complexité de configuration des rôles pour les intégrateurs externes
1163. Empêcher l'exécution concurrente de deux gammes modifiant la même cible d'infrastructure | src/core/execution/lockManager.ts | M | 5 | Interblocage accidentel si le verrou n'est pas relâché après crash de l'agent
1164. Extraire les paramètres de secret requis pour exiger une référence sans exposer la valeur | src/core/compilation/secretDetector.ts | S | 5 | Fausse détection de secrets sur des gabarits de configuration légitimes
1165. Indexer l'empreinte de version de la gamme dans la trace d'audit pour auditabilité légale | src/core/audit/immutableEntry.ts | S | 5 | Impossibilité de purger des traces en cas de demande RGPD mal calibrée
1166. Publier l'état de fraîcheur des gammes sous forme de métadonnées de page Confluence | src/platform/confluenceSyncAdapter.ts | M | 3 | Écrasement conflictuel de l'historique des versions de la page wiki
1167. Vérifier la conformité des outils MCP au manifest Forge avant déploiement | manifest.yml | S | 4 | Rejet par le linter Forge de définitions de routes non déclarées au manifest
1168. Afficher un tableau d'échecs par étape consolidant les effectifs totaux observés | src/ui/components/StepFailureTable.tsx | M | 4 | Dégradation de lisibilité sur les gammes complexes comptant plus de 30 étapes
1169. Refuser l'exécution via MCP si l'agent ne transmet pas sa version d'interpréteur de protocole | src/integrations/mcp/server.ts | S | 4 | Rupture de compatibilité avec des clients légers ou des scripts curl de test

---

**1169 idées** classées par domaine.
