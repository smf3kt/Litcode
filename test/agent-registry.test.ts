import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { AsyncHookCompletion } from '../src/async-hooks.js';
import type Anthropic from '@anthropic-ai/sdk';
import { assertPaired, defaultConfig } from '../src/agent.js';
import { AgentRegistry, createAgentRegistryTools, type AgentRegistryOptions } from '../src/agent-registry.js';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { Session } from '../src/session.js';
import { listSessions } from '../src/sessions.js';
import { capChildOutput, createSubagentTool, selectChildTools } from '../src/subagents.js';
import { createTools, type ToolDefinition } from '../src/tools.js';

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function response(text = 'done', content?: Anthropic.ContentBlock[]): Anthropic.Message {
  return { id: 'fixture', model: 'test', type: 'message', role: 'assistant', content: content ?? [{ type: 'text', text }],
    stop_reason: content ? 'tool_use' : 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
function fixture(run: ModelProvider['complete'] = async () => response()) {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-registry-')));
  const tools = createTools();
  const config = defaultConfig(workspace, tools); config.model = 'test'; config.allowShell = true;
  const provider: ModelProvider = { count: async () => 0, complete: run };
  const registries: AgentRegistry[] = [];
  const make = (options: Partial<AgentRegistryOptions> = {}) => {
    const registry = new AgentRegistry({ source: () => config, tools, provider, ...options });
    registries.push(registry); return registry;
  };
  return { workspace, tools, config, provider, make,
    async cleanup() { await Promise.all(registries.map(registry => registry.close())); fs.rmSync(workspace, { recursive: true, force: true }); },
  };
}
const context = (workspace: string, signal = new AbortController().signal, maxOutputBytes = 24_000) =>
  ({ workspace, signal, allowShell: true, maxOutputBytes });
async function settled(registry: AgentRegistry, id: string) { return registry.get(id, { waitMs: 30_000 }); }

// All providers below are in-process fixtures; gates choose ordering explicitly.
test('sync launch isolates sessions and preserves child config, schemas and explore mode', async () => {
  const f = fixture(async request => {
    assert.equal(request.model, 'child-model');
    assert.equal(request.max_tokens, f.config.maxTokens);
    assert.equal(request.tools?.some(tool => 'name' in tool && tool.name === 'agent'), false);
    assert.deepEqual(request.tools?.map(tool => 'name' in tool ? tool.name : ''), ['read_file', 'list_files', 'search']);
    assert.match(String(request.system), /child agent/);
    assert.equal(request.messages[0]?.content, '  inspect  ');
    return response('findings');
  });
  const registry = f.make();
  try {
    const child = await registry.launch({ prompt: '  inspect  ', name: 'reader', model: 'child-model', max_turns: 2 });
    assert.equal(child.status, 'completed'); assert.equal(child.summary, 'findings');
    assert.equal(child.name, 'reader'); assert.equal(child.model_calls, 1);
    assert.equal(listSessions(f.workspace)[0]?.active, false);
    const session = Session.open(f.workspace, { id: child.session_id });
    try {
      assert.equal(session.config.childMode, 'explore'); assert.equal(session.config.allowShell, false);
      assert.equal(session.config.maxTurns, 2); assert.equal(session.config.model, 'child-model');
      assert.equal(session.events.at(-1)?.kind, 'turn_end');
    } finally { session.close(); }
  } finally { await f.cleanup(); }
});

test('stall watchdog retries a silent child and fails with the source message', async () => {
  let calls = 0;
  const f = fixture((_request, signal) => {
    calls++;
    return new Promise<Anthropic.Message>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  });
  const registry = f.make();
  try {
    const failed = await registry.launch({ prompt: 'work', stall_ms: 20 });
    assert.equal(failed.status, 'failed');
    assert.equal(failed.error, 'agent stalled on all 6 attempts (no progress for 20ms each)');
    assert.equal(calls, 6);
    await assert.rejects(registry.launch({ prompt: 'work', stall_ms: 'never' }), /must be a finite number/);
    assert.equal(calls, 6);
  } finally { await f.cleanup(); }
});

test('stall watchdog restarts on provider progress and completes in one request', async () => {
  let calls = 0;
  const f = fixture((_request, signal, onText) => {
    calls++;
    return new Promise<Anthropic.Message>((resolve, reject) => {
      let ticks = 0;
      const timer = setInterval(() => {
        ticks++;
        onText?.('working ');
        if (ticks === 5) { clearInterval(timer); resolve(response('finished')); }
      }, 10);
      signal.addEventListener('abort', () => { clearInterval(timer); reject(signal.reason); }, { once: true });
    });
  });
  const registry = f.make();
  try {
    const child = await registry.launch({ prompt: 'work', stall_ms: 50 });
    assert.equal(child.status, 'completed');
    assert.equal(child.summary, 'finished');
    assert.equal(calls, 1);
  } finally { await f.cleanup(); }
});

test('structured schema mode ends the turn on StructuredOutput and exposes the value', async () => {
  let calls = 0;
  const f = fixture(async request => {
    calls += 1;
    assert.equal(request.tools?.some(tool => 'name' in tool && tool.name === 'StructuredOutput'), true);
    assert.match(String(request.system), /You MUST return your final answer by calling the StructuredOutput tool exactly once/);
    return response('', [{ type: 'tool_use', id: 'out-1', name: 'StructuredOutput',
      input: { answer: 'yes' } } as Anthropic.ContentBlock]);
  });
  const registry = f.make();
  try {
    const child = await registry.launch({ prompt: 'return json',
      structured_schema: { type: 'object', properties: { answer: { type: 'string' } },
        required: ['answer'], additionalProperties: false } });
    assert.equal(child.status, 'completed', child.error ?? undefined);
    assert.deepEqual(child.structured_output, { answer: 'yes' });
    assert.equal(child.structured_error, undefined);
    // The `endsTurn` result must not trigger another model call.
    assert.equal(calls, 1);
  } finally { await f.cleanup(); }
});

test('structured schema mode reports a validation error and nudges once before retrying', async () => {
  let calls = 0;
  const f = fixture(async request => {
    calls += 1;
    if (calls === 1) return response('', [{ type: 'tool_use', id: 'out-bad', name: 'StructuredOutput',
      input: { wrong: true } } as Anthropic.ContentBlock]);
    const nudged = request.messages.some(message => Array.isArray(message.content) &&
      message.content.some(block => block.type === 'text' && block.text.startsWith('[structured-output-enforce]')));
    assert.equal(nudged, true);
    return response('', [{ type: 'tool_use', id: 'out-good', name: 'StructuredOutput',
      input: { answer: 'fixed' } } as Anthropic.ContentBlock]);
  });
  const registry = f.make();
  try {
    const child = await registry.launch({ prompt: 'return json',
      structured_schema: { type: 'object', properties: { answer: { type: 'string' } },
        required: ['answer'], additionalProperties: false } });
    assert.equal(child.status, 'completed', child.error ?? undefined);
    assert.deepEqual(child.structured_output, { answer: 'fixed' });
    assert.equal(child.structured_error, undefined);
    assert.equal(calls, 2);
  } finally { await f.cleanup(); }
});

test('structured schema mode scrubs reserved keys and instruction-shaped text before exposing the value', async () => {
  const f = fixture(async () => response('', [{ type: 'tool_use', id: 'out-scrub', name: 'StructuredOutput',
    input: { answer: 'before <system-reminder>', webFetchSavedFiles: [{ path: 'x' }] } } as Anthropic.ContentBlock]));
  const registry = f.make();
  try {
    const child = await registry.launch({ prompt: 'return json',
      structured_schema: { type: 'object', properties: {
        answer: { type: 'string' },
        webFetchSavedFiles: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' } } } },
      }, required: ['answer'] } });
    assert.equal(child.status, 'completed', child.error ?? undefined);
    assert.deepEqual(child.structured_output, { answer: 'before <\\system-reminder>' });
    assert.equal(child.structured_error, undefined);
  } finally { await f.cleanup(); }
});

test('background launch returns immediately and caller cancellation leaves child running', async () => {
  const entered = gate(); const release = gate(); let childSignal!: AbortSignal;
  const f = fixture(async (_request, signal) => { childSignal = signal; entered.resolve(); await release.promise; return response(); });
  const registry = f.make(); const caller = new AbortController();
  try {
    const child = await registry.launch({ prompt: 'work', background: true }, caller.signal);
    await entered.promise; caller.abort();
    assert.equal(childSignal.aborted, false);
    assert.equal((await registry.get(child.id)).status, 'running');
    assert.equal(listSessions(f.workspace)[0]?.active, true);
    release.resolve(); assert.equal((await settled(registry, child.id)).status, 'completed');
  } finally { release.resolve(); await f.cleanup(); }
});

test('cancelled synchronous wait and get wait do not cancel the launched child', async () => {
  const entered = gate(); const release = gate();
  const f = fixture(async () => { entered.resolve(); await release.promise; return response(); });
  const registry = f.make(); const caller = new AbortController();
  try {
    const launched = registry.launch({ prompt: 'work' }, caller.signal);
    await entered.promise;
    const rejected = assert.rejects(launched); caller.abort(); await rejected;
    const id = registry.list()[0]!.id;
    const waitSignal = new AbortController();
    const wait = registry.get(id, { waitMs: 30_000, signal: waitSignal.signal });
    const waitRejected = assert.rejects(wait); waitSignal.abort(); await waitRejected;
    assert.equal((await registry.get(id, { waitMs: 1 })).status, 'running');
    release.resolve(); assert.equal((await settled(registry, id)).status, 'completed');
  } finally { release.resolve(); await f.cleanup(); }
});

test('messages during tool batches wait for complete turn boundaries and remain FIFO', async () => {
  const toolEntered = gate(); const release = gate(); const seen: ModelRequest[] = [];
  const f = fixture(async request => {
    seen.push(structuredClone(request));
    if (seen.length === 1) return response('', [{ type: 'tool_use', id: 'call', name: 'blocked_read', input: {}, caller: { type: 'direct' } }]);
    assertPaired(request.messages);
    return response(`turn-${seen.length}`);
  });
  const read: ToolDefinition = { readOnly: true, schema: { name: 'blocked_read', input_schema: { type: 'object' } },
    async execute() { toolEntered.resolve(); await release.promise; return 'tool data'; } };
  const registry = f.make({ tools: [read] });
  try {
    const child = await registry.launch({ prompt: 'first', background: true });
    await toolEntered.promise;
    await registry.sendMessage(child.id, 'second'); await registry.sendMessage(child.id, 'third');
    assert.equal(seen.length, 1); assert.equal((await registry.get(child.id)).queued_messages, 2);
    release.resolve(); const done = await settled(registry, child.id);
    assert.equal(done.status, 'completed'); assert.equal(seen.length, 4);
    assert.equal(seen[2]?.messages.at(-1)?.content, 'second'); assert.equal(seen[3]?.messages.at(-1)?.content, 'third');
    const session = Session.open(f.workspace, { id: child.id });
    try {
      assertPaired(session.messages);
      const second = session.events.findIndex(event => event.kind === 'message' && event.message.content === 'second');
      assert.equal(session.events[second - 1]?.kind, 'turn_end');
      assert.equal(session.events.filter(event => event.kind === 'turn_end').length, 3);
    } finally { session.close(); }
  } finally { release.resolve(); await f.cleanup(); }
});

test('completed child resumes its pinned journal and name after source config changes', async () => {
  const seen: ModelRequest[] = [];
  const f = fixture(async request => { seen.push(structuredClone(request)); return response(`result-${seen.length}`); });
  const registry = f.make();
  try {
    const first = await registry.launch({ prompt: 'first', name: 'worker' });
    f.config.model = 'changed-parent'; f.config.system = 'changed-system';
    const queued = await registry.sendMessage('worker', 'follow up');
    assert.equal(queued.id, first.id);
    const second = await settled(registry, first.id);
    assert.equal(second.summary, 'result-2'); assert.equal(second.model_calls, 2);
    assert.equal(seen[1]?.model, 'test'); assert.match(String(seen[1]?.system), /child agent/);
    assert.equal(seen[1]?.messages.length, 3);
    assert.equal(listSessions(f.workspace).length, 1);
  } finally { await f.cleanup(); }
});

test('messages arriving during completion notifications are resumed after cleanup', async () => {
  const f = fixture(); const registry = f.make();
  try {
    let resumed = false;
    const notified = f.make({ onNotification: event => {
      if (!resumed) { resumed = true; void notified.sendMessage(event.agent.id, 'next'); }
    } });
    const first = await notified.launch({ prompt: 'first' });
    await settled(notified, first.id);
    assert.equal((await notified.get(first.id)).model_calls, 2);
    assert.equal(notified.drainNotifications().events.length, 2);
    assert.equal(registry.list().length, 0);
  } finally { await f.cleanup(); }
});

test('owner isolation, strict schemas, duplicate names and nested controls', async () => {
  const names = ['agent', 'list_agents', 'send_message', 'get_agent', 'stop_agent', 'poll_agents', 'run_background', 'monitor',
    'get_background_task', 'task_stop', 'read_notifications', 'cron_create', 'cron_delete', 'cron_list', 'schedule_wakeup'];
  const f = fixture(async request => { assert.deepEqual(request.tools, []); return response(); });
  const controls: ToolDefinition[] = names.map(name => ({ readOnly: true, schema: { name, input_schema: { type: 'object' } }, execute: async () => '' }));
  const first = f.make({ tools: controls }); const other = f.make();
  try {
    const child = await first.launch({ prompt: 'work', name: 'unique', mode: 'general' });
    assert.equal(other.list().length, 0);
    await assert.rejects(other.get(child.id), /Unknown/);
    await assert.rejects(other.sendMessage(child.id, 'message'), /Unknown/);
    await assert.rejects(first.launch({ prompt: 'again', name: 'unique' }), /already exists/);
    const tools = createAgentRegistryTools(first);
    assert.deepEqual(tools.map(tool => tool.schema.name), ['agent', 'list_agents', 'send_message', 'get_agent', 'stop_agent']);
    for (const tool of tools) await assert.rejects(tool.execute({ unexpected: true }, context(f.workspace)));
    await assert.rejects(tools[0]!.execute({ prompt: 'work', max_turns: 31 }, context(f.workspace)));
    assert.equal(JSON.parse(await tools[1]!.execute({}, context(f.workspace)))[0].id, child.id);
  } finally { await f.cleanup(); }
});

test('concurrency, mailbox bytes/count and total accepted-message bounds', async () => {
  const entered = gate(); const release = gate();
  const f = fixture(async () => { entered.resolve(); await release.promise; return response(); });
  const registry = f.make({ limits: { maxConcurrency: 1, maxMailboxCount: 1, maxMailboxBytes: 8, maxMessageBytes: 8, maxAgentMessages: 2 } });
  try {
    const child = await registry.launch({ prompt: 'one', background: true }); await entered.promise;
    await assert.rejects(registry.launch({ prompt: 'two' }), /concurrency/);
    await assert.rejects(registry.sendMessage(child.id, '123456789'), /byte limit/);
    await registry.sendMessage(child.id, '12345678');
    await assert.rejects(registry.sendMessage(child.id, 'x'), /limit/);
    release.resolve(); await settled(registry, child.id);
    await assert.rejects(registry.sendMessage(child.id, 'x'), /message limit/);
    await assert.rejects(registry.launch({ prompt: '123456789' }), /byte limit/);
  } finally { release.resolve(); await f.cleanup(); }
});

test('finished history and event queues are bounded by count and bytes', async () => {
  const f = fixture(); const registry = f.make({ limits: { maxHistory: 1, maxEvents: 1, maxEventBytes: 4096 } });
  try {
    const one = await registry.launch({ prompt: 'one' }); const two = await registry.launch({ prompt: 'two' });
    assert.equal(registry.list().length, 1); await assert.rejects(registry.get(one.id), /Unknown/);
    const notifications = registry.drainNotifications();
    assert.equal(notifications.events.length, 1); assert.equal(notifications.events[0]?.agent.id, two.id);
    assert.equal(notifications.dropped, 1);
    const tiny = f.make({ limits: { maxEventBytes: 1 } });
    await tiny.launch({ prompt: 'work' }); assert.equal(tiny.drainNotifications().dropped, 1);
    assert.equal(tiny.drainNotifications().events.length, 0);
  } finally { await f.cleanup(); }
});

test('stop and lifetime close abort active work, discard messages, await cleanup and release locks', async () => {
  const entered = gate(); const lifetime = new AbortController();
  const f = fixture(async (_request, signal) => {
    entered.resolve();
    await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('interrupted')), { once: true }));
    return response();
  });
  const registry = f.make({ signal: lifetime.signal });
  try {
    const one = await registry.launch({ prompt: 'work', background: true }); await entered.promise;
    await registry.sendMessage(one.id, 'queued');
    const stopped = await registry.stop(one.id);
    assert.equal(stopped.status, 'cancelled'); assert.equal(stopped.queued_messages, 0);
    await assert.rejects(registry.sendMessage(one.id, 'again'), /cancelled/);
    const two = await registry.launch({ prompt: 'work', background: true });
    lifetime.abort(); await registry.close();
    assert.equal((await registry.get(two.id)).status, 'cancelled');
    assert.equal(listSessions(f.workspace).some(session => session.active), false);
    assert.equal(fs.readdirSync(path.join(f.workspace, '.agent')).some(file => file.endsWith('.lock')), false);
    await assert.rejects(registry.launch({ prompt: 'later' }), /closed/);
  } finally { await f.cleanup(); }
});

