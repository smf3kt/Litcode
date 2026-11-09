import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getEventListeners } from 'node:events';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';

import { defaultConfig } from '../src/agent.js';
import { createRuntime, parseSettings, pinToolSchemas, type Runtime } from '../src/runtime.js';
import { Session } from '../src/session.js';
import { LocalScheduler, createSchedulerTools, type SchedulerTimer } from '../src/scheduler.js';
import { readSchedulerLock, readStoredTasks, writeStoredTasks } from '../src/scheduler-store.js';
import { BackgroundRegistry, createBackgroundTools } from '../src/background.js';
import { AgentRegistry, createAgentRegistryTools } from '../src/agent-registry.js';
import { WorkflowRegistry, createWorkflowTools } from '../src/workflow.js';
import { createLspTools } from '../src/lsp.js';
import { createWorktreeTools } from '../src/worktrees.js';
import type { ToolDefinition, ToolContext } from '../src/tools.js';
import type { ModelProvider } from '../src/provider.js';
import { createPluginTools, discoverInstalledPluginComponents } from '../src/plugins.js';

function reply(text: string): Anthropic.Message {
  return { id: 'fixture', model: 'fixture', role: 'assistant', type: 'message', content: [{ type: 'text', text }],
    stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
const unused: ModelProvider = { count: async () => 1, complete: async () => { throw new Error('Unexpected provider call'); } };
function fixture() {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-resource-fixture-')));
  const controller = new AbortController();
  const config = defaultConfig(workspace, []);
  config.model = 'fixture';
  config.features = { tasks: false, subagents: true, background: true, scheduler: true,
    lsp: true, worktrees: true, agentMessaging: true, agentIdle: true, workflow: true, media: true };
  config.lspServers = { fixture: { command: process.execPath, args: ['-e', 'process.exit(99)'], extensions: ['ts'] } };
  const context: ToolContext = { workspace, signal: controller.signal, allowShell: false, maxOutputBytes: 24_000 };
  const active = new Set<unknown>();
  const handlers: (() => void)[] = [];
  let starts = 0;
  const timer: SchedulerTimer = {
    setInterval(handler) { starts++; active.add(handler); handlers.push(handler); return handler; },
    clearInterval(handle) { active.delete(handle); },
  };
  return { workspace, controller, config, context, timer, active, handlers, starts: () => starts,
    cleanup: () => fs.rmSync(workspace, { recursive: true, force: true }) };
}
const selected = (tools: ToolDefinition[], name: string) => {
  const found = tools.find(tool => tool.schema.name === name);
  assert.ok(found, `${name} is missing`);
  return found;
};
const tool = (runtime: Runtime, name: string) => selected(runtime.tools, name);

test('schema construction and relocation owner allocate no timers or registry listeners', async () => {
  const f = fixture();
  const runtime = await createRuntime(f.config, unused, f.controller.signal, { scheduler: { timer: f.timer } });
  try {
    const baseline = getEventListeners(f.controller.signal, 'abort').length;
    assert.equal(baseline, 1);
    assert.equal(f.starts(), 0);
    const pinned = pinToolSchemas(runtime.tools);
    for (const owner of ['real-session', 'relocation', 'another-schema-owner']) {
      assert.deepEqual(pinToolSchemas(runtime.buildTools(f.config, owner)), pinned);
      runtime.hookOptions!(f.config, owner);
    }
    assert.equal(f.starts(), 0);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, baseline);
    assert.deepEqual(runtime.drainEvents!('initial'), []);
    assert.deepEqual(fs.readdirSync(f.workspace), []);
    await runtime.releaseSession!('relocation');
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, baseline);
  } finally {
    await runtime.close();
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 0);
    assert.equal(f.active.size, 0);
    f.cleanup();
  }
});

test('display-only config rows keep the owner tool set', async () => {
  const f = fixture();
  const runtime = await createRuntime(f.config, unused, f.controller.signal);
  try {
    const pinned = pinToolSchemas(runtime.buildTools({ ...f.config, verbose: true, prefersReducedMotion: true,
      showTurnDuration: false, timeFormat: '24-hour', editorMode: 'vim', terminalProgressBarEnabled: false,
      autoCompactEnabled: false, askUserQuestionTimeout: '60s', dialogExpiry: '5m',
      spinnerTipsEnabled: false, spinnerTipsLayers: [{ source: 'userSettings', override: { tips: ['Local tip'] } }],
      copyOnSelect: false, copyFullResponse: true, autoScrollEnabled: false, preferredNotifChannel: 'notifications_disabled', terminalTitleFromRename: false,
      permissions: { ...(f.config.permissions ?? { mode: 'default', allow: [], deny: [] }), defaultMode: 'plan' } }, 'display-owner'));
    // Allocate a resource record for the owner so a fingerprint mismatch would throw; without
    // this line the comparison below passes even with every exclusion deleted. `drainEvents`
    // only reads an existing record, so it cannot serve as the allocation.
    assert.equal(runtime.backgroundWorkCount!('display-owner'), 0);
    // The Verbose, Reduce motion, turn-duration, time-format, editor, progress-bar, auto-compact,
    // question-timeout, dialog-expiry and default-permission-mode rows write live state
    // (`Te`/`vy`, chunk-nybcbd9t.js 9556/15296; rows 12035/20203/20771/21614/21908/26180/26485/29983);
    // rebuilding for the same owner must not see a stale tool set.
    assert.deepEqual(pinToolSchemas(runtime.buildTools({ ...f.config, verbose: false,
      prefersReducedMotion: false, showTurnDuration: true, timeFormat: 'auto', editorMode: 'normal',
      terminalProgressBarEnabled: true, autoCompactEnabled: true, askUserQuestionTimeout: 'never',
      dialogExpiry: undefined,
      permissions: { ...(f.config.permissions ?? { mode: 'default', allow: [], deny: [] }) } }, 'display-owner')), pinned);
    // Negative control: a request-shaping field still trips the same allocated owner.
    assert.throws(() => runtime.buildTools({ ...f.config, maxOutputBytes: f.config.maxOutputBytes + 1 },
      'display-owner'), /Runtime owner configuration changed/);
  } finally {
    await runtime.releaseSession!('display-owner');
    await runtime.close();
    f.cleanup();
  }
});

