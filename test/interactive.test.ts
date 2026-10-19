import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultConfig } from '../src/agent.js';
import { configChangeSource, interactiveLoop, notifyPermissionPrompt } from '../src/interactive.js';
import type { ModelProvider } from '../src/provider.js';
import { createRuntime, type Runtime } from '../src/runtime.js';
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
function emitHookValue(value: unknown): string {
  return `printf '%s' '${JSON.stringify(value).replaceAll("'", `'\\''`)}'`;
}
/** A runtime with no tools, matching a session whose stored tool list is empty. */
function stubRuntime(overrides: Partial<Runtime> = {}): Runtime {
  return { tools: [], buildTools: () => [], close: async () => {}, limits: [], ...overrides };
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

test('startup SessionStart watch paths register with the config watcher', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-watch-paths-')));
  const config = defaultConfig(workspace, []); config.model = 'fixture'; config.watchConfig = true;
  const session = Session.open(workspace, { config });
  const provider: ModelProvider = { count: async () => 1, complete: async () => reply('done') };
  const stdout = output(), stderr = output();
  try {
    await interactiveLoop(session, provider, stubRuntime(), {
      input: Readable.from(['/exit\n']), output: stdout.stream, status: stderr.stream,
      signal: new AbortController().signal, initialWatchPaths: ['/tmp/watched.md'],
    });
    assert.ok(session.events.some(event => event.kind === 'instruction_watch' && event.paths.includes('/tmp/watched.md')));
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('PreModelSwitch deny and declined ask keep the model; an accepted ask switches it', async () => {
  const setup = (hook: Record<string, unknown>) => {
    const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-model-hook-')));
    const config = defaultConfig(workspace, []); config.model = 'fixture';
    config.hooks = { PreModelSwitch: [{ command: emitHookValue({ hookSpecificOutput: { hookEventName: 'PreModelSwitch', ...hook } }) }] };
    const session = Session.open(workspace, { config });
    const requests: unknown[] = [];
    const provider: ModelProvider = { count: async () => 1,
      complete: async request => { requests.push(request); return reply('done'); } };
    const stdout = output(), stderr = output();
    return { workspace, session, requests, provider, stdout, stderr,
      cleanup: () => { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); } };
  };
  const models = (requests: unknown[]) => requests.map(item => (item as { model?: string }).model);
  const waitFor = async (check: () => boolean, label: string) => {
    const deadline = Date.now() + 5000;
    while (!check()) { if (Date.now() > deadline) assert.fail(`wait expired: ${label}`); await new Promise(resolve => setTimeout(resolve, 5)); }
  };
  const denied = setup({ permissionDecision: 'deny', permissionDecisionReason: 'not allowed' });
  try {
    await interactiveLoop(denied.session, denied.provider, stubRuntime(), {
      input: Readable.from(['/model second-model\n', 'verify model switch\n', '/exit\n']),
      output: denied.stdout.stream, status: denied.stderr.stream, signal: new AbortController().signal,
    });
    assert.deepEqual(models(denied.requests), ['fixture']);
    assert.match(denied.stderr.value(), /Model switch blocked by a PreModelSwitch hook: not allowed/);
  } finally { denied.cleanup(); }
  for (const [line, switched] of [['n', false], ['y', true]] as const) {
    const run = setup({ permissionDecision: 'ask', permissionDecisionReason: 'sure?' });
    const input = new Readable({ read() {} });
    const loop = interactiveLoop(run.session, run.provider, stubRuntime(), {
      input, output: run.stdout.stream, status: run.stderr.stream, signal: new AbortController().signal,
    });
    try {
      input.push('/model second-model\n');
      await waitFor(() => run.stdout.value().includes('Switch model? [y/N]'), 'confirmation prompt');
      input.push(`${line}\n`);
      await waitFor(() => switched ? true : run.stderr.value().includes('blocked by a PreModelSwitch hook: sure?'), 'ask verdict');
      input.push('verify model switch\n');
      await waitFor(() => run.requests.length === 1, 'prompt after ask');
      input.push('/exit\n');
      input.push(null);
      await loop;
      assert.deepEqual(models(run.requests), [switched ? 'second-model' : 'fixture']);
    } finally { run.cleanup(); }
  }
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
    skill({ name: 'auto', description: 'Model disabled', body: 'Auto $1', disableModelInvocation: true,
      source: 'projectSettings' }),
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
      .map(line => JSON.parse(line) as { expansion_type?: string; command_name?: string; command_args?: string;
        command_source?: string; prompt?: string });
    assert.deepEqual(expansions.map(event => [event.expansion_type, event.command_name, event.command_args,
      event.command_source, event.prompt]),
      [['slash_command', 'greet', 'world', undefined, '/greet world'],
        ['slash_command', 'auto', 'z', 'projectSettings', '/auto z']]);
    assert.equal('command_source' in expansions[0]!, false);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('expansion hook is raised once before a skill run and its context reaches the fallthrough turn', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-fork-hook-')));
  const config = defaultConfig(workspace, []); config.model = 'test';
  config.skills = [
    skill({ name: 'forked', body: 'Fork body', context: 'fork', source: 'projectSettings' }),
    skill({ name: 'runs', body: 'Runs body', command: 'echo runs', source: 'userSettings' }),
  ];
  const expansionLog = path.join(workspace, 'expansions.jsonl');
  const emitExpansion = JSON.stringify(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptExpansion',
    additionalContext: 'expansion note' } }));
  config.hooks = { UserPromptExpansion: [{ command: `printf %s ${emitExpansion}; cat >> ${JSON.stringify(expansionLog)}` }] };
  const session = Session.open(workspace, { config });
  const ran: string[] = [];
  const runtime = stubRuntime({ runSkill: async (_config, _owner, target, args) => { ran.push(`${target.name}:${args}`); return 'skill result'; } });
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const provider: ModelProvider = {
    count: async () => 10,
    complete: async request => { requests.push(request); return reply('done'); },
  };
  const stdout = output(), stderr = output();
  try {
    await interactiveLoop(session, provider, runtime, {
      input: Readable.from(['/forked alpha\n', '/runs beta\n', '/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
    });
    assert.deepEqual(ran, ['forked:alpha', 'runs:beta']);
    assert.match(stdout.value(), /skill result/);
    const payloads = fs.readFileSync(expansionLog, 'utf8').trim().split('\n')
      .map(line => JSON.parse(line) as { command_name?: string; command_args?: string; command_source?: string });
    assert.deepEqual(payloads.map(payload => [payload.command_name, payload.command_args, payload.command_source]),
      [['forked', 'alpha', 'projectSettings'], ['runs', 'beta', 'userSettings']]);
    assert.equal(requests.length, 1);
    assert.match(JSON.stringify(requests[0]!.messages), /expansion note/);
    assert.deepEqual(session.events.flatMap(event => event.kind === 'message' && event.classifier?.origin.kind === 'human'
      ? [event.classifier.humanText] : []), ['/runs beta']);
    const content = session.messages.find(message => message.role === 'user')?.content;
    assert.deepEqual(content, [{ type: 'text', text: 'skill result' },
      { type: 'text', text: 'Hook context:\nexpansion note' }]);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('a SessionStart initial message is queued before typed input', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-initial-message-')));
  const config = defaultConfig(workspace, []); config.model = 'test';
  const session = Session.open(workspace, { config });
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const provider: ModelProvider = {
    count: async () => 10,
    complete: async request => { requests.push(request); return reply('done'); },
  };
  const stdout = output(), stderr = output();
  try {
    await interactiveLoop(session, provider, stubRuntime(), {
      input: Readable.from(['typed task\n', '/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
      initialUserMessage: 'hook message',
    });
    assert.equal(requests.length, 2);
    assert.match(JSON.stringify(requests[0]!.messages), /hook message/);
    assert.doesNotMatch(JSON.stringify(requests[0]!.messages), /typed task/);
    assert.match(JSON.stringify(requests[1]!.messages), /typed task/);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('a blocked expansion prevents the skill from running', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-fork-block-')));
  const config = defaultConfig(workspace, []); config.model = 'test';
  config.skills = [skill({ name: 'forked', body: 'Fork body', context: 'fork' })];
  const expansionLog = path.join(workspace, 'expansions.jsonl');
  config.hooks = { UserPromptExpansion: [{ command: `cat >> ${JSON.stringify(expansionLog)}; printf 'denied' >&2; exit 2` }] };
  const session = Session.open(workspace, { config });
  const ran: string[] = [];
  const runtime = stubRuntime({ runSkill: async (_config, _owner, target) => { ran.push(target.name); return 'skill result'; } });
  const stdout = output(), stderr = output();
  try {
    await interactiveLoop(session, { count: async () => 1, complete: async () => reply('done') }, runtime, {
      input: Readable.from(['/forked alpha\n', '/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
    });
    assert.deepEqual(ran, []);
    assert.match(stdout.value(), /UserPromptExpansion operation blocked by hook:\ndenied/);
    assert.match(stdout.value(), /Original prompt: \/forked alpha/);
    assert.match(stderr.value(), /hook_blocked/);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('a suppressed expansion block omits the original prompt', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-fork-suppress-')));
  const config = defaultConfig(workspace, []); config.model = 'test';
  config.skills = [skill({ name: 'forked', body: 'Fork body', context: 'fork' })];
  const blocked = JSON.stringify(JSON.stringify({ decision: 'block', reason: 'denied',
    hookSpecificOutput: { hookEventName: 'UserPromptExpansion', suppressOriginalPrompt: true } }));
  config.hooks = { UserPromptExpansion: [{ command: `printf %s ${blocked}` }] };
  const session = Session.open(workspace, { config });
  const ran: string[] = [];
  const runtime = stubRuntime({ runSkill: async (_config, _owner, target) => { ran.push(target.name); return 'skill result'; } });
  const stdout = output(), stderr = output();
  try {
    await interactiveLoop(session, { count: async () => 1, complete: async () => reply('done') }, runtime, {
      input: Readable.from(['/forked alpha\n', '/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
    });
    assert.deepEqual(ran, []);
    assert.match(stdout.value(), /UserPromptExpansion operation blocked by hook:\ndenied/);
    assert.doesNotMatch(stdout.value(), /Original prompt:/);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('config change sources follow the recovered settings and skill scopes', () => {
  const workspace = '/w', userDir = '/u';
  assert.equal(configChangeSource('/w/.harness/settings.json', workspace, { userDir }), 'project_settings');
  assert.equal(configChangeSource('/w/custom/settings.json', workspace, { userDir, settingsFile: 'custom/settings.json' }), 'project_settings');
  assert.equal(configChangeSource('/w/.harness/settings.local.json', workspace, { userDir }), 'local_settings');
  assert.equal(configChangeSource('/u/settings.json', workspace, { userDir }), 'user_settings');
  assert.equal(configChangeSource('/w/policy.json', workspace, { userDir, managedSettingsFile: 'policy.json' }), 'policy_settings');
  assert.equal(configChangeSource('/u/skills/example/SKILL.md', workspace, { userDir }), 'skills');
  assert.equal(configChangeSource('/w/.harness/skills/nested/example/SKILL.md', workspace, { userDir }), 'skills');
  assert.equal(configChangeSource('/w/.harness/commands/greet.md', workspace, { userDir }), 'skills');
  assert.equal(configChangeSource('/u/agents/reviewer.md', workspace, { userDir }), 'skills');
  assert.equal(configChangeSource('/plugin/skills/example/SKILL.md', workspace, { userDir, contentDirectories: ['/plugin'] }), 'skills');
  // Instruction files and non-skill catalogs do not raise ConfigChange.
  assert.equal(configChangeSource('/w/AGENTS.md', workspace, { userDir }), undefined);
  assert.equal(configChangeSource('/w/.harness/rules/style.md', workspace, { userDir }), undefined);
  assert.equal(configChangeSource('/w/notes/settings.json', workspace, { userDir }), undefined);
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

test('workspace relocation raises DirectoryAdded as a documented slash_command hook and displays its failure', { timeout: 8000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cwd-hooks-')));
  const target = path.join(workspace, 'next');
  fs.mkdirSync(target);
  const payloadLog = path.join(workspace, 'directory-added.jsonl');
  const config = { ...defaultConfig(workspace, []), model: 'test', hooks: {
    DirectoryAdded: [
      { matcher: 'slash_command', command: `printf '%s' '{"systemMessage":"directory note"}'` },
      { matcher: 'slash_command',
        command: `cat >> ${JSON.stringify(payloadLog)}; printf 'boom' >&2; exit 3` },
    ],
  } };
  const provider: ModelProvider = { count: async () => 0, complete: async () => reply('unused') };
  const lifetime = AbortSignal.timeout(6000);
  const runtime = await createRuntime(config, provider, lifetime);
  config.tools = runtime.buildTools(config, 'schema').map(tool => ({ ...tool.schema, eager_input_streaming: true }));
  const session = Session.open(workspace, { config });
  const stdout = output(), stderr = output();
  try {
    await interactiveLoop(session, provider, runtime, {
      input: Readable.from(['/cwd next\n', '/exit\n']), output: stdout.stream, status: stderr.stream, signal: lifetime,
    });
    const payload = JSON.parse(fs.readFileSync(payloadLog, 'utf8').trim().split('\n')[0]!) as
      { hook_event_name?: string; directory?: string; source?: string };
    assert.deepEqual([payload.hook_event_name, payload.directory, payload.source],
      ['DirectoryAdded', target, 'slash_command']);
    assert.match(stderr.value(), /hook DirectoryAdded: directory note/);
    assert.match(stderr.value(), /\[DirectoryAdded hook: exit code 3\] boom/);
  } finally { session.close(); await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('a bare argument command answers with its usage instead of the unknown-command error', { timeout: 8000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-usage-')));
  const config = { ...defaultConfig(workspace, []), model: 'test' };
  const provider: ModelProvider = { count: async () => 0, complete: async () => reply('unused') };
  const lifetime = AbortSignal.timeout(6000);
  const runtime = await createRuntime(config, provider, lifetime);
  const session = Session.open(workspace, { config });
  const stdout = output(), stderr = output();
  try {
    await interactiveLoop(session, provider, runtime, {
      input: Readable.from(['/effort\n', '/cwd\n', '/permissions\n', '/rename\n', '/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: lifetime,
    });
    assert.match(stderr.value(), /error: Use \/effort low\|medium\|high\|xhigh\|max/);
    assert.match(stderr.value(), /error: Use \/cwd DIR/);
    assert.match(stderr.value(), /error: Use \/permissions default\|plan\|acceptEdits\|ask\|bypass\|auto\|dontAsk/);
    assert.match(stderr.value(), /error: Use \/rename TITLE/);
    assert.doesNotMatch(stderr.value(), /Unknown command; use \/help/);
  } finally { session.close(); await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('bare /config opens the editor mode choice and saves the picked mode', { timeout: 8000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-config-')));
  const userDir = path.join(workspace, 'user');
  fs.mkdirSync(userDir);
  const config = { ...defaultConfig(workspace, []), model: 'test', configSources: { userDir } };
  const provider: ModelProvider = { count: async () => 0, complete: async () => reply('unused') };
  const lifetime = AbortSignal.timeout(6000);
  const runtime = await createRuntime(config, provider, lifetime);
  const session = Session.open(workspace, { config });
  const stdout = output(), stderr = output();
  // A live stream, because the choice is read after the command line is handled.
  const input = new PassThrough();
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  try {
    const loop = interactiveLoop(session, provider, runtime,
      { input, output: stdout.stream, status: stderr.stream, signal: lifetime });
    input.write('/config\n');
    await wait(50);
    input.write('2\n');
    await wait(50);
    input.write('/exit\n');
    await loop;
    assert.match(stdout.value(), /Choose input editing/);
    assert.match(stderr.value(), /Editor mode: vim/);
    assert.doesNotMatch(stderr.value(), /Unknown command; use \/help/);
    assert.doesNotMatch(stderr.value(), /Use \/config editor=normal\|vim/);
  } finally { session.close(); await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
