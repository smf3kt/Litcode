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
    assert.match(stdout.value(), /Usage: \/effort <low\|medium\|high\|xhigh\|max\|auto>/);
    assert.match(stderr.value(), /error: Use \/cwd DIR/);
    assert.match(stderr.value(), /error: Use \/permissions default\|plan\|acceptEdits\|ask\|bypass\|auto\|dontAsk/);
    assert.match(stderr.value(), /error: Use \/rename TITLE/);
    assert.doesNotMatch(stderr.value(), /Unknown command; use \/help/);
  } finally { session.close(); await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('/loop expands to the recovered loop instructions and sends them as the turn', { timeout: 8000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-loop-')));
  const config = { ...defaultConfig(workspace, []), model: 'fixture' };
  const session = Session.open(workspace, { config });
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    requests.push(request); return reply('done'); } };
  const stdout = output(), stderr = output();
  try {
    await interactiveLoop(session, provider, stubRuntime(), {
      input: Readable.from(['/loop 5m /babysit-prs\n/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: new AbortController().signal,
    });
    assert.doesNotMatch(stderr.value(), /Unknown command/);
    assert.equal(requests.length, 1);
    // A plain typed turn is sent as a string body; only later turns carry content blocks.
    const sent = requests[0]!.messages.filter(message => message.role === 'user')
      .map(message => typeof message.content === 'string' ? message.content
        : message.content.filter(block => block.type === 'text').map(block => (block as Anthropic.TextBlock).text).join(''));
    assert.equal(sent.length, 1);
    const text = sent[0]!;
    assert.ok(text.startsWith('# /loop — schedule a recurring or self-paced prompt'), text.slice(0, 60));
    assert.ok(text.endsWith('5m /babysit-prs'), 'the typed arguments end the text');
    assert.ok(text.includes('Call cron_create with'));
    assert.ok(text.includes('schedule_wakeup'));
    assert.ok(text.includes('task_stop any monitor you armed (use task_list'));
    assert.ok(text.includes('invoke it via the `skill` tool'));
    // The vendor display names never reach the model: every one is mapped to this host's tool.
    assert.doesNotMatch(text, /CronCreate|CronDelete|ScheduleWakeup|TaskStop|TaskList|AskUserQuestion|Monitor\b|PushNotification/);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('/effort answers every argument form and stores only a persistable level', { timeout: 8000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-effort-')));
  const userDir = path.join(workspace, 'user');
  fs.mkdirSync(userDir);
  const config = { ...defaultConfig(workspace, []), model: 'test', configSources: { userDir } };
  const provider: ModelProvider = { count: async () => 0, complete: async () => reply('unused') };
  const lifetime = AbortSignal.timeout(6000);
  const runtime = await createRuntime(config, provider, lifetime);
  const session = Session.open(workspace, { config });
  const stdout = output(), stderr = output();
  const settingsFile = path.join(userDir, 'settings.json');
  const stored = () => fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};
  const previous = process.env.LLM_EFFORT;
  delete process.env.LLM_EFFORT;
  // A live stream, because the settings write is only observable once the command has returned.
  const input = new PassThrough();
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  try {
    const loop = interactiveLoop(session, provider, runtime,
      { input, output: stdout.stream, status: stderr.stream, signal: lifetime });
    input.write('/effort\n'); await wait(200);
    input.write('/effort status\n'); await wait(200);
    input.write('/effort high\n'); await wait(200);
    assert.equal(stored().effort, 'high');
    input.write('/effort status\n'); await wait(200);
    input.write('/effort max\n'); await wait(200);
    // `max` is session-scoped, so the store keeps the earlier level.
    assert.equal(stored().effort, 'high');
    input.write('/effort extreme\n'); await wait(200);
    input.write('/effort auto\n'); await wait(200);
    assert.equal('effort' in stored(), false);
    input.write('/exit\n');
    await loop;
    const said = stdout.value(), status = stderr.value();
    assert.match(said, /Usage: \/effort <low\|medium\|high\|xhigh\|max\|auto>/);
    assert.match(said, /^Effort level: auto \(currently high\)$/m);
    assert.match(said, /Set effort level to high \(saved as your default for new sessions\): Comprehensive implementation with extensive testing and documentation/);
    assert.match(said, /Set effort level to max \(this session only\)/);
    assert.match(said, /Current effort level: high \(Comprehensive implementation with extensive testing and documentation\)/);
    assert.match(said, /Invalid argument: extreme\. Valid options are: low, medium, high, xhigh, max, auto/);
    assert.match(said, /Effort level set to auto/);
    // The recovered `eee` notice is the status-row surface, and `auto` has none.
    assert.match(status, /● high · \/effort/);
    assert.match(status, /◈ max · \/effort/);
    assert.doesNotMatch(status, /auto · \/effort/);
    assert.doesNotMatch(said + status, /Unknown command; use \/help/);
  } finally {
    if (previous !== undefined) process.env.LLM_EFFORT = previous;
    session.close(); await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('/copy sends the latest response through OSC 52 and reports what it copied', { timeout: 8000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-copy-')));
  const config = { ...defaultConfig(workspace, []), model: 'test' };
  const responses = ['the first answer', 'the second answer'];
  const provider: ModelProvider = { count: async () => 10,
    complete: async () => reply(responses.shift()!) };
  const lifetime = AbortSignal.timeout(6000);
  const runtime = await createRuntime(config, provider, lifetime);
  const session = Session.open(workspace, { config });
  const stdout = output(), stderr = output();
  try {
    await interactiveLoop(session, provider, runtime, {
      input: Readable.from(['one\n', 'two\n', '/copy\n', '/copy 2\n', '/copy 9\n', '/copy 0\n', '/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: lifetime,
    });
    const said = stdout.value();
    // The payload is the recovered `osc52Payload` form: ESC ] 52 ; c ; <base64> BEL.
    const payload = (text: string) => `\u001b]52;c;${Buffer.from(text, 'utf8').toString('base64')}\u0007`;
    assert.ok(said.includes(payload('the second answer')), 'the latest response is the one copied');
    assert.ok(said.includes(payload('the first answer')), '/copy 2 reaches the earlier response');
    assert.match(said, /Copied to clipboard \(17 characters, 1 lines\)\nAlso written to .*response\.md/);
    assert.match(said, /Only 2 assistant messages available to copy/);
    assert.match(said, /Usage: \/copy \[N\] where N is 1 \(latest\), 2, 3, … Got: 0/);
    assert.doesNotMatch(said, /Unknown command; use \/help/);
    // Two requests, two copies, and the scratch file holds the last one.
    assert.equal(responses.length, 0);
    const scratch = path.join(os.tmpdir(), 'litcode-copy', String(process.pid), 'response.md');
    assert.equal(fs.readFileSync(scratch, 'utf8'), 'the first answer');
  } finally { session.close(); await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('/autocompact reports the window, stores a token count and clears it', { timeout: 8000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-autocompact-')));
  const userDir = path.join(workspace, 'user');
  fs.mkdirSync(userDir);
  const config = { ...defaultConfig(workspace, []), model: 'test', configSources: { userDir } };
  const provider: ModelProvider = { count: async () => 0, complete: async () => reply('unused') };
  const lifetime = AbortSignal.timeout(6000);
  const runtime = await createRuntime(config, provider, lifetime);
  const session = Session.open(workspace, { config });
  const stdout = output(), stderr = output();
  const settingsFile = path.join(userDir, 'settings.json');
  const stored = () => fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};
  const input = new PassThrough();
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  try {
    const loop = interactiveLoop(session, provider, runtime,
      { input, output: stdout.stream, status: stderr.stream, signal: lifetime });
    // No prompt surface, so the bare form falls back to the recovered status block.
    input.write('/autocompact\n'); await wait(200);
    input.write('/autocompact 300k\n'); await wait(200);
    assert.equal(stored().compactAt, 300000);
    assert.equal(session.config.compactAt, 300000);
    input.write('/autocompact\n'); await wait(200);
    input.write('/autocompact 1m\n'); await wait(200);
    // The store keeps the requested value; the session takes the ceiling-clamped window.
    assert.equal(stored().compactAt, 1000000);
    assert.equal(session.config.compactAt, 975424);
    input.write('/autocompact reset\n'); await wait(200);
    assert.equal('compactAt' in stored(), false);
    assert.equal(session.config.compactAt, 512000);
    input.write('/autocompact 2m\n'); await wait(200);
    input.write('/exit\n');
    await loop;
    const said = stdout.value();
    assert.match(said, /Auto-compact window for test: 512k tokens \(default for this model\)/);
    assert.match(said, /Auto-compact window for test: 300k tokens \(from settings\)/);
    assert.match(said, /Overriding auto may result in high token usage, especially when resuming long sessions\./);
    assert.match(said, /Auto-compact window for test set to 300k tokens/);
    assert.match(said, /Auto-compact window for test set to 1m tokens \(capped to model limit of 975\.4k\)/);
    assert.match(said, /Auto-compact window for test set to auto/);
    assert.match(said, /Couldn't parse '2m'\. Expected 'auto' or 100k–1M tokens/);
    assert.doesNotMatch(said, /Unknown command; use \/help/);
  } finally { session.close(); await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('/model makes a typed pick the default for new sessions', { timeout: 8000 }, async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-model-')));
  const userDir = path.join(workspace, 'user');
  fs.mkdirSync(userDir);
  const config = { ...defaultConfig(workspace, []), model: 'first-model', configSources: { userDir } };
  const provider: ModelProvider = { count: async () => 0, complete: async () => reply('unused') };
  const lifetime = AbortSignal.timeout(6000);
  const runtime = await createRuntime(config, provider, lifetime);
  const session = Session.open(workspace, { config });
  const stdout = output(), stderr = output();
  const settingsFile = path.join(userDir, 'settings.json');
  const stored = () => fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};
  try {
    await interactiveLoop(session, provider, runtime, {
      input: Readable.from(['/model second-model\n', '/model second-model\n', '/exit\n']),
      output: stdout.stream, status: stderr.stream, signal: lifetime,
    });
    // The picker's enter arm writes the default; typing the same id again reports it unchanged.
    // A config change replaces the session object, so the live model is the printed answer.
    // The picker's enter arm writes the default. A typed pick always re-applies (the recovered
    // `R` validates and switches without a same-model check), so the second line repeats it.
    assert.equal(stored().model, 'second-model');
    assert.match(stderr.value(), /Model: second-model/);
    assert.doesNotMatch(stdout.value() + stderr.value(), /Unknown command; use \/help/);
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
