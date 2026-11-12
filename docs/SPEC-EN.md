# Gammes — your runbooks, as tools

> **English submission spec** · Atlassian Forge (Confluence + Jira) · Codegeist 2026, *Apps for Software Teams*
> Bonuses targeted: **Rovo agents / skills** (primary), **MCP**, **Marketplace**, Teamwork Graph (supporting).
> Source of truth: [`CAHIER-DES-CHARGES.md`](../CAHIER-DES-CHARGES.md) (French, v1 of 11 November 2026).

**Your wiki already knows how to do everything. Your agents don't.**

## The problem

A procedure lives in a Confluence page. It dies there too.

- **Humans read it badly.** They skim, skip step 4, forget the final check. Nobody knows which
  version of the page was followed on the day of the incident.
- **Agents don't read it at all.** A coding agent that must deploy doesn't get twelve paragraphs of
  prose — it gets tools. With no tool, it improvises, and improvisation is never traced.
- **The page and reality diverge.** Someone fixes the page; the scripts and habits elsewhere don't
  follow. Or the team changes how it works and the page stays two years old.
- **Nobody knows what fails.** The same step has failed one time in two for six months, and the
  information is scattered across ticket comments nobody re-reads.
- **Unwritten know-how is expensive.** Some gestures are done correctly by three people and by
  nobody else. They were never written down, so never tooled.

Everything needed to answer this already exists: Confluence pages (source text), Jira/JSM tickets
(the real history of manual runs), the Atlassian graph, Forge (to run, store and expose tools), and
Rovo agents (to consume them). What is missing is the **compiler** — and the discipline to trace what
was done, under which version, with which proof.

## The idea in one sentence

The app **compiles** a procedure page into an executable *gamme* (steps, preconditions, expected
evidence, agent-forbidden steps), publishes it as a tool any agent can call, and closes the loop by
proposing to fix the page from the failures actually observed.

## Vocabulary (§ 4)

| Term | Meaning |
|---|---|
| **Gamme** | A compiled procedure: an ordered set of steps with inputs, expected evidence, locks and a version. From the workshop: an assembly *gamme* says what to do, in which order, with which tool and which check. |
| **Source page** | The Confluence page the gamme comes from. Every gamme cites its source, and **every step cites the exact passage** that produced it. |
| **Step** | An elementary operation. Five kinds: `manual`, `command`, `check`, `decision`, `notification`. |
| **Expected evidence** | What a step must leave behind, with its strength (machine / attested / declared). |
| **Lock** | What forbids moving on — human-only step, required permit, detected secret, failing check. |
| **Version** | A gamme is versioned and each version is **immutable**. A run is pinned to a version (`GAM-deploy-01@v7`). |
| **Run** | One rolled-out instance, human or agent, with its steps, evidence, deviations and outcome. |
| **Trace** | The log of a run. It is the proof, and the raw material of statistics. |
| **Out of sync** | A gamme whose source page changed since compilation. Still runnable, but flagged, with the age of the gap shown. |
| **Amendment** | A trace-backed proposed change to a gamme. An amendment is never applied alone. |
| **Ghost gamme** | Repeated work, done correctly, that nobody wrote down. The app detects it and offers to write it. |
| **Conflict** | Two gammes (or a gamme and a policy page) prescribing incompatible things for the same action. |
| **Workshop (atelier)** | The overview — the benches (gammes), their state, usage and dust. |
| **Companion** | The agent that rolls out a gamme under supervision; an **apprentice** when it lacks the permits. |

Discipline, as elsewhere: **written** (the page says it) ≠ **compiled** (the gamme exists) ≠
**approved** (a human attested it) ≠ **executed** (a trace proves it) ≠ **succeeded** (the outcome is
conforming). The app never says "the procedure is respected" without a trace.

## What the app never does (§ 5)

- publishes nothing without human approval — compilation yields a draft and a diff, never a live gamme;
- never lets an agent attest a human-only step, approve a gamme, or validate an amendment;
- never runs commands itself — it says what to do, in which order, and records what was done;
- stores no secret — a step containing a key becomes a finding, not a step;
- never erases a version or a trace — deprecate is not delete;
- rates nobody — traces name an actor for audit, never for ranking; statistics are about steps;
- never concludes without sample size — below the threshold, a step statistic says "not enough history".

## Compilation in five stages (§ 6)

1. **Detect.** Which pages are procedures? Weak and strong signals (title, labels, numbered lists,
   checkboxes, code blocks, step tables, links from on-call pages, view frequency). Each candidate gets
   a score **and its reasons**. A person confirms — the app never compiles a page unconfirmed.
2. **Extract.** The storage format becomes a set of steps. Deterministic first (numbered/bulleted lists,
   checkboxes, code blocks → `command`, tables, headings, macros); the model only on ambiguous prose.
   **Every step keeps the exact location of its source passage** (offsets), like brief citations.
3. **Qualify.** Per step: kind, expected evidence, human-only or not, idempotent or not, risk level,
   recognizable command, expected result. Rules first (patterns: `rm -rf`, `DROP`, `kubectl delete`,
   force-push, production writes, personal-data handling), model second, human always. Risky steps get a
   lock: mandatory human **and** required permit.
