/**
 * Gammes — site public : tes données réelles.
 *
 * Le site est statique : il ne peut pas ouvrir de session Confluence ou Jira à ta place
 * (identifiants + CORS). Ce qu'il peut faire, et qui suffit à travailler sur du réel :
 * **tu colles ta page** (format storage Confluence, ou n'importe quel HTML/liste) et le
 * compilateur tourne dessus ; **tu colles tes tickets** et la détection de fantômes tourne
 * dessus ; et l'atelier entier s'exporte / se réimporte en JSON.
 *
 * Dans l'app Forge, ces mêmes fonctions lisent Confluence et Jira côté serveur, au nom de
 * l'utilisateur connecté (`src/platform/forge/atlassian-ports.ts`).
 */

import type { AppState } from "./state";
import { say } from "./state";
import { area, badge, button, code, details, field, h, kv, line, note, panel, table } from "./dom";
import { addPastedPage, setTickets } from "../seed/atelier";
import { memoryStore } from "../src/platform/memory-store";
import type { Collection, Deps } from "../src/core/ports";
import type { IssueDigest } from "../src/core/types";
import type { Navigate, Rerender } from "./types";

const COLLECTIONS = [
  "gammes", "versions", "runs", "bindings", "amendments", "stepStats", "conflicts", "conciliations",
  "ghosts", "permits", "exports", "coverage", "findings", "candidates", "settings", "deviations",
] as const;

type CollectionName = (typeof COLLECTIONS)[number];
type Row = Record<string, unknown>;
type AnyCollection = Collection<Row>;

const collectionOf = (deps: Deps, name: CollectionName): AnyCollection => deps.store[name] as unknown as AnyCollection;

export const realDataPanel = (state: AppState, rerender: Rerender, go: Navigate): HTMLElement => {
  const root = panel("Données réelles — ta page, tes tickets, ton atelier");
  root.append(
    note(
      "Rien n'est envoyé nulle part : le traitement a lieu dans ton navigateur. Une page collée devient " +
        "une page du catalogue, des tickets collés remplacent le jeu de démonstration.",
      "info",
    ),
    pageBlock(state, rerender, go),
    ticketsBlock(state, rerender, go),
    atelierBlock(state, rerender),
    limitsBlock(),
  );
  return root;
};

const pageBlock = (state: AppState, rerender: Rerender, go: Navigate): HTMLElement => {
  let title = state.realPageTitle ?? "Procédure : sauvegarder la base paiements";
  let body = state.realPage ?? EXEMPLE_REEL;
  const box = h("div", {});
  box.append(
    h("h3", {}, "1 · Ta page de procédure"),
    field("Titre", title, (v) => { title = v; state.realPageTitle = v; }),
    area("Contenu (format storage Confluence, HTML, ou texte avec listes)", body, (v) => { body = v; state.realPage = v; }, 12),
    line(
      button("Compiler cette page réelle", () => {
        const ari = `ari:page/collee-${Date.now().toString(36)}`;
        addPastedPage(ari, title || "Page collée", body);
        state.page = ari;
        say(state, `Page réelle « ${title} » ajoutée au catalogue — ${body.length} caractères.`);
        go("compiler");
      }, "primary"),
      button("Charger un exemple ambigu (prose, sans liste)", () => {
        title = "Mode opératoire : rotation des clés de signature";
        body = EXEMPLE_PROSE;
        state.realPageTitle = title;
        state.realPage = body;
        rerender();
      }),
      button("Charger un exemple structuré (listes + code)", () => {
        title = "Procédure : sauvegarder la base paiements";
        body = EXEMPLE_REEL;
        state.realPageTitle = title;
        state.realPage = body;
        rerender();
      }),
    ),
    details("Ce que le compilateur accepte", code(ACCEPTES)),
  );
  return box;
};

const EXEMPLE_REEL = [
  "<h1>Procédure : sauvegarder la base paiements</h1>",
  "<h2>Avant de commencer</h2><ul><li>La fenêtre de sauvegarde est ouverte.</li></ul>",
  "<h2>Étapes</h2><ol>",
  "<li>Vérifier que la réplication est en avance de moins de 30 secondes.</li>",
  "<li>Lancer la sauvegarde :",
  '<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[pg_dump -Fc paiements > /backups/paiements-$(date +%F).dump]]></ac:plain-text-body></ac:structured-macro>',
  "</li>",
  "<li>Contrôler la taille du fichier produit (au moins 2 Go).</li>",
  "<li>Faire valider la sauvegarde par le responsable d'astreinte.</li>",
  "</ol>",
  "<h2>Si ça tourne mal</h2><ol><li>Repasser sur la réplication secondaire.</li></ol>",
].join("\n");

const EXEMPLE_PROSE = [
  "<h1>Mode opératoire : rotation des clés de signature</h1>",
  "<p>Exécuter la rotation en deux temps : d'abord générer la nouvelle clé dans le coffre, puis attendre que tous les services l'aient rechargée avant de révoquer l'ancienne clé de signature.</p>",
  "<p>Ensuite s'assurer que tout va bien avant de prévenir les équipes concernées de la fin de l'opération.</p>",
].join("\n");

