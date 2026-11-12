/**
 * La couche HTTP des clients Atlassian (idées de consolidation n° 2 et 3).
 *
 * Brancher le vrai Confluence et le vrai Jira, c'est d'abord une discipline de
 * transport, et elle est la même pour les deux :
 *
 *   - **les erreurs sont normalisées** : 401, 403, 404, 409, 429, 5xx ont chacun
 *     un code, pour que l'appelant distingue « pas le droit » de « pas
 *     trouvé » de « pas disponible » — jamais un 500 muet ;
 *   - **on ne rejoue que les requêtes sûres** : un GET se rejoue, un POST et un
 *     PUT jamais (une transition Jira rejouée est une transition en double) ;
 *   - **le quota est respecté** : 100 requêtes par minute et par installation
 *     Forge, donc un compteur à jetons ;
 *   - **la pagination est explicite** : l'appelant fournit la fonction qui
 *     extrait la page suivante, le client ne Devine pas la forme de la réponse.
 *
 * Le transport est injecté : en production c'est `api.asUser()`, en test c'est
 * une fonction. Aucun appel réseau dans les tests.
 */

export type HttpMethod = "GET" | "POST" | "PUT";

export type HttpRequest = {
  readonly method: HttpMethod;
  readonly path: string;
  readonly query?: Readonly<Record<string, string | number | undefined>>;
  readonly body?: unknown;
};

export type HttpResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
};

/** Le transport : la seule chose qui touche le réseau. */
export type Transport = (req: HttpRequest) => Promise<HttpResponse>;

/** Les codes d'erreur normalisés : l'appelant n'a pas à connaître les HTTP. */
export type AtlassianErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "bad_request"
  | "server_error"
  | "network";

export type AtlassianError = {
  readonly code: AtlassianErrorCode;
  readonly status: number;
  readonly message: string;
};

export type HttpOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AtlassianError };

/** Le client : une base, un compteur de quota, une politique de reprise. */
export type AtlassianClient = {
  get<T>(path: string, query?: Readonly<Record<string, string | number | undefined>>): Promise<HttpOutcome<T>>;
  post<T>(path: string, body: unknown, query?: Readonly<Record<string, string | number | undefined>>): Promise<HttpOutcome<T>>;
  put<T>(path: string, body: unknown, query?: Readonly<Record<string, string | number | undefined>>): Promise<HttpOutcome<T>>;
  /** Parcourt les pages : l'extracteur dit ce qu'est une page et où est la suivante. */
  paginate<T>(
    path: string,
    query: Readonly<Record<string, string | number | undefined>>,
    extracteur: (body: unknown) => { readonly items: readonly T[]; readonly next?: string },
  ): Promise<HttpOutcome<readonly T[]>>;
};

export type ClientOptions = {
  readonly transport: Transport;
  /** La base de l'API : `https://api.atlassian.com/ex/confluence/{cloudId}` par exemple. */
  readonly baseUrl: string;
  /** Nombre de reprises sur 429 et 5xx (GET seulement). */
  readonly maxRetries?: number;
  /** Requêtes par minute (quota Forge : 100 par installation). */
  readonly parMinute?: number;
  /** Pause entre deux reprises, en ms (injectable pour les tests). */
  readonly pause?: (ms: number) => Promise<void>;
};

const codeDe = (status: number): AtlassianErrorCode => {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  if (status >= 400) return "bad_request";
  return "server_error";
};

const attendre = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Un compteur à jetons : 100 requêtes par minute, sans pic. */
const creerQuota = (parMinute: number) => {
  let disponible = parMinute;
  let dernier = Date.now();
  const replenir = () => {
    const maintenant = Date.now();
    const ecoule = maintenant - dernier;
    if (ecoule <= 0) return;
    disponible = Math.min(parMinute, disponible + (ecoule * parMinute) / 60_000);
    dernier = maintenant;
  };
  return async (): Promise<void> => {
    for (;;) {
      replenir();
      if (disponible >= 1) {
        disponible -= 1;
        return;
      }
      await attendre(Math.ceil((60_000 / parMinute) * (1 - disponible)));
    }
  };
};

const queryDe = (query: Readonly<Record<string, string | number | undefined>> | undefined): string => {
  if (!query) return "";
  const paires = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return paires.length ? `?${paires.join("&")}` : "";
};

/** L'expéditeur : une requête, ses reprises, son erreur normalisée. */
const creerEnvoyeur = (options: ClientOptions, consommer: () => Promise<void>) => {
  const retries = options.maxRetries ?? 3;
  const pause = options.pause ?? attendre;
  return async <T>(
    method: HttpMethod,
    path: string,
    query: Readonly<Record<string, string | number | undefined>> | undefined,
    body: unknown,
  ): Promise<HttpOutcome<T>> => {
    await consommer();
    const url = `${options.baseUrl}${path}${queryDe(query)}`;
    for (let essai = 0; ; essai += 1) {
      let reponse: HttpResponse;
      try {
        reponse = await options.transport({ method, path: url, ...(body === undefined ? {} : { body }) });
      } catch (err) {
        return { ok: false, error: { code: "network", status: 0, message: (err as Error).message } };
      }
      if (reponse.status >= 200 && reponse.status < 300) {
        return { ok: true, value: reponse.body as T };
      }
      const code = codeDe(reponse.status);
      const rejouable = method === "GET" && (code === "rate_limited" || code === "server_error");
      if (!rejouable || essai >= retries) {
        return { ok: false, error: { code, status: reponse.status, message: `${method} ${path} → ${reponse.status}` } };
      }
      const apres = Number(reponse.headers?.["retry-after"] ?? 0);
      await pause(apres > 0 ? apres * 1000 : 500 * 2 ** essai);
    }
  };
};

/** Construit un client Atlassian : normalisation des erreurs, quota, reprises. */
export const atlassianClient = (options: ClientOptions): AtlassianClient => {
  const envoyer = creerEnvoyeur(options, creerQuota(options.parMinute ?? 100));
  return {
    get: async <T>(
      path: string,
      query?: Readonly<Record<string, string | number | undefined>>,
    ): Promise<HttpOutcome<T>> => envoyer("GET", path, query, undefined),
    post: async <T>(
      path: string,
      body: unknown,
      query?: Readonly<Record<string, string | number | undefined>>,
    ): Promise<HttpOutcome<T>> => envoyer("POST", path, query, body),
    put: async <T>(
      path: string,
      body: unknown,
      query?: Readonly<Record<string, string | number | undefined>>,
    ): Promise<HttpOutcome<T>> => envoyer("PUT", path, query, body),
    paginate: async <T>(
      path: string,
      query: Readonly<Record<string, string | number | undefined>>,
      extracteur: (body: unknown) => { readonly items: readonly T[]; readonly next?: string },
    ): Promise<HttpOutcome<readonly T[]>> => {
      const pages: T[] = [];
      let curseur: string | undefined;
      for (let tour = 0; tour < 50; tour += 1) {
        const requete = { ...query, ...(curseur ? { cursor: curseur } : {}) };
        const reponse = await envoyer<unknown>("GET", path, requete, undefined);
        if (!reponse.ok) return reponse;
        const page = extracteur(reponse.value);
        pages.push(...page.items);
        curseur = page.next;
        if (!curseur) break;
      }
      return { ok: true, value: pages };
    },
  };
};
