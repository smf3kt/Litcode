import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { Agent, defaultConfig } from '../src/agent.js';
import { drainHeadlessWakeups, headlessWakeupPending } from '../src/headless-wakeup.js';
import { AUTONOMOUS_LOOP_DYNAMIC_SENTINEL } from '../src/loop-file.js';
import type { ModelProvider } from '../src/provider.js';
import { createRuntime, pinToolSchemas } from '../src/runtime.js';
import { Session } from '../src/session.js';

const start = new Date(2024, 0, 1, 12).getTime();
const usage = { input_tokens: 1, output_tokens: 1, cache_creation: null, cache_creation_input_tokens: null,
  cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null };
const unused: ModelProvider = { count: async () => 1, complete: async () => { throw new Error('Unexpected model call'); } };

test('headless pending wakeup uses the source inclusive parked-time grace and excludes missing tasks', () => {
  assert.equal(headlessWakeupPending(null, start, null), false);
  assert.equal(headlessWakeupPending({}, start + 1_000_000, start), true);
  assert.equal(headlessWakeupPending({ scheduledFor: start + 60_000 }, start + 180_000, start), true);
  assert.equal(headlessWakeupPending({ scheduledFor: start + 60_000 }, start + 180_001, start), false);
  assert.equal(headlessWakeupPending({ scheduledFor: start - 1_000_000 }, start + 120_000, start), true);
  assert.equal(headlessWakeupPending({ scheduledFor: start - 1_000_000 }, start + 120_001, start), false);
});

test('headless owner filters cron and file leasing while retaining dynamic claim, isolation and release', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'headless-owner-')));
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  config.features = { tasks: false, subagents: false, scheduler: true, schedulerDurable: true };
  const controller = new AbortController(); let at = start, busy = false;
  const runtime = await createRuntime(config, unused, controller.signal,
    { scheduler: { timer: null, now: () => new Date(at) } });
  t.after(async () => { await runtime.close(); await fs.rm(workspace, { recursive: true, force: true }); });
  runtime.bindHeadlessScheduler!('headless', () => busy);
  const tools = runtime.buildTools(config, 'headless');
  const context = { workspace, allowShell: false, maxOutputBytes: 24_000, signal: controller.signal };
  const tool = (name: string) => tools.find(candidate => candidate.schema.name === name)!;
  await tool('cron_create').execute({ cron: '* * * * *', prompt: 'retain ordinary cron', recurring: false, durable: true }, context);
  await tool('schedule_wakeup').execute({ delaySeconds: 60, prompt: 'dynamic only', reason: 'Wait', noop: false }, context);
  assert.equal((await fs.readdir(path.join(workspace, '.harness'))).includes('scheduled_tasks.lock'), false);
  const before = await fs.readFile(path.join(workspace, '.harness/scheduled_tasks.json'), 'utf8');
  busy = true; at += 60_000;
  runtime.checkScheduler!('headless');
  assert.equal(runtime.drainLoopWakeups!('headless').length, 0);
  busy = false; runtime.checkScheduler!('headless');
  const events = runtime.drainLoopWakeups!('headless');
  assert.equal(events.length, 1); assert.equal(events[0]!.prompt, 'dynamic only');
  assert.equal(runtime.beginLoopWakeup!('headless', events[0]!.id), true);
  runtime.finishLoopWakeup!('headless', events[0]!.id);
  assert.equal(runtime.pendingLoopWakeup!('headless'), false, 'headless omits the interactive fallback');
  assert.equal(await fs.readFile(path.join(workspace, '.harness/scheduled_tasks.json'), 'utf8'), before);
  assert.deepEqual(runtime.drainEvents!('headless'), []);
  const other = runtime.buildTools(config, 'interactive').find(candidate => candidate.schema.name === 'schedule_wakeup')!;
  await other.execute({ delaySeconds: 60, prompt: 'other owner', reason: 'Wait', noop: false }, context);
  assert.equal((await fs.readdir(path.join(workspace, '.harness'))).includes('scheduled_tasks.lock'), true);
  runtime.bindHeadlessScheduler!('interactive', () => true);
  runtime.checkScheduler!('interactive');
  const list = runtime.buildTools(config, 'interactive').find(candidate => candidate.schema.name === 'cron_list')!;
  await list.execute({}, context);
  assert.equal((await fs.readdir(path.join(workspace, '.harness'))).includes('scheduled_tasks.lock'), false,
    'an existing lease releases before the loading guard after input closes');
  assert.equal(await fs.readFile(path.join(workspace, '.harness/scheduled_tasks.json'), 'utf8'), before);
  await runtime.releaseSession!('headless');
  assert.equal(runtime.loopWakeup!('headless'), null);
  assert.equal(runtime.pendingLoopWakeup!('interactive'), true);
  runtime.checkScheduler!('headless');
  assert.deepEqual(runtime.drainLoopWakeups!('headless'), []);
});