test('initial tools remain executable and activate only the resource used', async () => {
  const f = fixture();
  let now = new Date(2026, 9, 10, 12, 0);
  const runtime = await createRuntime(f.config, unused, f.controller.signal, { scheduler: { timer: f.timer, now: () => now } });
  try {
    assert.deepEqual(JSON.parse(await tool(runtime, 'cron_list').execute({}, f.context)), { jobs: [] });
    assert.equal(f.starts(), 1);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 1);
    await tool(runtime, 'cron_create').execute({ cron: '* * * * *', prompt: 'initial event', recurring: false }, f.context);
    now = new Date(2026, 9, 10, 12, 1);
    f.handlers.forEach(handler => handler());
    assert.equal(runtime.drainEvents!('initial')[0]!.prompt, 'initial event');
    await tool(runtime, 'read_notifications').execute({}, f.context);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 2);
    await tool(runtime, 'list_agents').execute({}, f.context);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 3);
    assert.equal(f.starts(), 1);
    await runtime.releaseSession!('initial');
    assert.equal(f.active.size, 0);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 1);
    await assert.rejects(tool(runtime, 'cron_list').execute({}, f.context), /released|aborted/);
  } finally { await runtime.close(); f.cleanup(); }
});

test('released schema-only owner invalidates retained tools, blocks and child closures', async () => {
  const f = fixture();
  const runtime = await createRuntime(f.config, unused, f.controller.signal, { scheduler: { timer: f.timer } });
  try {
    const tools = runtime.buildTools(f.config, 'relocation');
    const skill = selected(tools, 'skill');
    const child = skill.forChild!();
    const media = selected(tools, 'read_media');
    assert.ok(media.executeBlocks);
    await runtime.releaseSession!('relocation');
    await assert.rejects(selected(tools, 'cron_list').execute({}, f.context), /released|aborted/);
    await assert.rejects(media.executeBlocks!({ path: 'missing.png' }, f.context), /released|aborted/);
    await assert.rejects(child.execute({ name: 'missing' }, f.context), /released|aborted/);
    assert.throws(() => skill.forChild!(), /released|aborted/);
    assert.equal(f.starts(), 0);
    const fresh = runtime.buildTools(f.config, 'relocation');
    assert.deepEqual(JSON.parse(await selected(fresh, 'cron_list').execute({}, f.context)), { jobs: [] });
    assert.equal(f.starts(), 1);
    await assert.rejects(selected(tools, 'cron_list').execute({}, f.context), /released|aborted/);
    await runtime.releaseSession!('relocation');
    assert.equal(f.active.size, 0);
  } finally { await runtime.close(); f.cleanup(); }
});

test('retained hook starter fails after release without creating listeners or processes', async () => {
  const f = fixture();
  const runtime = await createRuntime(f.config, unused, f.controller.signal, { scheduler: { timer: f.timer } });
  try {
    const hooks = runtime.hookOptions!(f.config, 'hooks-owner');
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 1);
    await runtime.releaseSession!('hooks-owner');
    assert.throws(() => hooks.startAsyncCommand!({
      definition: { command: 'exit 0', async: true }, event: 'PreToolUse',
      payload: { session_id: 'fixture' }, signal: f.context.signal, input: '{}', cwd: f.workspace, timeoutMs: 1000,
    }), /released|aborted/);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 1);
    assert.equal(f.starts(), 0);
  } finally { await runtime.close(); f.cleanup(); }
});

