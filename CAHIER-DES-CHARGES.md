# Procédures packagées — cahier des charges

> Codegeist 2026 · catégorie **Apps for Software Teams** (variante démo pour équipes métier)
> Bonus visés : Agents Rovo / skills (principal), MCP, Marketplace ; Teamwork Graph en appoint
> Version 1 du 11 novembre 2026 · soumission avant le mardi 22 décembre 2026, 21 h (Paris)
> Nom de dépôt proposé : `gammes` · nom public : **Gammes — your runbooks, as tools** · sous-titre produit : *Procédures packagées*
> Nom alternatif envisagé : *Partition* (écarté : ambigu avec la partition de disque)

## 1. L'idée en une phrase

Le wiki de l'entreprise sait déjà tout faire — déployer, tourner une clé, intégrer un collaborateur, répondre à un incident — mais ce savoir est écrit en prose : l'app **compile** une page de procédure en une gamme exécutable (étapes, préconditions, preuves attendues, étapes interdites aux agents), la publie comme outil invocable par n'importe quel agent, et referme la boucle en proposant de corriger la page à partir des échecs réellement observés.

## 2. Le problème

Une procédure vit dans une page Confluence. Elle y meurt aussi.

- **Les humains la lisent mal.** On survole, on saute l'étape 4, on oublie la vérification finale. Personne ne sait quelle version de la page a été suivie le jour de l'incident.
- **Les agents ne la lisent pas du tout.** Un agent de code qui doit déployer ne reçoit pas une prose de douze paragraphes : il reçoit des outils. Faute d'outil, il improvise — et l'improvisation n'est jamais tracée.
- **La page et la réalité divergent.** Quelqu'un corrige la page ; les scripts, les habitudes et les checklists d'ailleurs ne suivent pas. Ou l'inverse : l'équipe change sa façon de faire, la page reste celle d'il y a deux ans.
- **Personne ne sait ce qui rate.** La même étape échoue une fois sur deux depuis six mois, et l'information est éparpillée dans des commentaires de tickets que personne ne relit.
- **Le savoir non écrit coûte cher.** Certains gestes sont exécutés correctement par trois personnes, et par personne d'autre. Ils n'ont jamais été écrits, donc jamais été outillés.

Ce qu'il faut pour répondre existe déjà : les pages Confluence (le texte source), les tickets Jira et JSM (l'historique réel des exécutions manuelles), le graphe d'Atlassian (qui relie documents, projets, services et équipes), Forge (pour exécuter, stocker et exposer des outils), et les agents Rovo (pour consommer ces outils). Il manque le **compilateur** — et la discipline de tracer ce qui a été fait, sous quelle version, avec quelle preuve.

La phrase qui résume le produit : **« Your wiki already knows how to do everything. Your agents don't. »**

## 3. Utilisateurs

| Qui | Ce qu'il fait | Ce qu'il attend |
|---|---|---|
| Propriétaire d'une procédure | Maintient une page | Que la page devienne utile : exécutée, tracée, et corrigée par l'usage |
| Ingénieur de service / on-call | Exécute sous pression | La prochaine étape, la preuve attendue, et rien d'ambigu |
| Agent de code (MCP) | Doit agir | « Existe-t-il une procédure pour ce que je m'apprête à faire ? » et les étapes outillées |
| RSSI / responsable des changements | Audite | Quelle procédure, quelle version, qui a fait quoi, quelle preuve |
| Direction de l'ingénierie | Outille les équipes | La part du savoir-faire réellement exécutable, et ce qui rate |
| Nouveau venu | Apprend | Des gammes à dérouler au lieu de pages à deviner |

## 4. Vocabulaire du produit

- **Gamme** : une procédure compilée — une suite ordonnée d'étapes avec entrées, preuves attendues, verrous et version. Le mot vient de l'atelier : une gamme de montage dit quoi faire, dans quel ordre, avec quel outil et quel contrôle.
- **Page source** : la page Confluence dont la gamme est issue. Une gamme cite toujours sa source, et **chaque étape cite le passage exact** qui l'a produite.
- **Étape** : une opération élémentaire. Cinq natures : `manuelle`, `commande`, `contrôle`, `décision`, `notification`.
- **Preuve attendue** : ce qu'une étape doit laisser derrière elle, avec sa force (machine / attestée / déclarée).
- **Verrou** : ce qui interdit d'avancer — étape réservée à un humain, permis requis, secret détecté, contrôle en échec.
- **Version** : une gamme est versionnée, et chaque version est **immuable**. Une exécution est épinglée à une version (`GAM-deploy-01@v7`).
- **Exécution** : une instance déroulée, humaine ou agent, avec ses étapes, ses preuves, ses déviations et son issue.
- **Trace** : le journal d'une exécution. C'est la preuve, et c'est la matière première des statistiques.
- **Désynchronisée** : une gamme dont la page source a changé depuis la compilation. Elle reste exécutable, mais elle est marquée, et son âge est affiché.
- **Amendement** : une modification proposée pour une gamme, fondée sur des traces. Un amendement n'est jamais appliqué seul.
- **Gamme fantôme** : un travail répété, exécuté correctement, que personne n'a écrit. L'app le détecte et propose de le rédiger.
- **Conflit** : deux gammes (ou une gamme et une page de politique) qui prescrivent des choses incompatibles pour la même action.
- **Atelier** : la vue d'ensemble — les établis (gammes), leur état, leur usage, leurs poussières.
- **Compagnon** : l'agent qui déroule une gamme sous supervision ; **apprenti** quand il n'a pas les permis.

Discipline de vocabulaire, comme ailleurs : **écrit** (la page le dit) ≠ **compilé** (la gamme existe) ≠ **approuvé** (un humain l'a attestée) ≠ **exécuté** (une trace le prouve) ≠ **réussi** (l'issue est conforme). L'app ne dit jamais « la procédure est respectée » sans trace.

## 5. Ce que l'app ne fait pas

- elle **ne publie rien sans approbation humaine** : la compilation produit un brouillon et un diff, jamais une gamme en service ;
- elle **ne laisse pas un agent attester une étape réservée à un humain**, ni approuver une gamme, ni valider un amendement ;
- elle **n'exécute pas elle-même les commandes** : elle dit quoi faire, dans quel ordre, et enregistre ce qui a été fait. L'exécution reste chez l'agent, le CI ou la personne ;
- elle **ne stocke aucun secret** : une étape qui contient une clé devient un signalement, pas une étape (§ 9) ;
- elle **n'efface jamais** une version ni une trace : déprécier n'est pas supprimer ;
- elle **ne note personne** : les traces nomment un acteur pour l'audit, jamais un classement ; les statistiques portent sur les étapes ;
- elle **ne conclut pas sans effectif** : sous le seuil, une statistique d'étape affiche « pas assez de recul ».

## 6. La compilation en cinq étages

