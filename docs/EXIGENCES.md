# Exigences — matrice de suivi

P : **M** = indispensable pour la soumission, **S** = souhaitable, **C** = après le hackathon.
Lot : voir [`CONTRATS.md`](CONTRATS.md). État mis à jour par l'intégrateur à chaque fusion de PR.

| N° | Exigence | P | Lot | État | Preuve |
|---|---|---|---|---|---|
| GA-01 | Détecter les pages candidates avec score et raisons ; confirmation humaine obligatoire avant compilation | M | A | ⬜ à faire | — |
| GA-02 | Extraire les étapes en déterministe d'abord, modèle sur l'ambigu seulement, avec le passage source de chaque étape | M | A | ⬜ à faire | — |
| GA-03 | Qualifier chaque étape : nature, preuve attendue, verrou humain, idempotence, risque, conduite en échec | M | A | ⬜ à faire | — |
| GA-04 | Détecter les étapes à risque par motifs et leur affecter un verrou | M | A | ⬜ à faire | — |
| GA-05 | Versionnage immuable ; exécution épinglée à sa version | M | F | ⬜ à faire | — |
| GA-06 | Cycle de vie avec approbation humaine datée et date de révision | M | F | ⬜ à faire | — |
| GA-07 | Exécution pas à pas : étape courante, preuve exigée, acquittement, déviation, reprise | M | B | ⬜ à faire | — |
| GA-08 | Refus d'acquittement par un agent sur une étape réservée à un humain, tentative enregistrée | M | B | ⬜ à faire | — |
| GA-09 | Trace complète par exécution, consultable et citable | M | B | ⬜ à faire | — |
| GA-10 | Désynchronisation détectée par empreinte de contenu, diff de recompilation proposé | M | F | ⬜ à faire | — |
| GA-11 | Verrou de secret avant publication, avec proposition d'emplacement de remplacement | M | A | ⬜ à faire | — |
| GA-12 | Verrou de permis : une étape à risque par agent exige un permis valide | M | B | ⬜ à faire | — |
| GA-13 | Export `SKILL.md` par gamme approuvée, et skill générique côté Forge | M | G | ⬜ à faire | — |
| GA-14 | Outils MCP du § 18 | M | G | ⬜ à faire | — |
| GA-15 | Agent Rovo « Le compagnon » | M | H | ⬜ à faire | — |
| GA-16 | Encart sur le ticket Jira : quelle gamme s'applique, la démarrer, voir les traces | M | H | ⬜ à faire | — |
| GA-17 | Macro Confluence dans la page source : état, version, exécutions, fraîcheur | M | H | ⬜ à faire | — |
| GA-18 | L'atelier : registre des gammes, états, poussières, couverture | M | C | ⬜ à faire | — |
| GA-19 | Statistiques d'atelier par étape, avec effectif et « pas assez de recul » | M | C | ⬜ à faire | — |
| GA-20 | Amendement proposé depuis les traces, avec ses preuves, jamais appliqué seul | M | C | ⬜ à faire | — |
| GA-21 | Aucune statistique par personne | M | C | ⬜ à faire | — |
| GA-22 | Détection des gammes fantômes depuis l'historique Jira/JSM, avec preuves et coût | S | C | ⬜ à faire | — |
| GA-23 | Détection des conflits entre gammes et avec les pages de politique | S | D | ✅ faite | `test/conflits/` (16 tests), `src/core/conflicts/`, conciliateur `src/core/conciliation/hermes.ts` |
| GA-24 | Comparaison de versions (un amendement a-t-il amélioré quelque chose ?) | S | C | ⬜ à faire | — |
| GA-25 | Flux Jira pour la version humaine d'une gamme, et validateur de transition exigeant une trace | S | H | ⬜ à faire | — |
| GA-26 | Point d'entrée externe signé (`webtrigger`) pour les hooks d'agents et le CI | S | G | ⬜ à faire | — |
| GA-27 | Lecture du graphe pour le périmètre et le propriétaire (`document`, `software-service`, `project`) | S | E | ⬜ à faire | — |
| GA-28 | Étapes non falsifiables détectées, avec reformulation proposée | S | A | ⬜ à faire | — |
| GA-29 | Exécution en mode dégradé d'urgence, avec raison et revue différée obligatoire | S | B | ⬜ à faire | — |
| GA-30 | Publication de gammes vers d'autres espaces ou organisations | C | — | ⬜ à faire | — |
| GA-31 | Connecteur de graphe (app jumelle) pour graver les gammes comme documents reliés | C | F | ⬜ à faire | — |
| GA-32 | Ordonnancement de gammes composées (une gamme qui appelle une gamme) | C | — | ⬜ à faire | — |

Légende des états : ⬜ à faire · 🟨 en cours (PR ouverte) · ✅ faite et testée · ⛔ sacrifiée (assumé).

Sacrifiables dans l'ordre, si le temps manque (§ 28) : l'atelier visuel (le registre porte la même
information), les fantômes, les conflits, le validateur de transition Jira, le connecteur de graphe.
