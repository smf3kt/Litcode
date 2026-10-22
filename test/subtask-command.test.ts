import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import { COMMAND_HELP, interactiveLoop } from '../src/interactive.js';
import type { ModelProvider } from '../src/provider.js';
import { createRuntime, type Runtime } from '../src/runtime.js';
import { Session } from '../src/session.js';
import { allocateSubtaskName, SUBTASK_COORDINATOR, SUBTASK_FIRST_TURN, SUBTASK_FORK, SUBTASK_USAGE,
  subtaskCoordinator, subtaskForkLine, subtaskName, type SubtaskLaunch } from '../src/subtask.js';
import { TUI_COMMANDS } from '../src/tui-autocomplete.js';

function reply(text: string): Anthropic.Message {
  return { id: 'fixture', model: 'test', role: 'assistant', type: 'message', content: [{ type: 'text', text }],
    stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
function capture() {
  let text = '';
  const stream = new Writable({ write(chunk, _encoding, callback) { text += String(chunk); callback(); } });
  return { stream, value: () => text };
}
function workspace(): string { return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-subtask-'))); }

/** Runs the typed lines against a real runtime whose registry is replaced by an observation seam. */
async function drive(lines: readonly string[], runtime: (config: SessionConfig, session: Session) => Partial<Runtime>) {
  const root = workspace();
  const config = defaultConfig(root, []); config.model = 'test';
  const session = Session.open(root, { config });
  session.append({ kind: 'message', message: { role: 'user', content: 'earlier task' } });
  session.append({ kind: 'message', message: { role: 'assistant', content: 'earlier answer' } });
  session.append({ kind: 'turn_end', reason: 'end_turn' });
  const provider: ModelProvider = { count: async () => 0, complete: async () => reply('unused') };
  const stdout = capture(), stderr = capture();
  try {
    await interactiveLoop(session, provider, runtime(config, session) as Runtime, {
      input: Readable.from([...lines.map(line => `${line}\n`), '/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
    });
    return { text: stdout.value(), status: stderr.value(), session };
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('the source rows are exact', () => {
  // `m` (chunk-57v1bkyr.js 15000): the escaped angle brackets survive into the rendered row.
  assert.equal(SUBTASK_USAGE, 'Usage: /subtask \\<task\\>');
  assert.equal(SUBTASK_FORK, '⑂');
  assert.equal(SUBTASK_FIRST_TURN, 'Cannot start a subtask before the first conversation turn');
  assert.equal(SUBTASK_COORDINATOR, 'Subtasks are not available in coordinator sessions. Use /branch instead.');
  // `OR` and the last four id characters.
  assert.equal(subtaskForkLine('fix-parser', 'a1b2c3d4'), '⑂ forked fix-parser (c3d4)');
});

test('the name is the first three words, stripped, cut to 24, with fork as the fallback', () => {
  assert.equal(subtaskName('Fix the parser bug now'), 'fix-the-parser');
  assert.equal(subtaskName('  Review   PR #42  '), 'review-pr-42');
  assert.equal(subtaskName('a'.repeat(40)), 'a'.repeat(24));
  assert.equal(subtaskName('!!!'), 'fork');
  // Trailing dashes left by the strip are trimmed before the cut.
  assert.equal(subtaskName('fix the parser!!!'), 'fix-the-parser');
});

test('the allocator takes the first free ordinal', () => {
  assert.equal(allocateSubtaskName('fix', new Set()), 'fix');
  assert.equal(allocateSubtaskName('fix', new Set(['fix'])), 'fix-2');
  assert.equal(allocateSubtaskName('fix', new Set(['fix', 'fix-2', 'fix-4'])), 'fix-3');
});

test('the coordinator gate reads the environment flag and the surface', () => {
  assert.equal(subtaskCoordinator({}, { interactive: true, remote: false }), false);
  assert.equal(subtaskCoordinator({ CLAUDE_CODE_COORDINATOR_MODE: '0' }, { interactive: false, remote: false }), false);
  assert.equal(subtaskCoordinator({ CLAUDE_CODE_COORDINATOR_MODE: 'YES' }, { interactive: false, remote: false }), true);
  // An interactive local surface without the remote flag is not a coordinator session.
  assert.equal(subtaskCoordinator({ CLAUDE_CODE_COORDINATOR_MODE: 'on' }, { interactive: true, remote: false }), false);
  assert.equal(subtaskCoordinator({ CLAUDE_CODE_COORDINATOR_MODE: 'on', CLAUDE_CODE_REMOTE: '1' },
    { interactive: true, remote: false }), true);
  assert.equal(subtaskCoordinator({ CLAUDE_CODE_COORDINATOR_MODE: 'on' }, { interactive: true, remote: true }), true);
});

test('the command is registered in both command tables', () => {
  assert.match(COMMAND_HELP, /^\/subtask <task> {2}Send a subagent off with your full context; its result comes back here$/m);
  assert.deepEqual(TUI_COMMANDS.find(command => command.name === 'subtask'),
    { name: 'subtask', description: 'Send a subagent off with your full context; its result comes back here',
      kind: 'command', lane: 'agent' });
});

test('/subtask with no argument prints the usage row and spawns nothing', async () => {
  const launches: string[] = [];
  const run = await drive(['/subtask'], () => ({ tools: [], buildTools: () => [], close: async () => {}, limits: [],
    launchSubtask: async (_config, _owner, task) => { launches.push(task); return { kind: 'unavailable', reason: 'disabled' }; } }));
  assert.equal(run.text, SUBTASK_USAGE + '\n');
  assert.deepEqual(launches, []);
});

test('/subtask spawns a fork with the whole conversation and names it', async () => {
  let seen: { task: string; conversation: unknown } | undefined;
  const run = await drive(['/subtask Fix the parser'], () => ({ tools: [], buildTools: () => [], close: async () => {},
    limits: [], launchSubtask: async (_config, _owner, task, _signal, conversation) => {
      seen = { task, conversation };
      return { kind: 'forked', name: 'fix-the-parser', agentId: 'aaaa1111' } satisfies SubtaskLaunch;
    } }));
  assert.equal(seen!.task, 'Fix the parser');
  const messages = seen!.conversation as { role: string; content: unknown }[];
  assert.deepEqual(messages.map(message => message.role), ['user', 'assistant']);
  assert.equal(run.text, '⑂ forked fix-the-parser (1111)\n');
});

test('/subtask reports the first-turn row when there is no conversation to seed', async () => {
  const root = workspace();
  const config = defaultConfig(root, []); config.model = 'test';
  const session = Session.open(root, { config });
  const stdout = capture(), stderr = capture();
  try {
    const runtime: Partial<Runtime> = { tools: [], buildTools: () => [], close: async () => {}, limits: [],
      launchSubtask: async (_config, _owner, _task, _signal, conversation) =>
        ({ kind: conversation.length === 0 ? 'unavailable' : 'forked', ...(conversation.length === 0
          ? { reason: 'no-conversation' } : { name: 'x', agentId: 'bbbb2222' }) }) as SubtaskLaunch };
    await interactiveLoop(session, { count: async () => 0, complete: async () => reply('unused') }, runtime as Runtime, {
      input: Readable.from(['/subtask start over\n', '/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
    });
    assert.equal(stdout.value(), SUBTASK_FIRST_TURN + '\n');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('the real runtime seeds a registry child and reports its allocated name', async () => {
  const root = workspace();
  const config = defaultConfig(root, []); config.model = 'test';
  config.features = { tasks: false, subagents: true, agentMessaging: true, agentTypes: true };
  const provider: ModelProvider = { count: async () => 1, complete: async () => reply('child done') };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  const session = Session.open(root, { config });
  session.append({ kind: 'message', message: { role: 'user', content: 'earlier task' } });
  session.append({ kind: 'message', message: { role: 'assistant', content: 'earlier answer' } });
  session.append({ kind: 'turn_end', reason: 'end_turn' });
  const stdout = capture(), stderr = capture();
  try {
    await interactiveLoop(session, provider, runtime, {
      input: Readable.from(['/subtask Fix the parser\n', '/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
    });
    assert.match(stdout.value(), /^⑂ forked fix-the-parser \([0-9a-f]{4}\)$/m, stdout.value());
    // The child journal carries the seeded prefix and the prompt; the parent does not wait on it.
    const journals = fs.readdirSync(path.join(root, '.agent')).filter(name => name.endsWith('.jsonl')
      && !name.startsWith(session.id));
    assert.equal(journals.length, 1, journals.join(','));
    const records = fs.readFileSync(path.join(root, '.agent', journals[0]!), 'utf8').trim().split('\n')
      .map(line => JSON.parse(line) as Record<string, unknown>);
    const messages = records.filter(record => record.kind === 'message')
      .map(record => (record.message as { role: string }).role);
    assert.deepEqual(messages.slice(0, 2), ['user', 'assistant']);
    assert.ok(records.some(record => record.kind === 'turn_end' && record.reason === 'fork_seed'));
  } finally { await runtime.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
