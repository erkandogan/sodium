#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const INPUT_LIMIT = 1024 * 1024;
const MAX_FILES = 20;

function run(cwd, command, args) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 1500,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return result.status === 0 ? result.stdout.trimEnd() : '';
}

export function canonicalProject(remote) {
  const clean = remote.trim().replace(/\.git$/, '');
  const scp = clean.match(/^[^@]+@([^:]+):(.+)$/);
  if (scp) return `${scp[1]}/${scp[2]}`.toLowerCase();
  try {
    const parsed = new URL(clean);
    return `${parsed.hostname}${parsed.pathname}`.replace(/^\/+|\/+$/g, '').toLowerCase();
  } catch {
    return '';
  }
}

export function parsePorcelain(raw) {
  return raw
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.length > 3 ? line.slice(3).replace(/^.* -> /, '') : line)
    .slice(0, MAX_FILES);
}

function gitSnapshot(cwd) {
  const root = run(cwd, 'git', ['rev-parse', '--show-toplevel']) || cwd;
  const head = run(root, 'git', ['rev-parse', 'HEAD']);
  const branch = run(root, 'git', ['branch', '--show-current']);
  const remote = run(root, 'git', ['remote', 'get-url', 'origin']);
  const status = run(root, 'git', ['status', '--porcelain=v1', '--untracked-files=normal']);
  const files = parsePorcelain(status);
  const fingerprint = createHash('sha256').update(`${head}\n${status}`).digest('hex');
  return { root, head, branch, projectId: canonicalProject(remote), files, fingerprint };
}

export function orcaWorktree(cwd, runner = run) {
  for (const command of process.platform === 'linux' ? ['orca-ide'] : ['orca', 'orca-ide']) {
    const raw = runner(cwd, command, ['worktree', 'current', '--json']);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const worktree = parsed?.result?.worktree;
      if (worktree?.id) return { id: String(worktree.id), name: String(worktree.displayName || '') };
    } catch {
      // A non-Orca command named `orca` or an older CLI is simply ignored.
    }
  }
  return { id: '', name: '' };
}

function statePath(sessionId) {
  const base = process.env.PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA || '';
  if (!base || !sessionId) return '';
  return join(base, 'lifecycle', `${sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
}

function readState(path) {
  if (!path) return {};
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return {}; }
}

function writeState(path, state) {
  if (!path) return;
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, `${JSON.stringify(state)}\n`, { mode: 0o600 });
  } catch {
    // Hooks always fail open; state only suppresses duplicate checkpoints.
  }
}

export function sessionStartOutput(input, snapshot, orca) {
  const project = snapshot.projectId || 'the current repository';
  const files = snapshot.files.length ? snapshot.files.join(', ') : '(discover before editing)';
  const context = [
    'Sodium is the durable project brain for this agent session.',
    `Project: ${project}`,
    `Branch: ${snapshot.branch || '(detached or unknown)'}`,
    `Orca worktree: ${orca.id || '(not running in an Orca worktree)'}`,
    `Current changed files: ${files}`,
    'At task start call sodium_context_fetch with purpose, projectId, branch, worktreeId, and fileScope.',
    'Before asking the user to repeat prior context, call sodium_recall.',
    'Before a task switch or final response, record durable decisions and one unfinished handoff with sodium_remember.',
    'When replacing prior memory, use sodium_update or sodium_invalidate instead of adding a contradictory duplicate.',
    'Never store secrets, raw transcripts, or a log of every edit.',
  ].join('\n');
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context,
    },
  };
}

export function stopOutput(input, snapshot, state, orca) {
  if (input.stop_hook_active) {
    return { output: { continue: true }, nextState: { ...state, lastCheckpoint: snapshot.fingerprint, pending: '' } };
  }
  if (!state.baseline) {
    return { output: { continue: true }, nextState: { ...state, baseline: snapshot.fingerprint } };
  }
  if (snapshot.fingerprint === state.baseline || snapshot.fingerprint === state.lastCheckpoint) {
    return { output: { continue: true }, nextState: state };
  }
  const fileScope = snapshot.files.length ? snapshot.files.join(', ') : '(committed changes; inspect git diff/status)';
  const reason = [
    'Checkpoint durable Sodium context before finishing this turn.',
    `Call sodium_remember for projectId=${snapshot.projectId || '(resolve with sodium_project_list)'}, branch=${snapshot.branch || '(unknown)'}, worktreeId=${orca.id || '(none)'}.`,
    `Use related_files from: ${fileScope}.`,
    'Capture only decisions, constraints, completed outcome, and unfinished next steps; do not capture the transcript or routine edits.',
    'If this replaces a recalled record, use sodium_update or sodium_invalidate so stale memory is hidden.',
    'After the memory call, return the user-facing final response.',
  ].join(' ');
  return {
    output: { decision: 'block', reason },
    nextState: { ...state, pending: snapshot.fingerprint },
  };
}

async function readInput() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > INPUT_LIMIT) return null;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

async function main() {
  const input = await readInput();
  if (!input || !input.cwd || !input.hook_event_name) return;
  const snapshot = gitSnapshot(input.cwd);
  const orca = orcaWorktree(snapshot.root);
  const path = statePath(String(input.session_id || ''));
  const state = readState(path);
  let output;
  if (input.hook_event_name === 'SessionStart') {
    output = sessionStartOutput(input, snapshot, orca);
    writeState(path, { baseline: snapshot.fingerprint, lastCheckpoint: '', pending: '' });
  } else if (input.hook_event_name === 'Stop') {
    const result = stopOutput(input, snapshot, state, orca);
    output = result.output;
    writeState(path, result.nextState);
  } else {
    return;
  }
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(() => process.exit(0));
}
