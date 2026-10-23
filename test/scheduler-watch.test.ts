import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { LocalScheduler, type SchedulerTimer } from '../src/scheduler.js';
import {
  readSchedulerLock, readStoredTasks, scheduledTasksPath, STORE_LOCK_RETRY_MS,
  writeStoredTasks, type StoredTask,
} from '../src/scheduler-store.js';

async function until(predicate: () => boolean | Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!await predicate()) {
    if (Date.now() >= deadline) throw new Error('Scheduler state did not settle');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

test('file replacement, unlink and recreation retain session jobs and stored metadata', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'scheduler-watch-')));
  let at = new Date(2024, 0, 1).getTime();
  const fired: string[] = [];
  const scheduler = new LocalScheduler({ timer: null, now: () => new Date(at),
    onPrompt: prompt => { fired.push(prompt); }, store: { workspace, sessionId: 'watch' } });
  t.after(async () => { await scheduler.close(); await fs.rm(workspace, { recursive: true, force: true }); });
  await scheduler.ensureAttached();
  const local = scheduler.create({ cron: '* * * * *', prompt: 'session' });
  const original: StoredTask = { id: '80000000', cron: '* * * * *', prompt: 'external',
    createdAt: at, recurring: true, permanent: true, lastFiredAt: at,
    createdBySessionId: 'prior', createdByPid: 99, createdByProcStart: 'birth', createdInProject: workspace };
  await writeStoredTasks(workspace, [original]);
  await until(() => scheduler.getJob(original.id)?.prompt === 'external');
  assert.equal(scheduler.getJob(local.id)?.prompt, 'session');
  const nextAt = scheduler.getJob(original.id)!.nextAt;
  await writeStoredTasks(workspace, [{ ...original, prompt: 'updated' }]);
  await until(() => scheduler.getJob(original.id)?.prompt === 'updated');
  assert.equal(scheduler.getJob(original.id)?.nextAt, nextAt);

  await fs.unlink(scheduledTasksPath(workspace));
  await until(() => scheduler.getJob(original.id) === null);
  assert.equal(scheduler.getJob(local.id)?.prompt, 'session');
  await writeStoredTasks(workspace, [{ ...original, prompt: 'recreated' }]);
  await until(() => scheduler.getJob(original.id)?.prompt === 'recreated');
  at += 60_000;
  scheduler.tick();
  await scheduler.flushStore();
  assert.deepEqual(fired, ['session', 'recreated']);
  assert.deepEqual((await readStoredTasks(workspace))[0], { ...original, prompt: 'recreated', lastFiredAt: at });
  const durable = scheduler.create({ cron: '* * * * *', prompt: 'new durable', durable: true });
  await scheduler.flushStore();
  assert.deepEqual((await readStoredTasks(workspace)).find(task => task.id === original.id),
    { ...original, prompt: 'recreated', lastFiredAt: at });
  scheduler.delete(durable.id);
  await scheduler.flushStore();
  assert.deepEqual((await readStoredTasks(workspace)).map(task => task.id), [original.id]);
  await scheduler.close();
  assert.equal(await readSchedulerLock(workspace), undefined);
});

test('a contended file lease retries without blocking local jobs and a closing attach releases its lock', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'scheduler-lease-')));
  let at = new Date(2024, 0, 1).getTime();
  const handlers = new Map<unknown, { run(): void; ms: number }>();
  const timer: SchedulerTimer = {
    setInterval(run, ms) { const handle = {}; handlers.set(handle, { run, ms }); return handle; },
    clearInterval(handle) { handlers.delete(handle); },
  };
  const first = new LocalScheduler({ timer: null, now: () => new Date(at), onPrompt() {},
    store: { workspace, sessionId: 'first' } });
  const secondFires: string[] = [];
  const second = new LocalScheduler({ timer, now: () => new Date(at),
    onPrompt: prompt => { secondFires.push(prompt); }, store: { workspace, sessionId: 'second' } });
  t.after(async () => {
    await Promise.all([first.close(), second.close()]);
    await fs.rm(workspace, { recursive: true, force: true });
  });
  await first.ensureAttached();
  await writeStoredTasks(workspace, [{ id: '80000000', cron: '* * * * *', prompt: 'file job',
    createdAt: at, recurring: true }]);
  await until(() => first.getJob('80000000') !== null);
  assert.equal(await second.ensureAttached(), false);
  second.create({ cron: '* * * * *', prompt: 'local job' });
  at += 60_000;
  second.tick();
  assert.deepEqual(secondFires, ['local job']);
  assert.equal(first.tick().length, 1);
  await first.flushStore();
  await first.close();
  const retry = [...handlers.values()].find(entry => entry.ms === STORE_LOCK_RETRY_MS);
  assert.ok(retry, 'the source five-second lease retry is armed');
  const readFile = fs.readFile;
  let releaseRead = () => {};
  const pausedRead = new Promise<void>(resolve => { releaseRead = resolve; });
  let readStarted = false;
  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
    if (String(args[0]) === scheduledTasksPath(workspace)) { readStarted = true; await pausedRead; }
    return readFile(...args);
  }) as typeof fs.readFile;
  try {
    retry.run();
    await until(() => readStarted && second.hasStoreLock());
    assert.deepEqual(second.tick(), [], 'a timer during acquisition cannot reuse the stale file stamp');
  } finally { releaseRead(); fs.readFile = readFile; }
  await second.flushStore();
  assert.deepEqual(secondFires, ['local job'], 'the holder already fired this file occurrence');
  at += 60_000;
  second.tick();
  await second.flushStore();
  assert.deepEqual(secondFires, ['local job', 'local job', 'file job']);
  assert.equal((await readSchedulerLock(workspace))?.sessionId, 'second');
  await second.close();
  assert.equal(handlers.size, 0);
  assert.equal(await readSchedulerLock(workspace), undefined);

  const closing = new LocalScheduler({ timer: null, onPrompt() { assert.fail('closed owner fired'); },
    store: { workspace, sessionId: 'closing' } });
  const attaching = closing.ensureAttached();
  await closing.close();
  assert.equal(await attaching, false);
  assert.equal(await readSchedulerLock(workspace), undefined);
});
