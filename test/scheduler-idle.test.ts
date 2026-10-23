import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { Agent, defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import { createRuntime } from '../src/runtime.js';
import { LocalScheduler } from '../src/scheduler.js';
import { readStoredTasks } from '../src/scheduler-store.js';

const start = new Date(2026, 9, 24, 12, 0).getTime();

test('loading preserves due tasks and disk state until idle, with the source assistant exception', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'scheduler-idle-')));
  let at = start, loading = false;
  const prompts: string[] = [];
  const scheduler = new LocalScheduler({ timer: null, now: () => new Date(at), isLoading: () => loading,
    onPrompt: prompt => { prompts.push(prompt); }, store: { workspace, sessionId: 'idle-owner' } });
  t.after(async () => { await scheduler.close(); await fs.rm(workspace, { recursive: true, force: true }); });
  await scheduler.ensureAttached();
  const recurring = scheduler.create({ cron: '* * * * *', prompt: 'recurring', durable: true });
  const once = scheduler.create({ cron: '* * * * *', prompt: 'one shot', recurring: false, durable: true });
  scheduler.scheduleWakeup(60, 'dynamic');
  await scheduler.flushStore();
  const initialTasks = await readStoredTasks(workspace);
  loading = true;
  for (const minute of [1, 2, 3]) {
    at = start + minute * 60_000;
    assert.deepEqual(scheduler.tick(), []);
  }
  await scheduler.flushStore();
  assert.deepEqual(prompts, []);
  assert.equal(scheduler.getJob(recurring.id)!.nextAt, start + 60_000);
  assert.equal(scheduler.getJob(once.id)!.nextAt, start + 60_000);
  assert.equal(scheduler.getWakeup()!.scheduledFor, start + 60_000);
  assert.deepEqual(await readStoredTasks(workspace), initialTasks);
  loading = false;
  assert.equal(scheduler.tick().length, 3);
  await scheduler.flushStore();
  assert.deepEqual([...prompts].sort(), ['dynamic', 'one shot', 'recurring']);
  assert.equal(scheduler.getJob(recurring.id)!.nextAt, start + 4 * 60_000);
  assert.equal(scheduler.getJob(once.id), null);
  assert.equal(scheduler.getWakeup(), null);
  assert.deepEqual((await readStoredTasks(workspace)).map(task => [task.id, task.lastFiredAt]), [[recurring.id, at]]);
  assert.deepEqual(scheduler.tick(), []);

  const assistantPrompts: string[] = [];
  const assistant = new LocalScheduler({ timer: null, now: () => new Date(at), isLoading: () => true,
    assistantMode: true, onPrompt: prompt => { assistantPrompts.push(prompt); } });
  const assistantJob = assistant.create({ cron: '* * * * *', prompt: 'assistant' });
  at = assistantJob.nextAt;
  assert.equal(assistant.tick().length, 1);
  assert.deepEqual(assistantPrompts, ['assistant']);
  await assistant.close();
});

test('runtime loading readers follow the active owner and checks stay passive after release', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'runtime-idle-')));
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  config.features = { tasks: false, subagents: false, scheduler: true };
  let at = start, loading = true, starts = 0;
  const timers = new Set<() => void>();
  const controller = new AbortController();
  const runtime = await createRuntime(config, { count: async () => 1,
    complete: async () => { throw new Error('Unexpected provider call'); } }, controller.signal, {
    scheduler: { now: () => new Date(at), timer: {
      setInterval(handler) { starts++; timers.add(handler); return handler; },
      clearInterval(handle) { timers.delete(handle as () => void); },
    } },
  });
  t.after(async () => { await runtime.close(); await fs.rm(workspace, { recursive: true, force: true }); });
  runtime.bindSchedulerLoading!('one', () => loading);
  await runtime.settleScheduler!('one');
  runtime.checkScheduler!('one');
  assert.equal(starts, 0, 'binding and idle checks do not allocate a session-only scheduler');
  const tool = runtime.buildTools(config, 'one').find(tool => tool.schema.name === 'cron_create')!;
  const context = { workspace, allowShell: false, maxOutputBytes: 24_000, signal: controller.signal };
  await tool.execute({ cron: '* * * * *', prompt: 'one', recurring: false }, context);
  at += 60_000;
  runtime.checkScheduler!('one');
  assert.deepEqual(runtime.drainEvents!('one'), []);
  loading = false;
  runtime.checkScheduler!('one');
  assert.deepEqual(runtime.drainEvents!('one').map(event => event.prompt), ['one']);
  await runtime.releaseSession!('one');
  assert.equal(timers.size, 0);
  runtime.checkScheduler!('one');
  assert.equal(starts, 1, 'checking the released owner does not recreate it');
  runtime.buildTools(config, 'one');
  await runtime.settleScheduler!('one');
  const next = runtime.buildTools(config, 'one').find(tool => tool.schema.name === 'cron_create')!;
  loading = true;
  await next.execute({ cron: '* * * * *', prompt: 'fresh owner', recurring: false }, context);
  at += 60_000;
  runtime.checkScheduler!('one');
  assert.deepEqual(runtime.drainEvents!('one').map(event => event.prompt), ['fresh owner'], 'the released loading reader stays detached');
});

test('the Agent loading reader resets after provider failure and abort', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'agent-idle-')));
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  const session = Session.open(workspace, { config });
  t.after(async () => { session.close(); await fs.rm(workspace, { recursive: true, force: true }); });
  let at = start;
  const prompts: string[] = [];
  let fail = true, entered = () => {}, cancel = () => {};
  const reachedProvider = new Promise<void>(resolve => { entered = resolve; });
  const agent = new Agent(session, { count: async () => 1, complete: async (_request, signal) => {
    assert.equal(agent.isRunning(), true);
    at += 60_000;
    assert.deepEqual(scheduler.tick(), []);
    if (fail) throw new Error('fixture provider failure');
    entered();
    await new Promise<void>((_resolve, reject) => {
      cancel = () => reject(new Error('fixture abort'));
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    });
    throw new Error('Unreachable fixture response');
  } }, []);
  const scheduler = new LocalScheduler({ timer: null, now: () => new Date(at),
    isLoading: () => agent.isRunning(), onPrompt: prompt => { prompts.push(prompt); } });
  t.after(() => scheduler.close());
  scheduler.create({ cron: '* * * * *', prompt: 'after failure', recurring: false });
  await assert.rejects(agent.run('fail turn'), /fixture provider failure/);
  assert.equal(agent.isRunning(), false);
  assert.equal(scheduler.tick().length, 1);
  assert.deepEqual(prompts, ['after failure']);
  session.append({ kind: 'turn_end', reason: 'fixture_recovery' });
  fail = false;
  scheduler.create({ cron: '* * * * *', prompt: 'after abort', recurring: false });
  const controller = new AbortController();
  const running = agent.run('cancel turn', controller.signal);
  await reachedProvider;
  assert.equal(agent.isRunning(), true);
  controller.abort();
  assert.equal((await running).reason, 'aborted');
  assert.equal(agent.isRunning(), false);
  assert.equal(scheduler.tick().length, 1);
  assert.deepEqual(prompts, ['after failure', 'after abort']);
});