test('failure notifications and journal limits release session locks', async () => {
  const errors: string[] = [];
  const f = fixture(async () => { throw new Error('scripted failure'); });
  const registry = f.make({ onNotification: event => { errors.push(event.agent.error!); throw new Error('observer failure'); } });
  try {
    const failed = await registry.launch({ prompt: 'work' });
    assert.equal(failed.status, 'failed'); assert.equal(failed.error, 'scripted failure');
    assert.deepEqual(errors, ['scripted failure']); assert.equal(listSessions(f.workspace)[0]?.active, false);
    const journalBudget = 4096 + Buffer.byteLength(f.workspace) * 4;
    let boundedCalls = 0;
    const bounded = f.make({ provider: { count: async () => 0, complete: async () => { boundedCalls++; return response('large'.repeat(1000)); } }, limits: { maxJournalBytes: journalBudget } });
    const limited = await bounded.launch({ prompt: 'work' });
    assert.equal(boundedCalls, 1);
    assert.equal(limited.status, 'failed'); assert.match(limited.error!, /journal limit/);
    const file = path.join(f.workspace, '.agent', `${limited.id}.jsonl`);
    assert.ok(fs.statSync(file).size <= journalBudget);
    assert.equal(fs.existsSync(`${file}.lock`), false);
  } finally { await f.cleanup(); }
});

