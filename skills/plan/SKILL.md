---
name: plan
description: "Strategic planning workflow. Creates an agent team with Prometheus (interview), Metis (gap analysis), and optionally Momus (plan review). Plans live as scope chunks in the sodium team brain — recallable across sessions, never as filesystem markdown."
argument-hint: "[task description]"
---

# Plan Mode — Strategic Planning, Memory-First

The user wants a strategic plan for: "$ARGUMENTS"

Sodium is memory-first. The plan lives **in the brain**, not on disk. There is
no `.sisyphus/plans/<name>.md` — that's the omt pattern sodium exists to
replace. The plan body is a `scope` chunk; reviewers/executors find it via
`sodium_recall`, not by file path.

## Step 1 — Create the planning team

```
TeamCreate(team_name="<short-slug>", description="Plan: $ARGUMENTS")
```

Replace `<short-slug>` with a 1–3-word kebab-case slug derived from the
task. Save the slug — every subsequent step uses it.

## Step 2 — Spawn Prometheus to interview the user

```
Agent(
  prompt="You are Prometheus, the strategic planner. Plan: \"$ARGUMENTS\".

  Interview the user (3–7 focused questions, ONE at a time via the
  reply tool) to nail scope, constraints, success criteria, and edge
  cases. After each answer, call `sodium_remember` with document_type
  'note' to capture the answer keyed to the team_name slug.

  When you have enough — and ONLY then — generate the plan body in
  markdown (waves → tasks → agents → done-when criteria) and call
  `sodium_remember` with:
    - document_type: 'scope'
    - what: <full plan markdown>
    - why: 'Plan for <team_name>'
  Capture the returned chunk_id and report it back via reply.

  Do NOT write any files. Do NOT touch .sisyphus/. The plan IS the
  scope chunk.",
  subagent_type="prometheus",
  team_name="<short-slug>",
  name="prometheus-1"
)
```

## Step 3 — Wait for Prometheus's reply

Prometheus will publish the plan's chunk_id via reply. Capture it as
`{plan_chunk_id}`.

## Step 4 — Spawn Metis to find gaps

```
Agent(
  prompt="You are Metis, the gap analyser. The plan is in scope chunk
  {plan_chunk_id}.

  Read it via `sodium_recall` (search by team name '<short-slug>'). Walk
  the brain for prior decisions and similar scope chunks via
  `sodium_recall`. Identify hidden assumptions, missing requirements,
  scope-creep risks, and edge cases the plan doesn't address.

  Produce a follow-up `note` chunk via `sodium_remember` with your gap
  analysis, then reply with the chunk_id and a 5–10 line summary.

  Read-only. Do NOT modify the plan chunk; produce a sibling note that
  Prometheus can fold in.",
  subagent_type="metis",
  team_name="<short-slug>",
  name="metis-1"
)
```

## Step 5 — Optional: Prometheus folds in gaps

Send Metis's summary back to Prometheus via SendMessage. Prometheus
either issues a NEW scope chunk (revised plan; new chunk_id supersedes
the old one and references it via `related_files` or in the body) or
records that the gaps don't change the plan.

```
SendMessage(
  to="prometheus-1",
  text="Metis filed gap analysis at chunk_id {metis_chunk_id}. Decide
  whether to revise the plan; if yes, file a new scope chunk and
  reference {plan_chunk_id} in the body."
)
```

## Step 6 — Optional: Momus review

```
Agent(
  prompt="You are Momus. Review the plan at scope chunk
  {plan_chunk_id} (find it via `sodium_recall` with the team_name slug)
  for executability, reference accuracy, and alignment with prior
  decisions in the brain.

  Approval-biased. Reject only for true blockers. File your verdict as
  a `note` chunk via `sodium_remember` and reply with: APPROVED |
  CHANGES_REQUESTED | REJECTED + the chunk_id.",
  subagent_type="momus",
  team_name="<short-slug>",
  name="momus-1"
)
```

## Step 7 — Hand off to the operator

Reply once with:

> Plan filed in the brain as scope chunk `{plan_chunk_id}`.
> Run `/sodium:start-work {plan_chunk_id}` to dispatch Atlas + workers,
> or pass the chunk_id directly to a teammate via SendMessage.

## CRITICAL RULES

- **Never** `Write` a `.sisyphus/plans/*.md` or `.sisyphus/drafts/*.md`
  file. The brain is the source of truth.
- Plans are `document_type: "scope"`. Drafts are `note`. Gap analysis
  is `note`. Reviews are `note`.
- Chunk_ids are first-class. Pass them between agents via the prompt.
  Never refer to a plan by name only — names collide; chunk_ids don't.
- Spawn at least Prometheus + Metis. Momus is optional but cheap.
