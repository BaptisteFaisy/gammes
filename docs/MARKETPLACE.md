# Atlassian Marketplace listing — Gammes

> Texte de soumission au listing (§ 28 : soumission avant le 22 décembre — délai Devpost —, ticket de revue fourni comme
> preuve). Tous les champs sont prêts à coller dans le formulaire Marketplace.

## Name

**Gammes — your runbooks, as tools**

## Tagline (≤ 80 chars)

Compile Confluence procedures into executable, lockable, traceable tools for agents.

## Summary (≤ 200 chars)

Your wiki already knows how to do everything; your agents don't. Gammes compiles a procedure page
into an executable gamme — steps, evidence, locks, immutable versions — callable by any agent via MCP.

## Category

- Primary: **Developer tools / Automation**
- Secondary: **IT & Service Desk**, **Documentation & Wikis**
- Works with: **Confluence** (primary), **Jira**, **Jira Service Management**, **Rovo**

## Long description

A procedure lives in a Confluence page — and dies there. Humans skim it, agents never read it, and
nobody knows which version was followed during the incident.

**Gammes compiles that page into an executable *gamme*.** Deterministic extraction first (lists,
checkboxes, code blocks, tables), the model only on ambiguous prose, and **every step cites the exact
passage** it came from. Compilation publishes nothing: it yields a draft and a diff, and a human
approves — a dated act that freezes an **immutable version**.

Then the gamme becomes a tool any agent can call:

- **16 MCP tools** (`rovo:mcp`) — one generic toolset serving all gammes: `find-procedure`,
  `check-before-acting`, `start-run`, `get-current-step`, `record-step`, `report-deviation`,
  `finish-run`, `get-run-trace`, and more.
- **An exported `SKILL.md`** per approved gamme, open source, added to third-party agents.
- **A signed webhook** so a CI pipeline or coding-agent hook can ask "is there a procedure for this?"
  before a sensitive gesture.

**Three locks, enforced server-side:**

- *Human lock* — a `human_only` step can't be attested by an agent; the attempt is recorded as a deviation.
- *Permit lock* — a risky step requires a valid permit ( integrates with `permis-forge` ).
- *Secret lock* — a key, password or personal datum is never published; it becomes a finding with a
  replacement location proposed.

**The loop that makes documentation alive.** From the traces, Gammes measures failure and skip rates
per step — with sample size, a Wilson range, and "not enough history" below the threshold, never a fake
percentage. A step that fails six times in ten is proposed for amendment, proofs attached. Repeated
tickets with no written procedure surface as **ghost gammes** with their cost. Out-of-sync pages are
flagged with the age of the gap and a recompilation diff. Two gammes prescribing incompatible things
raise a **conflict**, cited from both sides, carried to both owners — the app never decides.

**What Gammes never does:** publish without human approval, let an agent attest a human step, run
commands itself, store a secret, erase a version or a trace, rate a person, or conclude without sample
size.

## Permissions and why they are needed

| Scope | Why |
|---|---|
| `read:confluence-content.all` | read procedure pages to compile |
| `write:confluence-content` | propose (never auto-apply) page edits from amendments |
| `read:space:confluence`, `read:confluence-user` | scope, ownership, attribution |
| `storage:app` | store gammes, versions, runs, traces, findings |
| `read:attachment:confluence` | evidence references |
| `read:issue-details:jira`, `write:issue:jira`, `read:jira-work`, `write:jira-work` | the Jira issue panel, ghost detection from ticket history, workflow validator |
| `read:graph:page:confluence`, `read:graph:project:atlassian` | scope and owner from the Teamwork Graph |
| `execute:rovo:actions` *(demandé, non accordé sur le site de dev)* | the MCP tools |
| `llm:public-models` *(demandé, non accordé sur le site de dev)* | extraction of ambiguous prose, qualification, conciliation — cached by content fingerprint |

External fetch: `api.inferhub.dev` (optional off-platform LLM for the local harness / conciliator).

## Data, privacy and security

- **No secret stored or published.** Detectors run before publication; findings keep only a fingerprint
  and a masked preview, never the value.
- **No per-person metric.** Traces name an actor for audit and responsibility, never for ranking;
  statistics are about steps. Enforced by CI (`npm run lint`) and an automated test (recette 20).
- **Immutable traces.** Versions and traces are never modified or deleted; deprecate is not delete.
- **Human authority everywhere.** Approval, amendment validation and attestation are dated, named human
  acts; an agent is refused.
- **Runs off-platform.** The domain core is pure TypeScript behind ports, so the whole acceptance suite
  runs in CI without an Atlassian site.

## Pricing

Free during Codegeist 2026. (Listing submitted before 22 December — Devpost deadline; review ticket provided as proof.)

## Support

- Repository: `https://github.com/Tradoooo/gammes` (issues open)
- Docs: `README.md`, `docs/SPEC-EN.md`, `docs/ARCHITECTURE.md`, `docs/GLOSSARY.md`
- Demo: `npm ci && npm run demo`

## Bonuses targeted

- **Rovo agents / skills** (primary): the `le-compagnon` agent + the generic `derouler-une-gamme` skill,
  and an exported open-source `SKILL.md` per gamme.
- **MCP**: the 16 `rovo:mcp` tools, one generic toolset for all gammes.
- **Marketplace**: this listing.
- **Teamwork Graph** (supporting): scope and owner read from `document`, `project`, `software-service`.