test('constructor failures clean locks for registry and legacy child tools', async () => {
  const f = fixture(); f.config.contextTokens = f.config.compactAt + f.config.maxTokens;
  const registry = f.make();
  try {
    await assert.rejects(registry.launch({ prompt: 'work' }), /Compaction threshold/);
    await assert.rejects(createSubagentTool(f.config, f.provider, f.tools).execute({ prompt: 'work' }, context(f.workspace)), /Compaction threshold/);
    assert.equal(fs.readdirSync(path.join(f.workspace, '.agent')).some(file => file.endsWith('.lock')), false);
    assert.deepEqual(registry.list(), []);
  } finally { await f.cleanup(); }
});

test('UTF-8 output caps include marker and bound summaries, errors and all tool responses', async () => {
  const text = '中🙂'.repeat(2000);
  for (const limit of [1, 2, 3, 4, 64, 100]) {
    const capped = capChildOutput(text, limit);
    assert.ok(Buffer.byteLength(capped) <= limit); assert.equal(capped.includes('�'), false);
  }
  const f = fixture(async () => response(text)); const registry = f.make({ limits: { maxOutputBytes: 100 } });
  try {
    const child = await registry.launch({ prompt: 'work' }); assert.ok(Buffer.byteLength(child.summary) <= 100);
    const tools = createAgentRegistryTools(registry);
    const inputs: Record<string, unknown>[] = [{ prompt: 'work' }, {}, { id: child.id, message: 'again' }, { id: child.id }, { id: child.id }];
    for (let index = 0; index < tools.length; index++) {
      const output = await tools[index]!.execute(inputs[index], context(f.workspace, undefined, 75));
      assert.ok(Buffer.byteLength(output) <= 75); assert.equal(output.includes('�'), false);
    }
  } finally { await f.cleanup(); }
});

test('start/end hooks run for startup and resume and child configuration disables all parent controls', async () => {
  const f = fixture();
  f.config.features = { tasks: true, subagents: true, background: true, scheduler: true };
  f.config.hooks = { SessionStart: [{ command: 'printf \'{}\'' }], SessionEnd: [{ command: 'printf \'{}\'' }] };
  const registry = f.make();
  try {
    const first = await registry.launch({ prompt: 'first', mode: 'general' });
    await registry.sendMessage(first.id, 'next'); await settled(registry, first.id);
    const session = Session.open(f.workspace, { id: first.id });
    try {
      assert.equal(session.config.allowShell, true);
      assert.deepEqual(session.config.features, { tasks: true, subagents: false, background: false, scheduler: false });
      const hooks = session.events.filter(event => event.kind === 'hook_start' || event.kind === 'hook_result');
      assert.deepEqual(hooks.map(event => event.event), ['SessionStart', 'SessionStart', 'SessionEnd', 'SessionEnd',
        'SessionStart', 'SessionStart', 'SessionEnd', 'SessionEnd']);
    } finally { session.close(); }
  } finally { await f.cleanup(); }
});

test('metadata budget rejects before journal creation and event budget reserves failure boundaries', async () => {
  const f = fixture();
  const tiny = f.make({ limits: { maxJournalBytes: 1 } });
  const events = f.make({ limits: { maxJournalEvents: 3 } });
  try {
    await assert.rejects(tiny.launch({ prompt: 'work' }), /journal limit/);
    assert.equal(fs.existsSync(path.join(f.workspace, '.agent')), false);
    const child = await events.launch({ prompt: 'work' });
    assert.equal(child.status, 'failed');
    const session = Session.open(f.workspace, { id: child.id });
    try { assert.equal(session.events.length, 3); assert.equal(session.events.at(-1)?.kind, 'turn_end'); }
    finally { session.close(); }
  } finally { await f.cleanup(); }
});

test('mailbox count and byte limits are independent and a running child survives history eviction', async () => {
  const entered = gate(); const release = gate();
  const f = fixture(async request => {
    if (request.messages[0]?.content === 'hold') { entered.resolve(); await release.promise; }
    return response();
  });
  const registry = f.make({ limits: { maxHistory: 1, maxMailboxCount: 2, maxMailboxBytes: 4 } });
  try {
    const active = await registry.launch({ prompt: 'hold', background: true }); await entered.promise;
    await registry.sendMessage(active.id, '123');
    await assert.rejects(registry.sendMessage(active.id, '12'), /mailbox limit/);
    await registry.sendMessage(active.id, '1');
    await assert.rejects(registry.sendMessage(active.id, 'x'), /mailbox limit/);
    await registry.launch({ prompt: 'one' }); await registry.launch({ prompt: 'two' });
    assert.equal((await registry.get(active.id)).status, 'running');
    assert.equal(registry.list().length, 2);
    release.resolve(); await settled(registry, active.id);
    assert.equal(registry.list().length, 1);
  } finally { release.resolve(); await f.cleanup(); }
});

test('internal execution overrides validate workspace and tool provenance and retain scoped model/hooks', async () => {
  const seen: ModelRequest[] = [];
  const f = fixture(async request => { seen.push(structuredClone(request)); return response(); });
  const registry = f.make();
  try {
    await assert.rejects(registry.launch({ prompt: 'work' }, undefined, {
      config: { ...f.config, workspace: '/foreign' }, tools: [],
    }), /workspace/);
    const changed = { ...f.tools[0]!, schema: { ...f.tools[0]!.schema, description: 'changed' } };
    await assert.rejects(registry.launch({ prompt: 'work' }, undefined, { config: f.config, tools: [changed] }), /original parent/);
    const config = { ...structuredClone(f.config), model: 'skill-model', hooks: { SessionStart: [{ command: 'printf \'{}\'' }], SessionEnd: [{ command: 'printf \'{}\'' }] } };
    const child = await registry.launch({ prompt: 'work', background: true }, undefined, { config, tools: [f.tools[0]!] });
    assert.equal((await settled(registry, child.id)).status, 'completed');
    assert.equal(seen[0]?.model, 'skill-model'); assert.deepEqual(seen[0]?.tools?.map(tool => 'name' in tool ? tool.name : ''), ['read_file']);
    const journal = Session.open(f.workspace, { id: child.id });
    try { assert.ok(journal.events.some(event => event.kind === 'hook_result' && event.event === 'SessionEnd')); }
    finally { journal.close(); }
  } finally { await f.cleanup(); }
});

