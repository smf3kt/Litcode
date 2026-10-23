import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getEventListeners } from 'node:events';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';

import { defaultConfig } from '../src/agent.js';
import { createRuntime, parseSettings, pinToolSchemas, type Runtime } from '../src/runtime.js';
import { LocalScheduler, createSchedulerTools, type SchedulerTimer } from '../src/scheduler.js';
import { BackgroundRegistry, createBackgroundTools } from '../src/background.js';
import { AgentRegistry, createAgentRegistryTools } from '../src/agent-registry.js';
import { WorkflowRegistry, createWorkflowTools } from '../src/workflow.js';
import { createLspTools } from '../src/lsp.js';
import { createWorktreeTools } from '../src/worktrees.js';
import type { ToolDefinition, ToolContext } from '../src/tools.js';
import type { ModelProvider } from '../src/provider.js';

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
      copyOnSelect: false, copyFullResponse: true, autoScrollEnabled: false, preferredNotifChannel: 'notifications_disabled',
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
  try {
    f.config.tools = pinToolSchemas(runtime.tools);
    const tools = runtime.buildTools(f.config, 'skill-owner');
    const result = JSON.parse(await selected(tools, 'skill').execute({ name: 'background-fixture' }, f.context));
    assert.ok(result.id);
    const child = JSON.parse(await selected(tools, 'get_agent').execute({ id: result.id, wait_ms: 1000 }, f.context));
    assert.equal(child.status, 'completed');
    const repeated = JSON.parse(await runtime.runSkill!(f.config, 'skill-owner', f.config.skills[0]!, '', f.context.signal));
    assert.ok(repeated.id);
    assert.equal(f.starts(), 0);
    runtime.buildTools(f.config, 'user-skill-owner');
    runtime.hookOptions!(f.config, 'user-skill-owner');
    const second = JSON.parse(await runtime.runSkill!(f.config, 'user-skill-owner', f.config.skills[0]!, '', f.context.signal));
    assert.ok(second.id);
    await runtime.releaseSession!('user-skill-owner');
    await runtime.releaseSession!('skill-owner');
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 1);
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
    for (let index = 0; index < 3; index++) await runtime.runSkill!(f.config, 'effects', skill, '', f.context.signal);
    const events = runtime.drainEvents!('effects');
    assert.equal(events.filter(event => event.kind === 'hook_terminal').length, 2);
    assert.ok(events.some(event => event.kind === 'notification' && event.prompt.includes('dropped 1 effects')));
    assert.ok(events.filter(event => event.kind === 'hook_terminal').every(event => event.prompt === undefined));
    held = true;
    const pending = runtime.runSkill!(f.config, 'effects', skill, '', f.context.signal);
    await waiting; await runtime.releaseSession!('effects'); runtime.buildTools(f.config, 'effects');
    release(); await pending;
    assert.deepEqual(runtime.drainEvents!('effects'), []);
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
    await runtime.runSkill!(f.config, "instructions", skill, "", f.context.signal);
    await runtime.runSkill!(f.config, "instructions", skill, "", f.context.signal);
    const events = runtime.drainEvents!("instructions");
    assert.equal(events.length, 1);
    assert.equal(events[0]!.kind, "instruction_paths");
    if (events[0]!.kind === "instruction_paths") assert.deepEqual(events[0]!.paths, [instruction, imported, path.join(f.workspace, "deep/HARNESS.md")]);
    assert.equal(events[0]!.prompt, undefined);
    assert.deepEqual(runtime.drainEvents!("another"), []);
    await runtime.releaseSession!("instructions");
    runtime.buildTools(f.config, "instructions");
    assert.deepEqual(runtime.drainEvents!("instructions"), []);
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
  const owner = 'stop-agents';
  try {
    const tools = runtime.buildTools(f.config, owner);
    const launched = JSON.parse(await selected(tools, 'agent').execute(
      { prompt: 'hold', background: true }, { ...f.context, allowShell: true })) as { id: string };
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
  } finally { await runtime.close(); f.cleanup(); }
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
  const owner = 'count-agents';
  try {
    const tools = runtime.buildTools(f.config, owner);
    const agent = selected(tools, 'agent');
    const first = JSON.parse(await agent.execute(
      { prompt: 'finish', background: true }, { ...f.context, allowShell: true })) as { id: string };
    const list = selected(tools, 'list_agents');
    for (let attempt = 0; attempt < 200 && await childStatus(list, first.id, f.context) !== 'completed'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(await childStatus(list, first.id, f.context), 'completed');

    hold = true;
    const second = JSON.parse(await agent.execute(
      { prompt: 'hold', background: true }, { ...f.context, allowShell: true })) as { id: string };
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
  } finally { await runtime.close(); f.cleanup(); }
});

test('effort settings accepts exactly five levels without introducing a default', () => {
  assert.deepEqual(parseSettings({}), {});
  for (const effort of ['low', 'medium', 'high', 'xhigh', 'max']) assert.deepEqual(parseSettings({ effort }), { effort });
  for (const effort of ['auto', '', null, 1, undefined]) assert.throws(() => parseSettings({ effort }), /settings.effort/);
});
