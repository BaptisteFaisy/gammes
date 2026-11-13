/**
 * L'écran d'approbation, dans la macro de la page.
 *
 * Le composant est testé comme la surface le rend : deux états de la gamme
 * (brouillon, approuvée), le refus du noyau rendu lisiblement, et l'absence
 * de silence quand le serveur ne répond pas. `@forge/react` et le pont vers le
 * resolver sont simulés — le test porte sur l'écran, pas sur Atlassian.
 */
import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { createElement, type ReactNode } from "react";
import { Button } from "@forge/react";
import { appeler } from "../../src/frontend/bridge";
import { Approbation } from "../../src/frontend/surfaces/approbation";
import { Macro } from "../../src/frontend/surfaces/macro";

/** Les composants UI Kit 2 simulés : un hôte HTML par composant. */
vi.mock("@forge/react", async () => {
  const { createElement: h } = await import("react");
  const host = (tag: string) => (props: { readonly children?: ReactNode }) =>
    h(tag, null, props.children as ReactNode);
  return {
    Box: host("div"),
    Button: (props: { readonly children?: ReactNode; readonly onClick?: () => void }) =>
      h("button", { onClick: props.onClick }, props.children as ReactNode),
    Heading: host("h3"),
    Lozenge: host("span"),
    Stack: host("div"),
    Text: host("span"),
  };
});

/** Le pont vers le resolver : simulé, comme dans les autres surfaces. */
vi.mock("../../src/frontend/bridge", () => ({ appeler: vi.fn() }));

const require = createRequire(import.meta.url);
const TestRenderer = require("react-test-renderer") as {
  create: (element: unknown) => {
    root: { findAllByType: (type: unknown) => { props: Record<string, unknown> }[] };
    toJSON: () => unknown;
  };
  act: (fn: () => Promise<void> | void) => Promise<void>;
};

const pont = vi.mocked(appeler);
const CODE = "GAM-deploy-01";

/** Le texte rendu par l'écran, à plat. */
const texte = (element: unknown): string => {
  if (element === null || element === undefined) return "";
  if (typeof element === "string" || typeof element === "number") return String(element);
  if (Array.isArray(element)) return element.map(texte).join(" ");
  const noeud = element as { readonly children?: unknown };
  return texte(noeud.children);
};

/** Le rendu de l'écran d'approbation. */
const rendre = async (props: { readonly state?: string; readonly version?: number }) => {
  let arbre: ReturnType<typeof TestRenderer.create> | undefined;
  await TestRenderer.act(async () => {
    arbre = TestRenderer.create(createElement(Approbation, { code: CODE, ...props }));
  });
  return arbre!;
};

/** Le clic sur le bouton d'approbation, et son effet. */
const cliquer = async (arbre: ReturnType<typeof TestRenderer.create>) => {
  const bouton = arbre.root.findAllByType(Button)[0];
  await TestRenderer.act(async () => {
    await (bouton?.props.onClick as () => Promise<void>)();
  });
};

describe("écran d'approbation (macro de la page)", () => {
  it("une gamme en brouillon propose le bouton d'approbation", async () => {
    const arbre = await rendre({ state: "draft", version: 1 });
    const boutons = arbre.root.findAllByType(Button);
    expect(boutons).toHaveLength(1);
    expect(boutons[0]?.props.children).toBe("Approuver cette version");
    expect(texte(arbre.toJSON())).toContain("brouillon");
  });

  it("une gamme déjà approuvée est dite, sans bouton", async () => {
    const arbre = await rendre({ state: "approved", version: 1 });
    expect(arbre.root.findAllByType(Button)).toHaveLength(0);
    expect(texte(arbre.toJSON())).toContain("approuvée");
  });

  it("un état inconnu ne propose rien : on n'approuve pas à l'aveugle", async () => {
    const arbre = await rendre({ state: undefined });
    expect(arbre.root.findAllByType(Button)).toHaveLength(0);
    expect(texte(arbre.toJSON())).toContain("inconnu");
  });

  it("le refus du noyau est rendu lisiblement, jamais une exception", async () => {
    pont.mockResolvedValue({ ok: false, error: { code: "lock_secret", messageFr: "Un secret est détecté." } });
    const arbre = await rendre({ state: "draft", version: 1 });
    await cliquer(arbre);
    expect(texte(arbre.toJSON())).toContain("Un secret est détecté.");
    expect(pont).toHaveBeenCalledWith("approve", { code: CODE });
  });

  it("un serveur muet n'est jamais un écran vide", async () => {
    pont.mockResolvedValue(undefined);
    const arbre = await rendre({ state: "draft", version: 1 });
    await cliquer(arbre);
    expect(texte(arbre.toJSON())).toContain("n'a pas répondu");
  });
});

describe("approbation dans la macro", () => {
  const etatMacro = (state: string) => ({
    bound: true,
    sync: "synced",
    code: CODE,
    version: 1,
    state,
    runs: 0,
    workshop: { syncedPct: 1, medianGapDays: 0, staleOver90d: 0, total: 1 },
    message: `${CODE}@v1 : synchronisée avec cette page.`,
  });

  const rendreMacro = async (state: string) => {
    pont.mockImplementation(async (cle: string) => (cle === "macroState" ? etatMacro(state) : undefined));
    let arbre: ReturnType<typeof TestRenderer.create> | undefined;
    await TestRenderer.act(async () => {
      arbre = TestRenderer.create(createElement(Macro, { facts: { pageAri: "ari:cloud:confluence:demo:page/1001" } }));
    });
    return arbre!;
  };

  it("une page liée à un brouillon montre le bouton d'approbation", async () => {
    const arbre = await rendreMacro("draft");
    expect(arbre.root.findAllByType(Button)).toHaveLength(1);
    expect(texte(arbre.toJSON())).toContain("Approuver cette version");
  });

  it("une page liée à une gamme approuvée le dit, sans bouton", async () => {
    const arbre = await rendreMacro("approved");
    expect(arbre.root.findAllByType(Button)).toHaveLength(0);
    expect(texte(arbre.toJSON())).toContain("approuvée");
  });
});