test('concurrent runtime releases and root close wait for the same owner cleanup', async () => {
  for (const mode of ['session', 'runtime', 'replacement'] as const) {
    const rootClose = mode === 'runtime';
    const f = fixture(); f.config.allowShell = true;
    const runtime = await createRuntime(f.config, unused, f.controller.signal);
    f.config.tools = pinToolSchemas(runtime.tools);
    const session = Session.open(f.workspace, { config: f.config }), original = BackgroundRegistry.prototype.close;
    let enter!: () => void, unblock!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; }), gate = new Promise<void>(resolve => { unblock = resolve; });
    let calls = 0, firstConfirmed = false, secondConfirmed = false, rootConfirmed = false, replacementConfirmed = false;
    let first: Promise<void> | undefined, second: Promise<void> | undefined, closing: Promise<void> | undefined, replacementClosing: Promise<void> | undefined;
    let replacement: Session | undefined;
    try {
      await runtime.bindSession!(session);
      const tools = runtime.buildTools(session.config, session.id);
      await selected(tools, 'run_background').execute({ command: 'printf ready; sleep 30' }, { ...f.context, session, allowShell: true });
      BackgroundRegistry.prototype.close = async function() { calls++; enter(); await gate; await original.call(this); };
      first = runtime.releaseSession!(session.id, () => { firstConfirmed = true; });
      await entered;
      second = runtime.releaseSession!(session.id, () => { secondConfirmed = true; });
      if (rootClose) closing = runtime.closeForHandoff!().then(() => { rootConfirmed = true; });
      await new Promise<void>(resolve => setImmediate(resolve));
      assert.equal(firstConfirmed, false); assert.equal(secondConfirmed, false, 'second release must await actual cleanup');
      assert.equal(rootConfirmed, false, 'root close must await an already retiring owner');
      if (!rootClose) {
        assert.throws(() => runtime.buildTools(session.config, session.id), /cleanup.*unconfirmed/);
        await assert.rejects(runtime.bindSession!(session), /cleanup.*unconfirmed/);
      }
      if (mode === 'replacement') {
        await session.close(); replacement = Session.open(f.workspace, { id: session.id });
        await runtime.bindSession!(replacement);
        const replacementTools = runtime.buildTools(replacement.config, replacement.id);
        assert.notEqual(replacementTools, tools);
        await selected(replacementTools, 'run_background').execute({ command: 'printf replacement' }, { ...f.context, session: replacement, allowShell: true });
        replacementClosing = runtime.releaseSession!(replacement.id, () => { replacementConfirmed = true; });
        await new Promise<void>(resolve => setImmediate(resolve));
        assert.equal(firstConfirmed, false); assert.equal(secondConfirmed, false); assert.equal(replacementConfirmed, false);
      }
      unblock(); await Promise.all([first, second, closing, replacementClosing]);
      assert.equal(firstConfirmed, true); assert.equal(secondConfirmed, true); assert.equal(calls, mode === 'replacement' ? 2 : 1);
      if (mode === 'replacement') assert.equal(replacementConfirmed, true);
      if (rootClose) assert.equal(rootConfirmed, true);
      else {
        const live = replacement ?? session, fresh = runtime.buildTools(live.config, live.id);
        assert.notEqual(fresh, tools);
        await runtime.bindSession!(live); assert.equal(runtime.sessionLease!(live)(), true);
        await assert.rejects(selected(tools, 'run_background').execute({ command: 'printf stale' }, { ...f.context, session, allowShell: true }), /released|aborted/);
        await runtime.releaseSession!(session.id);
      }
    } finally {
      unblock(); await Promise.allSettled([first, second, closing, replacementClosing]);
      BackgroundRegistry.prototype.close = original; await runtime.close(); await session.close(); await replacement?.close(); f.cleanup();
    }
  }
});

test('failed owner cleanup cannot be acknowledged or rebound by a later release', async () => {
  for (const strictFirst of [false, true]) {
  for (const failureKind of ['collected', 'thrown'] as const) {
    const f = fixture(); f.config.allowShell = true;
    const runtime = await createRuntime(f.config, unused, f.controller.signal);
    f.config.tools = pinToolSchemas(runtime.tools);
    const session = Session.open(f.workspace, { config: f.config }), original = BackgroundRegistry.prototype.close;
    const originalAgents = AgentRegistry.prototype.close;
    let attempts = 0, acknowledgements = 0;
    try {
      await runtime.bindSession!(session);
      const tools = runtime.buildTools(session.config, session.id);
      await selected(tools, 'run_background').execute({ command: 'printf cleanup' },
        { ...f.context, session, allowShell: true });
      if (failureKind === 'collected') BackgroundRegistry.prototype.close = async function() { attempts++; await original.call(this); throw new Error('injected retained cleanup failure'); };
      else {
        await selected(tools, 'list_agents').execute({}, { ...f.context, session });
        AgentRegistry.prototype.close = async function() { attempts++; await originalAgents.call(this); throw new Error('injected retained agent cleanup'); };
      }
      const expected = failureKind === 'collected' ? /Runtime cleanup incomplete/ : /injected retained agent cleanup/;
      const first = runtime.releaseSession!(session.id, strictFirst ? () => { acknowledgements++; } : undefined);
      if (strictFirst || failureKind === 'thrown') await assert.rejects(first, expected); else await first;
      await assert.rejects(runtime.releaseSession!(session.id, () => { acknowledgements++; }), expected);
      assert.throws(() => runtime.buildTools(session.config, session.id), /cleanup.*unconfirmed/);
      await assert.rejects(runtime.bindSession!(session), /cleanup.*unconfirmed/);
      assert.equal(attempts, 1); assert.equal(acknowledgements, 0);
      await assert.rejects(runtime.closeForHandoff!(), expected);
    } finally {
      BackgroundRegistry.prototype.close = original; AgentRegistry.prototype.close = originalAgents;
      await runtime.close().catch(() => {}); await session.close(); f.cleanup();
    }
  }
  }
});

