import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Readable, Writable } from 'node:stream';
import type Anthropic from '@anthropic-ai/sdk';

import { defaultConfig } from '../src/agent.js';
import { FORK_WORKTREE_TOOL, forkBriefing, forkRelocation } from '../src/fork-relocation.js';
import { forkRowChip } from '../src/fork-command.js';
import { interactiveLoop } from '../src/interactive.js';
import type { ModelProvider } from '../src/provider.js';
import type { Runtime } from '../src/runtime.js';
import { Session } from '../src/session.js';

const fixtureEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.test',
  GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.test' };
function git(root: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd: root, env: fixtureEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000,
  }).trimEnd();
}
function repository(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccrev-fork-relocation-')));
  git(root, 'init', '--initial-branch=trunk');
  fs.writeFileSync(path.join(root, 'file.txt'), 'baseline\n');
  git(root, 'add', 'file.txt'); git(root, 'commit', '-m', 'Disposable fixture baseline');
  return root;
}
/** A real linked worktree under the owned directory, on its own branch. */
function linkedWorktree(root: string, name = 'feature'): string {
  const target = path.join(root, '.harness-worktrees', name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  git(root, 'worktree', 'add', '-b', name, target);
  return fs.realpathSync(target);
}
function reply(text: string): Anthropic.Message {
  return { id: 'fixture', model: 'test', role: 'assistant', type: 'message', content: [{ type: 'text', text }],
    stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
function capture() {
  let text = '';
  return { stream: new Writable({ write(chunk, _encoding, callback) { text += String(chunk); callback(); } }),
    value: () => text };
}

test('the briefing keeps the source sentences and drops each clause the source drops', () => {
  // `Fo`, entered-worktree arm (chunk-24k7d6mw.js 40527): both branch clauses are conditional.
  const entered = forkBriefing({ workspace: '/repo/.harness-worktrees/feature', to: '/repo',
    worktreePath: '/repo/.harness-worktrees/feature', branch: 'feature' });
  assert.equal(entered, 'This conversation was forked out of /repo/.harness-worktrees/feature (branch feature), ' +
    'a linked worktree the original session is still working in — never edit files, run commands, or enter ' +
    `that worktree with ${FORK_WORKTREE_TOOL}. You are in /repo; before making code changes, create a new worktree ` +
    `of your own with ${FORK_WORKTREE_TOOL} instead of reusing the original's, and if the task builds on the ` +
    "original's work, base your new branch on feature rather than checking that branch out (it stays checked out " +
    "in the original's worktree).");
  assert.equal(forkBriefing({ workspace: '/repo/.harness-worktrees/feature', to: '/repo' }),
    'This conversation was forked out of /repo/.harness-worktrees/feature, a linked worktree the original session ' +
    `is still working in — never edit files, run commands, or enter that worktree with ${FORK_WORKTREE_TOOL}. ` +
    `You are in /repo; before making code changes, create a new worktree of your own with ${FORK_WORKTREE_TOOL} ` +
    "instead of reusing the original's.");
  // `_o` (`worktree.bgIsolation === "none"`) drops the own-worktree sentence and keeps the refusal.
  assert.equal(forkBriefing({ workspace: '/repo/.harness-worktrees/feature', to: '/repo',
    worktreePath: '/repo/.harness-worktrees/feature', branch: 'feature', isolationNone: true }),
  'This conversation was forked out of /repo/.harness-worktrees/feature (branch feature), a linked worktree the ' +
  `original session is still working in — never edit files, run commands, or enter that worktree with ` +
  `${FORK_WORKTREE_TOOL}. You are in /repo.`);
  // `xo === "own-worktree"`: the launched-in-a-linked-worktree arm.
  assert.equal(forkBriefing({ workspace: '/repo/.harness-worktrees/feature', editsIn: 'own-worktree' }),
    'This conversation was forked from a session that is still working in this checkout ' +
    `(/repo/.harness-worktrees/feature). Before making code changes, create a new worktree of your own with ` +
    `${FORK_WORKTREE_TOOL} so your edits don't land where the original session is editing.`);
  assert.equal(forkBriefing({ workspace: '/repo', editsIn: 'this-tree' }), undefined);
});

test('the row chip names the relocation, the shared checkout, or nothing', () => {
  // `Ue`'s `H`: `relocatedTo` wins, then `editsIn === "this-tree"`, and `own-worktree` adds none.
  assert.equal(forkRowChip({ relocatedTo: '/repo' }), 'runs in the origin tree');
  assert.equal(forkRowChip({ editsIn: 'this-tree' }), 'edits this checkout');
  assert.equal(forkRowChip({ editsIn: 'own-worktree' }), undefined);
  assert.equal(forkRowChip({ relocatedTo: '/repo', editsIn: 'this-tree' }), 'runs in the origin tree');
  assert.equal(forkRowChip({}), undefined);
});

test('relocation reads the repository root, a linked worktree and a non-repository', async () => {
  const root = repository();
  const worktree = linkedWorktree(root);
  try {
    // A plain checkout is the root of its own repository: the copy may edit it unless isolated.
    assert.deepEqual(await forkRelocation({ workspace: root }),
      { editsIn: 'own-worktree', briefing: forkBriefing({ workspace: root, editsIn: 'own-worktree' }) });
    assert.deepEqual(await forkRelocation({ workspace: root, isolationNone: true }), { editsIn: 'this-tree' });
    // An entered worktree relocates to the recorded origin with the recorded branch in the briefing.
    assert.deepEqual(await forkRelocation({ workspace: worktree, worktreeReturn: root, worktreeBranch: 'feature' }),
      { relocatedTo: root, briefing: forkBriefing({ workspace: worktree, to: root, branch: 'feature' }) });
    // Without a recorded branch the briefing keeps both sentences and drops both branch clauses.
    assert.deepEqual(await forkRelocation({ workspace: worktree, worktreeReturn: root }),
      { relocatedTo: root, briefing: forkBriefing({ workspace: worktree, to: root }) });
    // A session launched inside the linked worktree has no `no` record, so its copy relocates but
    // carries no branch clause even though the checkout is on one.
    const launched = await forkRelocation({ workspace: worktree });
    assert.equal(launched.relocatedTo, root);
    assert.match(launched.briefing ?? '', /^This conversation was forked out of /);
    assert.doesNotMatch(launched.briefing ?? '', /\(branch /);
    // The detached case stays clause-free for the same reason.
    git(worktree, 'checkout', '--detach', 'HEAD');
    assert.deepEqual(await forkRelocation({ workspace: worktree }), launched);
    git(worktree, 'checkout', 'feature');
    // Outside any repository there is no relocation and no briefing (`ur(...)===null`).
    const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccrev-fork-plain-')));
    try { assert.deepEqual(await forkRelocation({ workspace: outside }), {}); }
    finally { fs.rmSync(outside, { recursive: true, force: true }); }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('an open-fleet /fork from a worktree reports the origin chip and passes the briefing', async () => {
  const root = repository();
  const worktree = linkedWorktree(root);
  const config = { ...defaultConfig(worktree, []), model: 'test', worktreeReturn: root };
  const session = Session.open(worktree, { config });
  session.append({ kind: 'message', message: { role: 'user', content: 'earlier task' } });
  session.append({ kind: 'message', message: { role: 'assistant', content: 'earlier answer' } });
  session.append({ kind: 'turn_end', reason: 'end_turn' });
  const calls: { briefing?: string; relocatedTo?: string }[] = [];
  const stdout = capture(), stderr = capture();
  const provider: ModelProvider = { count: async () => 0, complete: async () => reply('unused') };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] } as unknown as Runtime;
  try {
    await interactiveLoop(session, provider, runtime, {
      input: Readable.from(['/fork write the tests\n', '/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
      startBackground: options => {
        calls.push({ ...(options.briefing === undefined ? {} : { briefing: options.briefing }),
          ...(options.relocatedTo === undefined ? {} : { relocatedTo: options.relocatedTo }) });
        return { sessionId: 'abcdef01-2345-6789-abcd-ef0123456789', pid: undefined, log: '/tmp/copy.log',
          relocatedTo: options.relocatedTo };
      },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.relocatedTo, root);
    assert.match(calls[0]!.briefing ?? '', /^This conversation was forked out of /);
    assert.match(stdout.value(), /^session running · abcdef01 · runs in the origin tree$/m);
  } finally {
    session.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