Une page ne devient pas une gamme par magie. Cinq étages, chacun avec ses règles d'abord, son modèle ensuite, sa validation humaine à la fin.

**1. Repérer.** Quelles pages sont des procédures ? Signaux faibles et forts : titre (`Procédure`, `Runbook`, `Mode opératoire`, `How to`, `SOP`), étiquettes, listes numérotées, cases à cocher, blocs de code, tableaux d'étapes, liens depuis les pages d'astreinte, fréquence de consultation. Chaque candidate reçoit un score et ses raisons. Une personne confirme — **l'app ne compile jamais une page sans confirmation**.

**2. Extraire.** Le format storage de la page devient une suite d'étapes. En déterministe d'abord : listes numérotées et à puces, cases à cocher, blocs de code (→ `commande`), tableaux (→ étapes colonnes), titres (→ sections), macros. Le modèle n'intervient que sur la prose ambiguë. **Chaque étape conserve l'emplacement exact du passage source** (décalages dans le texte), comme les citations d'un brief : rien n'est affirmé sans sa source.

**3. Qualifier.** Pour chaque étape : nature, preuve attendue, réservée à un humain ou non, idempotente ou non, niveau de risque, commande reconnaissable, résultat attendu. Règles d'abord (motifs : `rm -rf`, `DROP`, `kubectl delete`, `force-push`, écriture en production, manipulation de données personnelles), modèle ensuite, humain toujours. Les étapes à risque reçoivent un verrou : humain obligatoire **et** permis requis (§ 9).

**4. Publier.** La gamme approuvée devient : un ensemble d'outils invocables (actions/MCP), un `SKILL.md` exportable par gamme pour les agents tiers, un type de ticket et un flux Jira pour la version humaine, et une macro qui réinsère l'état de la gamme dans la page source. Versionnage immuable ; la publication est un acte humain daté.

**5. Relier.** Le lien page ↔ gamme est entretenu dans les deux sens : la page change → la gamme est marquée désynchronisée, avec le diff de recompilation proposé ; les traces révèlent un défaut → un amendement est proposé, et **la modification de la page est suggérée** à son propriétaire. La documentation et l'outil cessent de diverger en silence.

## 7. La structure d'une gamme

| Champ | Contenu |
|---|---|
| Identité | code (`GAM-deploy-01`), titre, version, état (brouillon / en revue / approuvée / dépréciée), propriétaire |
| Provenance | page source (ARI), empreinte du contenu à la compilation, passages cités par étape |
| Périmètre | services, projets, espaces concernés — lus dans le graphe (`software-service`, `project`, `document`) |
| Entrées | liste typée et obligatoire (service, environnement, version à déployer, ticket déclencheur) |
| Étapes | ordre, nature, texte, commande éventuelle, résultat attendu, preuve attendue et sa force, verrous, délai, idempotence, conduite en cas d'échec (stop / réessayer / escalader / passer avec raison) |
| Conditions | préconditions vérifiables avant de commencer, postconditions à la fin |
| Repli | ce qu'on fait si ça tourne mal, et quelles étapes de repli sont elles-mêmes outillées |
| Acteurs autorisés | humain seul / humain ou agent sous permis / agent libre — par gamme **et** par étape |
| Mesures | durée estimée, risque, exclusivité (une seule exécution à la fois ou non) |
| Statistiques | exécutions, taux d'échec par étape, déviations, âge de la dernière validation |

Règle de forme : une étape qui ne peut pas être vérifiée (« s'assurer que tout va bien ») est signalée comme **non falsifiable** et propose une reformulation — c'est le défaut n° 1 des runbooks.

## 8. L'exécution et sa trace

Une exécution démarre par un appel outillé (`start-run`) ou depuis l'encart d'un ticket Jira, avec les entrées typées. Ensuite :

- l'app **renvoie l'étape courante** : texte, commande, résultat attendu, preuve exigée, verrous. Pour un humain c'est une checklist ; pour un agent c'est l'instruction suivante — le même contenu, deux rendus ;
- chaque étape est **acquittée avec sa preuve** : sortie de commande, lien de build, capture, attestation humaine. Sans preuve là où elle est exigée, l'étape n'avance pas ;
- une **déviation** se déclare : ce qui a été fait à la place, et pourquoi. Les déviations sont la matière la plus précieuse du produit (§ 11) ;
- l'exécution est **reprise** après interruption, épinglée à sa version — la page peut changer entre-temps, l'exécution ne change pas de gamme ;
- à la fin, la **trace** est close : version, acteur et sa nature (humain / agent), étapes, preuves, déviations, durée, issue, et le ticket ou l'incident auquel elle se rapporte.

Ce que la trace répond, et que rien d'autre ne répond aujourd'hui : *« le 3 mars, quand on a déployé en urgence, quelle procédure a été suivie, par qui, jusqu'où, et avec quelle preuve ? »*

## 9. Les trois verrous

**Le verrou humain.** Une étape marquée `réservée à un humain` ne peut être acquittée que par une personne authentifiée. Un agent qui tente de l'acquitter reçoit un refus, et la tentative est **enregistrée comme déviation** — pas comme une erreur silencieuse. Même règle pour approuver une gamme, valider un amendement ou attester une rotation.

**Le verrou de permis.** Une étape à risque appartient à une classe d'actions ; son exécution par un agent exige un permis valide délivré par `permis-forge` (périmètre, durée, niveau d'autonomie). Sans permis, l'app refuse et renvoie la demande de permis à créer. Les deux produits se complètent : la gamme dit **quoi** faire, le permis dit **si l'agent a le droit**.

