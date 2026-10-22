import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import { FORK_BACKGROUND_DESCRIPTION, FORK_COORDINATOR, FORK_DESCRIPTION, FORK_FIRST_TURN, FORK_NOTHING,
  FORK_USAGE, SESSION_RUNNING, SESSION_WAITING, agentViewDisabled, fleetForkOpen, forkNameLine,
  forkSessionLine } from '../src/fork-command.js';
import { COMMAND_HELP, interactiveLoop } from '../src/interactive.js';
import type { ModelProvider } from '../src/provider.js';
import type { Runtime } from '../src/runtime.js';
import { Session, type SessionConfig } from '../src/session.js';
import { SUBTASK_COORDINATOR, SUBTASK_FIRST_TURN, SUBTASK_USAGE, type SubtaskLaunch } from '../src/subtask.js';
import { tuiCommandsWithSkills } from '../src/tui-autocomplete.js';

function reply(text: string): Anthropic.Message {
  return { id: 'fixture', model: 'test', role: 'assistant', type: 'message', content: [{ type: 'text', text }],
    stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
function capture() {
  let text = '';
  const stream = new Writable({ write(chunk, _encoding, callback) { text += String(chunk); callback(); } });
  return { stream, value: () => text };
}
function workspace(): string { return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-fork-'))); }

type Drive = {
  lines: readonly string[];
  runtime?: (config: SessionConfig, session: Session) => Partial<Runtime>;
  env?: NodeJS.ProcessEnv;
  config?: (config: SessionConfig) => void;
  conversation?: boolean;
  startBackground?: (options: { session: Session; prompt: string }) =>
    { sessionId: string; pid: number | undefined; log: string };
};
async function drive(options: Drive) {
  const root = workspace();
  const config = defaultConfig(root, []); config.model = 'test';
  options.config?.(config);
  const session = Session.open(root, { config });
  if (options.conversation !== false) {
    session.append({ kind: 'message', message: { role: 'user', content: 'earlier task' } });
    session.append({ kind: 'message', message: { role: 'assistant', content: 'earlier answer' } });
    session.append({ kind: 'turn_end', reason: 'end_turn' });
  }
  const provider: ModelProvider = { count: async () => 0, complete: async () => reply('unused') };
  const stdout = capture(), stderr = capture();
  const saved = { ...process.env };
  Object.assign(process.env, options.env ?? {});
  for (const key of ['CLAUDE_CODE_DISABLE_AGENT_VIEW', 'IS_DEMO', 'CLAUDE_CODE_COORDINATOR_MODE'])
    if (options.env?.[key] === undefined) delete process.env[key];
  const runtime: Partial<Runtime> = { tools: [], buildTools: () => [], close: async () => {}, limits: [],
    ...(options.runtime?.(config, session) ?? {}) };
  try {
    await interactiveLoop(session, provider, runtime as Runtime, {
      input: Readable.from([...options.lines.map(line => `${line}\n`), '/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
      ...(options.startBackground === undefined ? {} : { startBackground: options.startBackground }),
    });
    return { text: stdout.value(), status: stderr.value(), session };
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('the closed-fleet directive rows are exact', () => {
  // `m` (chunk-0krtqd6x.js 15000): the escaped brackets survive into the rendered row.
  assert.equal(FORK_USAGE, 'Usage: /fork \\<directive\\>');
  assert.equal(FORK_COORDINATOR, 'Forking is not available in coordinator sessions. Use /branch instead.');
  assert.equal(FORK_FIRST_TURN, 'Cannot fork before the first conversation turn');
  assert.equal(FORK_DESCRIPTION, 'Spawn a background agent that inherits the full conversation');
  assert.equal(FORK_BACKGROUND_DESCRIPTION, 'Copy this conversation into a new background session and keep working here');
});

test('the fleet-fork gate reads the env flag, the setting and the demo flag', () => {
  assert.equal(fleetForkOpen({}, {}), true);
  // `r`: the environment flag disables on any non-empty value; the setting only on strict true.
  assert.equal(agentViewDisabled({ CLAUDE_CODE_DISABLE_AGENT_VIEW: '1' }, {}), true);
  assert.equal(agentViewDisabled({ CLAUDE_CODE_DISABLE_AGENT_VIEW: '0' }, {}), true);
  assert.equal(agentViewDisabled({}, { disableAgentView: true }), true);
  assert.equal(agentViewDisabled({}, { disableAgentView: false }), false);
  // `gw() && !Ne(IS_DEMO)`: `Ne` reads `1`/`true`/`yes`/`on` in any case.
  assert.equal(fleetForkOpen({ IS_DEMO: '1' }, {}), false);
  assert.equal(fleetForkOpen({ IS_DEMO: 'TRUE' }, {}), false);
  assert.equal(fleetForkOpen({ IS_DEMO: '0' }, {}), true);
  assert.equal(fleetForkOpen({ CLAUDE_CODE_DISABLE_AGENT_VIEW: '1' }, { disableAgentView: false }), false);
});

test('the fork row is the state, the name, the short id and the chips', () => {
  assert.equal(SESSION_RUNNING, 'session running');
  assert.equal(SESSION_WAITING, 'session waiting for a prompt');
  assert.equal(forkSessionLine({ state: SESSION_RUNNING }), 'session running');
  assert.equal(forkSessionLine({ state: SESSION_RUNNING, name: 'fix-parser', id: 'a1b2c3d4',
    chips: ['edits this checkout'] }), 'session running · fix-parser · a1b2c3d4 · edits this checkout');
  // `TMr` splits a name on the fork glyph and rejoins it with the same separator.
  assert.equal(forkNameLine('fix-parser'), 'fix-parser');
  assert.equal(forkNameLine('fix-parser ⑂ other'), 'fix-parser ⑂ other');
  assert.equal(forkNameLine('  ⑂  '), undefined);
});

test('the open fleet fork lists the copy row and keeps the subtask row', () => {
  const open = tuiCommandsWithSkills(undefined, { fleetFork: true });
  assert.equal(open.find(command => command.name === 'fork')?.description, FORK_BACKGROUND_DESCRIPTION);
  assert.ok(open.some(command => command.name === 'subtask'));
});

test('the closed fleet fork lists the directive row and no subtask row', () => {
  const closed = tuiCommandsWithSkills(undefined, { fleetFork: false });
  assert.equal(closed.find(command => command.name === 'fork')?.description, FORK_DESCRIPTION);
  assert.ok(!closed.some(command => command.name === 'subtask'));
  // The default is the open branch, which is what `/help` and the composer were built on.
  assert.deepEqual(tuiCommandsWithSkills(undefined).map(command => command.name),
    tuiCommandsWithSkills(undefined, { fleetFork: true }).map(command => command.name));
  assert.match(COMMAND_HELP, /^\/fork {7}Copy this conversation into a new background session and keep working here$/m);
});

test('the open-fleet /fork copies into a background session and keeps this one', async () => {
  const calls: string[] = [];
  const run = await drive({ lines: ['/fork'], startBackground: ({ prompt }) => {
    calls.push(prompt); return { sessionId: 'abcdef01-2345-6789-abcd-ef0123456789', pid: undefined, log: '/tmp/copy.log' };
  } });
  assert.deepEqual(calls, ['']);
  assert.match(run.text, /^session waiting for a prompt · abcdef01$/m);
  assert.match(run.text, /^Log: \/tmp\/copy\.log$/m);
  assert.match(run.text, /^Resume it with: litcode --resume abcdef01-2345-6789-abcd-ef0123456789$/m);
});

test('the open-fleet /fork runs the copy when a prompt is typed', async () => {
  const calls: string[] = [];
  const run = await drive({ lines: ['/fork write the tests'], startBackground: ({ prompt }) => {
    calls.push(prompt); return { sessionId: 'abcdef01-2345-6789-abcd-ef0123456789', pid: undefined, log: '/tmp/copy.log' };
  } });
  assert.deepEqual(calls, ['write the tests']);
  assert.match(run.text, /^session running · abcdef01$/m);
});

test('the open-fleet /fork refuses an empty conversation before it spawns', async () => {
  const calls: string[] = [];
  const run = await drive({ lines: ['/fork'], conversation: false, startBackground: ({ prompt }) => {
    calls.push(prompt); return { sessionId: 'x', pid: undefined, log: '/tmp/copy.log' };
  } });
  assert.deepEqual(calls, []);
  assert.equal(run.text, FORK_NOTHING + '\n');
});

test('the open-fleet /fork reports a failed copy without ending this session', async () => {
  const run = await drive({ lines: ['/fork'], startBackground: () => { throw new Error('spawn failed'); } });
  assert.equal(run.text, "Couldn't fork: spawn failed\n");
});

test('the closed-fleet /fork prints the usage row and spawns nothing', async () => {
  const launches: string[] = [];
  const run = await drive({ lines: ['/fork'], env: { CLAUDE_CODE_DISABLE_AGENT_VIEW: '1' },
    runtime: () => ({ launchSubtask: async (_config, _owner, task) => {
      launches.push(task); return { kind: 'unavailable', reason: 'disabled' }; } }) });
  assert.equal(run.text, FORK_USAGE + '\n');
  assert.deepEqual(launches, []);
});

test('the closed-fleet /fork refuses a coordinator session before the spawn', async () => {
  const launches: string[] = [];
  const run = await drive({ lines: ['/fork review the diff'],
    env: { CLAUDE_CODE_DISABLE_AGENT_VIEW: '1', CLAUDE_CODE_COORDINATOR_MODE: 'on' },
    runtime: () => ({ launchSubtask: async (_config, _owner, task) => {
      launches.push(task); return { kind: 'unavailable', reason: 'coordinator' }; } }) });
  assert.equal(run.text, FORK_COORDINATOR + '\n');
  assert.deepEqual(launches, []);
});

test('the closed-fleet /fork spawns a fork and reports the first-turn row without history', async () => {
  let seen: { task: string; roles: string[] } | undefined;
  const run = await drive({ lines: ['/fork review the diff'], conversation: false,
    env: { CLAUDE_CODE_DISABLE_AGENT_VIEW: '1' },
    runtime: () => ({ launchSubtask: async (_config, _owner, task, _signal, conversation) => {
      seen = { task, roles: conversation.map(message => message.role) };
      return { kind: 'unavailable', reason: 'no-conversation' } satisfies SubtaskLaunch;
    } }) });
  assert.deepEqual(seen, { task: 'review the diff', roles: [] });
  assert.equal(run.text, FORK_FIRST_TURN + '\n');
});

test('the closed-fleet /fork reports the forked row with the whole conversation', async () => {
  let seen: { task: string; roles: string[] } | undefined;
  const run = await drive({ lines: ['/fork review the diff'], env: { CLAUDE_CODE_DISABLE_AGENT_VIEW: '1' },
    runtime: () => ({ launchSubtask: async (_config, _owner, task, _signal, conversation) => {
      seen = { task, roles: conversation.map(message => message.role) };
      return { kind: 'forked', name: 'review-the-diff', agentId: 'aaaa1111' } satisfies SubtaskLaunch;
    } }) });
  assert.deepEqual(seen, { task: 'review the diff', roles: ['user', 'assistant'] });
  assert.equal(run.text, '⑂ forked review-the-diff (1111)\n');
});

test('/subtask keeps its own rows in an open fleet fork', async () => {
  const run = await drive({ lines: ['/subtask'], runtime: () => ({
    launchSubtask: async () => ({ kind: 'unavailable', reason: 'disabled' }) }) });
  assert.equal(run.text, SUBTASK_USAGE + '\n');
  const coordinator = await drive({ lines: ['/subtask review the diff'],
    env: { CLAUDE_CODE_COORDINATOR_MODE: 'on' }, runtime: () => ({
      launchSubtask: async () => ({ kind: 'unavailable', reason: 'coordinator' }) }) });
  assert.equal(coordinator.text, SUBTASK_COORDINATOR + '\n');
  const firstTurn = await drive({ lines: ['/subtask review the diff'], conversation: false,
    runtime: () => ({ launchSubtask: async (_config, _owner, _task, _signal, conversation) =>
      ({ kind: conversation.length === 0 ? 'unavailable' : 'forked',
        ...(conversation.length === 0 ? { reason: 'no-conversation' } : { name: 'x', agentId: 'bbbb2222' }) }) as SubtaskLaunch }) });
  assert.equal(firstTurn.text, SUBTASK_FIRST_TURN + '\n');
});
