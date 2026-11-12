# Devpost — Gammes (draft de soumission)

> À coller dans le formulaire Devpost de Codegeist 2026. Rédigé en anglais (langue des
> juges). Les champs marqués `[à renseigner]` attendent une valeur du site (URLs,
> images, captures). La vidéo est exclue de cette rédaction (scénario dans
> `docs/VIDEO-SCRIPT.md`).

## Title

**Gammes — your runbooks, as tools**

## Tagline (≤ 80 chars)

Compile Confluence procedures into executable, lockable, traceable tools for agents.

## Elevator pitch (what it does)

Your wiki already knows how to do everything; your agents don't. **Gammes** compiles a
Confluence procedure page into an executable *gamme* — deterministic extraction first
(lists, checkboxes, code blocks, tables), the model only on ambiguous prose, and **every
step cites the exact passage** it came from.

Then the gamme becomes a tool any agent can call: **16 MCP tools** (`rovo:mcp`), an
exported open-source **`SKILL.md`** per approved gamme, and a **signed webhook** so a CI
pipeline or a coding-agent hook can ask *"is there a procedure for this?"* before a
sensitive gesture.

Three locks are enforced server-side: *human* (an agent cannot attest a human step),
*permit* (a risky step requires a valid permit), *secret* (keys and personal data are
never published — they become findings). A run is pinned to an **immutable version**:
during an incident you always know which version was followed, who did what, and what
proof was left behind.

Documentation stops decaying. From the traces, Gammes measures failure and skip rates
per step — with sample size, never a fake percentage — proposes amendments with proof,
surfaces **ghost gammes** (repeated tickets with no written procedure), flags
out-of-sync pages, and detects **conflicting procedures** cited from both sides.
**The app never decides**: it compiles, proposes, refuses, cites — a human approves.

## Problem it solves

Procedures live in Confluence and die there. Humans skim them; agents never read them;
and nobody can say which version was followed during the incident. Boards fill with
tickets for the same manual gesture; runbooks drift out of sync; two teams prescribe
incompatible things. Gammes turns the wiki into an executable, governed source of truth
— with the human authority, the traceability and the "no fake data" discipline that
production demands.

## How it's built

- **Forge** (`manifest.yml` validated against `@forge/manifest` 13.9.0 in CI), **UI Kit 2**
  for the six surfaces (Atelier, macro Confluence, encart Jira, réglages, registre, action).
- **Rovo**: the *Le compagnon* agent + a generic skill (`derouler-une-gamme`) that encodes
  the expected conduct of any agent, and the **16 `rovo:mcp` tools**.
- **Teamwork Graph** read for scope and owner (`document`, `software-service`, `project`);
  a twin app writes links — modeled as human-approved, receipt-recorded propositions.
- A **pure TypeScript domain core** behind ports: the full acceptance suite (§ 25) runs
  off-platform in CI, no Atlassian site needed. The model is used only on ambiguous prose,
  cached by content fingerprint, with a displayed budget.

## Demo

`npm ci && npm run demo` — the whole scenario in memory (detection, diff, steps, locks,
approval, desync, stats, export), no network. Live site: `https://baptistefaisy.github.io/gammes/`.

## Project links

- Repository: `https://github.com/BaptisteFaisy/gammes`
- Demo site: `https://baptistefaisy.github.io/gammes/`
- Video: `[à renseigner]` · Marketplace listing: `[à renseigner (soumission dès le 16 décembre)]`

## Bonuses targeted

- **Rovo agents / skills** (primary): `le-compagnon` + the generic skill + one exported
  `SKILL.md` per approved gamme.
- **MCP**: the 16 `rovo:mcp` tools, one generic toolset for all gammes.
- **Marketplace**: listing submitted from 16 December (`docs/MARKETPLACE.md`).
- **Teamwork Graph** (supporting): scope and owner read from the graph; a twin app engraves
  gammes as connected documents.

## What's next

- **GA-30/31/32 delivered**: cross-space/organization publication (immutable snapshot),
  the twin-app graph connector, and composite gammes (a gamme calling a gamme, acquitted
  by the child's closed trace).
- Deploy the UI Kit 2 rendering to a Forge development site to validate the six surfaces
  in real conditions, then the Marketplace listing.

## Screenshots / media

`[à renseigner : captures de l'atelier, de la macro, de l'encart Jira, de la carte de preuve]`