4. **Publish.** The approved gamme becomes a set of callable tools (actions/MCP), an exportable
   `SKILL.md`, a Jira ticket type and flow for the human version, and a macro reinserting the gamme's
   state into the source page. Immutable versioning; publishing is a dated human act.
5. **Link.** The page ↔ gamme bond is kept both ways: page changes → gamme flagged out of sync with a
   recompilation diff; traces reveal a defect → an amendment is proposed and the **page edit is
   suggested** to its owner. Documentation and tooling stop diverging silently.

## The three locks (§ 9)

- **Human lock.** A `human_only` step can only be acknowledged by an authenticated person. An agent that
  tries gets a refusal, and the attempt is **recorded as a deviation** — not a silent error.
- **Permit lock.** A risky step belongs to an action class; an agent running it needs a valid permit
  (`permis-forge`: scope, duration, autonomy). Without a permit, the app refuses and returns the permit
  request to create.
- **Secret lock.** Before publishing, each step goes through `placard-wiki` detectors. A key, password or
  personal datum is never published: the app proposes a location instead (secret-manager link, env var,
  vault) and opens a finding.

Refusals are enforced **server-side**, never client-side.

## What agents do with it (§ 15)

Three doors, one source of truth:

1. **MCP tools** (`rovo:mcp`): `find-procedure`, `check-before-acting`, `get-procedure`, `list-procedures`,
   `start-run`, `get-current-step`, `record-step`, `report-deviation`, `finish-run`, `get-run-trace`,
   `get-procedure-stats`, `propose-amendment`, `compile-page`, `export-skill`, `get-missing-procedures`,
   `get-conflicts`. One generic toolset serves **all** gammes: content lives in the store, not the manifest.
2. **Exported skill**: each approved gamme yields a `SKILL.md` (and companion files), downloadable and
   open-source, added to third-party agents. On the Forge side, a generic skill `derouler-une-gamme`
   teaches the conduct.
3. **Signed external entry** (`webtrigger`): a coding-agent hook or CI pipeline asks "is there a procedure
   for what I'm about to do?" before a sensitive gesture.

The most telling demo: **an agent refuses to improvise because a compiled Confluence page told it to.**

## Workshop statistics (§ 11)

From traces, per step and per version — with sample size, range, and "not enough history" below the
threshold: failure rate, skip rate, ghost steps, human/agent divergence, version comparison (`v6` vs `v7`),
real vs estimated durations, coverage. **A procedure improves because it is used.** No documentation does
this today.

## Architecture (§ 20)

A Confluence-first Forge app with Jira surfaces and a signed bridge outward. Two layers, one constraint:
the manifest is static, so there is a **tooled layer** (one generic skill, one agent, MCP tools serving all
gammes from the store) and an **exported layer** (a `SKILL.md` per approved gamme, downloadable, open
source). The product does not depend on whether a skill can be declared dynamically.

Platform limits respected: 25 s per function (55 s for action/agent/webtrigger), long work via `consumer`
(900 s) and one scheduled trigger; 500 KB UI response → long procedures served step by step; hosted LLM
cached by content fingerprint with a displayed budget; graph read as the user, missing right = empty
result without error (the coverage screen distinguishes "no right" from "no data").

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the layer diagram and [`CONTRATS.md`](CONTRATS.md) for module
ownership and public signatures.

## Requirements (§ 17)

**M** = required for submission, **S** = desirable, **C** = after the hackathon. The full GA-01…GA-32
matrix with live status is in [`EXIGENCES.md`](EXIGENCES.md).

## How judges test it (§ 27)

1. **Demo space.** `npm run seed` seeds seven pages (three realistic procedures, one non-procedure, one
   with a fake key, two in conflict on the same service, one policy page), a Jira project with 40 similar
   tickets, and seeded traces.
2. **Compile.** `npm run demo`: detection, diff, steps with source passages, locks, approval.
3. **Roll out.** Via MCP: typed inputs, current step, evidence, human-lock refusal, deviation, closed trace.
4. **Desync.** Modify a page and see the gamme flagged with the diff.
5. **Measure.** Workshop statistics on seeded traces, with sample sizes, and a proposed amendment.
6. **Export.** A gamme's `SKILL.md`, added to a third-party agent.

```bash
npm ci
npm run verify     # house rules + typecheck + tests
npm run demo       # the whole scenario, in memory, no network
npm run seed       # the judges' demo space
```

Everything runs **off-platform**: the domain core is pure TypeScript behind ports, so the full acceptance
suite (§ 25) is testable in CI without an Atlassian site. See [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Reuse of the portfolio (§ 16)

House rule: one implementation per logic. Nothing is copied, everything is consumed. See
[`docs/CONTRATS.md`](CONTRATS.md) § Lot E and `src/integrations/`: `permis-forge` (permit lock),
`preuve-a-l-appui` (evidence-strength grid), `brief-forge` (citation discipline, context budget, unified
secret masking), `placard-wiki` (secret detectors), `delegable-ou-pas` (cohorts, no conclusion below
threshold), `deja-vu-ci` (failure signatures), `chantiers-en-collision` (exclusive-resource reservation),
`vigie` (level-A key results), Teamwork Graph (scope and owner).
