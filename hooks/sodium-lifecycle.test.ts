import { describe, expect, it } from 'bun:test';
import {
  canonicalProject,
  orcaWorktree,
  parsePorcelain,
  sessionStartOutput,
  stopOutput,
} from './sodium-lifecycle.mjs';

const snapshot = {
  root: '/repo',
  head: 'abc',
  branch: 'feature/memory',
  projectId: 'github.com/acme/example-app',
  files: ['sodium/a.go', 'sodium/b.ts'],
  fingerprint: 'changed',
};

describe('sodium lifecycle hook', () => {
  it('canonicalizes HTTPS and SSH remotes', () => {
    expect(canonicalProject('https://github.com/Acme/example-app.git')).toBe('github.com/acme/example-app');
    expect(canonicalProject('git@github.com:Acme/example-app.git')).toBe('github.com/acme/example-app');
  });

  it('extracts changed paths without reading their contents', () => {
    expect(parsePorcelain(' M sodium/a.go\nR  old.ts -> sodium/b.ts\n?? new.md\n')).toEqual([
      'sodium/a.go', 'sodium/b.ts', 'new.md',
    ]);
  });

  it('injects exact MCP argument names and Orca identity at session start', () => {
    const out = sessionStartOutput({}, snapshot, { id: 'orca-wt', name: 'memory' });
    const text = out.hookSpecificOutput.additionalContext;
    expect(text).toContain('projectId');
    expect(text).toContain('worktreeId');
    expect(text).toContain('fileScope');
    expect(text).toContain('orca-wt');
    expect(text).not.toContain('transcript_path');
  });

  it('continues a clean baseline and requests one checkpoint after change', () => {
    const clean = stopOutput({ stop_hook_active: false }, { ...snapshot, fingerprint: 'base' }, { baseline: 'base' }, { id: '', name: '' });
    expect(clean.output.continue).toBe(true);
    const changed = stopOutput({ stop_hook_active: false }, snapshot, { baseline: 'base' }, { id: 'orca-wt', name: '' });
    expect(changed.output.decision).toBe('block');
    expect(changed.output.reason).toContain('sodium_remember');
    const continued = stopOutput({ stop_hook_active: true }, snapshot, changed.nextState, { id: 'orca-wt', name: '' });
    expect(continued.output.continue).toBe(true);
    expect(continued.nextState.lastCheckpoint).toBe('changed');
  });

  it('ignores the Linux screen-reader binary and accepts orca-ide JSON', () => {
    const calls: string[] = [];
    const result = orcaWorktree('/repo', (_cwd, command) => {
      calls.push(command);
      return command === 'orca-ide'
        ? JSON.stringify({ result: { worktree: { id: 'wt-1', displayName: 'main' } } })
        : '';
    });
    expect(result.id).toBe('wt-1');
    expect(calls).toEqual(['orca-ide']);
  });
});