test('lazy resource schemas match direct factories including LSP and worktrees', async () => {
  const f = fixture();
  const inert = AbortSignal.abort();
  const runtime = await createRuntime(f.config, unused, f.controller.signal, { scheduler: { timer: f.timer } });
  const background = new BackgroundRegistry({ workspace: f.workspace, signal: inert });
  const scheduler = new LocalScheduler({ timer: null, onPrompt() {} });
  const agents = new AgentRegistry({ source: () => f.config, provider: unused, tools: [], signal: inert });
  const workflows = new WorkflowRegistry({ agents, signal: inert });
  const lsp = createLspTools(f.config.lspServers!, { workspace: f.workspace, signal: inert, maxOutputBytes: f.config.maxOutputBytes });
  try {
    const schemas = [
      ...createBackgroundTools(background), ...createAgentRegistryTools(agents, { idle: true }), ...createWorkflowTools(workflows),
      ...createWorktreeTools(), ...lsp.tools,
    ].map(item => item.schema);
    schemas.push(...Object.values(createSchedulerTools(scheduler)).map(item => ({
      name: item.name, description: item.description, input_schema: { ...item.input_schema },
    })));
    for (const schema of schemas) assert.deepEqual(tool(runtime, schema.name).schema, schema);
    assert.equal(f.starts(), 0);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 1);
  } finally {
    scheduler.close();
    await workflows.close(); await agents.close(); await background.close(); await lsp.close();
    await runtime.close(); f.cleanup();
  }
});

test('background skills initialize the owner registry before the agent tool is used', async () => {
  const f = fixture();
  f.config.skills = [{ name: 'background-fixture', description: 'fixture', body: 'fixture body',
    path: 'fixture/SKILL.md', userInvocable: true, disableModelInvocation: false, background: true }];
  const provider: ModelProvider = { count: async () => 1, complete: async () => reply('done') };
  const runtime = await createRuntime(f.config, provider, f.controller.signal, { scheduler: { timer: f.timer } });
  let first: Session | undefined;
  let secondSession: Session | undefined;
  try {
    f.config.tools = pinToolSchemas(runtime.tools);
    first = Session.open(f.workspace, { config: f.config });
    secondSession = Session.open(f.workspace, { config: f.config });
    await runtime.bindSession!(first);
    await runtime.bindSession!(secondSession);
    const tools = runtime.buildTools(f.config, first.id);
    const result = JSON.parse(await selected(tools, 'skill').execute({ name: 'background-fixture' }, { ...f.context, session: first }));
    assert.ok(result.id);
    const child = JSON.parse(await selected(tools, 'get_agent').execute({ id: result.id, wait_ms: 1000 }, f.context));
    assert.equal(child.status, 'completed');
    const repeated = JSON.parse(await runtime.runSkill!(f.config, first.id, f.config.skills[0]!, '', f.context.signal));
    assert.ok(repeated.id);
    assert.equal(f.starts(), 0);
    runtime.buildTools(f.config, secondSession.id);
    runtime.hookOptions!(f.config, secondSession.id);
    const second = JSON.parse(await runtime.runSkill!(f.config, secondSession.id, f.config.skills[0]!, '', f.context.signal));
    assert.ok(second.id);
    await runtime.releaseSession!(secondSession.id);
    await runtime.releaseSession!(first.id);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 1);
  } finally { await runtime.close(); first?.close(); secondSession?.close(); f.cleanup(); }
});

test('session release drains its running skill shell and leaves another owner running', async () => {
  const f = fixture();
  f.config.allowShell = true;
  f.config.permissions = { mode: 'bypass', allow: [], deny: [] };
  f.config.features = { ...f.config.features, tasks: false, subagents: true, skillInlineCommands: true };
  const makeSkill = (name: string, body: string) => ({ name, description: 'fixture', body, path: 'fixture/SKILL.md', userInvocable: true, disableModelInvocation: false });
  const runtime = await createRuntime(f.config, unused, f.controller.signal);
  const waitFile = async (file: string) => {
    const deadline = Date.now() + 5000;
    while (!fs.existsSync(file)) { if (Date.now() > deadline) throw new Error(`Missing ${file}`); await new Promise(resolve => setTimeout(resolve, 10)); }
  };
  try {
    const first = runtime.runSkill!(f.config, 'ad1c0f3a-3333-4333-8333-333333333333', makeSkill('a', '!`sleep 20 & echo $! > child-a; echo ready > ready-a; wait`'), '', f.context.signal);
    const firstResult = first.then(() => 'completed', error => String(error));
    const second = runtime.runSkill!(f.config, 'ad1c0f3a-4444-4444-8444-444444444444', makeSkill('b', '!`echo ready > ready-b; sleep 20`'), '', f.context.signal);
    const secondResult = second.then(() => 'completed', error => String(error));
    await Promise.all([waitFile(path.join(f.workspace, 'ready-a')), waitFile(path.join(f.workspace, 'ready-b'))]);
    const child = Number(fs.readFileSync(path.join(f.workspace, 'child-a'), 'utf8'));
    await runtime.releaseSession!('ad1c0f3a-3333-4333-8333-333333333333');
    assert.match(await firstResult, /aborted/);
    assert.throws(() => process.kill(child, 0));
    let settled = false; void secondResult.then(() => { settled = true; });
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(settled, false);
    await runtime.releaseSession!('ad1c0f3a-4444-4444-8444-444444444444');
    assert.match(await secondResult, /aborted/);
    const normal = await runtime.runSkill!(f.config, 'ad1c0f3a-5555-4555-8555-555555555555', makeSkill('c', '!`printf done`'), '', f.context.signal);
    assert.equal(normal, 'done');
    await runtime.releaseSession!('ad1c0f3a-5555-4555-8555-555555555555');
  } finally { await runtime.close(); f.cleanup(); }
});

