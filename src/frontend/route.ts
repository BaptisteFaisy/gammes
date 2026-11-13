/**
 * Route des surfaces Forge — la seule logique de l'UI qui ne soit pas du rendu.
 *
 * Les six modules du manifeste partagent UNE ressource (le point d'entrée UI Kit 2,
 * `src/frontend/index.tsx`) et donc un seul bundle React : c'est la
 * clé de module qui dit quoi afficher.
 * Ce fichier est pur (aucun import de `@forge/*`), donc testable hors navigateur.
 */

/** Les surfaces du produit, une par module du manifeste. */
export type SurfaceKey =
  | "issuePanel"
  | "macro"
  | "atelier"
  | "registre"
  | "reglages"
  | "contentAction"
  | "inconnue";

/** Ce que le contexte Forge garantit : tout le reste est lu défensivement. */
export type SurfaceContext = {
  readonly moduleKey?: string;
  readonly extension?: Readonly<Record<string, unknown>>;
};

/** Clé de module du manifeste → surface. La clé de module est le seul repère fiable. */
export const SURFACE_PAR_MODULE: Readonly<Record<string, SurfaceKey>> = {
  "gammes-issue-panel": "issuePanel",
  "gammes-macro": "macro",
  "gammes-atelier": "atelier",
  "gammes-registre-jira": "registre",
  "gammes-settings": "reglages",
  "gammes-page-action": "contentAction",
};

/** Repli : le type de contexte d'extension, quand la clé de module manque. */
const SURFACE_PAR_CONTEXTE: Readonly<Record<string, SurfaceKey>> = {
  issuePanel: "issuePanel",
  macro: "macro",
  contentAction: "contentAction",
  spaceSettings: "reglages",
  projectPage: "registre",
  globalPage: "atelier",
};

const texte = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

/** Surface à rendre pour ce contexte. Jamais d'exception : `inconnue` sinon. */
export const routeSurface = (ctx: SurfaceContext | undefined): SurfaceKey => {
  if (!ctx) return "inconnue";
  const parModule = texte(ctx.moduleKey);
  if (parModule && SURFACE_PAR_MODULE[parModule]) return SURFACE_PAR_MODULE[parModule];
  const ext = ctx.extension ?? {};
  const parContexte = texte(ext.type) ?? texte(ext.contextType);
  if (parContexte && SURFACE_PAR_CONTEXTE[parContexte]) return SURFACE_PAR_CONTEXTE[parContexte];
  return "inconnue";
};

/** Faits utiles d'une surface, lus sans jamais supposer une forme précise. */
export type ExtensionFacts = {
  readonly contextType?: string;
  readonly issueKey?: string;
  readonly pageAri?: string;
  readonly spaceKey?: string;
  readonly projectId?: string;
};

/** Lecture défensive du contexte d'extension (Jira, Confluence, réglages). */
export const extensionFacts = (ctx: SurfaceContext | undefined): ExtensionFacts => {
  const ext: Readonly<Record<string, unknown>> = ctx?.extension ?? {};
  const nested = (ext.context ?? {}) as Readonly<Record<string, unknown>>;
  const pick = (k: string): string | undefined => texte(ext[k]) ?? texte(nested[k]);
  return {
    ...(pick("type") ? { contextType: pick("type") } : {}),
    ...(pick("issueKey") ? { issueKey: pick("issueKey") } : {}),
    ...(pick("pageAri") || pick("ari") ? { pageAri: pick("pageAri") ?? pick("ari") } : {}),
    ...(pick("spaceKey") ? { spaceKey: pick("spaceKey") } : {}),
    ...(pick("projectId") ? { projectId: pick("projectId") } : {}),
  };
};
