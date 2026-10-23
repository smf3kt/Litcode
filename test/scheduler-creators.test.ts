import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { processStart } from '../src/local-peer.js';
import { TaskCreators, schedulerProcessBirth } from '../src/scheduler-creators.js';
import { LocalScheduler, type SchedulerTimer } from '../src/scheduler.js';
import { readStoredTasks, STORE_LOCK_RETRY_MS, writeStoredTasks, type StoredTask } from '../src/scheduler-store.js';

async function workspace(): Promise<string> {
  return fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'scheduler-creators-')));
}

async function until(predicate: () => boolean | Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!await predicate()) {
    if (Date.now() >= deadline) throw new Error('Creator state did not settle');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

test('creator eligibility requires project, transcript, process lifetime and observed session evidence', async t => {
  const dir = await workspace();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const id = randomUUID(), missing = randomUUID(), linked = randomUUID(), directory = randomUUID();
  await fs.mkdir(path.join(dir, '.agent'));
  await fs.writeFile(path.join(dir, '.agent', `${id}.jsonl`), '');
  await fs.symlink(`${id}.jsonl`, path.join(dir, '.agent', `${linked}.jsonl`));
  await fs.mkdir(path.join(dir, '.agent', `${directory}.jsonl`));
  const history = new Set(['prior']);
  const creators = new TaskCreators({ workspace: dir, sessionId: 'current', sessionIds: history });
  const row: StoredTask = { id: '80000000', cron: '* * * * *', prompt: 'fixture', createdAt: Date.now() };
  await creators.readTranscripts([id, missing, linked, directory, '../escape'].map(createdBySessionId => ({ ...row, createdBySessionId })));
  assert.equal(creators.eligible(row, false), false);
  assert.equal(creators.eligible(row, true), true);
  assert.equal(creators.eligible({ ...row, createdBySessionId: 'current', createdByPid: 1,
    createdInProject: '/different' }, false), true);
  assert.equal(creators.eligible({ ...row, createdBySessionId: 'other', createdInProject: dir.toUpperCase().replaceAll('/', '\\') }, true), true);
  assert.equal(creators.eligible({ ...row, createdBySessionId: 'other', createdInProject: `${dir}-other` }, true), false);
  assert.equal(creators.eligible({ ...row, createdBySessionId: id }, true), true);
  for (const createdBySessionId of [missing, linked, directory, '../escape'])
    assert.equal(creators.eligible({ ...row, createdBySessionId }, true), false);
  const prior = { ...row, createdBySessionId: 'prior', createdByPid: process.pid };
  assert.equal(creators.eligible({ ...prior, createdAt: performance.timeOrigin - 1 }, false), false);
  assert.equal(creators.eligible({ ...prior, createdAt: performance.timeOrigin + 1 }, false), true);
  assert.equal(creators.eligible({ ...prior, createdAt: 0, createdByProcStart: schedulerProcessBirth() }, false), true);
  assert.equal(creators.eligible({ ...prior, createdByProcStart: 'different birth' }, false), false);
  const live = { ...prior, createdBySessionId: 'foreign', createdInProject: dir };
  assert.equal(creators.eligible(live, true), false);
  assert.equal(creators.eligible({ ...live, createdByProcStart: schedulerProcessBirth() }, true), false);
  assert.equal(creators.eligible({ ...live, createdByProcStart: 'recycled birth' }, true), true);
  assert.equal(creators.eligible({ ...live, createdByPid: 1 }, true), true);
  await fs.unlink(path.join(dir, '.agent', `${id}.jsonl`));
  await creators.readTranscripts([{ ...row, createdBySessionId: id }]);
  assert.equal(creators.eligible({ ...row, createdBySessionId: id }, true), false);
});

test('a live foreign creator is skipped until it exits, and a resumed creator refreshes its PID and birth', async t => {
  const dir = await workspace();
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  await once(child, 'spawn');
  const exited = once(child, 'exit');
  const pid = child.pid!;
  let at = Date.now();
  const fired: string[] = [];
  const scheduler = new LocalScheduler({ timer: null, now: () => new Date(at),
    onPrompt: prompt => { fired.push(prompt); }, store: { workspace: dir, sessionId: 'current' } });
  let resumed: LocalScheduler | undefined;
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
    await scheduler.close(); await resumed?.close(); await fs.rm(dir, { recursive: true, force: true });
  });
  const birth = await processStart(pid);
  assert.ok(birth);
  const foreign: StoredTask = { id: '80000000', cron: '* * * * *', prompt: 'foreign live', createdAt: at,
    recurring: true, permanent: true, createdBySessionId: 'foreign', createdByPid: pid,
    createdByProcStart: birth, createdInProject: dir };
  await writeStoredTasks(dir, [foreign]);
  assert.equal(await scheduler.ensureAttached(), true);
  assert.equal(scheduler.list()[0]?.id, foreign.id, 'listing retains an ineligible file record');
  at += 60_000;
  assert.deepEqual(scheduler.tick(), []);
  assert.deepEqual(await readStoredTasks(dir), [foreign]);
  child.kill(); await exited;
  assert.equal(scheduler.tick().length, 1);
  assert.deepEqual(fired, ['foreign live']);
  await scheduler.flushStore();
  assert.equal((await readStoredTasks(dir))[0]?.lastFiredAt, at);
  await scheduler.close();

  const own = { ...foreign, id: '00000000', prompt: 'resumed', createdBySessionId: 'resumed' };
  const missed = { ...own, id: '00000001', prompt: 'own missed', createdAt: at - 120_000, recurring: false };
  await writeStoredTasks(dir, [own, missed, { ...missed, id: '00000002', prompt: 'foreign missed',
    createdBySessionId: 'live foreign', createdByPid: process.pid, createdByProcStart: schedulerProcessBirth() }]);
  const catchup: string[] = [];
  resumed = new LocalScheduler({ timer: null, now: () => new Date(at), onPrompt() {},
    store: { workspace: dir, sessionId: 'resumed', onMissed: prompt => { catchup.push(prompt); } } });
  await resumed.ensureAttached();
  const stored = await readStoredTasks(dir);
  assert.equal(stored.find(task => task.id === own.id)?.createdByPid, process.pid);
  assert.equal(stored.find(task => task.id === own.id)?.createdByProcStart, schedulerProcessBirth());
  assert.equal(catchup.length, 1);
  assert.match(catchup[0]!, /own missed/);
  assert.doesNotMatch(catchup[0]!, /foreign missed/);
  assert.deepEqual(stored.map(task => task.id), [own.id, '00000002']);
});

