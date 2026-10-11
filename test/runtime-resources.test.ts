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

test('effort settings accepts exactly five levels without introducing a default', () => {
  assert.deepEqual(parseSettings({}), {});
  for (const effort of ['low', 'medium', 'high', 'xhigh', 'max']) assert.deepEqual(parseSettings({ effort }), { effort });
  for (const effort of ['auto', '', null, 1, undefined]) assert.throws(() => parseSettings({ effort }), /settings.effort/);
});
