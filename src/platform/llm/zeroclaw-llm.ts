/**
 * Gammes — client LLM « ZeroClaw » : le modèle EST un agent ZeroClaw.
 *
 * Le produit a deux voies de modèle hors Forge : appeler l'API InferHub en direct
 * (`inferhub-llm.ts`), ou **déléguer à un agent ZeroClaw** — qui, lui, est servi
 * par InferHub (`[agents.*].model_provider = "custom.inferhub"`). Ce fichier
 * implémente la seconde voie : un `LlmClient` dont `complete()` lance l'agent en
 * coup unique (`zeroclaw agent -a <alias> -m "<message>"`) et rend sa réponse.
 *
 * La consigne système est repliée dans le message (un appel en mode `-m` est un
 * tour unique, il n'a pas de rôle système séparé) : la discipline du rempart de
 * prompt passe donc par le texte, pas par un champ.
 *
 * L'exécution est injectée : en production c'est un `spawn` du binaire ZeroClaw,
 * en test c'est une fonction. Aucun secret ici — le binaire lit sa propre config.
 */

import { spawn } from "node:child_process";
import type { LlmBudget, LlmClient, LlmRequest, LlmResponse } from "../../core/ports";
import { systemFor } from "./prompts";

export type ZeroClawOptions = {
  /** L'alias ZeroClaw à lancer. Défaut `b` : c'est l'agent servi par InferHub. */
  readonly agent?: string;
  readonly cliPath?: string;
  readonly budget?: LlmBudget;
  readonly timeoutMs?: number;
  /** Exécuteur injectable : `(message) => texte rendu par l'agent`. */
  readonly run?: (message: string) => Promise<string>;
};

/** Le texte d'un tour : la consigne système repliée, puis la demande, puis le format. */
const messageDe = (req: LlmRequest): string => [
  systemFor(req.task),
  "",
  req.prompt,
  "",
  req.json ? "Réponds UNIQUEMENT en JSON strict, sans aucun autre texte." : "",
].filter((l) => l !== "").join("\n");

/** Nettoie la sortie du binaire ZeroClaw : on ne garde que la réponse, pas l'habillage. */
const nettoyer = (sortie: string): string => {
  const lignes = sortie
    .split("\n")
    .map((l) => l.replace(/\u001b\[[0-9;]*m/g, "").trimEnd())
    .filter((l) => l.trim().length > 0);
  return lignes.join("\n").trim();
};

/** Estimation en jetons (le binaire ne rapporte pas l'usage) : ~4 caractères par jeton. */
const jetons = (texte: string): number => Math.ceil(texte.length / 4);

/**
 * Traduit l'échec le plus courant : un **autre processus ZeroClaw** détient
 * l'état de configuration (le daemon, par exemple), et le binaire refuse alors de
 * démarrer un second agent. Le message dit quoi faire, pas seulement ce qui a
 * échoué.
 */
const erreurDe = (erreur: string, code: number): Error => {
  if (erreur.includes("owns the config state")) {
    return new Error(
      "ZeroClaw : un autre processus détient l'état de configuration (daemon actif). " +
        "Passez par le client HTTP direct (inferHubLlm) ou arrêtez le daemon.",
    );
  }
  return new Error(`ZeroClaw a quitté avec ${code}: ${erreur.slice(0, 160)}`);
};

/** Lance le binaire ZeroClaw en coup unique et rend sa sortie standard. */
const lancer = (cliPath: string, agent: string, message: string, timeoutMs: number) =>
  new Promise<string>((resolve, reject) => {
    const enfant = spawn(cliPath, ["agent", "--agent", agent, "-m", message], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let sortie = "";
    let erreur = "";
    const tuer = setTimeout(() => enfant.kill("SIGKILL"), timeoutMs);

    enfant.stdout.on("data", (morceau: Buffer) => (sortie += morceau.toString("utf8")));
    enfant.stderr.on("data", (morceau: Buffer) => (erreur += morceau.toString("utf8")));
    enfant.on("error", (err) => {
      clearTimeout(tuer);
      reject(err);
    });
    enfant.on("close", (code) => {
      clearTimeout(tuer);
      if (code === 0) resolve(nettoyer(sortie));
      else reject(erreurDe(nettoyer(erreur), code ?? 1));
    });
  });

/**
 * Le client ZeroClaw : même contrat `LlmClient` que les autres adaptateurs, donc
 * interchangeable — le cœur ne sait pas si le modèle est un agent ou une API.
 */
export const zeroClawLlm = (options: ZeroClawOptions = {}): LlmClient & {
  readonly cacheSize: () => number;
} => {
  const agent = options.agent ?? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.["ZEROCLAW_AGENT"] ?? "b";
  const cliPath = options.cliPath ?? "zeroclaw";
  const timeoutMs = options.timeoutMs ?? 300_000;
  const executer = options.run ?? ((message: string) => lancer(cliPath, agent, message, timeoutMs));
  const cache = new Map<string, LlmResponse>();

  return {
    name: `zeroclaw:@${agent}`,
    cacheSize: () => cache.size,
    complete: async (req: LlmRequest): Promise<LlmResponse> => {
      const key = req.cacheKey ? `${req.task}:${req.cacheKey}` : undefined;
      const hit = key ? cache.get(key) : undefined;
      if (hit) return { ...hit, cached: true };
      const message = messageDe(req);
      const texte = await executer(message);
      if (!texte.trim()) throw new Error("ZeroClaw : réponse vide (modèle indisponible ou plante du binaire)");
      const res: LlmResponse = {
        text: nettoyer(texte),
        model: `zeroclaw:@${agent}`,
        tokensIn: jetons(message),
        tokensOut: jetons(texte),
        cached: false,
      };
      options.budget?.record(req.task, res);
      if (key) cache.set(key, res);
      return res;
    },
  };
};