const ACCEPTES = [
  "Format storage Confluence : <h1>…</h1>, <ol>/<ul>/<li>, <ac:structured-macro ac:name=\"code\"> avec CDATA,",
  "  <table>/<tr>/<td>, cases à cocher (ac:task).",
  "HTML ordinaire : <h1> à <h6>, <ol>, <ul>, <li>, <pre>, <code>, <table>.",
  "Texte simple : les paragraphes impératifs longs passent par le modèle (prose ambiguë) — il faut donc",
  "  un modèle branché (écran « Modèle réel ») pour qu'ils deviennent des étapes.",
  "",
  "Sections reconnues : « Entrées » → entrées typées · « Avant de commencer »/« Prérequis » → préconditions ·",
  "  « Si ça tourne mal »/« Repli » → repli outillé · le reste → étapes.",
].join("\n");

const ticketsBlock = (state: AppState, rerender: Rerender, go: Navigate): HTMLElement => {
  let raw = state.realTickets ?? "";
  const box = h("div", {});
  box.append(
    h("h3", {}, "2 · Tes tickets Jira / JSM"),
    area("JSON (export de /rest/api/3/search) ou lignes « CLE | résumé | composant | créé | résolu | commentaires »", raw, (v) => { raw = v; state.realTickets = v; }, 10),
    line(
      button("Charger ces tickets", () => loadTickets(state, raw, box, go), "primary"),
      button("Vider", () => { raw = ""; state.realTickets = ""; rerender(); }),
    ),
    details("Formats acceptés", code(FORMATS_TICKETS)),
  );
  return box;
};

const FORMATS_TICKETS = [
  "A) JSON — la réponse brute de GET /rest/api/3/search :",
  '   {"issues":[{"key":"PAY-101","fields":{"summary":"…","created":"2026-03-01T09:00:00.000Z",',
  '     "resolution":{"resolutionDate":"…"},"components":[{"name":"paiements"}],"comment":{"comments":[{"body":"…"}]}}}]}',
  "",
  "B) JSON — un tableau d'objets plats :",
  '   [{"key":"PAY-101","summary":"…","components":["paiements"],"createdAt":"…","resolvedAt":"…","commentBodies":["…"]}]',
  "",
  "C) Lignes séparées par des barres verticales :",
  "   PAY-101 | Réinitialiser le coffre de clés | paiements | 2026-03-01 | 2026-03-02 | ouvrir le coffre; révoquer l'ancienne clé",
  "",
  "Le regroupement se fait sur projet + composants + les trois mots porteurs du titre ; il faut au",
  "moins 5 tickets semblables pour qu'un motif soit proposé (MIN_CLUSTER_SIZE).",
].join("\n");

const loadTickets = (state: AppState, raw: string, box: HTMLElement, go: Navigate): void => {
  const parsed = parseTickets(raw);
  box.append(
    parsed.length === 0
      ? note("Aucun ticket reconnu dans ce texte. Voir « Formats acceptés ».", "ko")
      : note(`${parsed.length} ticket(s) chargé(s). Les fantômes déjà détectés ont été remis à zéro.`, "ok"),
  );
  if (parsed.length === 0) return;
  setTickets(parsed);
  void resetGhosts(state);
  say(state, `${parsed.length} ticket(s) réel(s) chargé(s) — détection de fantômes à relancer.`);
  go("fantomes");
};

const resetGhosts = async (state: AppState): Promise<void> => {
  for (const ghost of await state.deps.store.ghosts.list()) {
    await state.deps.store.ghosts.update(ghost.id, (g) => ({ ...g, state: "dismissed" }));
  }
};

export const parseTickets = (raw: string): readonly IssueDigest[] => {
  const text = raw.trim();
  if (!text) return [];
  if (text.startsWith("{") || text.startsWith("[")) return parseJsonTickets(text);
  return parseLines(text);
};

const field_ = (source: Record<string, unknown>, key: string, fallback: string): string => {
  const value = source[key];
  return typeof value === "string" && value ? value : fallback;
};

const fromFlat = (raw: Record<string, unknown>, index: number): IssueDigest => ({
  id: field_(raw, "id", `pasted-${index}`),
  key: field_(raw, "key", `PASTE-${index}`),
  projectKey: field_(raw, "projectKey", String(field_(raw, "key", "X")).split("-")[0] ?? "X"),
  summary: field_(raw, "summary", "(sans résumé)"),
  components: Array.isArray(raw.components) ? raw.components.map((c) => (typeof c === "string" ? c : field_(c as Record<string, unknown>, "name", ""))).filter(Boolean) : [],
  labels: Array.isArray(raw.labels) ? raw.labels.map((l) => String(l)) : [],
  createdAt: field_(raw, "createdAt", new Date(0).toISOString()),
  ...(raw.resolvedAt ? { resolvedAt: field_(raw, "resolvedAt", "") } : {}),
  transitions: Array.isArray(raw.transitions) ? raw.transitions.map(String) : [],
  commentBodies: Array.isArray(raw.commentBodies) ? raw.commentBodies.map(String) : [],
  assigneeCount: typeof raw.assigneeCount === "number" ? raw.assigneeCount : 1,
});

