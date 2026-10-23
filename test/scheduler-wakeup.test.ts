import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';

import { Agent, defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import type { ModelProvider } from '../src/provider.js';
import { createRuntime, pinToolSchemas } from '../src/runtime.js';
import { createSchedulerTools, LocalScheduler } from '../src/scheduler.js';
import { Session } from '../src/session.js';
import type { TerminalCallbacks, TerminalSurface } from '../src/terminal.js';

const start = new Date(2026, 9, 24, 12, 0).getTime();

test('dynamic chains retain prompt age, expire, reset after the source grace and cancel independently of cron', async () => {
  let at = start;
  const scheduler = new LocalScheduler({ timer: null, now: () => new Date(at), onPrompt: () => {}, recurringMaxAgeMs: 120_000 });
  try {
    const cron = scheduler.create({ cron: '* * * * *', prompt: 'cron' });
    scheduler.scheduleWakeup(60, 'chain');
    at += 60_000;
    const fire = scheduler.tick().find(event => event.kind === 'wakeup')!;
    scheduler.finishWakeup(fire.id);
    scheduler.scheduleWakeup(60, 'chain', 'Continue');
    assert.equal(scheduler.getWakeup()!.chainStartedAt, start);
    assert.equal(scheduler.getWakeup()!.reason, 'Continue');
    at += 60_000;
    assert.deepEqual(scheduler.scheduleWakeup(60, 'chain'), { scheduledFor: 0, clampedDelaySeconds: 0, wasClamped: false });
    assert.equal(scheduler.getWakeup(), null);
    at += 60_000;
    assert.equal(scheduler.scheduleWakeup(60, 'chain').scheduledFor, 0, 'the grace boundary is strict');
    at++;
    assert.equal(scheduler.scheduleWakeup(60, 'chain').scheduledFor, at + 60_000);
    assert.equal(scheduler.getWakeup()!.chainStartedAt, at);
    assert.equal(scheduler.stop(), true);
    at += 120_000;
    scheduler.scheduleWakeup(60, 'chain');
    assert.equal(scheduler.getWakeup()!.chainStartedAt, at, 'stop forgets the cancelled chain');
    at += 60_000;
    const inFlight = scheduler.tick().find(event => event.kind === 'wakeup')!;
    assert.equal(scheduler.stop(), false, 'a delivered tick has no pending slot');
    at += 60_000;
    assert.ok(scheduler.scheduleWakeup(60, 'chain').scheduledFor > 0, 'stop also forgets the delivered prompt');
    assert.equal(scheduler.getWakeup()!.chainStartedAt, at);
    scheduler.finishWakeup(inFlight.id);
    assert.equal(scheduler.getJob(cron.id), null, 'the short recurring age also expires its cron after the final fire');
  } finally { await scheduler.close(); }

  const stale = new LocalScheduler({ timer: null, now: () => new Date(at), onPrompt: () => {}, recurringMaxAgeMs: 1 });
  try {
    stale.scheduleWakeup(60, '__proto__');
    at += 60_000 + 3_600_000 + 1;
    stale.scheduleWakeup(60, '__proto__');
    assert.equal(stale.getWakeup()!.chainStartedAt, at, 'an abandoned prompt starts a fresh chain after one hour past its deadline');
  } finally { await stale.close(); }

  const unlimited = new LocalScheduler({ timer: null, now: () => new Date(at), onPrompt: () => {}, recurringMaxAgeMs: 0 });
  try {
    unlimited.scheduleWakeup(3600, 'unlimited');
    for (let hour = 0; hour < 169; hour++) {
      at += 3_600_000;
      assert.ok(unlimited.scheduleWakeup(3600, 'unlimited').scheduledFor > 0);
    }
  } finally { await unlimited.close(); }
});

test('dynamic tool fields and stop results work through runtime while old pinned schemas reopen unchanged', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'wakeup-runtime-')));
  let at = start;
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  config.features = { tasks: false, subagents: false, scheduler: true };
  const controller = new AbortController();
  const provider: ModelProvider = { count: async () => 1, complete: async () => { throw new Error('Unexpected provider'); } };
  const runtime = await createRuntime(config, provider, controller.signal, { scheduler: { now: () => new Date(at), timer: null } });
  t.after(async () => { await runtime.close(); await fs.rm(workspace, { recursive: true, force: true }); });
  const context = { workspace, allowShell: false, maxOutputBytes: 24_000, signal: controller.signal };
  const tools = runtime.buildTools(config, 'one');
  const wakeup = tools.find(tool => tool.schema.name === 'schedule_wakeup')!;
  const cron = tools.find(tool => tool.schema.name === 'cron_create')!;
  const input = { delaySeconds: 60, prompt: '/loop fixture', reason: 'Await fixture', noop: false };
  await assert.rejects(wakeup.execute({ delaySeconds: 60, prompt: '/loop fixture' }, context), /reason and noop/);
  await wakeup.execute(input, context);
  await cron.execute({ cron: '* * * * *', prompt: 'cron', recurring: false }, context);
  at += 60_000;
  runtime.checkScheduler!('one');
  runtime.cancelLoopWakeup!('one');
  assert.deepEqual(runtime.drainEvents!('one').map(event => event.prompt), ['cron']);
  assert.equal(runtime.pendingLoopWakeup!('one'), false);
  assert.deepEqual(JSON.parse(await wakeup.execute({ stop: true, noop: 'ignored' }, context)),
    { scheduledFor: 0, clampedDelaySeconds: 0, wasClamped: false, stopped: true, cancelledWakeups: 0 });
  await wakeup.execute(input, context);
  assert.equal(JSON.parse(await wakeup.execute({ stop: true }, context)).cancelledWakeups, 1);
  assert.equal(runtime.pendingLoopWakeup!('one'), false);
  const other = runtime.buildTools(config, 'two').find(tool => tool.schema.name === 'schedule_wakeup')!;
  await other.execute(input, context);
  runtime.cancelLoopWakeup!('one');
  assert.equal(runtime.pendingLoopWakeup!('two'), true);

  const legacyScheduler = new LocalScheduler({ timer: null, onPrompt: () => {} });
  const legacy = createSchedulerTools(legacyScheduler, { legacyWakeup: true }).schedule_wakeup;
  const originalTools = tools.map(tool => tool.schema.name === 'schedule_wakeup'
    ? { ...tool, schema: { name: legacy.name, description: legacy.description, input_schema: { ...legacy.input_schema } } } : tool);
  config.tools = pinToolSchemas(originalTools);
  const session = Session.open(workspace, { config });
  const id = session.id; session.close();
  const resumed = Session.open(workspace, { id });
  try {
    const rebuilt = runtime.buildTools(resumed.config, id);
    assert.deepEqual(pinToolSchemas(rebuilt), resumed.config.tools);
    assert.doesNotThrow(() => new Agent(resumed, provider, rebuilt));
    const old = rebuilt.find(tool => tool.schema.name === 'schedule_wakeup')!;
    assert.ok(JSON.parse(await old.execute({ delaySeconds: 60, prompt: 'legacy' }, context)).scheduledFor > 0);
  } finally { resumed.close(); await legacyScheduler.close(); }
});

