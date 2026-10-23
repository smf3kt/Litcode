import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { LocalScheduler } from '../src/scheduler.js';
import { readSchedulerLock, readStoredTasks, writeStoredTasks } from '../src/scheduler-store.js';

const fallback = 'scheduled task handler threw (message not reported: it may contain user text)';
const temporaryRoot = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();

async function until(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'the store reload settles');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

test('failed durable one-shots retain rows for every diagnostic shape and suppress reload retries', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(temporaryRoot, 'scheduler-delivery-')));
  let at = new Date(2024, 0, 1).getTime();
  const failures: unknown[] = [new Error(''), '', undefined, { toString: () => '' },
    Object.defineProperty(new Error('hidden'), 'message', { get() { throw new Error('message getter'); } }),
    { [Symbol.toPrimitive]() { throw new Error('conversion'); } }];
  const attempts: string[] = [];
  const scheduler = new LocalScheduler({ timer: null, now: () => new Date(at),
    store: { workspace, sessionId: 'delivery' }, onPrompt(prompt) {
      attempts.push(prompt);
      if (prompt.startsWith('failure-')) throw failures[Number(prompt.slice(8))];
    } });
  t.after(async () => { await scheduler.close(); await fs.rm(workspace, { recursive: true, force: true }); });
  assert.equal(await scheduler.ensureAttached(), true);
  const jobs = failures.map((_, index) => scheduler.create({ cron: '* * * * *',
    prompt: `failure-${index}`, recurring: false, durable: true }));
  scheduler.create({ cron: '* * * * *', prompt: 'successful sibling', recurring: false, durable: true });
  await scheduler.flushStore();
  const retained = (await readStoredTasks(workspace)).filter(task => task.prompt.startsWith('failure-'));

  at += 60_000;
  const events = scheduler.tick();
  await scheduler.flushStore();
  assert.deepEqual(events.map(event => event.callbackError), ['', '', 'undefined', '', fallback, fallback, undefined]);
  assert.deepEqual(attempts, [...jobs.map(job => job.prompt), 'successful sibling']);
  assert.deepEqual(await readStoredTasks(workspace), retained);
  assert.deepEqual(scheduler.tick(), []);
  assert.deepEqual(scheduler.list(), []);

  const changed = retained.map(task => ({ ...task, permanent: true }));
  await writeStoredTasks(workspace, [...changed,
    { id: 'reload-seen', cron: '* * * * *', prompt: 'reload sentinel', createdAt: at }]);
  await until(() => scheduler.getJob('reload-seen') !== null);
  for (const job of jobs) assert.equal(scheduler.getJob(job.id), null);
  at += 60_000;
  assert.deepEqual(scheduler.tick().map(event => event.prompt), ['reload sentinel']);
  await scheduler.flushStore();
  assert.deepEqual(attempts, [...jobs.map(job => job.prompt), 'successful sibling', 'reload sentinel']);
  assert.deepEqual(await readStoredTasks(workspace), changed);
  await scheduler.close();
  assert.equal(await readSchedulerLock(workspace), undefined);
});

test('delivery errors consume local and dynamic occurrences but stamp recurring and remove final fires', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(temporaryRoot, 'scheduler-categories-')));
  const start = new Date(2024, 0, 1).getTime();
  let at = start;
  await writeStoredTasks(workspace, [
    { id: 'permanent', cron: '* * * * *', prompt: 'permanent', createdAt: at, recurring: true, permanent: true },
    { id: 'expiring', cron: '* * * * *', prompt: 'expiring', createdAt: at, recurring: true },
  ]);
  const scheduler = new LocalScheduler({ timer: null, now: () => new Date(at), recurringMaxAgeMs: 120_000,
    onPrompt() { throw new Error(''); }, store: { workspace, sessionId: 'categories' } });
  t.after(async () => { await scheduler.close(); await fs.rm(workspace, { recursive: true, force: true }); });
  await scheduler.ensureAttached();
  scheduler.create({ cron: '* * * * *', prompt: 'local once', recurring: false });
  scheduler.create({ cron: '* * * * *', prompt: 'local recurring' });
  scheduler.scheduleWakeup(60, 'dynamic once');
  at += 60_000;
  const first = scheduler.tick();
  await scheduler.flushStore();
  assert.deepEqual(first.map(event => event.prompt), ['permanent', 'expiring', 'local once', 'local recurring', 'dynamic once']);
  assert.ok(first.every(event => event.callbackError === ''));
  assert.equal(scheduler.getWakeup(), null);
  assert.deepEqual(scheduler.tick(), []);
  assert.deepEqual((await readStoredTasks(workspace)).map(task => [task.id, task.lastFiredAt]),
    [['permanent', at], ['expiring', at]]);

  at += 60_000;
  assert.deepEqual(scheduler.tick().map(event => event.prompt), ['permanent', 'expiring', 'local recurring']);
  await scheduler.flushStore();
  assert.deepEqual(scheduler.list().map(job => [job.prompt, job.nextAt]), [['permanent', start + 180_000]]);
  assert.deepEqual((await readStoredTasks(workspace)).map(task => [task.id, task.lastFiredAt]), [['permanent', at]]);
  assert.deepEqual(scheduler.tick(), []);
  await scheduler.close();
  assert.equal(await readSchedulerLock(workspace), undefined);
});

test('a failed missed-task handler retains its row until a later session surfaces it once', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(temporaryRoot, 'scheduler-catchup-')));
  const at = new Date(2024, 0, 1, 0, 2).getTime();
  const row = { id: 'missed', cron: '* * * * *', prompt: 'retained missed task', createdAt: at - 120_000 };
  await writeStoredTasks(workspace, [row]);
  let failedAttempts = 0;
  const failure = new Error('');
  const first = new LocalScheduler({ timer: null, now: () => new Date(at),
    onPrompt() { assert.fail('missed tasks use the catch-up handler'); },
    store: { workspace, sessionId: 'first', onMissed() { failedAttempts++; throw failure; } } });
  const caught: string[] = [];
  const second = new LocalScheduler({ timer: null, now: () => new Date(at), onPrompt() { assert.fail('ordinary fire'); },
    store: { workspace, sessionId: 'second', onMissed(prompt) { caught.push(prompt); } } });
  t.after(async () => { await first.close(); await second.close(); await fs.rm(workspace, { recursive: true, force: true }); });
  assert.equal(await first.ensureAttached(), true);
  await assert.rejects(first.flushStore(), error => error === failure);
  assert.deepEqual(await readStoredTasks(workspace), [row]);
  assert.deepEqual(first.tick(), []);
  assert.equal(await first.ensureAttached(), true);
  assert.equal(failedAttempts, 1);
  await first.close();
  assert.equal(await readSchedulerLock(workspace), undefined);

  assert.equal(await second.ensureAttached(), true);
  await second.flushStore();
  assert.equal(caught.length, 1);
  assert.match(caught[0]!, /First use the AskUserQuestion tool/);
  assert.match(caught[0]!, /retained missed task/);
  assert.deepEqual(await readStoredTasks(workspace), []);
  assert.deepEqual(second.tick(), []);
  assert.equal(await second.ensureAttached(), true);
  assert.equal(caught.length, 1);
  await second.close();
  assert.equal(await readSchedulerLock(workspace), undefined);
});
