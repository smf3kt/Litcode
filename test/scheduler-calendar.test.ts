import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { defaultConfig } from '../src/agent.js';
import { reloadConfig } from '../src/reload.js';
import { createRuntime, parseSettings, pinToolSchemas } from '../src/runtime.js';
import { applyManagedPolicy, configSchema, managedPolicySchema, Session } from '../src/session.js';
import { sourceNextOccurrence } from '../src/scheduler-calendar.js';
import { LocalScheduler, nextOccurrence, nextOneShotFire, nextRecurringFire, parseCron, SCHEDULER_TIMING } from '../src/scheduler.js';
import { missedTasks, readSchedulerLock, readStoredTasks, writeStoredTasks } from '../src/scheduler-store.js';

const temporaryRoot = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();
const utc = (text: string) => Date.parse(text);
const provider = { count: async () => 1, complete: async () => { throw new Error('Unexpected model call'); } };

async function until(check: () => boolean): Promise<void> {
  const end = Date.now() + 5000;
  while (!check()) {
    assert.ok(Date.now() < end, 'the durable calendar change reaches its owner');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

test('the copied calendar preserves observed multi-year, expanded-day and DST results beside the legacy calendar', () => {
  const previous = process.env.TZ;
  try {
    const rows = [
      ['UTC', '0 0 29 2 *', '2025-01-01T00:00:00Z', '2028-02-29T00:00:00.000Z', null],
      ['UTC', '0 0 29 2 *', '2024-02-29T00:00:00Z', '2028-02-29T00:00:00.000Z', null],
      ['UTC', '0 0 30 2 *', '2024-01-01T00:00:00Z', null, null],
      ['UTC', '0 0 1-31 2 1', '2024-02-01T00:00:00Z', '2024-02-05T00:00:00.000Z', '2024-02-02T00:00:00.000Z'],
      ['UTC', '0 0 */1 2 1', '2024-02-01T00:00:00Z', '2024-02-05T00:00:00.000Z', '2024-02-02T00:00:00.000Z'],
      ['UTC', '0 0 30 2 0-6', '2024-02-01T00:00:00Z', null, '2024-02-02T00:00:00.000Z'],
      ['UTC', '0 0 13 * 5', '2024-06-01T00:00:00Z', '2024-06-07T00:00:00.000Z', '2024-06-07T00:00:00.000Z'],
      ['UTC', '* * * * *', '2024-02-01T00:00:32.123Z', '2024-02-01T00:01:00.000Z', '2024-02-01T00:01:00.000Z'],
      ['America/New_York', '* * * * *', '2024-11-03T05:59:00Z', '2024-11-03T07:00:00.000Z', '2024-11-03T06:00:00.000Z'],
      ['America/New_York', '* * * * *', '2024-11-03T06:01:00Z', '2024-11-03T05:02:00.000Z', '2024-11-03T06:02:00.000Z'],
      ['America/New_York', '* * * * *', '2024-03-10T06:59:00Z', '2024-03-10T07:00:00.000Z', '2024-03-10T07:00:00.000Z'],
      ['America/New_York', '30 2 * * *', '2024-03-10T06:59:00Z', '2024-03-11T06:30:00.000Z', '2024-03-11T06:30:00.000Z'],
      ['Australia/Lord_Howe', '* * * * *', '2024-04-06T14:59:00Z', '2024-04-06T15:30:00.000Z', '2024-04-06T15:00:00.000Z'],
      ['Australia/Lord_Howe', '* * * * *', '2024-04-06T15:01:00Z', '2024-04-06T14:32:00.000Z', '2024-04-06T15:02:00.000Z'],
    ];
    for (const [zone, cron, from, source, legacy] of rows) {
      assert.ok(zone && cron && from);
      process.env.TZ = zone;
      const parsed = parseCron(cron);
      assert.ok(parsed);
      const instant = new Date(from);
      assert.equal(sourceNextOccurrence(parsed, instant)?.toISOString() ?? null, source, `${zone} ${cron} source`);
      assert.equal(nextOccurrence(parsed, instant)?.toISOString() ?? null, legacy, `${zone} ${cron} legacy`);
      assert.equal(instant.getTime(), utc(from), 'date search leaves the caller date intact');
    }
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});

test('one selected calendar reaches jitter, recurring stamps, store reload, missed catch-up and dynamic wakeup', async t => {
  const previous = process.env.TZ;
  process.env.TZ = 'UTC';
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(temporaryRoot, 'scheduler-calendar-')));
  let at = utc('2025-01-01T00:00:00Z');
  const seen: string[] = [];
  const scheduler = new LocalScheduler({ timer: null, sourceCalendar: true, jitter: true, now: () => new Date(at),
    recurringMaxAgeMs: 0, store: { workspace, sessionId: 'calendar-owner' }, onPrompt: prompt => { seen.push(prompt); } });
  t.after(async () => {
    await scheduler.close(); await fs.rm(workspace, { recursive: true, force: true });
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  });
  const leap = utc('2028-02-29T00:00:00Z');
  assert.equal(nextRecurringFire('0 0 29 2 *', at, '80000000', SCHEDULER_TIMING, sourceNextOccurrence), leap + 1_800_000);
  assert.equal(nextOneShotFire('0 0 29 2 *', at, '80000000', SCHEDULER_TIMING, sourceNextOccurrence), leap - 45_000);
  assert.equal(nextRecurringFire('0 0 29 2 *', at, '80000000'), null);
  assert.equal(nextOneShotFire('0 0 29 2 *', at, '80000000'), null);
  await scheduler.ensureAttached();
  const job = scheduler.create({ cron: '0 0 29 2 *', prompt: 'recurring leap', durable: true });
  assert.ok(job.nextAt >= leap && job.nextAt <= leap + 1_800_000);
  await scheduler.flushStore();
  const original = (await readStoredTasks(workspace))[0]!;
  at = job.nextAt;
  assert.deepEqual(scheduler.tick().map(event => event.prompt), ['recurring leap']);
  await scheduler.flushStore();
  const nextLeap = utc('2032-02-29T00:00:00Z');
  const nextAt = scheduler.getJob(job.id)!.nextAt;
  assert.ok(nextAt >= nextLeap && nextAt <= nextLeap + 1_800_000);
  assert.deepEqual(await readStoredTasks(workspace), [{ ...original, lastFiredAt: at }]);
  assert.deepEqual(scheduler.tick(), []);
  await writeStoredTasks(workspace, [{ ...original, prompt: 'reloaded leap', lastFiredAt: at }]);
  await until(() => scheduler.getJob(job.id)?.prompt === 'reloaded leap');
  assert.equal(scheduler.getJob(job.id)!.nextAt, nextAt);
  await scheduler.close();
  assert.equal(await readSchedulerLock(workspace), undefined);
  const resumed = new LocalScheduler({ timer: null, sourceCalendar: true, jitter: true, now: () => new Date(at),
    store: { workspace, sessionId: 'calendar-owner' }, onPrompt() { assert.fail('the future leap remains pending'); } });
  try {
    await resumed.ensureAttached();
    assert.equal(resumed.getJob(job.id)!.nextAt, nextAt);
    assert.deepEqual(resumed.tick(), []);
    assert.equal(resumed.delete(job.id), true); await resumed.flushStore();
    assert.deepEqual(await readStoredTasks(workspace), []);
  } finally { await resumed.close(); }
  const missed = { ...original, recurring: undefined, createdAt: utc('2025-01-01T00:00:00Z') };
  assert.deepEqual(missedTasks([missed], leap + 1, sourceNextOccurrence).map(row => row.id), [job.id]);
  assert.deepEqual(missedTasks([missed], leap + 1), []);
  process.env.TZ = 'America/New_York';
  at = utc('2024-11-03T06:01:30Z');
  const dynamic = new LocalScheduler({ timer: null, sourceCalendar: true, jitter: true, now: () => new Date(at), onPrompt() {} });
  try {
    dynamic.scheduleWakeup(60, 'DST wakeup');
    const wakeup = dynamic.getWakeup()!;
    assert.equal(wakeup.scheduledFor, utc('2024-11-03T05:03:00Z'));
    assert.equal(wakeup.createdAt, utc('2024-11-03T05:03:00Z') - 1);
    assert.equal(wakeup.nextAt, utc('2024-11-03T05:03:00Z'));
  } finally { await dynamic.close(); }
  assert.deepEqual(seen, ['recurring leap']);
});

test('pinned settings and runtime owners retain absent or false calendars through original resume and explicit reload', async t => {
  const workspace = await fs.realpath(await fs.mkdtemp(path.join(temporaryRoot, 'calendar-settings-')));
  const userDir = path.join(workspace, 'user'); await fs.mkdir(userDir);
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  config.configSources = { userDir };
  config.features = { tasks: false, subagents: false, scheduler: true, schedulerSourceCalendar: true };
  assert.equal(parseSettings({ features: { schedulerSourceCalendar: false } }).features?.schedulerSourceCalendar, false);
  assert.throws(() => parseSettings({ features: { schedulerSourceCalendar: 'true' } }));
  const policy = managedPolicySchema.parse({ features: { schedulerSourceCalendar: false } });
  const managed = structuredClone(config); applyManagedPolicy(managed, policy);
  assert.equal(managed.features?.schedulerSourceCalendar, false);
  assert.equal(configSchema.parse(config).features?.schedulerSourceCalendar, true);
  const at = new Date(2025, 0, 1).getTime();
  for (const version of [undefined, false, true]) {
    const selected = structuredClone(config);
    if (version === undefined) delete selected.features!.schedulerSourceCalendar;
    else selected.features!.schedulerSourceCalendar = version;
    const controller = new AbortController();
    const runtime = await createRuntime(selected, provider, controller.signal, { scheduler: { timer: null, now: () => new Date(at) } });
    selected.tools = pinToolSchemas(runtime.tools);
    const session = Session.open(workspace, { config: selected });
    const bytes = await fs.readFile(session.file);
    const id = session.id;
    try {
      const tools = runtime.buildTools(session.config, id);
      const create = tools.find(tool => tool.schema.name === 'cron_create')!;
      const context = { workspace, allowShell: false, maxOutputBytes: 24000, signal: controller.signal };
      if (version === true) {
        const result = JSON.parse(await create.execute({ cron: '0 0 29 2 *', prompt: 'runtime leap', recurring: false }, context));
        assert.equal(result.nextAt, new Date(2028, 1, 29).getTime());
      } else {
        await assert.rejects(create.execute({ cron: '0 0 29 2 *', prompt: 'legacy leap', recurring: false }, context), /next year/);
      }
    } finally { await runtime.close(); session.close(); }
    await fs.writeFile(path.join(userDir, 'settings.json'), JSON.stringify({ features: { schedulerSourceCalendar: true } }));
    const reopened = Session.open(workspace, { id });
    try {
      assert.deepEqual(await fs.readFile(reopened.file), bytes);
      assert.equal(reopened.config.features?.schedulerSourceCalendar, version);
      await fs.writeFile(path.join(userDir, 'settings.json'), JSON.stringify({ features: { schedulerSourceCalendar: false } }));
      assert.equal(reloadConfig(reopened.config).features?.schedulerSourceCalendar, false);
      await fs.writeFile(path.join(userDir, 'settings.json'), '{}');
      assert.equal(reloadConfig(reopened.config).features?.schedulerSourceCalendar, true);
      assert.equal(reopened.config.features?.schedulerSourceCalendar, version);
    } finally { reopened.close(); }
  }
});