test('closed runtime invalidates inert initial tools and hook starters', async () => {
  const f = fixture();
  const runtime = await createRuntime(f.config, unused, f.controller.signal, { scheduler: { timer: f.timer } });
  const hooks = runtime.hookOptions!(f.config, 'idle');
  await runtime.close();
  try {
    await assert.rejects(tool(runtime, 'cron_list').execute({}, f.context), /closed/);
    assert.throws(() => runtime.buildTools(f.config, 'next'), /closed/);
    assert.throws(() => hooks.startAsyncCommand!({
      definition: { command: 'exit 0', async: true }, event: 'PreToolUse', payload: {}, signal: f.context.signal,
      input: '{}', cwd: f.workspace, timeoutMs: 1000,
    }), /closed/);
    assert.equal(f.starts(), 0);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 0);
  } finally { f.cleanup(); }
});

test('asyncRewake exit-2 completion wakes its owner with the hook body instead of the completion record', async () => {
  const f = fixture();
  const runtime = await createRuntime(f.config, unused, f.controller.signal, { scheduler: { timer: f.timer } });
  try {
    const hooks = runtime.hookOptions!(f.config, 'rewake-owner');
    const command = "printf 'hook failed' >&2; exit 2";
    const payload = { cwd: f.workspace, session_id: 'rewake-owner' };
    await hooks.startAsyncCommand!({
      definition: { command, asyncRewake: true, rewakeSummary: 'hook wake' },
      event: 'SessionStart', payload, input: `${JSON.stringify({ ...payload, hook_event_name: 'SessionStart' })}\n`,
      cwd: f.workspace, timeoutMs: 5000, signal: f.context.signal,
    });
    let events: ReturnType<NonNullable<Runtime['drainEvents']>> = [];
    for (let i = 0; i < 200 && events.length === 0; i++) {
      events = runtime.drainEvents!('rewake-owner');
      if (!events.length) await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(events.length, 1);
    assert.equal(events[0]!.kind, 'notification');
    assert.equal(events[0]!.prompt, `Stop hook blocking error from command "${command}": hook failed`);
  } finally { await runtime.close(); f.cleanup(); }
});

test('child terminal queue bounds serialized bytes and discards released generation callbacks', async () => {
  const f = fixture();
  const skill = { name: 'terminal', description: 'fixture', body: 'task', path: 'fixture/SKILL.md',
    userInvocable: true, disableModelInvocation: false, context: 'fork' as const };
  f.config.hooks = { SubagentStart: [{ type: 'callback', name: 'terminal' }] };
  let held = false, entered!: () => void, release!: () => void;
  const waiting = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const runtime = await createRuntime(f.config, { count: async () => 1, complete: async () => reply('done') }, f.controller.signal,
    { hookCallbacks: () => ({ terminal: async () => {
      if (held) { entered(); await gate; }
      return { terminalSequence: '\x07'.repeat(4096) };
    } }) });
  try {
    for (let index = 0; index < 3; index++) await runtime.runSkill!(f.config, 'ad1c0f3a-6666-4666-8666-666666666666', skill, '', f.context.signal);
    const events = runtime.drainEvents!('ad1c0f3a-6666-4666-8666-666666666666');
    assert.equal(events.filter(event => event.kind === 'hook_terminal').length, 2);
    assert.ok(events.some(event => event.kind === 'notification' && event.prompt.includes('dropped 1 effects')));
    assert.ok(events.filter(event => event.kind === 'hook_terminal').every(event => event.prompt === undefined));
    held = true;
    const pending = runtime.runSkill!(f.config, 'ad1c0f3a-6666-4666-8666-666666666666', skill, '', f.context.signal);
    await waiting; await runtime.releaseSession!('ad1c0f3a-6666-4666-8666-666666666666'); runtime.buildTools(f.config, 'ad1c0f3a-6666-4666-8666-666666666666');
    release(); await pending;
    assert.deepEqual(runtime.drainEvents!('ad1c0f3a-6666-4666-8666-666666666666'), []);
  } finally { release(); await runtime.close(); f.cleanup(); }
});

test("child instruction discoveries deduplicate owner events and skip released generations", async () => {
  const f = fixture(); f.config.watchConfig = true; f.config.dynamicInstructions = true;
  fs.mkdirSync(path.join(f.workspace, "deep"));
  const instruction = path.join(f.workspace, "deep/AGENTS.md"); const imported = path.join(f.workspace, "deep/detail.md");
  fs.writeFileSync(instruction, "@detail.md\nfixture"); fs.writeFileSync(imported, "import"); fs.writeFileSync(path.join(f.workspace, "deep/file.txt"), "file");
  let calls = 0;
  const runtime = await createRuntime(f.config, { count: async () => 1, complete: async () => {
    if (++calls % 2 === 1) return { ...reply(""), content: [{ type: "tool_use", id: `read-${calls}`, name: "read_file", input: { path: "deep/file.txt" } }], stop_reason: "tool_use" } as Anthropic.Message;
    return reply("done");
  } }, f.controller.signal);
  f.config.tools = pinToolSchemas(runtime.tools);
  const skill = { name: "read", description: "fixture", body: "read", path: "/fixture/SKILL.md", userInvocable: true, disableModelInvocation: false, context: "fork" as const };
  try {
    await runtime.runSkill!(f.config, "ad1c0f3a-7777-4777-8777-777777777777", skill, "", f.context.signal);
    await runtime.runSkill!(f.config, "ad1c0f3a-7777-4777-8777-777777777777", skill, "", f.context.signal);
    const events = runtime.drainEvents!("ad1c0f3a-7777-4777-8777-777777777777");
    assert.equal(events.length, 1);
    assert.equal(events[0]!.kind, "instruction_paths");
    if (events[0]!.kind === "instruction_paths") assert.deepEqual(events[0]!.paths, [instruction, imported, path.join(f.workspace, "deep/HARNESS.md")]);
    assert.equal(events[0]!.prompt, undefined);
    assert.deepEqual(runtime.drainEvents!("another"), []);
    await runtime.releaseSession!("ad1c0f3a-7777-4777-8777-777777777777");
    runtime.buildTools(f.config, "ad1c0f3a-7777-4777-8777-777777777777");
    assert.deepEqual(runtime.drainEvents!("ad1c0f3a-7777-4777-8777-777777777777"), []);
  } finally { await runtime.close(); f.cleanup(); }
});

test('stopState projects running background jobs and session cron tasks', async () => {
  const f = fixture();
  const now = new Date(2026, 9, 10, 12, 0);
  const runtime = await createRuntime(f.config, unused, f.controller.signal, { scheduler: { timer: f.timer, now: () => now } });
  const owner = 'stop-state';
  try {
    const tools = runtime.buildTools(f.config, owner);
    const created = await selected(tools, 'cron_create').execute(
      { cron: '*/5 * * * *', prompt: 'x'.repeat(1001), recurring: true }, { ...f.context, allowShell: true });
    assert.ok((JSON.parse(String(created)) as { id?: string }).id);
    const started = JSON.parse(await selected(tools, 'run_background').execute(
      { command: 'sleep 5', description: 'tail' }, { ...f.context, allowShell: true })) as { id: string };
    const state = runtime.stopState!(owner);
    assert.equal(state.background_tasks.length, 1);
    assert.equal(state.background_tasks[0]!.type, 'shell');
    assert.equal(state.background_tasks[0]!.status, 'running');
    assert.equal(state.background_tasks[0]!.command, 'sleep 5');
    assert.equal(state.session_crons.length, 1);
    assert.equal(state.session_crons[0]!.schedule, '*/5 * * * *');
    assert.equal(state.session_crons[0]!.recurring, true);
    assert.equal(state.session_crons[0]!.prompt, 'x'.repeat(1000) + '… [+1 chars]');
    await selected(tools, 'task_stop').execute({ id: started.id }, { ...f.context, allowShell: true });
    await selected(tools, 'get_background_task').execute({ id: started.id, wait_ms: 5000 }, { ...f.context, allowShell: true });
    assert.deepEqual(runtime.stopState!(owner).background_tasks, []);
    assert.equal(runtime.stopState!(owner).session_crons.length, 1);
  } finally { await runtime.close(); f.cleanup(); }
});

test('background task lookup leaves completion events for the first queue consumer', async () => {
  const f = fixture();
  const runtime = await createRuntime(f.config, unused, f.controller.signal);
  try {
    for (const consumer of ['tool', 'runtime'] as const) {
      const owner = `completion-${consumer}`;
      const tools = runtime.buildTools(f.config, owner);
      const context = { ...f.context, allowShell: true };
      const job = JSON.parse(await selected(tools, 'run_background').execute(
        { command: 'printf completion', description: consumer }, context)) as { id: string };
      const view = JSON.parse(await selected(tools, 'get_background_task').execute(
        { id: job.id, wait_ms: 5000 }, context)) as { state: string; stdout: string };
      assert.equal(view.state, 'completed');
      assert.equal(view.stdout, 'completion');
      const read = async () => JSON.parse(await selected(tools, 'read_notifications').execute({}, context)) as {
        events: { job_id: string; kind: string }[];
      };
      if (consumer === 'tool') {
        assert.ok((await read()).events.some(event => event.job_id === job.id && event.kind === 'exit'));
        assert.deepEqual(runtime.drainEvents!(owner), []);
      } else {
        assert.ok(runtime.drainEvents!(owner).some(event => event.kind === 'background' && event.owner === owner && event.events.some(entry => entry.job_id === job.id)));
        assert.deepEqual((await read()).events, []);
      }
    }
  } finally { await runtime.close(); f.cleanup(); }
});

test('stopBackground stops every running job for its owner', async () => {
  const f = fixture();
  const runtime = await createRuntime(f.config, unused, f.controller.signal);
  const owner = 'stop-background';
  try {
    const tools = runtime.buildTools(f.config, owner);
    const first = JSON.parse(await selected(tools, 'run_background').execute(
      { command: 'sleep 5', description: 'one' }, { ...f.context, allowShell: true })) as { id: string };
    const second = JSON.parse(await selected(tools, 'run_background').execute(
      { command: 'sleep 5', description: 'two' }, { ...f.context, allowShell: true })) as { id: string };
    assert.equal(runtime.stopState!(owner).background_tasks.length, 2);
    assert.equal(runtime.stopBackground!(owner), 2);
    // `stop` only signals the group; the registry settles on the child close event.
    for (const job of [first, second]) {
      await selected(tools, 'get_background_task').execute({ id: job.id, wait_ms: 5000 }, { ...f.context, allowShell: true });
    }
    assert.deepEqual(runtime.stopState!(owner).background_tasks, []);
    assert.equal(runtime.stopBackground!(owner), 0);
  } finally { await runtime.close(); f.cleanup(); }
});

const childStatus = async (list: ToolDefinition, id: string, context: ToolContext): Promise<string> => {
  const rows = JSON.parse(await list.execute({}, { ...context })) as { id: string; status: string }[];
  return rows.find(row => row.id === id)?.status ?? 'running';
};

test('stopBackground aborts a running child agent instead of only counting it', async () => {
  const f = fixture();
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const provider: ModelProvider = { count: async () => 1,
    complete: async (_request, signal) => {
      entered();
      // Settles only when the registry aborts the child, so a count-only stop leaves it running.
      await new Promise<never>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
      return reply('done');
    } };
  const runtime = await createRuntime(f.config, provider, f.controller.signal);
  let session: Session | undefined;
  try {
    session = Session.open(f.workspace, { config: f.config });
    await runtime.bindSession!(session);
    const owner = session.id;
    const tools = runtime.buildTools(f.config, owner);
    const launched = JSON.parse(await selected(tools, 'agent').execute(
      { prompt: 'hold', background: true }, { ...f.context, session, allowShell: true })) as { id: string };
    await started;
    assert.equal(runtime.backgroundWorkCount!(owner), 1);
    assert.equal(runtime.stopBackground!(owner), 1);
    const list = selected(tools, 'list_agents');
    let status = 'running';
    for (let attempt = 0; attempt < 200; attempt += 1) {
      status = await childStatus(list, launched.id, f.context);
      if (status !== 'running') break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(status, 'cancelled');
    assert.equal(runtime.backgroundWorkCount!(owner), 0);
    assert.equal(runtime.stopBackground!(owner), 0);
  } finally { await runtime.close(); session?.close(); f.cleanup(); }
});

test('backgroundWorkCount excludes completed child agents', async () => {
  const f = fixture();
  let hold = false;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const provider: ModelProvider = { count: async () => 1,
    complete: async (_request, signal) => {
      if (!hold) return reply('done');
      entered();
      await new Promise<never>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
      return reply('done');
    } };
  const runtime = await createRuntime(f.config, provider, f.controller.signal);
  let session: Session | undefined;
  try {
    session = Session.open(f.workspace, { config: f.config });
    await runtime.bindSession!(session);
    const owner = session.id;
    const tools = runtime.buildTools(f.config, owner);
    const agent = selected(tools, 'agent');
    const first = JSON.parse(await agent.execute(
      { prompt: 'finish', background: true }, { ...f.context, session, allowShell: true })) as { id: string };
    const list = selected(tools, 'list_agents');
    for (let attempt = 0; attempt < 200 && await childStatus(list, first.id, f.context) !== 'completed'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(await childStatus(list, first.id, f.context), 'completed');

    hold = true;
    const second = JSON.parse(await agent.execute(
      { prompt: 'hold', background: true }, { ...f.context, session, allowShell: true })) as { id: string };
    await started;
    // The completed sibling stays in the registry but does not count as live work.
    assert.equal(runtime.backgroundWorkCount!(owner), 1);
    assert.equal(runtime.stopBackground!(owner), 1);
    for (let attempt = 0; attempt < 200 && await childStatus(list, second.id, f.context) === 'running'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(await childStatus(list, second.id, f.context), 'cancelled');
    assert.equal(runtime.backgroundWorkCount!(owner), 0);
    assert.equal(runtime.stopBackground!(owner), 0);
  } finally { await runtime.close(); session?.close(); f.cleanup(); }
});

test('live plugin catalogs update retained skill and agent tools without retiring scheduler resources', async () => {
  const f = fixture();
  f.config.plugins = { enabled: true }; f.config.features = { ...f.config.features, tasks: false, subagents: true, agentTypes: true };
  const source = path.join(f.workspace, 'plugin-source'); fs.mkdirSync(source);
  fs.mkdirSync(path.join(source, 'skills/example'), { recursive: true }); fs.mkdirSync(path.join(source, 'agents'));
  fs.writeFileSync(path.join(source, 'plugin.json'), JSON.stringify({ name: 'fixture', version: '1', skills: 'skills', agents: 'agents', hooks: 'hooks.json' }));
  const write = (version: string) => {
    fs.writeFileSync(path.join(source, 'skills/example/SKILL.md'), `---\nname: example\ndescription: ${version}_SKILL\n---\n${version}_SKILL_BODY`);
    fs.writeFileSync(path.join(source, 'agents/reviewer.md'), `---\nname: reviewer\ndescription: ${version}_AGENT\n---\n${version}_AGENT_BODY`);
    fs.writeFileSync(path.join(source, 'hooks.json'), JSON.stringify({ hooks: { SessionStart: [{ command: 'true' }] } }));
  };
  const mutate = async (name: string) => {
    const previous = discoverInstalledPluginComponents(f.workspace, { enabled: true })[0]?.plugin;
    return createPluginTools({ enabled: true }).find(tool => tool.schema.name === name)!.execute({
      ...(name !== 'plugin_remove' ? { directory: source } : {}),
      ...(name !== 'plugin_install' ? { name: 'fixture', expected_digest: previous!.digest } : {}),
    }, f.context);
  };
  write('OLD'); await mutate('plugin_install');
  const systems: string[] = [];
  const provider: ModelProvider = { count: async () => 1, complete: async request => { systems.push(JSON.stringify(request.system)); return reply('done'); } };
  const runtime = await createRuntime(f.config, provider, f.controller.signal, { scheduler: { timer: f.timer } });
  let session: Session | undefined;
  try {
    session = Session.open(f.workspace, { config: f.config }); await runtime.bindSession!(session);
    const owner = session.id, tools = runtime.buildTools(session.config, owner), context = { ...f.context, session };
    const skill = selected(tools, 'skill'), agent = selected(tools, 'agent');
    assert.match(await skill.execute({ name: 'example' }, context), /OLD_SKILL_BODY/);
    await selected(tools, 'cron_create').execute({ cron: '* * * * *', prompt: 'preserved', recurring: true }, context);
    await agent.execute({ prompt: 'first', subagent_type: 'fixture:reviewer', background: false }, context);
    assert.match(systems.at(-1)!, /OLD_AGENT_BODY/);
    const starts = f.starts();
    write('NEW'); await mutate('plugin_update');
    assert.match(await skill.execute({ name: 'example' }, context), /NEW_SKILL_BODY/);
    const refreshed = runtime.buildTools(session.config, owner);
    assert.equal(selected(refreshed, 'skill'), skill); assert.equal(selected(refreshed, 'agent'), agent);
    await agent.execute({ prompt: 'second', subagent_type: 'fixture:reviewer', background: false }, context);
    assert.match(systems.at(-1)!, /NEW_AGENT_BODY/);
    assert.equal(f.starts(), starts); assert.match(await selected(refreshed, 'cron_list').execute({}, context), /preserved/);
    await mutate('plugin_remove');
    await assert.rejects(skill.execute({ name: 'example' }, context), /Unknown skill/);
    runtime.buildTools(session.config, owner);
    await assert.rejects(agent.execute({ prompt: 'removed', subagent_type: 'fixture:reviewer', background: false }, context), /Unknown agent type/);
    const changed = { ...session.config, maxOutputBytes: session.config.maxOutputBytes + 1 };
    assert.throws(() => runtime.buildTools(changed, owner), /configuration changed/);
  } finally { await runtime.close(); session?.close(); f.cleanup(); }
});

test('effort settings accepts exactly five levels without introducing a default', () => {
  assert.deepEqual(parseSettings({}), {});
  for (const effort of ['low', 'medium', 'high', 'xhigh', 'max']) assert.deepEqual(parseSettings({ effort }), { effort });
  for (const effort of ['auto', '', null, 1, undefined]) assert.throws(() => parseSettings({ effort }), /settings.effort/);
});

test('durable schema construction stays passive and catch-up belongs to the real session', async () => {
  const f = fixture();
  f.config.features = { ...f.config.features!, schedulerDurable: true };
  await writeStoredTasks(f.config.workspace, [{ id: 'deadbeef', cron: '0 9 * * *', prompt: 'catch up',
    createdAt: new Date(2026, 9, 1, 0, 0).getTime() }]);
  const runtime = await createRuntime(f.config, unused, f.controller.signal,
    { scheduler: { timer: f.timer, now: () => new Date(2026, 9, 10, 12, 0) } });
  try {
    const tools = runtime.buildTools(f.config, 'actual-session');
    assert.equal(f.starts(), 0);
    assert.equal(await readSchedulerLock(f.workspace), undefined);
    assert.deepEqual(runtime.drainEvents!('initial'), []);
    await runtime.settleScheduler!('actual-session');
    assert.equal(f.starts(), 1);
    assert.equal((await readSchedulerLock(f.workspace))?.sessionId, 'actual-session');
    const events = runtime.drainEvents!('actual-session');
    assert.equal(events.filter(event => event.kind === 'scheduled' && /catch up/.test(event.prompt)).length, 1);
    assert.deepEqual(runtime.drainEvents!('initial'), []);
    const created = JSON.parse(await selected(tools, 'cron_create')
      .execute({ cron: '0 9 * * *', prompt: 'persisted', durable: true }, f.context)) as { id: string; durable: boolean };
    assert.equal(created.durable, true);
    assert.deepEqual((await readStoredTasks(f.config.workspace)).map(task => task.prompt), ['persisted']);
    await runtime.releaseSession!('actual-session');
    assert.equal(f.active.size, 0);
    assert.equal(await readSchedulerLock(f.workspace), undefined);
  } finally { await runtime.close(); f.cleanup(); }
});