test('internal execution policy overlay enforces parent rules and runs argument grants before original executor', async () => {
  let executed = 0; let grantCalls = 0; let call = 0;
  const f = fixture(async () => ++call % 2 ? response('', [{ type: 'tool_use', id: 'call-' + call,
    name: 'scoped', input: { command: 'allowed' }, caller: { type: 'direct' } }]) : response());
  const tool: ToolDefinition = { readOnly: false, schema: { name: 'scoped', input_schema: { type: 'object' } },
    async execute() { executed++; return 'done'; } };
  const registry = f.make({ tools: [tool] });
  try {
    f.config.permissions = { mode: 'default', allow: [], deny: ['scoped'] };
    const weakened = { ...structuredClone(f.config), permissions: { mode: 'bypass' as const, allow: [], deny: [] } };
    const denied = await registry.launch({ prompt: 'work', mode: 'general' }, undefined, { config: weakened, tools: [tool] });
    assert.equal(denied.status, 'completed'); assert.equal(executed, 0);
    f.config.permissions = { mode: 'default', allow: [], deny: [] };
    await registry.launch({ prompt: 'work', mode: 'general' }, undefined, { config: weakened, tools: [tool],
      beforeTool: async (_tool, input, signal) => { signal.throwIfAborted(); assert.deepEqual(input, { command: 'allowed' }); grantCalls++; } });
    assert.equal(executed, 1); assert.equal(grantCalls, 1);
    f.config.permissions = { mode: 'ask', allow: [], deny: [] };
    await registry.launch({ prompt: 'work', mode: 'general' }, undefined, { config: weakened, tools: [tool] });
    assert.equal(executed, 1);
  } finally { await f.cleanup(); }
});

test('structured tool results enforce parent and scoped input rules before block execution', async () => {
  let inputPath = 'private/image.png'; let call = 0; let blocks = 0; const order: string[] = [];
  const f = fixture(async request => {
    if (++call % 2) return response('', [{ type: 'tool_use', id: 'media-' + call,
      name: 'read_media', input: { path: inputPath }, caller: { type: 'direct' } }]);
    const last = request.messages.at(-1)!;
    assert.equal(last.role, 'user');
    if (typeof last.content !== 'string') assert.equal(last.content[0]?.type, 'tool_result');
    return response();
  });
  f.config.allowShell = false;
  f.config.permissions = { mode: 'default', allow: [], deny: [],
    inputRules: [{ tool: 'read_media', path: 'private/*', decision: 'deny' }] };
  const media: ToolDefinition = { readOnly: true, schema: { name: 'read_media', input_schema: { type: 'object' } },
    async execute() { throw new Error('Agent should use structured results'); },
    async executeBlocks(_input, context) {
      blocks++; order.push('blocks'); assert.equal(context.allowShell, false); assert.equal(context.workspace, f.workspace);
      return [{ type: 'text', text: 'image data' }];
    },
  };
  const registry = f.make({ tools: [media] });
  const config = { ...structuredClone(f.config), allowShell: true,
    permissions: { mode: 'bypass' as const, allow: [], deny: [], inputRules: [{ tool: 'read_media', path: 'scoped/*', decision: 'deny' as const }] } };
  const execution = { config, tools: [media],
    beforeTool: async (tool: ToolDefinition, input: unknown, signal: AbortSignal) => {
      signal.throwIfAborted(); assert.equal(tool, media); assert.deepEqual(input, { path: 'public/image.png' }); order.push('grant');
    },
  };
  try {
    const denied = await registry.launch({ prompt: 'read private image', mode: 'general' }, undefined, execution);
    assert.equal(denied.status, 'completed'); assert.equal(blocks, 0); assert.deepEqual(order, []);
    inputPath = 'scoped/image.png';
    await registry.launch({ prompt: 'read scoped image', mode: 'general' }, undefined, execution);
    assert.equal(blocks, 0); assert.deepEqual(order, []);
    inputPath = 'public/image.png';
    const allowed = await registry.launch({ prompt: 'read public image', mode: 'general' }, undefined, execution);
    assert.equal(allowed.status, 'completed'); assert.equal(blocks, 1); assert.deepEqual(order, ['grant', 'blocks']);
  } finally { await f.cleanup(); }
});

test('child tools use scoped factories before mode/control filtering and keep loader schemas', async () => {
  let parentExecutions = 0; let childExecutions = 0; let call = 0;
  const f = fixture(async () => ++call % 2 ? response('', [{ type: 'tool_use', id: 'skill-' + call,
    name: 'skill', input: { name: 'editing-skill' }, caller: { type: 'direct' } }]) : response());
  const schema = { name: 'skill', input_schema: { type: 'object' as const,
    properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false } };
  const loader: ToolDefinition = { readOnly: true, schema, async execute() { childExecutions++; return 'skill instructions'; } };
  const advanced: ToolDefinition = { readOnly: true, schema,
    async execute() { parentExecutions++; throw new Error('Parent skill closure reached'); }, forChild: () => loader };
  const controls: ToolDefinition = { readOnly: true, schema: { name: 'loader', input_schema: { type: 'object' } },
    execute: async () => '', forChild: () => ({ readOnly: true, schema: { name: 'agent', input_schema: { type: 'object' } }, execute: async () => '' }) };
  const registry = f.make({ tools: [advanced] });
  try {
    assert.deepEqual(selectChildTools([advanced, controls], 'explore'), [loader]);
    assert.deepEqual(selectChildTools([advanced, controls], 'general'), [loader]);
    const explore = await registry.launch({ prompt: 'load skill' });
    const general = await registry.launch({ prompt: 'load skill', mode: 'general' });
    assert.equal(explore.status, 'completed'); assert.equal(general.status, 'completed');
    assert.equal(parentExecutions, 0); assert.equal(childExecutions, 2);
    const session = Session.open(f.workspace, { id: explore.id });
    try { assert.deepEqual(session.config.tools, [{ ...schema, eager_input_streaming: true }]); }
    finally { session.close(); }
  } finally { await f.cleanup(); }
});

test('child async hooks execute with independent ownership and settle before journal unlock on startup/resume', async () => {
  const completions: AsyncHookCompletion[] = []; const terminal: string[] = []; let foreignAsyncStarts = 0;
  const f = fixture();
  const output = JSON.stringify({ terminalSequence: "\x1b]2;CHILD_ASYNC\x07" });
  f.config.hooks = { SessionStart: [{ command: `printf start >> async-starts; printf '%s' '${output}'`, async: true }],
    SessionEnd: [{ command: `printf end >> async-ends; printf '%s' '${output}'`, async: true }] };
  const registry = f.make({ hookOptions: () => ({ startAsyncCommand: async () => { foreignAsyncStarts++; return 'foreign'; } }),
    terminalSequence: (id, sequence) => {
      const records = fs.readFileSync(path.join(f.workspace, '.agent', `${id}.jsonl`), 'utf8').trim().split('\n').map(line => JSON.parse(line));
      assert.ok(records.some(event => event.kind === 'hook_result' && event.terminalSequences?.includes(sequence)));
      terminal.push(sequence);
    },
    onHookCompletion: (id, completion) => {
      assert.equal(fs.existsSync(path.join(f.workspace, '.agent', `${id}.jsonl.lock`)), true);
      completions.push(completion);
    } });
  try {
    const first = await registry.launch({ prompt: 'work' });
    await registry.sendMessage(first.id, 'resume'); await settled(registry, first.id);
    assert.equal(foreignAsyncStarts, 0);
    assert.equal(fs.readFileSync(path.join(f.workspace, 'async-starts'), 'utf8'), 'startstart');
    assert.equal(fs.readFileSync(path.join(f.workspace, 'async-ends'), 'utf8'), 'endend');
    assert.equal(completions.length, 4); assert.equal(completions.every(completion => completion.state === 'completed'), true);
    assert.deepEqual(terminal, Array(4).fill("\x1b]2;CHILD_ASYNC\x1b\\"));
    const session = Session.open(f.workspace, { id: first.id });
    try {
      const starts = session.events.filter(event => event.kind === 'hook_start' && event.event.startsWith('async:'));
      const ends = session.events.filter(event => event.kind === 'hook_result' && event.event.startsWith('async:'));
      assert.equal(starts.length, 4); assert.equal(ends.length, 4);
      assert.deepEqual(new Set(starts.map(event => event.kind === 'hook_start' ? event.id : '')),
        new Set(ends.map(event => event.kind === 'hook_result' ? event.id : '')));
      assert.equal(JSON.stringify(session.events).includes('pending parent integration'), false);
    } finally { session.close(); }
  } finally { await f.cleanup(); }
});

