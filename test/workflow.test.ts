import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import { AgentRegistry } from '../src/agent-registry.js';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { listSessions } from '../src/sessions.js';
import { createTools } from '../src/tools.js';
import { createWorkflowTools, WorkflowRegistry, type WorkflowRegistryOptions } from '../src/workflow.js';

function gate() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
function response(text: string): Anthropic.Message {
  return { id: 'fixture', model: 'test', type: 'message', role: 'assistant', content: [{ type: 'text', text }],
    stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
function fixture(complete: ModelProvider['complete'] = async () => response('done')) {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-workflow-')));
  const tools = createTools(); const config = defaultConfig(workspace, tools); config.model = 'test';
  const agents = new AgentRegistry({ source: config, tools, provider: { count: async () => 0, complete } });
  const registries: WorkflowRegistry[] = [];
  const make = (options: Partial<WorkflowRegistryOptions> = {}) => {
    const registry = new WorkflowRegistry({ agents, ...options }); registries.push(registry); return registry;
  };
  return { workspace, tools, config, agents, make,
    async cleanup() { await Promise.all(registries.map(registry => registry.close())); await agents.close(); fs.rmSync(workspace, { recursive: true, force: true }); },
  };
}
const settled = (registry: WorkflowRegistry, id: string) => registry.get(id, { waitMs: 30_000 });
const prompt = (request: ModelRequest) => String(request.messages.at(-1)?.content);

test('pipeline executes topologically with untrusted dependency context and child session evidence', async () => {
  const requests: ModelRequest[] = [];
  const f = fixture(async request => { requests.push(structuredClone(request)); return response('output-' + requests.length); });
  const workflows = f.make({ now: () => 123 });
  try {
    const result = await workflows.run({ tasks: [
      { id: 'third', prompt: 'third task', depends_on: ['second'] },
      { id: 'first', prompt: 'first task' },
      { id: 'second', prompt: 'second task', depends_on: ['first'], model: 'other' },
    ] });
    assert.equal(result.status, 'completed'); assert.equal(requests.length, 3);
    assert.equal(prompt(requests[0]!), 'first task');
    assert.match(prompt(requests[1]!), /second task.*\n[\s\S]*untrusted task data/);
    assert.match(prompt(requests[1]!), /output-1/); assert.equal(requests[1]?.model, 'other');
    assert.match(prompt(requests[2]!), /output-2/);
    assert.equal(new Set(result.tasks.map(task => task.session_id)).size, 3);
    assert.ok(result.tasks.every(task => task.status === 'completed' && task.session_id));
    assert.equal(result.started_at, 123); assert.equal(result.ended_at, 123);
    assert.equal(listSessions(f.workspace).every(session => !session.active), true);
  } finally { await f.cleanup(); }
});

test('ready tasks run in parallel up to max_parallel before downstream tasks begin', async () => {
  const entered = gate(); const release = gate(); let active = 0; let maximum = 0; let started = 0;
  const f = fixture(async request => {
    active++; maximum = Math.max(maximum, active); started++;
    if (started === 2) entered.resolve();
    if (!prompt(request).includes('Dependency')) await release.promise;
    active--; return response('done');
  });
  const registry = f.make();
  try {
    const run = await registry.run({ tasks: [
      { id: 'a', prompt: 'a' }, { id: 'b', prompt: 'b' }, { id: 'c', prompt: 'c' },
      { id: 'd', prompt: 'd', depends_on: ['a', 'b', 'c'] },
    ], max_parallel: 2, background: true });
    await entered.promise; assert.equal(started, 2); assert.equal(maximum, 2);
    const pending = await registry.get(run.id); assert.equal(pending.tasks[3]?.status, 'pending');
    release.resolve(); assert.equal((await settled(registry, run.id)).status, 'completed');
    assert.equal(started, 4); assert.equal(maximum, 2);
  } finally { release.resolve(); await f.cleanup(); }
});

test('DAG validation rejects duplicate IDs/dependencies, unknown edges, cycles, excessive nodes and script inputs', async () => {
  const f = fixture(); const registry = f.make();
  try {
    await assert.rejects(registry.run({ tasks: [{ id: 'a', prompt: 'a' }, { id: 'a', prompt: 'b' }] }), /Duplicate/);
    await assert.rejects(registry.run({ tasks: [{ id: 'a', prompt: 'a', depends_on: ['x'] }] }), /Unknown dependency/);
    await assert.rejects(registry.run({ tasks: [{ id: 'a', prompt: 'a', depends_on: ['a'] }] }), /cycle/);
    await assert.rejects(registry.run({ tasks: [{ id: 'a', prompt: 'a', depends_on: ['b'] }, { id: 'b', prompt: 'b', depends_on: ['a'] }] }), /cycle/);
    await assert.rejects(registry.run({ tasks: [{ id: 'a', prompt: 'a' }, { id: 'b', prompt: 'b', depends_on: ['a', 'a'] }] }), /Duplicate/);
    await assert.rejects(registry.run({ tasks: Array.from({ length: 33 }, (_, i) => ({ id: 'n' + i, prompt: 'work' })) }));
    await assert.rejects(registry.run({ tasks: [{ id: 'a', prompt: ' ' }] }));
    const tools = createWorkflowTools(registry);
    const context = { workspace: f.workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 1000 };
    await assert.rejects(tools[0]!.execute({ script: 'throw new Error()' }, context));
    assert.equal(f.agents.list().length, 0);
  } finally { await f.cleanup(); }
});

test('workflow script schema mode returns the validated StructuredOutput object', async () => {
  let calls = 0;
  const f = fixture(async request => {
    calls += 1;
    assert.equal(request.tools?.some(tool => 'name' in tool && tool.name === 'StructuredOutput'), true);
    return { id: 'fixture', model: 'test', type: 'message', role: 'assistant',
      content: [{ type: 'tool_use', id: 'out-1', name: 'StructuredOutput', input: { answer: 'yes' } }],
      stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
  });
  const registry = f.make();
  try {
    const tools = createWorkflowTools(registry);
    const context = { workspace: f.workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000 };
    const script = "export const meta = { name: 'schema', description: 'schema' }\n"
      + "return await agent('json', { schema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] } })";
    const result = JSON.parse(await tools[0]!.execute({ script }, context)) as { result?: unknown };
    assert.deepEqual(result.result, { answer: 'yes' });
    assert.equal(calls, 1);
  } finally { await f.cleanup(); }
});

test('failed dependencies skip downstream transitively while independent tasks finish', async () => {
  const seen: string[] = [];
  const f = fixture(async request => { const text = prompt(request); seen.push(text); if (text === 'fail') throw new Error('fixture failure'); return response('ok'); });
  const registry = f.make();
  try {
    const result = await registry.run({ tasks: [
      { id: 'failure', prompt: 'fail' }, { id: 'child', prompt: 'child', depends_on: ['failure'] },
      { id: 'grandchild', prompt: 'grandchild', depends_on: ['child'] }, { id: 'independent', prompt: 'success' },
    ] });
    assert.equal(result.status, 'failed'); assert.equal(result.tasks[0]?.error, 'fixture failure');
    assert.deepEqual(result.tasks.map(task => task.status), ['failed', 'skipped', 'skipped', 'completed']);
    assert.deepEqual(new Set(seen), new Set(['fail', 'success']));
    assert.equal(result.tasks[1]?.session_id, null);
  } finally { await f.cleanup(); }
});

test('reverse-declared downstream failures are skipped transitively', async () => {
  const f = fixture(async () => { throw new Error('fixture failure'); }); const registry = f.make();
  try {
    const result = await registry.run({ tasks: [
      { id: 'last', prompt: 'last', depends_on: ['middle'] },
      { id: 'middle', prompt: 'middle', depends_on: ['first'] }, { id: 'first', prompt: 'first' },
    ] });
    assert.deepEqual(result.tasks.map(task => task.status), ['skipped', 'skipped', 'failed']);
    assert.equal(result.error, null);
  } finally { await f.cleanup(); }
});

test('explicit workflow stop cancels only its children and leaves parent sibling alive', async () => {
  const started = gate(); let calls = 0;
  const f = fixture(async (_request, signal) => {
    if (++calls === 2) started.resolve();
    await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
    return response('done');
  });
  const registry = f.make();
  try {
    const sibling = await f.agents.launch({ prompt: 'sibling', background: true });
    const run = await registry.run({ tasks: [{ id: 'a', prompt: 'hold' }, { id: 'b', prompt: 'later', depends_on: ['a'] }], background: true });
    await started.promise;
    const stopped = await registry.stop(run.id);
    assert.equal(stopped.status, 'cancelled'); assert.deepEqual(stopped.tasks.map(task => task.status), ['cancelled', 'cancelled']);
    assert.equal((await f.agents.get(sibling.id)).status, 'running');
    await f.agents.stop(sibling.id);
    assert.equal(listSessions(f.workspace).every(session => !session.active), true);
  } finally { await f.cleanup(); }
});

test('cancellation while launch returns still stops the newly owned child', async () => {
  const entered = gate(); const f = fixture(async (_request, signal) => {
    entered.resolve();
    await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
    return response('done');
  });
  const lifetime = new AbortController(); const registry = f.make({ signal: lifetime.signal });
  const launch = f.agents.launch.bind(f.agents);
  f.agents.launch = async (...args) => {
    const result = await launch(...args); await entered.promise; lifetime.abort(); return result;
  };
  try {
    const run = await registry.run({ tasks: [{ id: 'a', prompt: 'work' }], background: true });
    await registry.close();
    assert.equal((await registry.get(run.id)).status, 'cancelled');
    assert.equal(listSessions(f.workspace).every(session => !session.active), true);
  } finally { await f.cleanup(); }
});

test('lifetime abort and deadlines await owned children cleanup', async () => {
  const entered = gate(); const signal = new AbortController();
  const f = fixture(async (_request, childSignal) => {
    entered.resolve(); await new Promise<void>((_resolve, reject) => childSignal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })); return response('done');
  });
  const registry = f.make({ signal: signal.signal });
  try {
    const run = await registry.run({ tasks: [{ id: 'a', prompt: 'hold' }], background: true }); await entered.promise;
    signal.abort(); await registry.close();
    assert.equal((await registry.get(run.id)).status, 'cancelled');
    assert.equal(listSessions(f.workspace).every(session => !session.active), true);
    await assert.rejects(registry.run({ tasks: [{ id: 'a', prompt: 'work' }] }), /closed/);
    const deadline = f.make(); const timed = await deadline.run({ tasks: [{ id: 'a', prompt: 'hold' }], timeout_ms: 10 });
    assert.equal(timed.status, 'cancelled'); assert.equal(timed.error, 'Workflow deadline reached');
    assert.equal(listSessions(f.workspace).every(session => !session.active), true);
  } finally { await f.cleanup(); }
});

test('caller abort only cancels waits and background workflows keep owned lifetimes', async () => {
  const entered = gate(); const release = gate(); let childSignal!: AbortSignal;
  const f = fixture(async (_request, signal) => { childSignal = signal; entered.resolve(); await release.promise; return response('done'); });
  const registry = f.make(); const caller = new AbortController();
  try {
    const run = registry.run({ tasks: [{ id: 'a', prompt: 'work' }] }, caller.signal);
    await entered.promise; const rejection = assert.rejects(run); caller.abort(); await rejection;
    assert.equal(childSignal.aborted, false);
    release.resolve();
    const event = registry.drainNotifications().events[0]!;
    assert.equal((await settled(registry, event.id)).status, 'completed');
  } finally { release.resolve(); await f.cleanup(); }
});

test('explore tasks have read-only tools and workflow controls are omitted from all children', async () => {
  const f = fixture(async request => {
    assert.deepEqual(request.tools?.map(tool => 'name' in tool ? tool.name : ''), ['read_file', 'list_files', 'search']); return response('done');
  });
  const registry = f.make();
  const controlled = new AgentRegistry({ source: f.config, provider: { count: async () => 0, complete: async request => {
    assert.equal(request.tools?.some(tool => 'name' in tool && tool.name.startsWith('workflow_')), false); return response('done');
  } }, tools: [...f.tools, ...createWorkflowTools(registry)] });
  try {
    assert.equal((await registry.run({ tasks: [{ id: 'a', prompt: 'inspect' }] })).status, 'completed');
    await controlled.launch({ prompt: 'work', mode: 'general' });
  } finally { await controlled.close(); await f.cleanup(); }
});

test('prompt/output/history/event/concurrent workflow bounds are explicit and UTF-8 safe', async () => {
  const f = fixture(async () => response('中🙂'.repeat(2000)));
  const registry = f.make({ limits: { maxHistory: 1, maxEvents: 1, maxSummaryBytes: 64, maxOutputBytes: 80 } });
  try {
    const one = await registry.run({ tasks: [{ id: 'a', prompt: 'one' }] });
    const two = await registry.run({ tasks: [{ id: 'a', prompt: 'two' }] });
    await assert.rejects(registry.get(one.id), /Unknown workflow/);
    assert.ok(Buffer.byteLength(two.tasks[0]!.summary) <= 64); assert.equal(two.tasks[0]!.summary.includes('�'), false);
    const events = registry.drainNotifications(); assert.equal(events.events.length, 1); assert.ok(events.dropped > 0);
    const context = { workspace: f.workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 75 };
    const output = await createWorkflowTools(registry)[1]!.execute({ id: two.id }, context);
    assert.ok(Buffer.byteLength(output) <= 75); assert.equal(output.includes('�'), false);
    const tiny = f.make({ limits: { maxPromptBytes: 10, maxTotalPromptBytes: 10 } });
    await assert.rejects(tiny.run({ tasks: [{ id: 'a', prompt: '12345678901' }] }), /prompt byte/);
    await assert.rejects(tiny.run({ tasks: [{ id: 'a', prompt: '123456' }, { id: 'b', prompt: '123456' }] }), /total prompt/);
    const contextBound = f.make({ limits: { maxPromptBytes: 10 } });
    const overflow = await contextBound.run({ tasks: [{ id: 'a', prompt: 'first' }, { id: 'b', prompt: 'second', depends_on: ['a'] }] });
    assert.equal(overflow.tasks[1]?.status, 'failed'); assert.match(overflow.tasks[1]!.error!, /context exceeds/);
  } finally { await f.cleanup(); }
});

test('owner workflow lookups and concurrency bounds isolate state', async () => {
  const entered = gate(); const release = gate();
  const f = fixture(async () => { entered.resolve(); await release.promise; return response('done'); });
  const registry = f.make({ limits: { maxRunning: 1 } }); const other = f.make();
  try {
    const first = await registry.run({ tasks: [{ id: 'a', prompt: 'hold' }], background: true }); await entered.promise;
    await assert.rejects(other.get(first.id), /Unknown/);
    await assert.rejects(registry.run({ tasks: [{ id: 'b', prompt: 'work' }] }), /concurrency/);
    release.resolve(); assert.equal((await settled(registry, first.id)).status, 'completed');
    const next = await registry.run({ tasks: [{ id: 'b', prompt: 'next' }] }); assert.equal(next.status, 'completed');
  } finally { release.resolve(); await f.cleanup(); }
});
