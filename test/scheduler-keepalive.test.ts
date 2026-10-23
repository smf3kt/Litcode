import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';

import { defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import { AUTONOMOUS_LOOP_DYNAMIC_SENTINEL } from '../src/loop-file.js';
import type { ModelProvider } from '../src/provider.js';
import { createRuntime, pinToolSchemas } from '../src/runtime.js';
import { LocalScheduler, loopKeepaliveEnabled } from '../src/scheduler.js';
import { Session } from '../src/session.js';
import type { TerminalCallbacks, TerminalSurface } from '../src/terminal.js';

const start = new Date(2024, 0, 1, 12, 0).getTime();

test('a dispatched idle tick gets one source fallback and an explicit schedule resets the budget', async () => {
  let at = start;
  const scheduler = new LocalScheduler({ timer: null, now: () => new Date(at), keepalive: () => true, onPrompt: () => {} });
  const dispatch = () => {
    at = Math.ceil(scheduler.getWakeup()!.nextAt);
    const event = scheduler.tick().find(item => item.kind === 'wakeup')!;
    assert.equal(scheduler.beginWakeup(event.id), true);
    return event.id;
  };
  try {
    const cron = scheduler.create({ cron: '* * * * *', prompt: 'independent cron' });
    scheduler.scheduleWakeup(60, '__proto__');
    const first = dispatch();
    scheduler.finishWakeup(first);
    const fallback = scheduler.getWakeup()!;
    assert.equal(fallback.prompt, '__proto__');
    assert.equal(fallback.scheduledFor, start + 1_260_000);
    assert.equal(fallback.chainStartedAt, start);
    assert.equal(fallback.keepalive, true);
    scheduler.finishWakeup(first);
    assert.equal(scheduler.getWakeup()!.id, fallback.id, 'repeated completion keeps the one fallback');
    const second = dispatch();
    scheduler.finishWakeup(second);
    assert.equal(scheduler.getWakeup(), null, 'the second missing rearm exhausts the budget');
    assert.ok(scheduler.getJob(cron.id));

    scheduler.scheduleWakeup(60, 'reset');
    scheduler.finishWakeup(dispatch());
    const reset = dispatch();
    scheduler.scheduleWakeup(60, 'reset', 'Explicit model rearm');
    const explicit = scheduler.getWakeup()!;
    scheduler.finishWakeup(reset);
    assert.equal(scheduler.getWakeup()!.id, explicit.id);
    assert.equal(explicit.keepalive, undefined);
    scheduler.finishWakeup(dispatch());
    assert.equal(scheduler.getWakeup()!.keepalive, true, 'explicit scheduling resets the consecutive fallback budget');
  } finally { await scheduler.close(); }
});

test('keepalive gating, cancellation, identity, age and cleanup retain their owners', async () => {
  for (const value of ['1', 'true', 'YES', ' on ', '', 'invalid']) assert.equal(loopKeepaliveEnabled(value), true);
  for (const value of ['0', 'false', 'NO', ' off ']) assert.equal(loopKeepaliveEnabled(value), false);
  let at = start, enabled = false;
  const scheduler = new LocalScheduler({ timer: null, now: () => new Date(at), keepalive: () => enabled, onPrompt: () => {} });
  const dispatch = () => {
    at = scheduler.getWakeup()!.nextAt;
    const event = scheduler.tick()[0]!;
    assert.equal(scheduler.beginWakeup(event.id), true);
    return event.id;
  };
  try {
    scheduler.scheduleWakeup(60, 'disabled');
    scheduler.finishWakeup(dispatch());
    assert.equal(scheduler.getWakeup(), null);
    enabled = true;
    scheduler.scheduleWakeup(60, 'cancelled');
    const cancelled = dispatch();
    assert.equal(scheduler.stop(), false);
    scheduler.finishWakeup(cancelled);
    assert.equal(scheduler.getWakeup(), null);
    scheduler.scheduleWakeup(60, 'queued only');
    at = scheduler.getWakeup()!.nextAt;
    const queued = scheduler.tick()[0]!;
    scheduler.finishWakeup(queued.id);
    assert.equal(scheduler.getWakeup(), null, 'an undispatched queue entry never earns a fallback');
    scheduler.scheduleWakeup(60, 'old');
    const old = dispatch();
    scheduler.scheduleWakeup(60, 'new');
    const current = dispatch();
    scheduler.finishWakeup(old);
    assert.equal(scheduler.getWakeup(), null, 'a stale completion cannot retire the current tick');
    scheduler.finishWakeup(current);
    assert.equal(scheduler.getWakeup()!.prompt, 'new');
    await scheduler.close();
    scheduler.finishWakeup(current);
    assert.equal(scheduler.getWakeup(), null);
  } finally { await scheduler.close(); }

  at = start;
  const aged = new LocalScheduler({ timer: null, recurringMaxAgeMs: 60_000, now: () => new Date(at), keepalive: () => true, onPrompt: () => {} });
  try {
    aged.scheduleWakeup(60, 'aged');
    at += 60_000;
    const event = aged.tick()[0]!;
    aged.beginWakeup(event.id);
    aged.finishWakeup(event.id);
    assert.equal(aged.getWakeup(), null, 'fallback passes through the original chain-age gate');
  } finally { await aged.close(); }
});

test('interactive idle fallback preserves the sentinel, stops at its budget and releases the session', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'keepalive-interactive-')));
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  config.features = { tasks: false, subagents: false, scheduler: true };
  const controller = new AbortController(), input = new PassThrough();
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  let callbacks: TerminalCallbacks | undefined, at = start, calls = 0, completed = 0;
  const dispatches: string[] = [];
  const usage = { input_tokens: 1, output_tokens: 1, cache_creation: null, cache_creation_input_tokens: null,
    cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null };
  const provider: ModelProvider = { count: async () => 1, complete: async request => {
    calls++;
    const content = request.messages.at(-1)!.content;
    if (typeof content === 'string') dispatches.push(content);
    const response = { id: `keepalive-${calls}`, type: 'message' as const, role: 'assistant' as const, model: 'fixture',
      stop_sequence: null, container: null, diagnostics: null, stop_details: null, usage };
    if (calls === 1) return { ...response, stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'keepalive-arm', name: 'schedule_wakeup', caller: { type: 'direct' },
        input: { delaySeconds: 60, prompt: AUTONOMOUS_LOOP_DYNAMIC_SENTINEL, reason: 'Await local fixture', noop: false } }] };
    return { ...response, stop_reason: 'end_turn', content: [{ type: 'text', text: 'done', citations: null }] };
  } };
  const runtime = await createRuntime(config, provider, controller.signal,
    { scheduler: { timer: null, now: () => new Date(at) } });
  config.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(workspace, { config });
  const terminal: TerminalSurface = { isTTY: true, outputStream: output,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { callbacks!.onSubmit!('arm local loop'); }, close() {}, setKeybindings() {}, writeTerminalSequence() {},
    setRunning(running) {
      if (running || calls === 0) return;
      completed++;
      setImmediate(() => {
        if (completed === 1) {
          at += 60_000; runtime.checkScheduler!(session.id);
        } else if (completed === 2) {
          assert.equal(runtime.pendingLoopWakeup!(session.id), true);
          at += 1_200_000; runtime.checkScheduler!(session.id);
        } else {
          assert.equal(runtime.pendingLoopWakeup!(session.id), false);
          callbacks?.onExit?.();
        }
      });
    } };
  t.after(async () => { session.close(); await runtime.close(); input.destroy(); await fs.rm(workspace, { recursive: true, force: true }); });
  await interactiveLoop(session, provider, runtime, { input, output, status: output, terminal, signal: controller.signal });
  assert.equal(calls, 4);
  assert.equal(completed, 3);
  assert.equal(dispatches.length, 3);
  assert.match(dispatches[1]!, /You scheduled this tick via the schedule_wakeup tool/);
  assert.match(dispatches[2]!, /You scheduled this tick via the schedule_wakeup tool/);
  assert.equal(runtime.pendingLoopWakeup!(session.id), false);
  assert.equal((await fs.readdir(path.join(workspace, '.agent'))).some(name => name.endsWith('.lock')), false);
});
