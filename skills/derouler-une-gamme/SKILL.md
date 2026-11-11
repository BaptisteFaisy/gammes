# Skill : dérouler une gamme

> Skill générique, publié en source ouverte (bonus MCP du Codegeist 2026).
> C'est la conduite attendue de **tout** agent dans l'organisation, pas seulement dans
> cette app. Il est déclaré statiquement au manifeste (`rovo:skill`) et sert toutes les
> gammes : le contenu vient de la base via les outils MCP, jamais du manifeste.

## Quand l'utiliser

Dès qu'un agent s'apprête à **agir** sur un service, un environnement ou une ressource —
déployer, tourner une clé, intégrer un collaborateur, répondre à un incident. Avant le geste,
pas après.

## La conduite — dans cet ordre

1. **Chercher avant d'agir.** Appeler `check-before-acting` (ou `find-procedure`) avec le geste
   envisagé et le service. Ne jamais improviser un geste sensible sans avoir demandé.
2. **Lire le verdict.**
   - *Aucune gamme approuvée* → **s'arrêter** et le dire. Ne pas improviser. Proposer à un humain
     de documenter la procédure (`compile-page` produit un brouillon, jamais une publication).
   - *Gamme non approuvée* (brouillon, en revue, dépréciée) → **ne pas s'en servir** ; le signaler.
   - *Gamme approuvée* → continuer.
3. **Demander les entrées typées.** `start-run` avec les entrées de la gamme. Une entrée
   obligatoire manquante bloque le démarrage : ne pas la deviner.
4. **Dérouler étape par étape.** `get-current-step` rend le texte, la commande, le résultat
   attendu, la preuve exigée et les verrous. Un humain voit une checklist, un agent voit
   l'instruction suivante — **le même contenu**.
5. **Acquitter avec la preuve.** `record-step` avec l'issue et la preuve (sortie de commande,
   lien de build, capture, attestation). Sans la preuve là où elle est exigée, l'étape
   **n'avance pas**.
6. **S'arrêter net au premier verrou.**
   - *Verrou humain* → un agent reçoit un refus explicite ; la tentative est enregistrée comme
     déviation. Passer la main à un humain.
   - *Verrou de permis* → sans permis valide (`permis-forge`), refus + demande de permis à créer.
     Ne pas contourner.
   - *Verrou de secret* → une étape contenant une clé n'est pas publiée ; ne jamais en recopier.
7. **Déclarer toute déviation.** `report-deviation` : ce qui a été fait à la place, et pourquoi.
   Une déviation n'est pas un échec caché — c'est la matière la plus précieuse du produit.
8. **Clore et citer la version.** `finish-run` rend la trace citable
   (`GAM-deploy-01@v7 · run_3`). Le compte rendu cite toujours la version.

## Ce que l'agent ne fait jamais

- improviser une étape à risque ;
- acquitter une étape réservée à un humain ;
- exécuter une commande que la gamme ne prescrit pas ;
- recopier un secret, une clé ou une donnée personnelle ;
- conclure sans effectif : sous le seuil, une statistique dit « pas assez de recul », jamais un chiffre.

## Outils MCP disponibles

`find-procedure` · `check-before-acting` · `get-procedure` · `list-procedures` · `start-run` ·
`get-current-step` · `record-step` · `report-deviation` · `finish-run` · `get-run-trace` ·
`get-procedure-stats` · `propose-amendment` · `compile-page` · `export-skill` ·
`get-missing-procedures` · `get-conflicts`.

## Point d'entrée externe

Un hook d'agent de code ou un pipeline CI peut demander « existe-t-il une procédure pour ce que
je m'apprête à faire ? » via le `webtrigger` signé (`src/platform/webtrigger.ts`) : même verdict
que `check-before-acting`, sans client MCP.
