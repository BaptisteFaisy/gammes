# Video script — under 5 minutes, in English (§ 26)

> Plan-by-plan shooting script. Everything shown is produced by this repo: `npm run demo`,
> `npm run seed`, an MCP client, and an exported `SKILL.md`. No mockups, no vaporware —
> each shot maps to a real command or tool call.

**Total runtime target: 4:50.** Voice-over in English, on-screen UI in English, terminal in French/English.

---

## 0:00 – 0:25 · The problem

**On screen:** a Confluence page, twelve paragraphs of prose, scrolling. Cut to an agent prompt:
"Deploy paiements to production." The agent starts typing a `kubectl` command from thin air.

**VO:** "This runbook has everything the team knows about deploying. Twelve paragraphs of prose.
And this agent, about to deploy, will never read it. The wiki knows how. The agent doesn't."

**Title card:** *Gammes — your runbooks, as tools.*

## 0:25 – 1:00 · Compilation

**On screen:** `npm run demo`, phase 1–3. The page becomes a gamme: steps appear one by one, each
with its **source passage** highlighted (`page/ari:…:60-103`). The diff. A human clicks *Approve*.

**VO:** "Gammes compiles the page into an executable gamme. Deterministic first — lists, checkboxes,
code blocks — the model only on ambiguous prose. Every step cites the exact passage it came from.
Compilation publishes nothing: a draft, a diff, and a dated human approval. The version is now immutable."

## 1:00 – 1:30 · The three locks

**On screen:** three steps light up. A `human_only` step (a padlock). A risky step (`production-write`)
showing a **permit** requirement. A step where a fake AWS key is detected → replaced by a vault link,
a finding opened.

**VO:** "Three locks, enforced server-side. A human-only step can't be attested by an agent. A risky
step needs a valid permit from `permis-forge`. And a secret is never published — it becomes a finding,
with a location proposed instead. The gamme never becomes the new closet."

## 1:30 – 2:05 · An agent runs it via MCP

**On screen:** an MCP client calls `check-before-acting` → "gamme found, permits required". Then
`start-run`, `get-current-step`, `record-step` with evidence. The agent reaches the `human_only` step →
**refusal** `lock_human_only`, and the attempt appears as a deviation.

**VO:** "Any MCP client — Rovo, a home orchestrator, a third-party agent — rolls out a gamme step by
step. It asks before acting. It acknowledges each step with its evidence. And at the human lock, it
stops: the refusal is explicit, and the attempt is recorded as a deviation, not swallowed."

## 2:05 – 2:35 · The trace

**On screen:** `finish-run` → a citable trace: `GAM-deploy-01@v7 · run_3`, actor and its nature, steps,
evidence, outcome. The March-3rd question answered in one line.

**VO:** "At the end, a citable trace: which version, who, how far, with what proof. 'On March 3rd, when
we deployed in a hurry, which procedure was followed?' becomes a query, not an archaeology dig."

## 2:35 – 3:05 · Desynchronisation

**On screen:** the page is edited. The gamme is flagged **out of sync**, the age of the gap shown, a
recompilation diff proposed. The approved version keeps running.

**VO:** "The page changes, the gamme is marked out of sync, with the age of the gap and a recompilation
diff. The running execution keeps its pinned version. Documentation and tooling stop diverging silently."

## 3:05 – 3:35 · Workshop statistics

**On screen:** phase 6. Step 2 fails 6 times in 10 over 40 runs — with its sample size and Wilson range.
An **amendment** is proposed, with its evidence: which runs, which errors, what people did instead.

**VO:** "From the traces, per step, with sample size and range — and 'not enough history' below the
threshold, never a fake percentage. A step that fails six times in ten isn't hard, it's wrong. Gammes
proposes an amendment, proofs attached. A procedure improves because it's used."

## 3:35 – 4:00 · Ghosts

**On screen:** phase 8. 38 similar tickets, no written procedure. Count, spread, median handling time,
cost in days — no names.

**VO:** "And the other half: what was never written. Repeated tickets, same gestures, no procedure.
Gammes spots the ghost and offers to draft it — with the evidence, and the cost, but never a name."

## 4:00 – 4:25 · The exported skill and the CI hook

**On screen:** `export-skill` → a `SKILL.md` (version cited, no secret). Added to a third-party agent.
Then a CI hook hitting the signed `webtrigger`: "is there a procedure for this?" before a sensitive gesture.

**VO:** "Every approved gamme exports a `SKILL.md`, open source, added to any third-party agent. And a
signed webhook lets a CI pipeline ask, before acting: is there a procedure for this?"

## 4:25 – 4:50 · Architecture and close

**On screen:** the layer diagram — deterministic compiler then model, SQL, MCP, skill, reused permits
and evidence. The portfolio badges (`permis-forge`, `preuve-a-l-appui`, `placard-wiki`, `deja-vu-ci`…).

**VO:** "Deterministic first, model on the ambiguous only. One implementation per logic — permits,
evidence, secrets, signatures all reused, never recopied. Your wiki already knows how to do everything.
Gammes turns it into tools your agents can actually call — and refuses to let them improvise."

**End card:** *Gammes — your runbooks, as tools.* · repo link · `npm run demo`.

---

## Shot checklist (all reproducible from this repo)

| Shot | Command / tool |
|---|---|
| Detection scores + reasons | `npm run seed` |
| Compile → draft + diff | `npm run demo` (phase 2) |
| Approve (human, dated) | `npm run demo` (phase 3) |
| Locks: human / permit / secret | `npm run demo` (phase 4) + `test/mcp` |
| Agent runs via MCP, refusal | `handleTool("start-run"/"record-step")` |
| Citable trace | `finish-run` → `renderTraceMarkdown` |
| Desync + diff | `npm run demo` (phase 5) |
| Statistics + amendment | `npm run demo` (phase 6) |
| Ghosts | `npm run demo` (phase 8) |
| Conflicts + hermes conciliator | `npm run demo` (phase 9) |
| Exported `SKILL.md` | `npm run demo` (phase 10) |
| CI hook | `src/platform/webtrigger.ts` |