test('child cancellation waits for async process groups and preserves lock until completion delivery', async () => {
  const entered = gate(); const f = fixture(async (_request, signal) => {
    entered.resolve(); await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
    return response();
  });
  f.config.hooks = { SessionStart: [{ command: 'sleep 30 & child=$!; printf %s "$child" > async-child.pid; wait', async: true }] };
  const completions: AsyncHookCompletion[] = [];
  const registry = f.make({ onHookCompletion: (id, completion) => {
    assert.equal(fs.existsSync(path.join(f.workspace, '.agent', `${id}.jsonl.lock`)), true); completions.push(completion);
  } });
  try {
    const child = await registry.launch({ prompt: 'hold', background: true }); await entered.promise;
    const pidFile = path.join(f.workspace, 'async-child.pid');
    for (let index = 0; index < 100 && !fs.existsSync(pidFile); index++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(fs.existsSync(pidFile)); const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    const stopped = await registry.stop(child.id); assert.equal(stopped.status, 'cancelled');
    assert.equal(completions.length, 1); assert.equal(completions[0]?.state, 'cancelled');
    let alive = true;
    for (let index = 0; index < 100; index++) {
      try { process.kill(pid, 0); } catch { alive = false; break; }
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.equal(alive, false); assert.equal(listSessions(f.workspace)[0]?.active, false);
  } finally { await f.cleanup(); }
});

test('legacy children run owned async startup/shutdown hooks with unchanged schema', async () => {
  const f = fixture(); const events: string[] = [];
  f.config.hooks = { SessionStart: [{ command: 'printf start >> legacy-start', async: true }],
    SessionEnd: [{ command: 'printf end >> legacy-end', async: true }] };
  try {
    const tool = createSubagentTool(f.config, f.provider, f.tools, { onHookCompletion: (_id, completion) => { events.push(completion.event); } });
    const result = JSON.parse(await tool.execute({ prompt: 'work' }, context(f.workspace)));
    assert.equal(result.reason, 'end_turn'); assert.deepEqual(new Set(events), new Set(['SessionStart', 'SessionEnd']));
    assert.equal(fs.readFileSync(path.join(f.workspace, 'legacy-start'), 'utf8'), 'start');
    assert.equal(fs.readFileSync(path.join(f.workspace, 'legacy-end'), 'utf8'), 'end');
    assert.equal(listSessions(f.workspace)[0]?.active, false);
  } finally { await f.cleanup(); }
});

test('hook option construction failures release child journal locks', async () => {
  const f = fixture(); const registry = f.make({ hookOptions: () => { throw new Error('hook factory failed'); } });
  try {
    await assert.rejects(registry.launch({ prompt: 'work' }), /hook factory failed/);
    await assert.rejects(createSubagentTool(f.config, f.provider, f.tools, { hookOptions: () => { throw new Error('hook factory failed'); } })
      .execute({ prompt: 'work' }, context(f.workspace)), /hook factory failed/);
    assert.equal(listSessions(f.workspace).some(session => session.active), false);
  } finally { await f.cleanup(); }
});

test('idle controls are opt-in and preserve all five legacy input schemas', async () => {
  const f = fixture(); const registry = f.make();
  try {
    const legacy = createAgentRegistryTools(registry);
    assert.deepEqual(legacy.map(tool => tool.schema.input_schema), [
      { type: 'object', properties: { prompt: { type: 'string' }, mode: { type: 'string', enum: ['explore', 'general'] },
        max_turns: { type: 'integer', minimum: 1, maximum: 30 }, name: { type: 'string', minLength: 1, maxLength: 128 },
        background: { type: 'boolean' }, model: { type: 'string', minLength: 1, maxLength: 256 } }, required: ['prompt'], additionalProperties: false },
      { type: 'object', properties: {}, required: [], additionalProperties: false },
      { type: 'object', properties: { id: { type: 'string' }, message: { type: 'string' } }, required: ['id', 'message'], additionalProperties: false },
      { type: 'object', properties: { id: { type: 'string' }, wait_ms: { type: 'integer', minimum: 0, maximum: 30_000 } }, required: ['id'], additionalProperties: false },
      { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
    ]);
    assert.deepEqual(createAgentRegistryTools(registry, { idle: false }).map(tool => tool.schema), legacy.map(tool => tool.schema));
    const enabled = createAgentRegistryTools(registry, { idle: true });
    assert.deepEqual(enabled.map(tool => tool.schema.name), ['agent', 'list_agents', 'send_message', 'get_agent', 'stop_agent', 'poll_agents']);
    for (const index of [0, 1, 3, 4]) assert.deepEqual(enabled[index]!.schema, legacy[index]!.schema);
    assert.deepEqual(enabled[2]!.schema.input_schema.required, ['id']);
    assert.deepEqual(enabled[5]!.schema.input_schema, { type: 'object', properties: {
      wait_ms: { type: 'integer', minimum: 0, maximum: 30_000 }, since: { type: 'integer', minimum: 0 },
    }, required: [], additionalProperties: false });
    const child = await registry.launch({ prompt: 'work' });
    await assert.rejects(legacy[2]!.execute({ id: child.id, notify_when_idle: true }, context(f.workspace)));
    for (const input of [{ id: child.id }, { id: child.id, message: ' ' }, { id: child.id, notify_when_idle: 'true' },
      { id: child.id, notify_when_idle: true, expires_ms: 0 }, { id: child.id, notify_when_idle: true, expires_ms: 1_800_001 },
      { id: child.id, notify_when_idle: true, expires_ms: 1.5 }, { id: child.id, notify_when_idle: true, extra: true }]) {
      await assert.rejects(enabled[2]!.execute(input, context(f.workspace)));
    }
    for (const input of [{ wait_ms: -1 }, { wait_ms: 30_001 }, { wait_ms: 1.5 }, { since: -1 }, { since: 1.5 }, { extra: true }]) {
      await assert.rejects(enabled[5]!.execute(input, context(f.workspace)));
    }
  } finally { await f.cleanup(); }
});

test('idle subscriptions follow the next settled conversation once and do not send a message', async () => {
  const entered = gate(); const release = gate(); let calls = 0;
  const f = fixture(async () => { calls++; entered.resolve(); await release.promise; return response(); });
  const registry = f.make();
  try {
    const child = await registry.launch({ prompt: 'hold', name: 'worker', background: true }); await entered.promise;
    const subscription = registry.subscribeIdle('worker');
    assert.equal(subscription.agent_id, child.id); assert.equal(subscription.expires_ms, 300_000);
    const tools = createAgentRegistryTools(registry, { idle: true });
    const pure = JSON.parse(await tools[2]!.execute({ id: child.id, notify_when_idle: true }, context(f.workspace)));
    assert.equal(pure.queued_messages, 0); assert.equal(pure.status, 'running'); assert.equal(calls, 1);
    await tools[2]!.execute({ id: child.id, message: 'follow up', notify_when_idle: true }, context(f.workspace));
    assert.equal((await registry.get(child.id)).queued_messages, 1);
    release.resolve(); await settled(registry, child.id);
    const first = registry.drainNotifications().events;
    assert.equal(first.filter(event => !event.subscription).length, 1);
    const idle = first.filter(event => event.subscription);
    assert.equal(idle.length, 3); assert.ok(idle.some(event => event.subscription?.id === subscription.id));
    assert.ok(idle.every(event => event.subscription?.state === 'idle' && event.agent.status === 'completed' && event.agent.queued_messages === 0));
    assert.equal(calls, 2);
    const next = registry.subscribeIdle(child.id);
    assert.deepEqual(registry.drainNotifications().events, []);
    await registry.sendMessage(child.id, 'resume'); await settled(registry, child.id);
    const resumed = registry.drainNotifications().events.filter(event => event.subscription);
    assert.deepEqual(resumed.map(event => event.subscription), [{ id: next.id, state: 'idle' }]);
  } finally { release.resolve(); await f.cleanup(); }
});

test('idle callbacks can resume and resubscribe without duplicate workers or same-transition delivery', async () => {
  const entered = gate(); const release = gate(); const nextEntered = gate(); const nextRelease = gate();
  let calls = 0; let nextSubscription = ''; let resume: Promise<unknown> | undefined;
  const observed: { id: string; status: string }[] = [];
  const f = fixture(async () => {
    calls++;
    if (calls === 1) { entered.resolve(); await release.promise; }
    if (calls === 2) { nextEntered.resolve(); await nextRelease.promise; }
    return response();
  });
  const registry = f.make({ limits: { maxConcurrency: 1 }, onNotification: event => {
    if (event.subscription?.state !== 'idle') return;
    observed.push({ id: event.subscription.id, status: event.agent.status });
    if (!nextSubscription) {
      nextSubscription = registry.subscribeIdle(event.agent.id).id;
      resume = registry.sendMessage(event.agent.id, 'callback resume');
    }
  } });
  try {
    const child = await registry.launch({ prompt: 'hold', background: true }); await entered.promise;
    const one = registry.subscribeIdle(child.id); const two = registry.subscribeIdle(child.id);
    release.resolve(); await nextEntered.promise; await resume;
    assert.deepEqual(observed, [{ id: one.id, status: 'completed' }, { id: two.id, status: 'completed' }]);
    assert.equal(calls, 2); assert.equal((await registry.get(child.id)).status, 'running');
    await assert.rejects(registry.launch({ prompt: 'concurrency check' }), /concurrency/);
    nextRelease.resolve(); await settled(registry, child.id);
    assert.deepEqual(observed.at(-1), { id: nextSubscription, status: 'completed' });
    assert.equal(observed.length, 3); assert.equal(calls, 2);
    const later = await registry.launch({ prompt: 'capacity restored' }); assert.equal(later.status, 'completed');
  } finally { release.resolve(); nextRelease.resolve(); await f.cleanup(); }
});

test('failed and stopped children satisfy pending idle subscriptions once after cleanup', async () => {
  for (const state of ['failed', 'cancelled'] as const) {
    const entered = gate(); const release = gate();
    const f = fixture(async (_request, signal) => {
      entered.resolve();
      if (state === 'failed') { await release.promise; throw new Error('fixture failure'); }
      await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('fixture stopped')), { once: true }));
      return response();
    });
    const registry = f.make();
    try {
      const child = await registry.launch({ prompt: 'hold', background: true }); await entered.promise;
      const subscription = registry.subscribeIdle(child.id);
      if (state === 'failed') { release.resolve(); await settled(registry, child.id); } else await registry.stop(child.id);
      assert.equal(listSessions(f.workspace)[0]?.active, false);
      const idle = registry.drainNotifications().events.filter(event => event.subscription);
      assert.equal(idle.length, 1); assert.equal(idle[0]?.agent.status, state);
      assert.deepEqual(idle[0]?.subscription, { id: subscription.id, state: 'idle' });
      await registry.stop(child.id);
      assert.equal(registry.drainNotifications().events.some(event => event.subscription), false);
    } finally { release.resolve(); await f.cleanup(); }
  }
});

