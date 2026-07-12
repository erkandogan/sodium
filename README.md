# Sodium

Sodium is a durable project brain shared by your coding agents. Decisions,
scope, handoffs, notes, and file-aware context survive fresh sessions,
worktrees, and switches between Claude Code, Codex, Cursor, and custom agents.

This repository is the public, secret-free client distribution. The hosted
brain lives at `https://sodium.dev/mcp`; there is no local daemon and no token
to paste. Your MCP client opens a browser and authenticates through OAuth.

## Fastest setup

### Codex

```sh
codex mcp add sodium --url https://sodium.dev/mcp
codex mcp login sodium
```

Start a fresh Codex session and ask it to orient with Sodium. The repository
also contains a native Codex plugin manifest, shared skills, and lifecycle
hooks for clients that install plugins from a personal marketplace.

### Claude Code

```text
/plugin marketplace add https://github.com/erkandogan/sodium.git
/plugin install sodium@sodium
```

Or connect only the MCP:

```sh
claude mcp add --transport http sodium https://sodium.dev/mcp
```

### Cursor Agent

Clone this repository or copy `.cursor/mcp.json` into your project, then run:

```sh
cursor-agent mcp enable sodium
cursor-agent mcp login sodium
cursor-agent mcp list-tools sodium
```

Cursor opens Sodium's browser OAuth flow and returns through its loopback
callback. No local MCP proxy or pasted bearer token is required.

### Any MCP client

Add a remote Streamable-HTTP server named `sodium` with this URL:

```text
https://sodium.dev/mcp
```

The endpoint advertises its OAuth server. Do not create or paste a long-lived
token into project configuration.

### Optional universal CLI

Download the checksummed binary for Linux, macOS, or Windows from the
[public releases](https://github.com/erkandogan/sodium/releases/latest). The
CLI is optional—the remote MCP works without it—but provides the same
lifecycle on tools that do not run plugin hooks:

```sh
sodium init .
sodium login
sodium start
sodium checkpoint "Finished the auth migration; dashboard verification remains"
```

`sodium init` safely merges Claude, Codex, and Cursor project configuration,
adds bounded `AGENTS.md` guidance, and installs non-blocking Git checkpoints.
OAuth credentials stay in the user's private config directory, never the repo.

## What the plugin adds

- Project-scoped recall and warm context before an agent asks you to repeat
  earlier work.
- Durable decision, scope, note, and handoff capture.
- Shared Claude/Codex lifecycle hooks that detect Git changes and request one
  concise checkpoint before the agent finishes.
- Orca worktree identity when `orca-ide` is present.
- Reusable planning, debugging, reviewing, and implementation skills plus
  specialist agent personas.

The lifecycle hook reads Git metadata and changed filenames only. It does not
read or upload transcripts or source-file contents. Sodium should capture
durable knowledge, not a surveillance log of every edit.

## Recommended workflow

1. At task start, call `sodium_context_fetch` with the project, purpose,
   branch, worktree, and expected files.
2. Use `sodium_recall` before asking the user to repeat a prior decision.
3. Record decisions when they become durable, with rationale and related
   files—not every implementation detail.
4. Update or invalidate prior decisions when new work contradicts them.
5. Before switching tasks, record one concise handoff with the completed
   outcome, blockers, and next step.
6. Rate only memories you actually relied on with `sodium_feedback`.
7. Use `sodium_explain` when a surprising memory ranks highly; it reports the
   observable ranking signals and Git provenance without inventing a reason.

The web brain includes a capture inbox, semantic search, revision-safe edit /
invalidate controls, and a portable JSONL export. Export contains source
records and provenance—not embedding vectors or another user's private data.

## Repository contents

- `.mcp.json` — public remote MCP configuration.
- `.claude-plugin/` — Claude Code plugin and marketplace manifests.
- `.codex-plugin/` — Codex plugin manifest.
- `.cursor/mcp.json` — Cursor project configuration.
- `.agents/plugins/marketplace.json` — Codex marketplace metadata.
- `hooks/` — shared lifecycle checkpoint adapter and tests.
- `skills/` and `agents/` — reusable workflows and personas.

## Security

Never put credentials into issues, memories, plugin configuration, or hook
output. To report a vulnerability, follow [SECURITY.md](SECURITY.md).

Sodium's client package is MIT licensed. Use of the hosted service is subject
to the policies published on sodium.dev.
