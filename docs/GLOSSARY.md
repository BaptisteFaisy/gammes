# Glossary — Gammes (bilingual)

> Le vocabulaire produit du § 4, avec l'équivalent anglais retenu pour la soumission et le type
> TypeScript correspondant. La discipline : **écrit ≠ compilé ≠ approuvé ≠ exécuté ≠ réussi**.

| Français | English | Définition produit | Type (`src/core/types/*`) |
|---|---|---|---|
| Gamme | *gamme* (kept) / runbook-as-tool | Une procédure compilée : étapes ordonnées, entrées, preuves attendues, verrous, version. | `Gamme`, `GammeVersion` |
| Page source | source page | La page Confluence d'origine ; chaque étape cite son passage exact. | `PageDigest`, `SourceSpan` |
| Étape | step | Opération élémentaire : `manual`, `command`, `check`, `decision`, `notification`. | `Step`, `StepKind` |
| Preuve attendue | expected evidence | Ce qu'une étape doit laisser derrière elle, avec sa force. | `EvidenceSpec`, `Evidence` |
| Force de preuve | evidence strength | `machine` > `attested` > `declared`. | `EvidenceStrength` |
| Verrou | lock | Ce qui interdit d'avancer : humain, permis, secret. | `StepLock`, `LockKind` |
| Verrou humain | human lock | Étape réservée à une personne authentifiée ; refus à un agent, tracé en déviation. | `LockKind = "human"` |
| Verrou de permis | permit lock | Un agent doit présenter un permis valide (`permis-forge`). | `LockKind = "permit"`, `PermitCheck` |
| Verrou de secret | secret lock | Aucun secret publié ; signalement + emplacement de remplacement. | `LockKind = "secret"`, `SecretFinding` |
| Version | version | Une version est **immuable** ; une exécution y est épinglée. | `GammeVersion.immutable` |
| Exécution | run | Une instance déroulée, humaine ou agent. | `Run` |
| Trace | trace | Le journal d'une exécution ; la preuve, citable. | `Trace` |
| Déviation | deviation | Ce qui a été fait à la place, et pourquoi. Matière la plus précieuse. | `Deviation`, `DeviationOrigin` |
| Désynchronisée | out of sync / stale | La page source a changé depuis la compilation ; âge de l'écart affiché. | `SyncState = "stale"` |
| Source disparue | source gone | La page n'existe plus ; la gamme garde sa dernière version. | `SyncState = "source_gone"` |
| Amendement | amendment | Modification proposée d'après les traces ; jamais appliquée seule. | `Amendment`, `AmendmentState` |
| Gamme fantôme | ghost gamme | Travail répété, jamais écrit ; détecté depuis Jira/JSM. | `GhostCandidate` |
| Conflit | conflict | Deux prescriptions incompatibles pour la même action. | `Conflict`, `ConflictKind` |
| Conciliation | conciliation | Dossier d'options préparé par hermes ; jamais une décision. | `Conciliation`, `ConciliationOption` |
| Atelier | workshop | La vue d'ensemble : établis, états, usage, poussières. | `workshopDust`, `freshness` |
| Établi | bench | Une gamme ; sa taille = le nombre d'étapes. | (UI) |
| Poussière | dust | Gamme jamais exécutée depuis longtemps. | `DustItem.kind = "dust"` |
| Toile d'araignée | cobweb | Approbation ayant passé sa date de révision. | `DustItem.kind = "cobweb"` |
| Compagnon | companion | L'agent qui déroule sous supervision. | `agents/le-compagnon.md` |
| Apprenti | apprentice | Un agent sans les permis, déroulant sous permis limité. | (UI) |
| Entrée | input | Paramètre typé et obligatoire d'une gamme. | `InputSpec`, `InputType` |
| Repli | fallback | Ce qu'on fait si ça tourne mal ; étapes de repli outillées. | `Fallback` |
| Non falsifiable | non-falsifiable | Étape invérifiable (« s'assurer que tout va bien ») ; reformulation proposée. | `Step.falsifiable` |
| Couverture | coverage | Part compilée / approuvée / tracée / désynchronisée. | `Coverage` |
| Effectif | sample size / cohort | `n` ; sous le seuil, « pas assez de recul », aucun pourcentage. | `Cohort`, `Rate` |
| Pas assez de recul | not enough history | `Rate.value === undefined` : on ne conclut pas. | `Rate` |

## Discipline de vocabulaire (§ 4)

| Français | English | Ce que ça prouve |
|---|---|---|
| écrit | written | la page le dit |
| compilé | compiled | la gamme existe (brouillon) |
| approuvé | approved | un humain l'a attestée, version figée |
| exécuté | executed | une trace le prouve |
| réussi | succeeded | l'issue est conforme |

L'app ne dit jamais « la procédure est respectée » sans trace. *The app never claims a procedure
was followed without a trace.*