test('idle expiry is bounded, once-only, capacity-releasing and survives caller abort', async t => {
  const entered = gate(); const release = gate();
  const f = fixture(async () => { entered.resolve(); await release.promise; return response(); });
  const registry = f.make({ limits: { maxIdleSubscriptions: 1 } });
  try {
    const child = await registry.launch({ prompt: 'hold', background: true }); await entered.promise;
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const caller = new AbortController();
    await registry.sendMessage(child.id, undefined, caller.signal, { notifyWhenIdle: true, expiresMs: 20 }); caller.abort();
    await assert.rejects(registry.sendMessage(child.id, 'over limit', undefined, { notifyWhenIdle: true }), /subscription limit/);
    assert.equal((await registry.get(child.id)).queued_messages, 0);
    t.mock.timers.tick(19); assert.deepEqual(registry.drainNotifications().events, []);
    t.mock.timers.tick(1);
    const expired = registry.drainNotifications().events;
    assert.equal(expired.length, 1); assert.equal(expired[0]?.subscription?.state, 'expired');
    assert.equal(expired[0]?.agent.status, 'running');
    t.mock.timers.tick(100); assert.deepEqual(registry.drainNotifications().events, []);
    const next = registry.subscribeIdle(child.id, { expiresMs: 1_800_000 });
    const aborted = new AbortController(); aborted.abort();
    assert.throws(() => registry.subscribeIdle(child.id, { signal: aborted.signal }));
    release.resolve(); await settled(registry, child.id);
    const idle = registry.drainNotifications().events.filter(event => event.subscription);
    assert.deepEqual(idle.map(event => event.subscription), [{ id: next.id, state: 'idle' }]);
    t.mock.timers.tick(1_800_000); assert.deepEqual(registry.drainNotifications().events, []);
  } finally { t.mock.timers.reset(); release.resolve(); await f.cleanup(); }
});

test('idle event bounds apply to subscriptions and retained subscription descriptors are isolated', async t => {
  const f = fixture(); const registry = f.make({ limits: { maxHistory: 1, maxEvents: 1 } });
  try {
    const child = await registry.launch({ prompt: 'work' }); registry.drainNotifications();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const subscription = registry.subscribeIdle(child.id, { expiresMs: 1 }); const id = subscription.id;
    subscription.id = 'changed'; subscription.agent_id = 'changed';
    await registry.launch({ prompt: 'evict old child' }); registry.drainNotifications();
    await assert.rejects(registry.get(child.id), /Unknown/);
    t.mock.timers.tick(1);
    const expired = registry.drainNotifications().events;
    assert.equal(expired[0]?.agent.id, child.id); assert.deepEqual(expired[0]?.subscription, { id, state: 'expired' });
    const latest = registry.list()[0]!;
    registry.subscribeIdle(latest.id, { expiresMs: 1 }); registry.subscribeIdle(latest.id, { expiresMs: 1 });
    t.mock.timers.tick(1);
    const bounded = registry.drainNotifications(); assert.equal(bounded.events.length, 1); assert.equal(bounded.dropped, 1);
    const tiny = f.make({ limits: { maxEventBytes: 1 } });
    const small = await tiny.launch({ prompt: 'work' }); tiny.subscribeIdle(small.id, { expiresMs: 1 }); t.mock.timers.tick(1);
    assert.deepEqual(tiny.drainNotifications(), { events: [], dropped: 2 });
  } finally { t.mock.timers.reset(); await f.cleanup(); }
});

