# Demandes aux fichiers partagés

Un lot ne modifie jamais un fichier partagé (`package.json`, `tsconfig.json`, `manifest.yml`,
`src/core/types.ts`, `src/core/ports.ts`, `src/core/result.ts`, `test/helpers.ts`, `.github/**`,
`scripts/check-limits.mjs`) : il écrit ici ce dont il a besoin, et l'intégrateur l'applique sur
`main` avant de fusionner la PR.

Un fichier par branche : `docs/DEMANDES/<branche>.md`.

Format attendu, une demande par bloc :

```markdown
## <branche> — <date>

### 1. Type manquant
- fichier : `src/core/types/atelier.ts`
- besoin : `ProcedureMatch` pour `find-procedure`
- proposition :
  ```ts
  export type ProcedureMatch = { readonly code: string; readonly title: string; readonly version: number;
    readonly state: GammeState; readonly confidence: number; readonly reasons: readonly string[] };
  ```
- pourquoi pas chez moi : consommé aussi par le lot H (écran de recherche).

### 2. Dépendance npm
- paquet : `yaml@2.6.1` (déjà présent) — rien à ajouter.
```

Règle : une demande non traitée n'autorise pas à toucher au fichier partagé. On attend, ou on
contourne dans son propre lot, et on le dit dans la PR.