test('interactive interruption clears a model-armed wakeup and the delivered prompt chain', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'wakeup-interrupt-')));
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  config.features = { tasks: false, subagents: false, scheduler: true };
  const controller = new AbortController();
  const input = new PassThrough();
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  let callbacks: TerminalCallbacks | undefined;
  const usage = { input_tokens: 1, output_tokens: 1, cache_creation: null, cache_creation_input_tokens: null,
    cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null };
  let at = start, requests = 0;
  let wakeTool: ReturnType<typeof runtime.buildTools>[number];
  const arm = { delaySeconds: 60, prompt: 'dynamic interruption fixture', reason: 'Wait for the fixture', noop: false };
  const context = { workspace, allowShell: false, maxOutputBytes: 24_000, signal: controller.signal };
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: output,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { callbacks!.onSubmit!('arm fixture'); }, close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
  };
  const provider: ModelProvider = { count: async () => 1, complete: async (_request, signal) => {
    requests++;
    if (requests === 1) return { id: 'arm', type: 'message', role: 'assistant', model: 'fixture',
      content: [{ type: 'tool_use', id: 'arm-wakeup', name: 'schedule_wakeup', input: arm, caller: { type: 'direct' } }],
      stop_reason: 'tool_use', stop_sequence: null, container: null, diagnostics: null, stop_details: null, usage };
    if (requests === 2) {
      setImmediate(() => { at += 60_000; runtime.checkScheduler!(session.id); });
      return { id: 'ready', type: 'message', role: 'assistant', model: 'fixture', content: [{ type: 'text', text: 'armed', citations: null }],
        stop_reason: 'end_turn', stop_sequence: null, container: null, diagnostics: null, stop_details: null, usage };
    }
    assert.equal(requests, 3);
    await wakeTool.execute(arm, context);
    assert.equal(runtime.pendingLoopWakeup!(session.id), true);
    const aborted = new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
    callbacks!.onInterrupt!();
    assert.equal(runtime.pendingLoopWakeup!(session.id), false);
    await aborted;
    at += 60_000;
    runtime.checkScheduler!(session.id);
    assert.deepEqual(runtime.drainEvents!(session.id), []);
    setImmediate(() => callbacks?.onExit?.());
    throw signal.reason;
  } };
  const runtime = await createRuntime(config, provider, controller.signal,
    { scheduler: { now: () => new Date(at), timer: null } });
  config.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(workspace, { config });
  wakeTool = runtime.buildTools(session.config, session.id).find(tool => tool.schema.name === 'schedule_wakeup')!;
  t.after(async () => { session.close(); await runtime.close(); input.destroy(); await fs.rm(workspace, { recursive: true, force: true }); });
  await interactiveLoop(session, provider, runtime, { input, output, status: output, terminal, signal: controller.signal });
  assert.equal(requests, 3);

  const queuedConfig = defaultConfig(workspace, []); queuedConfig.model = 'fixture';
  queuedConfig.features = { tasks: false, subagents: false, scheduler: true };
  const queuedInput = new PassThrough();
  let queuedCallbacks: TerminalCallbacks | undefined;
  let queuedAt = start, count = 0;
  const dispatches: string[] = [];
  const response: ModelProvider['complete'] = async request => {
    count++;
    const content = request.messages.at(-1)!.content;
    if (typeof content === 'string') dispatches.push(content);
    const finish = () => ({ id: `queued-${count}`, type: 'message' as const, role: 'assistant' as const, model: 'fixture',
      content: [{ type: 'text' as const, text: 'done', citations: null }], stop_reason: 'end_turn' as const,
      stop_sequence: null, container: null, diagnostics: null, stop_details: null, usage });
    const use = (value: unknown) => ({ ...finish(), stop_reason: 'tool_use' as const,
      content: [{ type: 'tool_use' as const, id: `queued-tool-${count}`, name: 'schedule_wakeup', input: value, caller: { type: 'direct' as const } }] });
    if (count === 1) return use({ ...arm, prompt: 'dynamic A' });
    if (count === 2) { queuedCallbacks!.onSubmit!('arm B'); queuedAt += 60_000; return finish(); }
    if (count === 3) return use({ ...arm, prompt: 'dynamic B' });
    if (count === 4) { queuedCallbacks!.onSubmit!('restart A'); queuedAt += 60_000; return finish(); }
    if (count === 5) return use({ stop: true });
    if (count === 6 || count === 8) {
      assert.ok(Array.isArray(content));
      const result = content.find(block => block.type === 'tool_result');
      assert.ok(result && result.type === 'tool_result' && typeof result.content === 'string');
      const data = JSON.parse(result.content);
      if (count === 6) assert.equal(data.stopped, true);
      else assert.equal(data.scheduledFor, start + 180_000, 'stop forgets active A even after B has fired');
      return finish();
    }
    if (count === 7) return use({ ...arm, prompt: 'dynamic A' });
    assert.fail('a queued dynamic B survived model stop');
  };
  const queuedProvider: ModelProvider = { count: async () => 1, complete: response };
  const queuedTerminal: TerminalSurface = { isTTY: true, outputStream: output,
    subscribe(value) { queuedCallbacks = value; return () => { queuedCallbacks = undefined; }; },
    start() { queuedCallbacks!.onSubmit!('arm A'); }, close() {}, setKeybindings() {}, writeTerminalSequence() {},
    setRunning(running) { if (!running && count === 8) queueMicrotask(() => queuedCallbacks?.onExit?.()); } };
  const queuedRuntime = await createRuntime(queuedConfig, queuedProvider, controller.signal,
    { scheduler: { now: () => new Date(queuedAt), timer: null, recurringMaxAgeMs: 120_000 } });
  queuedConfig.tools = pinToolSchemas(queuedRuntime.tools);
  const queuedSession = Session.open(workspace, { config: queuedConfig });
  t.after(async () => { queuedSession.close(); await queuedRuntime.close(); queuedInput.destroy(); });
  await interactiveLoop(queuedSession, queuedProvider, queuedRuntime,
    { input: queuedInput, output, status: output, terminal: queuedTerminal, signal: controller.signal });
  assert.equal(count, 8);
  assert.deepEqual(dispatches, ['arm A', 'arm B', 'dynamic A', 'restart A']);
});