test('poll snapshots are owner-local and minimal, and waits observe messages and completion', async () => {
  const entered = gate(); const release = gate();
  const f = fixture(async () => { entered.resolve(); await release.promise; return response('private summary'); });
  const registry = f.make(); const other = f.make();
  try {
    assert.deepEqual(await registry.poll(), { revision: 0, changed: false, agents: [] });
    const child = await registry.launch({ prompt: 'hold', name: 'private name', background: true }); await entered.promise;
    const before = await registry.poll({ since: 0 });
    assert.ok(before.changed); assert.deepEqual(before.agents, [{ id: child.id, status: 'running' }]);
    const waiting = registry.poll({ since: before.revision, waitMs: 30_000 });
    await registry.sendMessage(child.id, 'queued');
    const changed = await waiting; assert.ok(changed.changed); assert.ok(changed.revision > before.revision);
    const finished = registry.poll({ since: changed.revision, waitMs: 30_000 });
    release.resolve(); const done = await finished;
    assert.ok(done.changed); assert.deepEqual(done.agents, [{ id: child.id, status: 'completed' }]);
    done.agents[0]!.id = 'mutated'; assert.equal((await registry.poll()).agents[0]?.id, child.id);
    assert.deepEqual(await other.poll(), { revision: 0, changed: false, agents: [] });
    await assert.rejects(other.poll({ since: done.revision }), /ahead/);
    assert.throws(() => other.subscribeIdle(child.id), /Unknown/);
    await assert.rejects(other.sendMessage(child.id, undefined, undefined, { notifyWhenIdle: true }), /Unknown/);
    const tool = createAgentRegistryTools(registry, { idle: true }).find(tool => tool.schema.name === 'poll_agents')!;
    const output = JSON.parse(await tool.execute({}, context(f.workspace)));
    assert.deepEqual(output.agents, [{ id: child.id, status: 'completed' }]);
    assert.ok(Buffer.byteLength(await tool.execute({}, context(f.workspace, undefined, 40))) <= 40);
  } finally { release.resolve(); await f.cleanup(); }
});

test('poll waiters timeout or abort without child cancellation and free bounded capacity', async t => {
  const entered = gate(); const release = gate();
  const f = fixture(async (_request, signal) => { entered.resolve(); await release.promise; signal.throwIfAborted(); return response(); });
  const registry = f.make({ limits: { maxPollWaiters: 1 } });
  try {
    const child = await registry.launch({ prompt: 'hold', background: true }); await entered.promise;
    const before = await registry.poll();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const timed = registry.poll({ waitMs: 30_000 });
    await assert.rejects(registry.poll({ waitMs: 1 }), /waiter limit/);
    let resolved = false; void timed.then(() => { resolved = true; });
    t.mock.timers.tick(29_999); await Promise.resolve(); assert.equal(resolved, false);
    t.mock.timers.tick(1); assert.deepEqual(await timed, before);
    for (const reason of [undefined, false, 0, '']) {
      const caller = new AbortController();
      const waiting = registry.poll({ waitMs: 30_000, signal: caller.signal });
      const rejected = assert.rejects(waiting, error => reason === undefined || error === reason);
      caller.abort(reason); await rejected;
      const getting = new AbortController();
      const result = registry.get(child.id, { waitMs: 30_000, signal: getting.signal });
      const getRejected = assert.rejects(result, error => reason === undefined || error === reason);
      getting.abort(reason); await getRejected;
    }
    const preAborted = new AbortController(); preAborted.abort();
    await assert.rejects(registry.poll({ signal: preAborted.signal }));
    assert.equal((await registry.get(child.id)).status, 'running');
    const last = registry.poll({ waitMs: 30_000 }); release.resolve(); assert.equal((await last).changed, true);
    await settled(registry, child.id); t.mock.timers.tick(30_000);
  } finally { t.mock.timers.reset(); release.resolve(); await f.cleanup(); }
});

test('closing cancels subscriptions and releases poll waits without idle delivery', async t => {
  const entered = gate();
  const f = fixture(async (_request, signal) => {
    entered.resolve(); await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('closed')), { once: true }));
    return response();
  });
  const registry = f.make();
  try {
    const child = await registry.launch({ prompt: 'hold', background: true }); await entered.promise;
    t.mock.timers.enable({ apis: ['setTimeout'] });
    registry.subscribeIdle(child.id, { expiresMs: 1 });
    const waiting = registry.poll({ waitMs: 30_000 });
    const closing = registry.close(); const revision = (await waiting).revision;
    assert.ok(revision > 0); await closing; await registry.close();
    assert.equal((await registry.get(child.id)).status, 'cancelled');
    assert.equal((await registry.poll({ waitMs: 30_000 })).changed, false);
    t.mock.timers.tick(1_800_000);
    assert.equal(registry.drainNotifications().events.some(event => event.subscription), false);
    assert.throws(() => registry.subscribeIdle(child.id), /closed/);
  } finally { t.mock.timers.reset(); await f.cleanup(); }
});

test('closing in an idle callback cancels other subscriptions in that transition', async () => {
  const entered = gate(); const release = gate(); let closing: Promise<void> | undefined;
  const f = fixture(async () => { entered.resolve(); await release.promise; return response(); });
  const registry = f.make({ onNotification: event => { if (event.subscription) closing = registry.close(); } });
  try {
    const child = await registry.launch({ prompt: 'hold', background: true }); await entered.promise;
    const one = registry.subscribeIdle(child.id); registry.subscribeIdle(child.id);
    release.resolve(); await settled(registry, child.id); await closing;
    assert.deepEqual(registry.drainNotifications().events.filter(event => event.subscription).map(event => event.subscription), [{ id: one.id, state: 'idle' }]);
  } finally { release.resolve(); await f.cleanup(); }
});

test('legacy agent schema retains the exact original properties', () => {
  const f = fixture();
  try {
    const schema = createSubagentTool(f.config, f.provider, f.tools).schema.input_schema;
    assert.deepEqual(schema, { type: 'object', properties: { prompt: { type: 'string' }, mode: { type: 'string', enum: ['explore', 'general'] }, max_turns: { type: 'integer', minimum: 1, maximum: 30 } }, required: ['prompt'], additionalProperties: false });
  } finally { fs.rmSync(f.workspace, { recursive: true, force: true }); }
});

test('advanced agent schema is gated and configured types only narrow parent tools', async () => {
  const seen: ModelRequest[] = [];
  const f = fixture(async request => { seen.push(structuredClone(request)); return response(); });
  const type = { name: 'reader', description: 'Read a selected file', body: 'Reader instructions', path: '/fixture/reader.md',
    mode: 'explore' as const, tools: ['read_file', 'write_file', 'foreign_tool'], model: 'type-model', effort: 'high' as const, maxTurns: 2 };
  const legacy = f.make(); const registry = f.make({ enableAdvanced: true, agentTypes: [type] });
  try {
    await assert.rejects(legacy.launch({ prompt: 'read', subagent_type: 'reader' }));
    const oldSchema = createAgentRegistryTools(registry)[0]!.schema.input_schema;
    assert.equal(Object.hasOwn(oldSchema.properties as object, 'subagent_type'), false);
    const tool = createAgentRegistryTools(registry, { enableAdvanced: true })[0]!;
    await assert.rejects(tool.execute({ prompt: 'read', subagent_type: 'missing' }, context(f.workspace)), /Unknown agent type/);
    const child = JSON.parse(await tool.execute({ prompt: 'read', subagent_type: 'reader' }, context(f.workspace)));
    assert.equal(child.mode, 'explore'); assert.equal(child.workspace, f.workspace);
    assert.equal(seen[0]!.model, 'type-model'); assert.equal(seen[0]!.output_config?.effort, 'high');
    assert.match(String(seen[0]!.system), /Reader instructions/);
    assert.deepEqual(seen[0]!.tools?.map(tool => 'name' in tool ? tool.name : ''), ['read_file']);
    const journal = Session.open(f.workspace, { id: child.id });
    try { assert.equal(journal.config.maxTurns, 2); } finally { journal.close(); }
  } finally { await f.cleanup(); }
});

