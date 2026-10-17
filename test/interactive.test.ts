import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultConfig } from '../src/agent.js';
import { interactiveLoop, notifyPermissionPrompt } from '../src/interactive.js';
import type { ModelProvider } from '../src/provider.js';
import type { Runtime } from '../src/runtime.js';
import { Session } from '../src/session.js';
import { forkSession, listSessions } from '../src/sessions.js';
import type { SkillInfo } from '../src/config.js';

function reply(text: string): Anthropic.Message {
  return { id: 'fixture', model: 'test', role: 'assistant', type: 'message', content: [{ type: 'text', text }],
    stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
function output() {
  let text = '';
  const stream = new Writable({ write(chunk, _encoding, callback) { text += String(chunk); callback(); } });
  return { stream, value: () => text };
}
/** A runtime with no tools, matching a session whose stored tool list is empty. */
function stubRuntime(): Runtime {
  return { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
}
function skill(overrides: Partial<SkillInfo> = {}): SkillInfo {
  return { name: 'greet', description: 'Say hello', path: '/skills/greet/SKILL.md', body: 'Hello $ARGUMENTS',
    userInvocable: true, disableModelInvocation: false, ...overrides };
}

test('interactive tasks, compact, fork and clear keep history and release every lock', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-repl-')));
  const config = defaultConfig(workspace, []); config.model = 'test';
  const session = Session.open(workspace, { config });
  const responses = ['first response', 'summary of first task', 'second response'];
  const requests: unknown[] = [];
  const starts: string[] = [];
  const provider: ModelProvider = {
    count: async () => 10,
    complete: async (request, _signal, onText) => {
      requests.push(request); const text = responses.shift(); assert.ok(text);
      onText?.(text); return reply(text);
    },
  };
  // The parent Agent gains startSession; observe the guarded clear/fork calls.
  const previous = Object.getOwnPropertyDescriptor(Agent.prototype as unknown as object, 'startSession');
  Object.defineProperty(Agent.prototype as unknown as object, 'startSession', {
    configurable: true, writable: true,
    value: async function (this: Agent, source: string) { starts.push(source); },
  });
  const stdout = output(), stderr = output();
  try {
    await interactiveLoop(session, provider, stubRuntime(), {
      input: Readable.from(['first task\n/status\n/compact\n/fork\nsecond task\n/clear\n/sessions\n/unknown\n/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
    });
    assert.equal(requests.length, 3);
    assert.match(stdout.value(), /first response/);
    assert.match(stdout.value(), /second response/);
    assert.match(stderr.value(), /Unknown command/);
    assert.deepEqual(starts, ['fork', 'clear']);
    const sessions = listSessions(workspace);
    assert.equal(sessions.length, 3);
    assert.ok(sessions.every(s => !s.active));
    const original = Session.open(workspace, { id: session.id });
    try { assert.equal(original.messages.length, 1); assert.match(String(original.messages[0]?.content), /summary of first task/); assert.equal(original.awaitingResponse, false); }
    finally { original.close(); }
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).filter(f => f.endsWith('.lock')).length, 0);
  } finally {
    if (previous) Object.defineProperty(Agent.prototype as unknown as object, 'startSession', previous);
    else delete (Agent.prototype as unknown as { startSession?: unknown }).startSession;
    session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('context and effort commands count paired history and pin the new request effort', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-context-')));
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  const captured = path.join(workspace, 'payloads');
  fs.mkdirSync(captured);
  config.hooks = {
    PreModelSwitch: [{ command: `cat > ${JSON.stringify(path.join(captured, 'pre.json'))}` }],
    PostModelSwitch: [{ command: `cat > ${JSON.stringify(path.join(captured, 'post.json'))}` }],
  };
  const session = Session.open(workspace, { config });
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const provider: ModelProvider = { count: async () => 123, complete: async request => {
    requests.push(request); return { ...reply('done'), content: [
      { type: 'thinking', thinking: 'bound to original model', signature: 'fixture-signature' },
      { type: 'redacted_thinking', data: 'fixture-redacted' }, { type: 'text', text: 'done', citations: null }] };
  } };
  const stdout = output(), stderr = output();
  try {
    await interactiveLoop(session, provider, stubRuntime(), {
      input: Readable.from(['/context\n/rename retained title\n/effort xhigh\nverify effort\n/model second-model\nverify model switch\n/usage\n/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
    });
    assert.equal(requests.length, 2);
    assert.equal(requests[0]!.output_config?.effort, 'xhigh');
    assert.match(stdout.value(), /"inputTokens": 123/);
    assert.match(stdout.value(), /"contextTokens": 1000000/);
    assert.match(stdout.value(), /"compactAt": 512000/);
    assert.match(stdout.value(), /"effort": "xhigh"/);
    assert.equal(requests[1]!.model, 'second-model');
    const history = requests[1]!.messages[1]!.content;
    assert.ok(Array.isArray(history));
    assert.equal(history.some(block => block.type === 'thinking' || block.type === 'redacted_thinking'), false);
    assert.equal(listSessions(workspace).length, 3);
    assert.ok(listSessions(workspace).every(item => item.title === 'retained title'));
    const branches = listSessions(workspace).filter(item => item.parent);
    assert.equal(branches.length, 2); assert.ok(branches.every(item => item.parent?.reason === 'configuration'));
    assert.ok(listSessions(workspace).every(item => !item.active));
    const pre = JSON.parse(fs.readFileSync(path.join(captured, 'pre.json'), 'utf8'));
    assert.equal(pre.hook_event_name, 'PreModelSwitch');
    assert.equal(pre.from_model, 'fixture');
    assert.equal(pre.to_model, 'second-model');
    assert.equal(pre.requested_model, 'second-model');
    const post = JSON.parse(fs.readFileSync(path.join(captured, 'post.json'), 'utf8'));
    assert.equal(post.hook_event_name, 'PostModelSwitch');
    assert.equal(post.from_model, 'fixture');
    assert.equal(post.to_model, 'second-model');
    assert.equal(post.requested_model, 'second-model');
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('thinking commands pin new sessions and preserve paired history for subsequent requests', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-thinking-')));
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  const session = Session.open(workspace, { config });
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const provider: ModelProvider = { count: async () => 1, complete: async request => { requests.push(request); return reply('done'); } };
  const stdout = output(), stderr = output();
  try {
    await interactiveLoop(session, provider, stubRuntime(), {
      input: Readable.from(['/thinking on\nfirst\n/thinking\nsecond\n/thinking off\n/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
    });
    assert.equal(requests.length, 2);
    assert.equal(requests[0]!.thinking?.type, 'adaptive');
    assert.equal(requests[1]!.thinking?.type, 'disabled');
    assert.equal(requests[1]!.messages.length, 3);
    assert.match(stderr.value(), /Thinking: on/); assert.match(stderr.value(), /Thinking: off/);
    const sessions = listSessions(workspace);
    assert.equal(sessions.length, 3); assert.ok(sessions.every(item => !item.active));
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('interactive rewind branches at a completed turn and preserves the original log', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-rewind-')));
  const config = defaultConfig(workspace, []); config.model = 'test';
  const session = Session.open(workspace, { config });
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const provider: ModelProvider = { count: async () => 1, complete: async request => {
    requests.push(request); return reply(`response ${requests.length}`);
  } };
  const stdout = output(), stderr = output();
  try {
    await interactiveLoop(session, provider, stubRuntime(), {
      input: Readable.from(['first\nsecond\n/rewind 1\nthird\n/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
    });
    assert.equal(requests.length, 3);
    assert.equal(requests[2]!.messages.length, 3);
    assert.equal(requests[2]!.messages[0]!.content, 'first');
    assert.equal(requests[2]!.messages[2]!.content, 'third');
    const original = Session.open(workspace, { id: session.id });
    try { assert.equal(original.messages.length, 4); assert.equal(original.messages[2]!.content, 'second'); }
    finally { original.close(); }
    assert.equal(listSessions(workspace).length, 2);
    assert.ok(listSessions(workspace).every(item => !item.active));
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('interactive clear, fork and exit run SessionEnd and release locks', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-end-')));
  const marker = path.join(workspace, 'ended.jsonl');
  const config = defaultConfig(workspace, []); config.model = 'test';
  config.hooks = { SessionEnd: [{ command: `${JSON.stringify(process.execPath)} -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>require("fs").appendFileSync(${JSON.stringify(marker)},s));'` }] };
  const session = Session.open(workspace, { config });
  const stdout = output(), stderr = output();
  const provider: ModelProvider = { count: async () => 1, complete: async () => reply('done') };
  try {
    await interactiveLoop(session, provider, stubRuntime(), { input: Readable.from(['/clear\n/fork\n/exit\n']), output: stdout.stream, status: stderr.stream, signal: new AbortController().signal });
    const ended = fs.readFileSync(marker, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(ended.map(event => event.reason), ['clear', 'other', 'prompt_input_exit']);
    assert.equal(new Set(ended.map(event => event.session_id)).size, 3);
    assert.ok(listSessions(workspace).every(item => !item.active));
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('fork blocks an unfinished turn and copies completed history into an independent log', () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-fork-')));
  const config = defaultConfig(workspace, []); config.model = 'test';
  const session = Session.open(workspace, { config });
  try {
    session.append({ kind: 'message', message: { role: 'user', content: 'task' } });
    assert.throws(() => forkSession(session), /Finish or continue/);
    session.append({ kind: 'message', message: { role: 'assistant', content: 'done' } });
    session.append({ kind: 'turn_end', reason: 'end_turn' });
    const fork = forkSession(session);
    try {
      assert.notEqual(fork.id, session.id);
      assert.deepEqual(fork.messages, session.messages);
      fork.append({ kind: 'message', message: { role: 'user', content: 'fork only' } });
      assert.equal(session.messages.length, 2);
    } finally { fork.close(); }
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('/skills lists skills and /NAME runs a user-invocable skill', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-skills-')));
  const config = defaultConfig(workspace, []); config.model = 'test';
  config.skills = [
    skill(),
    skill({ name: 'quiet', description: 'Silent', userInvocable: false }),
    skill({ name: 'auto', description: 'Model disabled', body: 'Auto $1', disableModelInvocation: true }),
  ];
  const expansionLog = path.join(workspace, 'expansions.jsonl');
  config.hooks = { UserPromptExpansion: [{ command: `cat >> ${JSON.stringify(expansionLog)}` }] };
  const session = Session.open(workspace, { config });
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const provider: ModelProvider = {
    count: async () => 10,
    complete: async (request, _signal, onText) => { requests.push(request); onText?.('done'); return reply('done'); },
  };
  const stdout = output(), stderr = output();
  try {
    await interactiveLoop(session, provider, stubRuntime(), {
      input: Readable.from([
        '/skills\n',
        '/greet world\n',
        '/quiet x\n',
        '/auto z\n', // disable-model-invocation is allowed for explicit user invocation
        '/missing x\n',
        '/exit\n',
      ]),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
    });
    assert.match(stdout.value(), /greet: Say hello/);
    assert.match(stdout.value(), /quiet \(not user-invocable\)/);
    assert.match(stdout.value(), /auto \(model-disabled\)/);
    // /greet and /auto expanded and ran; /quiet and /missing were rejected.
    assert.equal(requests.length, 2);
    const contents = requests.map(r => String(r.messages.at(-1)?.content));
    assert.ok(contents.includes('Hello world'));
    assert.ok(contents.includes('Auto z'));
    assert.match(stderr.value(), /not user-invocable/);
    assert.match(stderr.value(), /Unknown command/);
    const expansions = fs.readFileSync(expansionLog, 'utf8').trim().split('\n')
      .map(line => JSON.parse(line) as { expansion_type?: string; command_name?: string; command_args?: string; prompt?: string });
    assert.deepEqual(expansions.map(event => [event.expansion_type, event.command_name, event.command_args, event.prompt]),
      [['slash_command', 'greet', 'world', '/greet world'], ['slash_command', 'auto', 'z', '/auto z']]);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('a pending permission prompt notifies after six seconds and can be cancelled', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const emitted: Array<{ message: string; notification_type: string }> = [];
  const cancel = notifyPermissionPrompt('write_file', payload => emitted.push(payload));
  t.mock.timers.tick(5_999);
  assert.equal(emitted.length, 0);
  t.mock.timers.tick(1);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0]?.message, 'Permission needed to use write_file');
  assert.equal(emitted[0]?.notification_type, 'permission_prompt');
  const cancelled = notifyPermissionPrompt('read_file', payload => emitted.push(payload));
  cancelled();
  t.mock.timers.tick(6_000);
  assert.equal(emitted.length, 1);
  process.env.CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS = '1';
  try {
    notifyPermissionPrompt('read_file', payload => emitted.push(payload));
    t.mock.timers.tick(6_000);
    assert.equal(emitted.length, 1);
  } finally { delete process.env.CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS; }
});
