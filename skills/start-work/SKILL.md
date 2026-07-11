---
name: start-work
description: "Execute a work plan using Atlas orchestration with agent teams. Reads the plan from the sodium team brain (scope chunk), creates an exec team, spawns specialised teammates to run tasks in parallel waves. Plans live in memory, not in .sisyphus/plans/."
argument-hint: "[scope chunk_id, slug, or short description of the plan]"
---

# Start Work — Atlas Orchestrated Execution

Execute a plan that lives in the sodium brain. Follow these steps EXACTLY.

## Step 1 — Locate the plan in the brain

Plans are `document_type: "scope"` chunks. They are NOT files on disk —
sodium does not use `.sisyphus/plans/`.

Resolve `$ARGUMENTS`:

- **Looks like a UUID** (e.g. `019dd3cb-629c-7680-...`) → it IS the
  scope chunk_id. Skip recall.
- **Anything else** → call `mcp__sodium-tools__sodium_recall`:
  ```
  sodium_recall(query: "$ARGUMENTS plan", types: ["scope"], limit: 5)
  ```
  Show the user the matching scope chunks (id + first 200 chars). Ask
  which one to execute. If zero matches: suggest `/sodium:plan` first
  and stop.

Capture the chosen `{plan_chunk_id}` and the **full plan body**
(returned in the recall payload — it IS the chunk content). You will
embed the body in Atlas's briefing.

## Step 2 — Derive an exec team slug

`{plan-slug}` = the plan's short kebab-case name. Either parse it from
the plan's title or generate one (≤24 chars).

## Step 3 — Create the exec team

```
TeamCreate(team_name="exec-{plan-slug}", description="Executing plan {plan_chunk_id}")
```

## Step 4 — Create tasks from the plan body

Parse the plan body for `- [ ]` checkboxes (TODO items) AND for any
`### Wave N` sections. For each TODO:

```
TaskCreate(subject="<TODO title>", description="<TODO details>")
```

Use `TaskUpdate(taskId=..., addBlockedBy=[...])` to wire dependencies
between waves so wave N+1 tasks block on wave N tasks completing.

## Step 5 — Spawn Atlas as the conductor

**CRITICAL: embed the FULL plan body in Atlas's prompt. Atlas does not
read files; the plan is in memory and we hand it over directly.**

```
Agent(
  prompt="You are Atlas, conducting the execution of a work plan.

  ## PLAN CHUNK
  scope chunk_id: {plan_chunk_id}
  exec team:      exec-{plan-slug}

  ## THE PLAN (embedded from the brain — your source of truth)

  <PASTE THE FULL PLAN BODY HERE — every line of the scope chunk>

  ## PROTOCOL

  1. First turn: call `sodium_context_fetch` with purpose='Execute
     {plan-slug} per scope {plan_chunk_id}'. Consume the warm bundle
     so prior decisions are in your context.
  2. Identify all tasks + dependencies. Group independent tasks into
     parallel waves.
  3. For each task, spawn the right teammate:
     - Implementation / coding → subagent_type='hephaestus'
     - Research / investigation → subagent_type='explorer'
     - External docs / OSS lookup → subagent_type='librarian'
     - Architecture decisions → subagent_type='oracle'
     - Code review → subagent_type='reviewer'
     - Security review → subagent_type='security-auditor'
  4. Brief each teammate with the 6-section format:
     TASK, EXPECTED OUTCOME, MUST DO, MUST NOT DO, CONTEXT,
     PLAN CHUNK ID = {plan_chunk_id}
     (so the teammate can `sodium_recall` for plan context if needed)
  5. After each teammate completes: READ the changed files yourself
     and verify the work.
  6. Only mark a task complete after verification passes.
  7. If verification fails: SendMessage to the teammate (max 3 retries).
  8. Record durable architectural calls along the way via
     `sodium_remember` (document_type 'decision') so the next session
     inherits them.
  9. After all tasks: run final verification (build/test commands if
     the plan lists them) and reply to the team lead.

  ## RULES
  - NEVER write code yourself. Delegate everything.
  - NEVER skip verification. Read every changed file.
  - NEVER proceed if a critical task failed.
  - NEVER write a `.sisyphus/plans/*.md` file. Plans live in the
    brain; you reference them by chunk_id.",
  subagent_type="atlas",
  team_name="exec-{plan-slug}",
  name="atlas"
)
```

## Step 6 — Monitor

Atlas owns the orchestration from here. Watch progress via TaskList /
Ctrl+T. Atlas will spawn workers, assign tasks, verify results, and
file decision chunks for any architectural calls made during the run.

When Atlas reports completion, optionally suggest:
> Run `/sodium:review-work {plan_chunk_id}` for a 5-agent review pass.

## CRITICAL RULES

- Plans are `document_type: "scope"` chunks. Always identify them by
  `chunk_id`, never by filename.
- Never `Read` from `.sisyphus/plans/`. Never `Write` to it. The brain
  is the source of truth.
- The `$ARGUMENTS` value MAY be a chunk_id, a slug, or a short
  description. Resolve via `sodium_recall` and confirm with the user
  before spawning Atlas — picking the wrong plan wastes a whole team.