test('fork copies paired conversation data, omits bound reasoning and inherits the parent model', async () => {
  const seen: ModelRequest[] = []; const entered = gate(); const release = gate();
  const f = fixture(async request => { seen.push(structuredClone(request)); entered.resolve(); await release.promise; return response(); });
  f.config.effort = 'high';
  const registry = f.make({ enableAdvanced: true });
  const conversation: Anthropic.MessageParam[] = [
    { role: 'user', content: 'prior question' },
    { role: 'assistant', content: [{ type: 'thinking', thinking: 'prior reasoning', signature: 'bound-signature' },
      { type: 'tool_use', id: 'read', name: 'read_file', input: { path: 'file' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'read', content: 'prior file' }] },
    { role: 'assistant', content: [{ type: 'redacted_thinking', data: 'bound-data' }] },
  ];
  try {
    const child = await registry.launch({ prompt: 'new task', subagent_type: 'fork', model: 'ignored-model', effort: 'low', background: true }, undefined, undefined, conversation);
    await entered.promise; conversation[0]!.content = 'parent changed'; release.resolve(); await settled(registry, child.id);
    assert.equal(seen[0]!.model, 'test'); assert.equal(seen[0]!.output_config?.effort, 'high');
    assert.equal(seen[0]!.messages[0]!.content, 'prior question');
    assert.equal(seen[0]!.messages.at(-1)!.content, 'new task'); assertPaired(seen[0]!.messages);
    assert.equal(JSON.stringify(seen[0]!.messages).includes('bound-signature'), false);
    assert.match(JSON.stringify(seen[0]!.messages), /Prior reasoning omitted/);
    await assert.rejects(registry.launch({ prompt: 'fork', subagent_type: 'fork' }), /snapshot/);
    await assert.rejects(registry.launch({ prompt: 'fork', subagent_type: 'fork' }, undefined, undefined,
      [{ role: 'assistant', content: [{ type: 'tool_use', id: 'pending', name: 'read_file', input: {} }] }]), /Unanswered/);
  } finally { release.resolve(); await f.cleanup(); }
});

test('child environment lease binds tools to the new workspace and survives completed-child resume', async () => {
  const seen: string[] = []; let closes = 0; let calls = 0;
  const f = fixture(async () => ++calls % 2 ? response('', [{ type: 'tool_use', id: 'read-' + calls,
    name: 'read_file', input: { path: 'file' }, caller: { type: 'direct' } }]) : response());
  const target = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-child-env-')));
  fs.writeFileSync(path.join(target, 'file'), 'isolated');
  const registry = f.make({ enableAdvanced: true, childEnvironmentFactory: async request => {
    assert.equal(request.isolation, 'worktree');
    return { config: { ...request.config, workspace: target }, storageRoot: f.workspace,
      tools: request.tools.map(tool => ({ ...tool, async execute(input, context) {
        seen.push(context.workspace); assert.equal(context.workspace, target); return tool.execute(input, context);
      } })), close: async () => { closes++; } };
  } });
  try {
    const child = await registry.launch({ prompt: 'read', isolation: 'worktree' });
    assert.equal(child.workspace, target); assert.equal(closes, 0);
    assert.equal(fs.existsSync(path.join(target, '.agent')), false);
    await registry.sendMessage(child.id, 'read again'); await settled(registry, child.id);
    assert.deepEqual(seen, [target, target]); assert.equal(closes, 0);
    await registry.stop(child.id); assert.equal(closes, 1);
    await registry.close(); assert.equal(closes, 1);
  } finally { await f.cleanup(); fs.rmSync(target, { recursive: true, force: true }); }
});

test('environment preparation reserves concurrency and names and close awaits rollback', async () => {
  const entered = gate(); const release = gate(); const cleaning = gate(); const cleaned = gate(); let closes = 0;
  const f = fixture();
  const registry = f.make({ enableAdvanced: true, limits: { maxConcurrency: 1 }, childEnvironmentFactory: async request => {
    entered.resolve(); await release.promise;
    return { config: request.config, tools: [...request.tools], close: async () => { closes++; cleaning.resolve(); await cleaned.promise; } };
  } });
  try {
    const launching = registry.launch({ prompt: 'work', name: 'reserved', isolation: 'worktree' });
    const rejected = assert.rejects(launching, /closed|abort/i); await entered.promise;
    await assert.rejects(registry.launch({ prompt: 'other' }), /concurrency/);
    let closed = false; const closing = registry.close().then(() => { closed = true; });
    release.resolve(); await cleaning.promise; assert.equal(closed, false);
    cleaned.resolve(); await rejected; await closing; assert.equal(closes, 1);
    assert.equal(fs.existsSync(path.join(f.workspace, '.agent')), false);
  } finally { release.resolve(); cleaned.resolve(); await f.cleanup(); }
});

test('environment changes never bypass inherited configuration or original override provenance', async () => {
  let closes = 0; const f = fixture();
  const registry = f.make({ enableAdvanced: true, childEnvironmentFactory: async request => ({
    config: { ...request.config, allowShell: true }, tools: [...request.tools], close: async () => { closes++; },
  }) });
  try {
    await assert.rejects(registry.launch({ prompt: 'work', isolation: 'worktree' }), /inherited configuration/);
    assert.equal(closes, 1);
    await assert.rejects(registry.launch({ prompt: 'work', isolation: 'worktree' }, undefined,
      { config: { ...f.config, workspace: '/other' }, tools: [] }), /workspace must match parent/);
    const fake = { ...f.tools[0]! };
    await assert.rejects(registry.launch({ prompt: 'work', isolation: 'worktree' }, undefined,
      { config: f.config, tools: [fake] }), /original parent/);
  } finally { await f.cleanup(); }
});

test('stop, wait and registry close share delayed cancelled-child cleanup', async () => {
  const entered = gate(); const cleanupEntered = gate(); const releaseCleanup = gate(); let closes = 0;
  const f = fixture(async (_request, signal) => {
    entered.resolve();
    await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
    return response();
  });
  const registry = f.make({ enableAdvanced: true, childEnvironmentFactory: async request => ({
    config: request.config, tools: [...request.tools], close: async () => { closes++; cleanupEntered.resolve(); await releaseCleanup.promise; },
  }) });
  try {
    const child = await registry.launch({ prompt: 'work', isolation: 'worktree', background: true }); await entered.promise;
    let firstDone = false; const first = registry.stop(child.id).then(() => { firstDone = true; });
    await cleanupEntered.promise;
    let secondDone = false; let closeDone = false; let waitDone = false;
    const second = registry.stop(child.id).then(() => { secondDone = true; });
    const wait = registry.get(child.id, { waitMs: 30_000 }).then(() => { waitDone = true; });
    const closing = registry.close().then(() => { closeDone = true; });
    await Promise.resolve(); await Promise.resolve();
    assert.equal(firstDone || secondDone || closeDone || waitDone, false); assert.equal(closes, 1);
    releaseCleanup.resolve(); await Promise.all([first, second, wait, closing]);
    assert.equal(firstDone && secondDone && closeDone && waitDone, true); assert.equal(closes, 1);
  } finally { releaseCleanup.resolve(); await f.cleanup(); }
});

test('completed-child waits include delayed lease cleanup and retain timeout and cancellation semantics', async () => {
  const cleanupEntered = gate(); const releaseCleanup = gate(); let closes = 0;
  const f = fixture();
  const registry = f.make({ enableAdvanced: true, childEnvironmentFactory: async request => ({
    config: request.config, tools: [...request.tools], close: async () => { closes++; cleanupEntered.resolve(); await releaseCleanup.promise; },
  }) });
  try {
    const child = await registry.launch({ prompt: 'work', isolation: 'worktree' });
    assert.equal(child.status, 'completed');
    const stopped = registry.stop(child.id); await cleanupEntered.promise;
    let waitDone = false;
    const waiting = registry.get(child.id, { waitMs: 30_000 }).then(result => { waitDone = true; return result; });
    const caller = new AbortController();
    const cancelled = registry.get(child.id, { waitMs: 30_000, signal: caller.signal });
    const rejected = assert.rejects(cancelled, /cancelled|abort/i); caller.abort(); await rejected;
    const timedOut = await registry.get(child.id, { waitMs: 1 });
    assert.equal(timedOut.summary, 'done'); assert.equal(waitDone, false); assert.equal(closes, 1);
    releaseCleanup.resolve(); const [, result] = await Promise.all([stopped, waiting]);
    assert.equal(waitDone, true); assert.equal(result.summary, 'done'); assert.equal(closes, 1);
  } finally { releaseCleanup.resolve(); await f.cleanup(); }
});

test('lease cleanup failures preserve completed results and report the retained workspace', async () => {
  const f = fixture(); const registry = f.make({ enableAdvanced: true, childEnvironmentFactory: async request => ({
    config: request.config, tools: [...request.tools], close: async () => { throw new Error('dirty worktree preserved'); },
  }) });
  try {
    const child = await registry.launch({ prompt: 'work', isolation: 'worktree' });
    await registry.close(); const result = await registry.get(child.id);
    assert.equal(result.summary, 'done'); assert.equal(result.status, 'completed');
    assert.match(result.cleanup_error!, /dirty worktree preserved/); assert.ok(result.cleanup_error!.includes(f.workspace));
  } finally { await f.cleanup(); }
});