const parseJsonTickets = (text: string): readonly IssueDigest[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const issues = Array.isArray(parsed) ? parsed : (parsed as { issues?: unknown[] }).issues;
  if (!Array.isArray(issues)) return [];
  return issues.map((item, index) => {
    const raw = item as Record<string, unknown>;
    const fields = raw.fields as Record<string, unknown> | undefined;
    if (!fields) return fromFlat(raw, index);
    const resolution = fields.resolution as Record<string, unknown> | undefined;
    const comment = fields.comment as { comments?: { body?: string }[] } | undefined;
    return fromFlat(
      {
        id: raw.id,
        key: raw.key,
        summary: fields.summary,
        components: fields.components,
        labels: fields.labels,
        createdAt: fields.created,
        ...(resolution?.resolutionDate ? { resolvedAt: resolution.resolutionDate } : {}),
        commentBodies: (comment?.comments ?? []).map((c) => c.body ?? "").filter(Boolean),
        assigneeCount: fields.assignee ? 1 : 0,
      },
      index,
    );
  });
};

const parseLines = (text: string): readonly IssueDigest[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|"))
    .map((line, index) => {
      const cells = line.split("|").map((c) => c.trim());
      return fromFlat(
        {
          key: cells[0] ?? `PASTE-${index}`,
          summary: cells[1] ?? "(sans résumé)",
          components: cells[2] ? [cells[2]] : [],
          createdAt: cells[3] ? new Date(cells[3]).toISOString() : new Date(0).toISOString(),
          ...(cells[4] ? { resolvedAt: new Date(cells[4]).toISOString() } : {}),
          commentBodies: cells[5] ? cells[5].split(";").map((c) => c.trim()).filter(Boolean) : [],
        },
        index,
      );
    });

const atelierBlock = (state: AppState, rerender: Rerender): HTMLElement => {
  let imported = "";
  return h(
    "div",
    {},
    h("h3", {}, "3 · Emporter ton atelier"),
    line(
      button("Exporter l'atelier en JSON", () => void exportAtelier(state), "primary"),
      button("Importer un atelier", () => void importAtelier(state, imported, rerender)),
    ),
    area("Atelier au format JSON (pour import)", imported, (v) => { imported = v; }, 6),
    note("L'export contient gammes, versions, exécutions, traces, déviations, amendements, conflits, fantômes, signalements et réglages. Aucune clé, aucune valeur de secret : seulement des empreintes et des aperçus masqués.", "info"),
  );
};

const exportAtelier = async (state: AppState): Promise<void> => {
  const dump: Record<string, unknown> = {};
  for (const name of COLLECTIONS) dump[name] = await collectionOf(state.deps, name).list();
  dump.events = await state.deps.store.events();
  dump.exportedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = h("a", { href: url, download: "atelier-gammes.json" }) as HTMLAnchorElement;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  say(state, "Atelier exporté (atelier-gammes.json).");
};

const importAtelier = async (state: AppState, raw: string, rerender: Rerender): Promise<void> => {
  if (!raw.trim()) {
    say(state, "Rien à importer : colle d'abord un atelier exporté.");
    rerender();
    return;
  }
  let dump: Record<string, unknown>;
  try {
    dump = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    say(state, "Import refusé : JSON invalide.");
    rerender();
    return;
  }
  const store = memoryStore();
  let rows = 0;
  for (const name of COLLECTIONS) {
    const items = Array.isArray(dump[name]) ? (dump[name] as Row[]) : [];
    for (const item of items) {
      await collectionOf({ ...state.deps, store }, name).insert(item);
      rows += 1;
    }
  }
  state.deps = { ...state.deps, store };
  say(state, `Atelier importé : ${rows} enregistrements restaurés. Le journal d'événements n'est pas réimporté (append-only).`);
  rerender();
};

const limitsBlock = (): HTMLElement =>
  details(
    "Pourquoi le site ne lit pas Confluence directement",
    table(
      ["Contrainte", "Conséquence", "Ce que fait l'app Forge"],
      [
        ["Identifiants", "Un site public ne peut pas détenir ta session Atlassian", "Lecture `asUser()` côté serveur, avec les droits de l'utilisateur connecté"],
        ["CORS", "Confluence/Jira ne renvoient pas d'en-tête CORS pour un site tiers", "Appels serveur via `requestConfluence` / `requestJira`"],
        ["Clé de modèle", "Une clé embarquée dans un site public est une clé perdue", "LLM hébergé Forge (`llm:` au manifeste), clé jamais exposée"],
      ],
    ),
    note("D'où cet écran : tu apportes tes données, le site les traite localement, et rien ne sort de ton navigateur.", "info"),
    kv("chemin serveur équivalent", h("code", {}, "src/platform/forge/atlassian-ports.ts")),
    badge("aucune donnée envoyée", "ok"),
  );