**Le verrou de secret.** Avant publication, chaque étape passe par les détecteurs de `placard-wiki`. Une clé, un mot de passe ou une donnée personnelle dans une étape n'est jamais publiée : l'app propose un emplacement à la place (lien vers le gestionnaire de secrets, variable d'environnement, coffre) et ouvre un signalement. Une gamme ne doit pas devenir le nouveau placard.

## 10. La désynchronisation

Le couple page ↔ gamme est le point fragile de tout outillage de procédures. Trois cas, traités explicitement :

| Cas | Ce que fait l'app |
|---|---|
| La page change, la gamme suit | Empreinte du contenu comparée à chaque modification ; gamme marquée **désynchronisée** avec l'âge de l'écart ; recompilation proposée en diff ; approbation humaine requise avant republication |
| La gamme change, la page reste | Un amendement validé produit une **proposition de modification de la page**, soumise à son propriétaire, avec le diff et les traces qui le fondent |
| La page disparaît | La gamme garde sa dernière version compilée, marquée « source disparue », avec l'empreinte et la date ; elle continue de s'exécuter, et l'absence de source est affichée partout |

Un compteur d'atelier suit la **fraîcheur** : part des gammes synchronisées, âge médian de l'écart, gammes désynchronisées depuis plus de 90 jours. C'est l'indicateur de dette documentaire le plus honnête qui soit, parce qu'il est mesuré, pas déclaré.

## 11. Les statistiques d'atelier

À partir des traces, par étape et par version — avec effectif, fourchette, et « pas assez de recul » sous le seuil :

- **Taux d'échec par étape.** Une étape qui échoue six fois sur dix n'est pas une étape difficile : c'est une étape fausse. L'app propose un amendement, preuves à l'appui (quelles exécutions, quelles erreurs, ce que les gens ont fait à la place).
- **Taux de saut.** Une étape systématiquement sautée avec une raison est une étape à supprimer ou à rendre conditionnelle. Proposition, jamais suppression automatique.
- **Étapes fantômes.** Les mêmes gestes ajoutés par les humains entre l'étape 5 et l'étape 6, de façon répétée : l'app propose de les écrire.
- **Écart humains / agents.** Quand les deux divergent sur la même étape, soit l'étape est ambiguë (reformulation proposée), soit l'agent a besoin d'un garde-fou (verrou proposé).
- **Comparaison de versions.** `v6` contre `v7` : l'amendement a-t-il amélioré quelque chose ? Si non, l'app le dit — et la version précédente reste disponible.
- **Durées réelles** contre durée estimée : la gamme ment-elle sur son coût ?
- **Couverture.** Part des runbooks compilés, part des exécutions tracées, part des gammes approuvées. Une couverture partielle est déclarée, jamais masquée.

C'est la boucle qui rend le produit vivant : **une procédure s'améliore parce qu'on s'en sert.** Aucune documentation ne fait ça aujourd'hui.

## 12. Les gammes manquantes

L'autre moitié du travail : ce qui n'a jamais été écrit. L'app cherche dans Jira et JSM les **motifs répétés** — tickets aux titres et composants proches, mêmes enchaînements de commentaires, mêmes transitions, même durée médiane — et propose : « ceci ressemble à une procédure que personne n'a écrite ».

Chaque proposition porte ses preuves : nombre de tickets, étalement dans le temps, durée médiane de traitement, nombre de personnes différentes qui l'ont exécuté (sans classement ni nomination individuelle), et le coût estimé en jours. L'adoption est humaine : la proposition ouvre un brouillon de gamme pré-rempli depuis les commentaires les plus constants, que le propriétaire complète.

C'est aussi la réponse au critère d'impact : l'app ne se contente pas d'outiller l'existant, elle **réduit la part du savoir-faire qui n'appartient qu'à trois personnes**.

## 13. Les conflits

Deux gammes qui prescrivent l'incompatible pour la même action sont un risque réel, et invisible tant qu'elles restent dans deux espaces. Détection sur :

- la **même cible** (service, environnement, ressource) avec des exigences différentes (nombre d'approbations, fenêtre horaire, ordre des étapes) ;
- une gamme dont une étape **contredit une page de politique** (politique de déploiement, de sécurité, de conservation des données) — la page de politique est déclarée comme telle dans les réglages ;
- deux gammes **en concurrence** sur la même ressource exclusive : le conflit est alors signalé à `chantiers-en-collision`, qui gère la réservation.

Un conflit n'est jamais tranché par l'app : il est porté aux deux propriétaires, avec les passages sources cités de part et d'autre.

## 14. Gouvernance et cycle de vie

```
brouillon → en revue → approuvée → (exécutée, mesurée) → amendée → dépréciée
```

- **Brouillon** : issu de la compilation ou d'une proposition de gamme fantôme. Non invocable par un agent.
- **En revue** : un propriétaire est désigné ; les étapes non falsifiables et les verrous manquants sont listés.
- **Approuvée** : attestation humaine datée, version figée, invocable. Une approbation a une **date de révision** : une gamme approuvée il y a deux ans et jamais exécutée est signalée, pas oubliée.
- **Amendée** : nouvelle version, l'ancienne reste lisible et citable ; les exécutions en cours gardent leur version.
- **Dépréciée** : refusée aux agents, lisible par les humains, avec la gamme de remplacement s'il y en a une. Aucune suppression destructrice.
- **File d'adoption** : les gammes sans propriétaire, comme les pages orphelines ailleurs.

## 15. Ce que les agents en font

Trois portes d'entrée, une seule source de vérité :

1. **Outils MCP** (`rovo:mcp`) : `find-procedure`, `get-procedure`, `start-run`, `record-step`, `report-deviation`. N'importe quel client MCP — Rovo, un orchestrateur maison, un agent tiers — déroule une gamme étape par étape. Un outil générique sert toutes les gammes : le contenu est en base, pas dans le manifeste.
2. **Skill exporté** : chaque gamme approuvée produit un `SKILL.md` (et ses fichiers d'accompagnement) téléchargeable, que l'équipe peut ajouter à ses agents tiers — exactement ce que le bonus MCP prévoit pour les fichiers `skill.md` en source ouverte. Côté Forge, un **skill générique** `derouler-une-gamme` enseigne la conduite : chercher avant d'agir, respecter les verrous, déclarer les déviations, ne jamais improviser une étape à risque.
3. **Point d'entrée externe** (`webtrigger` signé) : un hook d'agent de code ou un pipeline CI demande « existe-t-il une procédure pour ce que je m'apprête à faire ? » avant un geste sensible. Sans gamme, l'appelant décide ; avec une gamme non approuvée, l'app le dit ; avec une gamme à verrou, l'app renvoie la demande de permis à obtenir.

C'est la démonstration la plus parlante du produit : **un agent refuse d'improviser parce qu'une page Confluence, compilée, le lui a dit.**

## 16. Réutilisation du portefeuille

Règle de la maison : une seule implémentation par logique. Rien n'est recopié, tout est consommé.

| App existante | Ce que Gammes en prend |
|---|---|
| `permis-forge` | Les classes d'actions et les permis : le verrou de permis appelle son registre, ne le réinvente pas |
| `preuve-a-l-appui` | La grille de force des preuves (machine / attestée / déclarée) pour les preuves d'étape |
| `brief-forge` | La discipline des citations (passage source par étape), le budget de contexte, le masquage unifié des secrets |
| `placard-wiki` | Les détecteurs de secrets et de données personnelles avant publication ; le verrou de secret |
| `delegable-ou-pas` | La mesure par cohortes et le refus de conclure sous le seuil, appliquée aux étapes : quelles étapes sont confiables pour un agent |
| `deja-vu-ci` | Le moteur de signature d'échec : les erreurs d'étape sont regroupées comme les builds rouges |
| `chantiers-en-collision` | La réservation de ressource exclusive pour les gammes qui écrivent du code |
| `merge-avec-contexte` / `deja-vu-ci` | Le motif des deux apps jumelles et du pont signé, si un connecteur de graphe est ajouté |
| `vigie` | Une gamme est une source de niveau A pour un résultat clé (« part des déploiements sous procédure tracée ») |

## 17. Exigences fonctionnelles

**M** = indispensable pour la soumission, **S** = souhaitable, **C** = après le hackathon.

| N° | Exigence | P |
|---|---|---|
| GA-01 | Détecter les pages candidates avec score et raisons ; confirmation humaine obligatoire avant compilation | M |
| GA-02 | Extraire les étapes en déterministe d'abord, modèle sur l'ambigu seulement, avec le passage source de chaque étape | M |
| GA-03 | Qualifier chaque étape : nature, preuve attendue, verrou humain, idempotence, risque, conduite en échec | M |
| GA-04 | Détecter les étapes à risque par motifs et leur affecter un verrou | M |
| GA-05 | Versionnage immuable ; exécution épinglée à sa version | M |
| GA-06 | Cycle de vie avec approbation humaine datée et date de révision | M |
| GA-07 | Exécution pas à pas : étape courante, preuve exigée, acquittement, déviation, reprise | M |
| GA-08 | Refus d'acquittement par un agent sur une étape réservée à un humain, tentative enregistrée | M |
| GA-09 | Trace complète par exécution, consultable et citable | M |
| GA-10 | Désynchronisation détectée par empreinte de contenu, diff de recompilation proposé | M |
| GA-11 | Verrou de secret avant publication, avec proposition d'emplacement de remplacement | M |
| GA-12 | Verrou de permis : une étape à risque par agent exige un permis valide | M |
| GA-13 | Export `SKILL.md` par gamme approuvée, et skill générique côté Forge | M |
| GA-14 | Outils MCP du § 18 | M |
| GA-15 | Agent Rovo « Le compagnon » | M |
| GA-16 | Encart sur le ticket Jira : quelle gamme s'applique, la démarrer, voir les traces | M |
| GA-17 | Macro Confluence dans la page source : état, version, exécutions, fraîcheur | M |
| GA-18 | L'atelier : registre des gammes, états, poussières, couverture | M |
| GA-19 | Statistiques d'atelier par étape, avec effectif et « pas assez de recul » | M |
| GA-20 | Amendement proposé depuis les traces, avec ses preuves, jamais appliqué seul | M |
| GA-21 | Aucune statistique par personne | M |
| GA-22 | Détection des gammes fantômes depuis l'historique Jira/JSM, avec preuves et coût | S |
| GA-23 | Détection des conflits entre gammes et avec les pages de politique | S |
| GA-24 | Comparaison de versions (un amendement a-t-il amélioré quelque chose ?) | S |
| GA-25 | Flux Jira pour la version humaine d'une gamme, et validateur de transition exigeant une trace | S |
| GA-26 | Point d'entrée externe signé (`webtrigger`) pour les hooks d'agents et le CI | S |
| GA-27 | Lecture du graphe pour le périmètre et le propriétaire (`document`, `software-service`, `project`) | S |
| GA-28 | Étapes non falsifiables détectées, avec reformulation proposée | S |
| GA-29 | Exécution en mode dégradé d'urgence, avec raison et revue différée obligatoire | S |
| GA-30 | Publication de gammes vers d'autres espaces ou organisations | C |
| GA-31 | Connecteur de graphe (app jumelle) pour graver les gammes comme documents reliés | C |
| GA-32 | Ordonnancement de gammes composées (une gamme qui appelle une gamme) | C |

## 18. Outils MCP, agent Rovo, skill

### Outils, exposés par `rovo:mcp`

| Clé | Verbe | Entrées | Retour |
|---|---|---|---|
| `find-procedure` | GET | `query` ou `context` (service, environnement, action visée) | Gammes candidates, état, confiance, version |
| `check-before-acting` | GET | `intendedAction`, `service?` | Y a-t-il une gamme ? verrous, permis requis, risque |
| `get-procedure` | GET | `code`, `version?` | Étapes, entrées, preuves, verrous, provenance |
| `list-procedures` | GET | `space?`, `owner?`, `state?`, `stale?`, `limit` | Registre filtré |
| `start-run` | CREATE | `code`, `inputs`, `actorKind`, `ticketRef?` | Exécution épinglée, première étape |
| `get-current-step` | GET | `runId` | Étape courante, preuve attendue, verrous |
| `record-step` | UPDATE | `runId`, `stepId`, `outcome`, `evidenceRef` | Étape acquittée ou refus motivé, étape suivante |
| `report-deviation` | CREATE | `runId`, `stepId`, `whatHappened`, `why` | Déviation enregistrée |
| `finish-run` | UPDATE | `runId`, `outcome`, `notes` | Trace close |
| `get-run-trace` | GET | `runId` | Trace complète citable |
| `get-procedure-stats` | GET | `code`, `version?` | Échecs, sauts, durées, déviations, avec effectifs |
| `propose-amendment` | CREATE | `code`, `stepId`, `proposal`, `evidenceRefs` | Amendement en revue |
| `compile-page` | CREATE | `pageId` | Brouillon de gamme et diff — rien de publié |
| `export-skill` | GET | `code`, `version` | `SKILL.md` et fichiers d'accompagnement |
| `get-missing-procedures` | GET | `projectKey?`, `limit` | Gammes fantômes avec preuves et coût |
| `get-conflicts` | GET | `service?` | Conflits détectés, passages cités |

Aucun outil ne renvoie de secret, aucun n'accepte d'attestation humaine au nom d'un agent, et `record-step` renvoie un refus explicite quand le verrou l'impose. Les outils de lecture sont des `GET` : une automatisation peut interroger l'atelier à chaque ouverture de sprint.

### Agent Rovo « Le compagnon »

Dans Rovo Chat :

- « Quelle procédure pour déployer le service paiements en production ? »
- « Déroule la gamme de rotation des clés et arrête-toi à la première étape humaine. »
- « Quelles gammes sont désynchronisées de leur page depuis plus d'un mois ? »
- « Quelle étape échoue le plus ce trimestre, et qu'est-ce que les gens font à la place ? »
- « Y a-t-il une procédure pour ce que je m'apprête à faire ? »
- « Quels gestes répétés n'ont jamais été écrits ? »
- « Montre la trace de l'exécution du 3 mars au soir. »

L'agent cite la version de la gamme, dit « aucune gamme approuvée » plutôt que d'improviser, et ne franchit jamais un verrou.

### Skill `derouler-une-gamme`

En `SKILL.md`, publié en source ouverte : chercher une gamme avant d'agir ; demander les entrées typées ; acquitter chaque étape avec sa preuve ; déclarer toute déviation ; s'arrêter net au premier verrou humain ou de permis ; ne jamais improviser une étape à risque ; citer la version dans le compte rendu. C'est la conduite attendue de tout agent dans l'organisation, pas seulement dans cette app.

## 19. Écrans — l'atelier

La carte visuelle est un **atelier** : chaque élément porte une donnée, rien n'est décoratif.

| Élément | Donnée encodée |
|---|---|
| Un **établi** | Une gamme ; sa taille = le nombre d'étapes |
| Les **outils** posés | Les étapes outillées (commande, contrôle, notification) |
| La **fiche au mur** | Le mode opératoire : les étapes dans l'ordre |
| Une **fiche de contrôle** | La preuve attendue, avec sa force |
| Un **cadenas** | Un verrou : humain, permis, secret |
| La **poussière** sur l'établi | Une gamme jamais exécutée depuis longtemps |
| Un **panneau rouge** | Une gamme désynchronisée de sa page ; son âge |
| Une **toile d'araignée** | Une gamme dont l'approbation a passé sa date de révision |
| Le **cahier d'atelier** | Le registre des exécutions : version, acteur, issue |
| Une **trace de pas** qui s'écarte | Une déviation déclarée |
| L'**établi vide** avec son contour | Une gamme fantôme : le travail existe, la procédure manque |
| Deux établis **dos à dos** | Un conflit entre gammes |
| L'**apprenti** | Un agent qui déroule sous permis limité |
| Le **registre** sur la table | La vue tableau — information identique, accessible, WCAG AA |

Écrans : 1. **L'atelier** (`confluence:globalPage`) · 2. **Fiche de gamme** (étapes, verrous, provenance, statistiques, versions) · 3. **Action sur une page** (`confluence:contentAction`) : « compiler en gamme », « voir la gamme », état de synchronisation · 4. **Macro dans la page source** (`confluence:macro`) : version, état, exécutions, fraîcheur — la page dit elle-même si elle est outillée · 5. **Déroulé d'exécution** : l'étape courante, la preuve attendue, les verrous · 6. **Encart sur le ticket Jira** (`jira:issuePanel`) : quelle gamme s'applique, la démarrer, les traces liées · 7. **Statistiques d'atelier** : échecs, sauts, déviations, comparaisons de versions, avec effectifs · 8. **Fantômes et adoption** · 9. **Conflits** · 10. **Écran de couverture** : droits, source de données, part compilée, part tracée · 11. **Réglages** (espace) : motifs de risque, pages de politique, seuils des statistiques, politique de verrous.

## 20. Architecture Forge

Une app principale sur Confluence, avec des surfaces Jira, et un pont signé vers l'extérieur.

```yaml
# Esquisse, validée par `forge lint` (CLI 14.2) le 13/11/2026 : les noms de
# modules et de portées ci-dessous sont ceux qui passent le linter.
modules:
  rovo:mcp:                       # les 16 outils du § 18
  rovo:skill:                     # « derouler-une-gamme » (générique, statique)
  rovo:agent:                     # « Le compagnon »
  action:                         # une entrée par outil
  confluence:globalPage:          # l'atelier, les statistiques, les fantômes, la couverture
  confluence:contentAction:       # compiler / voir la gamme depuis la page
  macro:                          # l'état de la gamme dans la page source
  confluence:spaceSettings:       # réglages d'espace
  jira:issuePanel:                # quelle gamme s'applique à ce ticket
  jira:globalPage:                # registre côté Jira (même contenu)
  jira:workflowValidator:         # une transition peut exiger une trace d'exécution
  trigger:                        # page créée/modifiée, commentaire, issue liée
  scheduledTrigger:               # nuit : fraîcheur, statistiques, fantômes, conflits
  consumer:                       # compilation et recalculs longs, jusqu'à 900 s
  webtrigger:                     # point d'entrée signé pour hooks d'agents et CI
  sql:
  llm:                            # extraction de prose, qualification, synthèse d'amendement
permissions:
  scopes:                         # read/write:confluence-content, pièces jointes, espaces,
                                  # utilisateurs ; read:issue-details:jira, write:issue:jira ;
                                  # read:graph:document:external, read:graph:project:jira,
                                  # read:graph:service:external
```

### Deux couches, une contrainte à respecter

Le manifeste est statique : on ne déploie pas un skill par gamme à la volée. Le produit est donc coupé en deux :

- **Couche outillée (statique)** : un skill générique, un agent, et un jeu d'outils MCP qui servent **toutes** les gammes — le contenu vient de la base, pas du manifeste. C'est ce qui garantit que le produit tourne quelle que soit la limite de la plateforme.
- **Couche exportée (dynamique)** : chaque gamme approuvée produit un `SKILL.md` et ses fichiers, téléchargeables et publiables en source ouverte, pour les agents tiers. L'équivalent dynamique d'un skill par procédure, sans dépendre d'un redéploiement.

Si la vérification du § 22 montre qu'un skill peut être déclaré dynamiquement, la couche exportée devient aussi une couche déployée — mais l'architecture ne dépend pas de cette réponse.

### Ce qu'impose la plateforme

- Fonctions interactives 55 s (agent, action, webtrigger) ; la compilation et les recalculs passent par `consumer` et déclencheur planifié, jusqu'à 900 s, par tranches avec curseur.
- Cinq déclencheurs planifiés au plus, un seul à 5 minutes.
- Payload 5 Mo, requête depuis une interface custom limitée à 500 Ko : une très longue procédure est servie par étapes, pas en un bloc.
- Lecture du graphe au nom d'un utilisateur connecté ; droit manquant = résultat vide sans erreur → l'écran de couverture distingue « pas de droit » de « pas de données ».
- LLM hébergé avec cache par empreinte de contenu ; le budget (appels, jetons, coût estimé) est affiché.
- Une app consomme l'API du graphe **ou** fournit un connecteur, pas les deux : l'option GA-31 exige une seconde app jumelle, comme dans `merge-avec-contexte`.

## 21. Modèle de données (Forge SQL)

| Table | Colonnes principales |
|---|---|
| `gamme` | id, code, title, state, owner_ref, space_key, current_version, risk, exclusive, created_at, approved_at, approved_by_ref, review_due_at, deprecated_at, replaced_by |
| `gamme_version` | id, gamme_id, version, source_page_ari, content_hash, compiled_at, compiled_by, approved_at, approved_by_ref, notes |
| `step` | id, version_id, ord, kind, text, command, expected_result, evidence_type, evidence_strength, human_only, idempotent, risk_class, on_failure, timeout_s, source_span_json, falsifiable |
| `input_spec` | id, version_id, name, type, required, description |
| `run` | id, version_id, actor_ref, actor_kind, ticket_ref, started_at, finished_at, outcome, pinned_version, resumed_count |
| `run_step` | id, run_id, step_id, state, started_at, done_at, evidence_ref, evidence_strength, refused_reason |
| `deviation` | id, run_id, step_id, what_happened, why, at, actor_kind, reviewed_at |
| `trace_link` | run_id, target_type (issue/incident/deployment), target_ref |
| `binding` | gamme_id, page_ari, content_hash, synced_at, stale_since, last_diff_json |
| `amendment` | id, gamme_id, step_id, proposal, evidence_json, state, proposed_at, decided_at, decided_by_ref |
| `step_stat` | version_id, step_id, period, n, fail_rate, fail_low, fail_high, skip_rate, deviations, median_s, computed_at |
| `conflict` | id, gamme_a, gamme_b, kind, facts_json, state, raised_at, resolved_at |
| `ghost_candidate` | id, cluster_key, sample_issue_ids_json, n, span_days, median_handle_h, people_count, cost_days, state, draft_gamme_id |
| `permit_ref` | step_id, permit_class, permit_id, checked_at, result |
| `export` | gamme_id, version_id, skill_md_hash, exported_at, downloads |
| `coverage` | scope, pages_detected, compiled_pct, approved_pct, traced_pct, stale_pct, computed_at |
| `budget` | day, compiled, llm_calls, tokens, cost_estimate |

Aucune table ne contient de secret, de texte de commande brut non qualifié, ni de mesure par personne. `actor_ref` et `approved_by_ref` servent l'audit et la responsabilité, jamais un classement.

## 22. Contraintes vérifiées et points à valider

### Vérifié dans la documentation (11 novembre 2026)

- **Fonctions** : 25 s en standard ; jusqu'à 900 s quand la fonction n'est appelée que par un `consumer` ou un déclencheur planifié ; 55 s pour web trigger, action et agent. Mémoire 512 Mo à 1 Go, `/tmp` 512 Mo éphémère.
- **Payload** : 5 Mo ; requête depuis une interface custom limitée à 500 Ko. **Sorties réseau** : 100 requêtes/min/runtime ; invocation 1 200/min/utilisateur, 7 000/min/installation.
- **Déclencheurs planifiés** : 5 au plus par app, un seul à 5 minutes ; événements asynchrones pour les traitements longs.
- **LLM hébergé** : Haiku (200K/64K), Sonnet et Opus (1M/128K) ; 100 invites/min/installation, 500K jetons/min/modèle.
- **Stockage** : SQL, KVS, Entity Store, Object Store (Preview) ; facturation à la consommation depuis le 1ᵉʳ janvier 2026.
- **Rovo** : `rovo:agent` avec fenêtre d'exécution courte et contrôle de sécurité d'Atlassian ; `rovo:mcp` en Preview, un module par app, 50 outils au plus ; `rovo:skill` en Preview — instructions et fichiers réutilisables ; le bonus MCP du hackathon prévoit explicitement des fichiers `skill.md` en source ouverte ajoutés par les utilisateurs à leurs agents tiers.
- **Teamwork Graph** : lecture par GraphQL, requêtes prêtes ou Cypher persisté (Cypher brut refusé aux nouvelles apps), au nom d'un utilisateur, un droit par type d'objet, droit manquant = données omises sans erreur ; parmi les types utiles ici : `document`, `space`, `project`, `software-service`, `work-item`, `comment`. Écriture par connecteur seulement, sur un catalogue fermé de 26 types ; une app ne peut pas consommer l'API **et** fournir un connecteur.

### À confirmer

La forme exacte d'un module `rovo:skill` (clés, fichiers embarqués, taille limite) et la possibilité — improbable mais à trancher — de déclarer un skill dynamiquement ; la forme des schémas d'entrées d'une `rovo:action` (types simples seulement ?) ; la liste exacte des modules Confluence disponibles (`confluence:contentAction`, `confluence:spaceSettingsPage`, `confluence:macro`, `confluence:globalPage`) ; les scopes Confluence exacts pour écrire `asUser()` ; la manière dont un client MCP tiers authentifie une app Forge.

### À valider par un prototype la première semaine

| Point | Pourquoi | Solution de repli |
|---|---|---|
| Un skill peut-il être généré dynamiquement | Couche exportée vs déployée | Skill générique unique + outils MCP paramétrés + `SKILL.md` téléchargeable |
| Schéma d'entrées d'une action (objets, tableaux) | Entrées typées d'une gamme | Entrées plates en chaînes, validation côté fonction |
| Taille maximale d'une réponse d'outil | Gammes longues | Servir étape par étape (`get-current-step`) |
| Écriture d'une page Confluence `asUser()` et commentaire de version | Proposition de modification de la page | Diff affiché dans l'app, application manuelle guidée |
| `confluence:contentAction` disponible sur une page vue | L'entrée principale du produit | Macro + page globale |
| Validation de transition Jira exigeant une trace | GA-25 | Champ personnalisé + contrôle dans l'encart |
| Compilation d'une page de 3 000 mots dans les limites | Le compilateur | Découpage par sections, plusieurs exécutions |
| Connexion d'un agent tiers au serveur MCP de l'app | La démo « agent externe » | `webtrigger` signé + `SKILL.md` exporté |

## 23. Exigences non fonctionnelles

- **Approbation humaine partout.** Rien n'est publié, approuvé, amendé ni attesté par un agent. Chaque acte d'autorité est daté et nommé.
- **Traçabilité totale.** Chaque étape cite son passage source ; chaque exécution cite sa version ; chaque statistique cite ses traces.
- **Immuabilité.** Les versions et les traces ne sont ni modifiées ni supprimées ; déprécier et archiver, jamais effacer.
- **Déterminisme d'abord.** L'extraction et la qualification commencent par des règles ; le modèle n'intervient que sur l'ambigu, avec cache par empreinte.
- **Explicabilité.** Chaque score, verrou, statistique et proposition montre son fondement.
- **Retenue.** L'app propose et refuse ; elle n'exécute jamais une commande, ne modifie jamais une page, ne déprécie jamais une gamme seule.
- **Sécurité.** Aucun secret stocké ni publié ; les détecteurs tournent avant publication ; les traces ne contiennent que des références de preuve.
- **Pas de notation.** Aucune statistique par personne ; les déviations qualifient les étapes, pas les acteurs.
- **Robustesse.** Confluence injoignable : les gammes approuvées continuent de s'exécuter depuis la base ; l'indisponibilité est affichée.
- **Sobriété.** Budget de compilation et de calcul affiché (pages compilées, appels, jetons, coût estimé).
- **Rapidité.** `find-procedure` en moins de 2 s, étape courante en moins de 1 s, depuis le cache.
- **Accessibilité.** Registre équivalent à l'atelier, navigation clavier, WCAG AA, la poussière et le panneau rouge ne sont jamais les seuls codages.
- **Langues.** Interface en anglais et en français ; soumission en anglais.

## 24. Cas limites

- Page qui n'est pas une procédure mais compilée quand même : la confirmation humaine est obligatoire, et un faux positif est écarté avec raison.
- Procédure éclatée sur quatre pages : gamme multi-sources, chaque étape cite sa page et son passage.
- Page supprimée : la gamme garde sa dernière version, marquée « source disparue », toujours exécutable.
- Étape contenant une clé : non publiée, signalement ouvert, emplacement de remplacement proposé.
- Agent qui tente d'acquitter une étape humaine : refus explicite, tentative enregistrée comme déviation.
- Deux équipes, deux procédures homonymes : espaces distincts, portée explicite, conflit signalé si les périmètres se recouvrent.
- Exécution longue (plusieurs jours) : reprise possible, expiration déclarée, version épinglée.
- Deux exécutions concurrentes d'une gamme exclusive : la seconde est refusée ou mise en file, avec renvoi vers `chantiers-en-collision`.
- Étape « s'assurer que tout fonctionne » : signalée non falsifiable, reformulation proposée avec le contrôle disponible.
- Amendement qui dégrade : la comparaison de versions le montre, la version précédente reste disponible.
- Gamme approuvée il y a deux ans, jamais exécutée : signalée (toile d'araignée), pas supprimée.
- Mode urgence : exécution en mode dégradé avec raison écrite, trace marquée, revue différée obligatoire dans les 7 jours.
- Gamme sans propriétaire : file d'adoption ; non invocable par un agent tant qu'elle n'est pas adoptée et approuvée.
- Page modifiée pendant une exécution : l'exécution garde sa version ; la désynchronisation est signalée pour la suivante.
- Procédure en plusieurs langues : le texte d'origine est conservé, la commande normalisée ; l'interface suit la langue de l'utilisateur.

## 25. Recette

1. Une page avec une liste numérotée et un bloc de code compile en étapes dont chacune cite son passage source.
2. Une page sans aucun signal de procédure n'est pas proposée, ou l'est avec un score faible et ses raisons.
3. Une compilation ne publie rien : elle produit un brouillon et un diff, et l'état reste « brouillon ».
4. Une étape contenant `kubectl delete` reçoit un verrou humain et une classe de risque, visibles.
5. Une étape contenant une clé AWS n'est pas publiée ; un signalement est ouvert avec l'empreinte et l'aperçu masqué.
6. Une gamme approuvée passe en version immuable ; l'approbation porte une date et un nom.
7. `start-run` épingle la version ; modifier la page ensuite ne change pas l'exécution en cours.
8. Un agent qui acquitte une étape `human_only` reçoit un refus, et la tentative apparaît dans les déviations.
9. Une étape à risque exécutée par un agent sans permis valide est refusée, avec la demande de permis à créer.
10. Une étape sans preuve là où une preuve est exigée n'avance pas.
11. Une déviation déclarée est visible dans la trace, avec ce qui a été fait et pourquoi.
12. La page source modifiée marque la gamme désynchronisée, avec l'âge de l'écart et le diff proposé.
13. Une exécution close produit une trace citable : version, acteur et sa nature, étapes, preuves, issue.
14. Une étape en échec six fois sur dix sur 40 exécutions déclenche une proposition d'amendement avec ses preuves.
15. Un taux calculé sur trois exécutions affiche « pas assez de recul », sans pourcentage.
16. La comparaison `v6` / `v7` affiche les deux taux avec leurs effectifs.
17. `export-skill` produit un `SKILL.md` qui ne contient aucun secret et cite la version.
18. Un motif de tickets répétés sans gamme apparaît dans les fantômes, avec nombre de tickets, étalement et coût estimé.
19. Deux gammes prescrivant des approbations incompatibles pour le même service déclenchent un conflit, passages cités.
20. Aucun écran, export ni outil MCP ne contient de statistique par personne (test automatisé).
21. Confluence injoignable : une gamme approuvée se déroule encore depuis la base, et l'indisponibilité est affichée.

## 26. Scénario de la vidéo (moins de 5 minutes, en anglais)

| Temps | Contenu |
|---|---|
| 0:00 – 0:25 | Un runbook de douze paragraphes. Un agent qui doit déployer. « The wiki knows how. The agent doesn't. » |
| 0:25 – 1:00 | La compilation : la page devient une gamme, étape par étape, chacune citant son passage. Le diff, l'approbation humaine |
| 1:00 – 1:30 | Les verrous : une étape `human_only`, une étape à risque qui exige un permis, une clé détectée et remplacée par un lien vers le coffre |
| 1:30 – 2:05 | L'exécution par un agent tiers via MCP : `check-before-acting`, `start-run`, étape courante, preuve, refus sur le verrou humain |
| 2:05 – 2:35 | La trace : quelle version, qui, quelles preuves. « Which procedure was followed on March 3rd? » |
| 2:35 – 3:05 | La page change, la gamme devient désynchronisée, le diff est proposé |
| 3:05 – 3:35 | Les statistiques d'atelier : l'étape 4 échoue six fois sur dix → amendement proposé avec ses preuves |
| 3:35 – 4:00 | Les fantômes : 38 tickets semblables, aucune procédure écrite, coût estimé |
| 4:00 – 4:25 | Le skill exporté (`SKILL.md`) ajouté à un agent tiers, et le hook CI qui demande s'il existe une procédure |
| 4:25 – 4:50 | Architecture : compilateur déterministe puis modèle, SQL, MCP, skill, permis et preuves réutilisés |

## 27. Comment les juges testeront

1. **Espace de démonstration.** Un script sème six pages : trois procédures réalistes (déploiement, rotation de clé, intégration d'un collaborateur), une page qui n'est pas une procédure, une procédure contenant une fausse clé, et deux procédures en conflit sur le même service. Plus un projet Jira avec 40 tickets semblables pour les fantômes, et des traces semées pour les statistiques.
2. **Compiler.** Depuis l'action sur la page : détection, diff, étapes et passages sources, verrous, approbation.
3. **Dérouler.** Via l'interface et via un client MCP : entrées typées, étape courante, preuve, refus sur verrou humain, déviation, trace close.
4. **Désynchroniser.** Modifier une page et voir la gamme marquée, avec le diff.
5. **Mesurer.** Les statistiques d'atelier sur les traces semées, avec leurs effectifs, et une proposition d'amendement.
6. **Agent Rovo.** Les sept questions du § 18.
7. **Exporter.** Le `SKILL.md` d'une gamme, ajouté à un agent tiers.

Lien d'installation, identifiants de démo et script de semis fournis dans la soumission.

## 28. Plan jusqu'au 22 décembre

| Semaine | Objectif |
|---|---|
| 11 – 17 nov. | Les huit validations du § 22 (forme d'un skill, schémas d'actions, modules Confluence, écriture `asUser()`, MCP tiers) ; squelette Forge et socle CI |
| 18 – 24 nov. | Compilateur : détection des candidates, extraction déterministe avec passages sources, qualification des étapes |
| 25 nov. – 1ᵉʳ déc. | Cycle de vie, versions immuables, verrous (humain, permis, secret), exécution pas à pas, traces |
| 2 – 8 déc. | Liaison page ↔ gamme, désynchronisation et diff, macro et encart Jira, atelier et registre |
| 9 – 15 déc. | Outils MCP, agent Rovo, skill générique et export `SKILL.md`, statistiques d'atelier, amendements ; **gel des fonctionnalités le 15** |
| 16 – 22 déc. | Recette, fantômes et conflits si le temps le permet, espace de démo semé, vidéo, instructions pour les juges, soumission, dépôt Marketplace |

Sacrifiables dans l'ordre : l'atelier visuel (le registre porte la même information), les fantômes, les conflits, le validateur de transition Jira, le connecteur de graphe.

## 29. Risques

| Risque | Parade |
|---|---|
| Skills non déclarables dynamiquement | Architecture en deux couches (§ 20) : outils MCP paramétrés + export `SKILL.md`. Aucune dépendance à cette réponse |
| Extraction trop fragile sur des pages mal écrites | Déterministe d'abord, brouillon toujours revu par un humain, étapes non falsifiables signalées plutôt que devinées |
| Compilateur perçu comme une usine à gaz | Le parcours principal tient en trois écrans : compiler, approuver, dérouler |
| Gammes publiées puis abandonnées | Date de révision, poussière et toile d'araignée visibles, couverture mesurée |
| Agent qui franchit un verrou | Refus côté serveur (pas côté client), tentative enregistrée, permis requis pour les classes à risque |
| Secret publié par une gamme | Détecteurs avant publication, verrou bloquant, aucun secret en base ni dans les exports |
| Statistiques lues comme un classement | Aucune donnée par personne, seuils d'effectif, déviations qualifiant les étapes |
| Conflit avec les outils d'automatisation existants | Le produit ne remplace pas un moteur d'exécution : il structure, verrouille et trace — il peut outiller n'importe lequel |
| Délai de revue Marketplace | Soumission au listing avant le 22 décembre (délai Devpost), ticket de revue fourni comme preuve |

## 30. La vision poussée à l'extrême

- **Le compilateur de savoir-faire.** De la prose en entrée, des outils en sortie. Chaque page utile de l'organisation devient invocable, et la documentation cesse d'être un cimetière.
- **La première documentation qui s'améliore parce qu'on s'en sert.** Les étapes fausses sont détectées par leurs échecs, les gestes manquants par leurs répétitions, les formulations ambiguës par l'écart entre humains et agents.
- **La fin de l'improvisation à risque.** Un agent demande avant d'agir ; s'il n'y a pas de gamme, il le dit ; s'il y en a une à verrou, il s'arrête. La sécurité de l'organisation tient dans une page que quelqu'un a approuvée — et on sait laquelle.
- **L'intégration comme déroulé.** Un nouvel arrivant ne lit pas trente pages : il déroule trois gammes, et chacune laisse une trace de ce qu'il a fait et compris.
- **Le catalogue des gestes.** Les gammes deviennent un bien de l'organisation, publiable d'un espace à l'autre, puis d'une organisation à l'autre — un Marketplace du savoir-faire, avec ses versions et ses statistiques d'usage.
- **L'audit continu.** « Quelle procédure, quelle version, quelle preuve, quel acteur » devient une requête, pas une fouille. Le jour de l'audit, le cahier d'atelier est déjà écrit.
- **Le pont avec les objectifs.** La part des déploiements sous procédure tracée, le taux d'étapes en échec, la fraîcheur des gammes : autant de résultats clés de niveau A pour `vigie`.
- **La mémoire des gestes.** Les gammes dépréciées restent lisibles avec leurs traces : on peut savoir comment on faisait avant, et pourquoi on a arrêté.

## 31. Liens avec les autres cahiers des charges

- **Permis d'agir (`permis-forge`)** : la gamme dit quoi faire, le permis dit si l'agent a le droit. Le verrou de permis appelle son registre et ses classes d'actions, sans les dupliquer.
- **Fait, preuve à l'appui (`preuve-a-l-appui`)** : la grille de force des preuves est reprise pour chaque étape ; un validateur de transition peut exiger une trace d'exécution.
- **Brief de contexte (`brief-forge`)** : mêmes citations de passages sources, même budget de contexte, même masquage unifié des secrets.
- **Placard du wiki (`placard-wiki`)** : les détecteurs sont partagés ; une clé dans une étape devient un foyer du placard, pas une étape de gamme.
- **Délégable ou pas (`delegable-ou-pas`)** : ses cohortes et son refus de concluire sous le seuil s'appliquent aux étapes — quelles étapes sont fiables pour un agent, lesquelles exigent un humain.
- **Déjà-vu CI (`deja-vu-ci`)** : son moteur de signature d'échec regroupe les erreurs d'étape comme il regroupe les builds rouges.
- **Chantiers en collision (`chantiers-en-collision`)** : une gamme qui écrit du code déclare son emprise et respecte les réservations.
- **Merge avec contexte (`merge-avec-contexte`)** : une gamme de déploiement peut exiger un merge check vert ; le motif des apps jumelles est réutilisé si un connecteur est ajouté.
- **Objectifs réels (`vigie`)** : les gammes fournissent des mesures de niveau A (part tracée, taux d'échec, fraîcheur).
- **Le coût réel de la dette (`laddition`)** : une gamme fantôme non écrite a un coût ; il se chiffre comme le reste de la dette.

## 32. Sources

- [Codegeist 2026](https://codegeist2026.devpost.com/) et ses [ressources](https://codegeist2026.devpost.com/resources) (bonus agents, MCP et `skill.md` en source ouverte)
- [Modules du manifeste Forge](https://developer.atlassian.com/platform/forge/manifest-reference/modules/) · [`rovo:skill`](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-skill/) · [`rovo:action`](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-action/) · [`rovo:mcp`](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-mcp/) · [`rovo:agent`](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-agent/)
- [Exemples d'apps Rovo](https://developer.atlassian.com/platform/forge/example-apps-rovo/) · [apps Confluence](https://developer.atlassian.com/platform/forge/example-apps-confluence/)
- [Limites d'exécution](https://developer.atlassian.com/platform/forge/limits-invocation/) · [LLM hébergé](https://developer.atlassian.com/platform/forge/ai/) · [stockage](https://developer.atlassian.com/platform/forge/storage-api/) · [web triggers](https://developer.atlassian.com/platform/forge/webtrigger/)
- [API Confluence Cloud](https://developer.atlassian.com/cloud/confluence/rest/intro/) · [API Jira Cloud](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/) · [permissions Forge](https://developer.atlassian.com/platform/forge/manifest-reference/permissions/)
- [Teamwork Graph : présentation](https://developer.atlassian.com/platform/teamwork-graph/) · [types d'objet](https://developer.atlassian.com/platform/teamwork-graph/api-reference/object-types/overview/)
- [Publication d'une app Forge au Marketplace](https://developer.atlassian.com/platform/marketplace/listing-forge-apps/)
- Rapports internes : `inventaire-codegeist/A-github.md`, `B-encours.md`, `D-marche-forge.md`, `E-verif-goals.md`, `F-verif-skills.md`