test('current and prior in-process creators fire under contention and keep their deadline on lease acquisition', async t => {
  const dir = await workspace();
  let at = Date.now();
  const handlers = new Map<unknown, { run(): void; ms: number }>();
  const timer: SchedulerTimer = {
    setInterval(run, ms) { const handle = {}; handlers.set(handle, { run, ms }); return handle; },
    clearInterval(handle) { handlers.delete(handle); },
  };
  const holder = new LocalScheduler({ timer: null, onPrompt() {}, store: { workspace: dir, sessionId: 'holder' } });
  const fires: string[] = [];
  const history = new Set(['prior', 'current']);
  const current = new LocalScheduler({ timer, jitter: true, now: () => new Date(at),
    onPrompt: prompt => { fires.push(prompt); }, store: { workspace: dir, sessionId: 'current', sessionIds: history } });
  t.after(async () => {
    await holder.close(); await current.close(); await fs.rm(dir, { recursive: true, force: true });
  });
  await writeStoredTasks(dir, [{ id: '80000000', cron: '* * * * *', prompt: 'prior', recurring: true,
    createdAt: at, createdBySessionId: 'prior', createdByPid: process.pid, createdByProcStart: schedulerProcessBirth() }]);
  await holder.ensureAttached();
  assert.equal(await current.ensureAttached(), false);
  const own = current.create({ cron: '* * * * *', prompt: 'own', durable: true });
  await current.flushStore();
  assert.equal((await readStoredTasks(dir)).find(task => task.id === own.id)?.createdByProcStart, schedulerProcessBirth());
  const deadline = current.getJob('80000000')!.nextAt;
  at = Math.max(deadline, own.nextAt);
  assert.equal(current.tick().length, 2);
  await current.flushStore();
  assert.deepEqual([...fires].sort(), ['own', 'prior']);
  const next = current.getJob('80000000')!.nextAt;
  await writeStoredTasks(dir, (await readStoredTasks(dir)).map(task => task.id === '80000000'
    ? { ...task, cron: '0 0 * * *' } : task));
  await until(() => current.getJob('80000000')?.cron === '0 0 * * *');
  assert.equal(current.getJob('80000000')!.nextAt, next);
  await holder.close();
  [...handlers.values()].find(entry => entry.ms === STORE_LOCK_RETRY_MS)!.run();
  await until(() => current.hasStoreLock()); await current.flushStore();
  assert.equal(current.getJob('80000000')!.nextAt, next, 'an eligible prior-session deadline survives lease acquisition');
  at = next;
  current.tick(); await current.flushStore();
  assert.equal(fires.filter(prompt => prompt === 'prior').length, 2);
});