test('headless drain runs the same Agent through rearm and stop, resolves sentinels and respects cancellation and budget', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'headless-loop-')));
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  config.features = { tasks: false, subagents: false, scheduler: true };
  const controller = new AbortController(); let at = start, calls = 0, notices = 0;
  const prompts: string[] = [];
  const provider: ModelProvider = { count: async () => 1, complete: async request => {
    calls++;
    const content = request.messages.at(-1)!.content;
    if (typeof content === 'string') prompts.push(content);
    const message = { id: `headless-${calls}`, type: 'message' as const, role: 'assistant' as const, model: 'fixture',
      stop_sequence: null, container: null, diagnostics: null, stop_details: null, usage };
    if (calls === 1 || calls === 3) return { ...message, stop_reason: 'tool_use', content: [{ type: 'tool_use',
      id: `arm-${calls}`, name: 'schedule_wakeup', caller: { type: 'direct' },
      input: { delaySeconds: 60, prompt: AUTONOMOUS_LOOP_DYNAMIC_SENTINEL, reason: 'Wait', noop: false } }] };
    if (calls === 5) return { ...message, stop_reason: 'tool_use', content: [{ type: 'tool_use',
      id: 'stop', name: 'schedule_wakeup', caller: { type: 'direct' }, input: { stop: true } }] };
    return { ...message, stop_reason: 'end_turn', content: [{ type: 'text', text: `done-${calls}`, citations: null }] };
  } };
  const runtime = await createRuntime(config, provider, controller.signal,
    { scheduler: { timer: null, now: () => new Date(at) } });
  config.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(workspace, { config });
  const agent = new Agent(session, provider, runtime.buildTools(session.config, session.id));
  runtime.bindHeadlessScheduler!(session.id, () => agent.isRunning());
  t.after(async () => { session.close(); await runtime.close(); await fs.rm(workspace, { recursive: true, force: true }); });
  const result = await agent.run('arm fixture', controller.signal);
  const final = await drainHeadlessWakeups({ runtime, owner: session.id, agent, result, signal: controller.signal,
    budgetExhausted: () => false, now: () => at, onWait: () => { notices++; }, wait: async () => { at += 5000; } });
  assert.equal(final.modelCalls, 6); assert.equal(final.text, 'done-6');
  assert.equal(prompts.length, 3); assert.match(prompts[1]!, /You scheduled this tick/); assert.match(prompts[2]!, /You scheduled this tick/);
  assert.equal(notices, 2); assert.equal(runtime.pendingLoopWakeup!(session.id), false);

  const wakeup = runtime.buildTools(session.config, session.id).find(tool => tool.schema.name === 'schedule_wakeup')!;
  const context = { workspace, allowShell: false, maxOutputBytes: 24_000, signal: controller.signal };
  await wakeup.execute({ delaySeconds: 60, prompt: 'budget pending', reason: 'Wait', noop: false }, context);
  let waits = 0;
  await drainHeadlessWakeups({ runtime, owner: session.id, agent, result: final, signal: controller.signal,
    budgetExhausted: () => true, now: () => at, wait: async () => { waits++; } });
  assert.equal(waits, 0); assert.equal(calls, 6);
  const stopped = new AbortController();
  await assert.rejects(drainHeadlessWakeups({ runtime, owner: session.id, agent, result: final, signal: stopped.signal,
    budgetExhausted: () => false, now: () => at, wait: async () => { stopped.abort(new Error('fixture interruption')); } }), /fixture interruption/);
  assert.equal(calls, 6);
});
