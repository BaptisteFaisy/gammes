# Exigences — matrice de suivi

P : **M** = indispensable pour la soumission, **S** = souhaitable, **C** = après le hackathon.
Lot : voir [`CONTRATS.md`](CONTRATS.md). État mis à jour par l'intégrateur à chaque fusion de PR.

| N° | Exigence | P | Lot | État | Preuve |
|---|---|---|---|---|---|
| GA-01 | Détecter les pages candidates avec score et raisons ; confirmation humaine obligatoire avant compilation | M | A | ✅ faite | `src/core/detect/`, `test/compilateur-front/detect-extract.test.ts` |
| GA-02 | Extraire les étapes en déterministe d'abord, modèle sur l'ambigu seulement, avec le passage source de chaque étape | M | A | ✅ faite | `src/core/extract/`, recettes 1 et 2 testées |
| GA-03 | Qualifier chaque étape : nature, preuve attendue, verrou humain, idempotence, risque, conduite en échec | M | A | ✅ faite | `src/core/qualify/qualify-steps.ts` |
| GA-04 | Détecter les étapes à risque par motifs et leur affecter un verrou | M | A | ✅ faite | `src/core/risk/risk-motifs.ts`, recette 4 testée |
| GA-05 | Versionnage immuable ; exécution épinglée à sa version | M | F | ✅ faite | `src/core/version/versioning.ts`, `test/cycle-de-vie/versioning.test.ts` |
| GA-06 | Cycle de vie avec approbation humaine datée et date de révision | M | F | ✅ faite | `approveVersion` (acte humain daté + `reviewDueAt`), `deprecateGamme`, `canTransition` |
| GA-07 | Exécution pas à pas : étape courante, preuve exigée, acquittement, déviation, reprise | M | B | ✅ faite | `src/core/run/{runs,record,run-state}.ts`, recettes 7/10/11 testées |
| GA-08 | Refus d'acquittement par un agent sur une étape réservée à un humain, tentative enregistrée | M | B | ✅ faite | `src/core/locks/locks.ts` + refus tracé en déviation, recette 8 testée |
| GA-09 | Trace complète par exécution, consultable et citable | M | B | ✅ faite | `src/core/trace/trace.ts` (trace citable fr/en), recette 13 testée |
| GA-10 | Désynchronisation détectée par empreinte de contenu, diff de recompilation proposé | M | F | ✅ faite | `src/core/binding/binding.ts`, `src/core/compile/recompile.ts`, recette 12 testée |
| GA-11 | Verrou de secret avant publication, avec proposition d'emplacement de remplacement | M | A | ✅ faite | `src/core/secrets/detectors.ts`, recette 5 testée (empreinte + aperçu masqué) |
| GA-12 | Verrou de permis : une étape à risque par agent exige un permis valide | M | B | ✅ faite | verrou de permis via le port `PermitRegistry`, recette 9 testée |
| GA-13 | Export `SKILL.md` par gamme approuvée, et skill générique côté Forge | M | G | ✅ faite | `src/core/export/skill-md.ts` + `skills/derouler-une-gamme/SKILL.md`, recette 17 testée |
| GA-14 | Outils MCP du § 18 | M | G | ✅ faite | `src/core/mcp/{tools,search}.ts` (16 outils), `test/mcp/tools.test.ts` |
| GA-15 | Agent Rovo « Le compagnon » | M | H | ✅ faite | `agents/le-compagnon.md` (les 7 questions du § 18) + `rovo:agent` au manifeste |
| GA-16 | Encart sur le ticket Jira : quelle gamme s'applique, la démarrer, voir les traces | M | K | ✅ faite | `src/ui/issue-panel/panel-model.ts`, `src/resolver/panel.ts` (4 actions), `src/frontend/surfaces/issue-panel.tsx`, 9 tests |
| GA-17 | Macro Confluence dans la page source : état, version, exécutions, fraîcheur | M | L | 🟨 en cours | socle UI Kit 2 posé (`src/frontend/surfaces/macro.tsx`, `src/resolver/macro.ts`) |
| GA-18 | L'atelier : registre des gammes, états, poussières, couverture | M | C | ✅ faite | `src/core/coverage/coverage.ts`, `src/core/stats/workshop.ts` + atelier du site public |
| GA-19 | Statistiques d'atelier par étape, avec effectif et « pas assez de recul » | M | C | ✅ faite | `src/core/stats/step-stats.ts`, recette 14/15 testées |
| GA-20 | Amendement proposé depuis les traces, avec ses preuves, jamais appliqué seul | M | C | ✅ faite | `src/core/amendments/amendments.ts`, recette 14 testée |
| GA-21 | Aucune statistique par personne | M | C | ✅ faite | test explicite : aucune clé d'acteur dans les agrégats + `npm run lint` |
| GA-22 | Détection des gammes fantômes depuis l'historique Jira/JSM, avec preuves et coût | S | C | ✅ faite | `src/core/ghosts/ghosts.ts`, recette 18 testée |
| GA-23 | Détection des conflits entre gammes et avec les pages de politique | S | D | ✅ faite | `test/conflits/` (16 tests), `src/core/conflicts/`, conciliateur `src/core/conciliation/hermes.ts` |
| GA-24 | Comparaison de versions (un amendement a-t-il amélioré quelque chose ?) | S | C | ✅ faite | `compareVersions`, recette 16 testée |
| GA-25 | Flux Jira pour la version humaine d'une gamme, et validateur de transition exigeant une trace | S | M | ✅ faite | `src/jira/trace-gate.ts` (trois verdicts motivés), `src/validator.ts` (handler Forge, échec fermé), `src/resolver/jira.ts`, 9 tests |
| GA-26 | Point d'entrée externe signé (`webtrigger`) pour les hooks d'agents et le CI | S | G | ✅ faite | `src/platform/webtrigger.ts` (HMAC-SHA256, échec fermé sans secret) |
| GA-27 | Lecture du graphe pour le périmètre et le propriétaire (`document`, `software-service`, `project`) | S | E | ✅ faite | `src/integrations/graph.ts` (droit manquant = vide sans erreur) |
| GA-28 | Étapes non falsifiables détectées, avec reformulation proposée | S | A | ✅ faite | `src/core/falsifiable/falsifiability.ts` |
| GA-29 | Exécution en mode dégradé d'urgence, avec raison et revue différée obligatoire | S | B | ✅ faite | mode `emergency` : raison écrite + revue différée à 7 jours |
| GA-30 | Publication de gammes vers d'autres espaces ou organisations | C | — | ⬜ à faire | — |
| GA-31 | Connecteur de graphe (app jumelle) pour graver les gammes comme documents reliés | C | F | ⬜ à faire | — |
| GA-32 | Ordonnancement de gammes composées (une gamme qui appelle une gamme) | C | — | ⬜ à faire | — |

Légende des états : ⬜ à faire · 🟨 en cours (PR ouverte) · ✅ faite et testée · ⛔ sacrifiée (assumé).

Sacrifiables dans l'ordre, si le temps manque (§ 28) : l'atelier visuel (le registre porte la même
information), les fantômes, les conflits, le validateur de transition Jira, le connecteur de graphe.
