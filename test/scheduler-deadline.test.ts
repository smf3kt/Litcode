import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createSchedulerTools, LocalScheduler } from '../src/scheduler.js';
import { readSchedulerLock, readStoredTasks, writeStoredTasks } from '../src/scheduler-store.js';

const temporaryRoot = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();
const start = new Date(2024, 1, 28, 23, 58).getTime();
const leapAt = new Date(2024, 1, 29).getTime();

async function until(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'the changed file reaches the scheduler');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

test('an unresolved recurring deadline stays listable after its fire without retrying or delaying finite jobs', async () => {
  for (const jitter of [false, true]) {
    let at = start;
    const seen: string[] = [];
    const scheduler = new LocalScheduler({ timer: null, jitter, now: () => new Date(at), onPrompt: prompt => { seen.push(prompt); } });
    try {
      const job = scheduler.create({ cron: '0 0 29 2 *', prompt: 'leap recurring' });
      assert.equal(job.nextAt, leapAt);
      at = leapAt;
      assert.deepEqual(scheduler.tick().map(event => event.prompt), ['leap recurring']);
      assert.equal(scheduler.getJob(job.id)?.nextAt, Infinity);
      const finite = scheduler.create({ cron: '* * * * *', prompt: 'finite once', recurring: false });
      assert.deepEqual(scheduler.list().map(row => row.id), [finite.id, job.id]);
      assert.deepEqual(scheduler.tick(), []);
      const tools = createSchedulerTools(scheduler);
      const listed = tools.cron_list.run({});
      assert.equal(listed.ok, true);
      if (!listed.ok) assert.fail('cron_list succeeds for an unresolved job');
      assert.match(JSON.stringify(listed.data), /"nextAt":null/);
      at = finite.nextAt;
      assert.deepEqual(scheduler.tick().map(event => event.prompt), ['finite once']);
      at = new Date(2028, 1, 29).getTime();
      assert.deepEqual(scheduler.tick(), [], 'the id keeps its unresolved deadline until reload or explicit change');
      assert.deepEqual(seen, ['leap recurring', 'finite once']);
      const cancelled = tools.cron_delete.run({ id: job.id });
      assert.equal(cancelled.ok, true);
      if (!cancelled.ok) assert.fail('cron_delete succeeds for an unresolved job');
      assert.deepEqual(cancelled.data, { id: job.id, deleted: true });
      assert.deepEqual(scheduler.list(), []);
    } finally { await scheduler.close(); }
  }
});

test('durable unresolved rows retain stamps and metadata through reload and restart and remain cancellable', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(temporaryRoot, 'scheduler-deadline-')));
  let at = start;
  const seen: string[] = [];
  const first = new LocalScheduler({ timer: null, jitter: true, now: () => new Date(at),
    store: { workspace, sessionId: 'first' }, onPrompt: prompt => { seen.push(prompt); } });
  const second = new LocalScheduler({ timer: null, jitter: true, now: () => new Date(at),
    store: { workspace, sessionId: 'second' }, onPrompt() { assert.fail('an unresolved row is not a missed one-shot'); } });
  t.after(async () => { await first.close(); await second.close(); await fs.rm(workspace, { recursive: true, force: true }); });
  await first.ensureAttached();
  const job = first.create({ cron: '0 0 29 2 *', prompt: 'durable leap', durable: true });
  await first.flushStore();
  const original = (await readStoredTasks(workspace))[0]!;
  at = leapAt;
  assert.equal(first.tick().length, 1);
  await first.flushStore();
  assert.equal(first.getJob(job.id)?.nextAt, Infinity);
  const stored = { ...original, lastFiredAt: at };
  assert.deepEqual(await readStoredTasks(workspace), [stored]);
  const renamed = { ...stored, prompt: 'renamed unresolved', permanent: true };
  await writeStoredTasks(workspace, [renamed]);
  await until(() => first.getJob(job.id)?.prompt === renamed.prompt);
  assert.equal(first.getJob(job.id)?.nextAt, Infinity);
  assert.deepEqual(first.tick(), []);
  await first.close();
  assert.equal(await readSchedulerLock(workspace), undefined);

  assert.equal(await second.ensureAttached(), true);
  assert.deepEqual(second.list().map(row => [row.id, row.prompt, row.nextAt]), [[job.id, renamed.prompt, Infinity]]);
  assert.deepEqual(second.tick(), []);
  assert.deepEqual(await readStoredTasks(workspace), [renamed]);
  assert.equal(second.delete(job.id), true);
  await second.flushStore();
  assert.deepEqual(await readStoredTasks(workspace), []);
  assert.deepEqual(second.list(), []);
  assert.deepEqual(seen, ['durable leap']);
  await second.close();
  assert.equal(await readSchedulerLock(workspace), undefined);
});

test('initial unresolved rows stay visible while final-age fires still delete and permanent or zero-age failures stamp', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(temporaryRoot, 'scheduler-deadline-expiry-')));
  let at = leapAt + 8 * 86_400_000;
  await writeStoredTasks(workspace, [
    { id: 'expired', cron: '0 0 29 2 *', prompt: 'expired leap', createdAt: start, recurring: true },
    { id: 'permanent', cron: '0 0 29 2 *', prompt: 'permanent leap', createdAt: start, recurring: true, permanent: true },
    { id: 'impossible', cron: '0 0 30 2 *', prompt: 'no calendar day', createdAt: start, recurring: true },
  ]);
  const scheduler = new LocalScheduler({ timer: null, now: () => new Date(at), onPrompt() { throw new Error(''); },
    store: { workspace, sessionId: 'expiry' } });
  t.after(async () => { await scheduler.close(); await fs.rm(workspace, { recursive: true, force: true }); });
  await scheduler.ensureAttached();
  assert.equal(scheduler.getJob('impossible')?.nextAt, Infinity);
  assert.deepEqual(scheduler.tick().map(event => [event.prompt, event.callbackError]), [['expired leap', ''], ['permanent leap', '']]);
  await scheduler.flushStore();
  assert.equal(scheduler.getJob('expired'), null);
  assert.equal(scheduler.getJob('permanent')?.nextAt, Infinity);
  assert.deepEqual((await readStoredTasks(workspace)).map(row => [row.id, row.lastFiredAt]), [['permanent', at], ['impossible', undefined]]);
  at += 365 * 86_400_000;
  assert.deepEqual(scheduler.tick(), []);
  await scheduler.close();
  assert.equal(await readSchedulerLock(workspace), undefined);

  at = start;
  const unlimited = new LocalScheduler({ timer: null, now: () => new Date(at), recurringMaxAgeMs: 0,
    onPrompt() { throw new Error(''); } });
  try {
    const job = unlimited.create({ cron: '0 0 29 2 *', prompt: 'unlimited leap' });
    at = leapAt + 8 * 86_400_000;
    assert.equal(unlimited.tick()[0]?.callbackError, '');
    assert.equal(unlimited.getJob(job.id)?.nextAt, Infinity);
    assert.deepEqual(unlimited.tick(), []);
  } finally { await unlimited.close(); }
});
