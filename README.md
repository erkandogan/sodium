# Sodium

Sodium is a durable project brain shared by your coding agents. Decisions,
scope, handoffs, notes, and file-aware context survive fresh sessions,
worktrees, and switches between Claude Code, Codex, and other MCP clients.

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

### Any MCP client

Add a remote Streamable-HTTP server named `sodium` with this URL:

```text
https://sodium.dev/mcp
```

The endpoint advertises its OAuth server. Do not create or paste a long-lived
token into project configuration.

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
4. Before switching tasks, record one concise handoff with the completed
   outcome, blockers, and next step.
5. Rate only memories you actually relied on with `sodium_feedback`.

## Repository contents

- `.mcp.json` — public remote MCP configuration.
- `.claude-plugin/` — Claude Code plugin and marketplace manifests.
- `.codex-plugin/` — Codex plugin manifest.
- `.agents/plugins/marketplace.json` — Codex marketplace metadata.
- `hooks/` — shared lifecycle checkpoint adapter and tests.
- `skills/` and `agents/` — reusable workflows and personas.

## Security

Never put credentials into issues, memories, plugin configuration, or hook
output. To report a vulnerability, follow [SECURITY.md](SECURITY.md).

Sodium's client package is MIT licensed. Use of the hosted service is subject
to the policies published on sodium.dev.
