import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  createSchedulerTools,
  DEFAULT_TICK_MS,
  describeCron,
  LocalScheduler,
  MAX_CRON_LENGTH,
  MAX_JOBS,
  MAX_PROMPT_LENGTH,
  type LocalSchedulerOptions,
  nextOccurrence,
  parseCron,
  RECURRING_MAX_AGE_MS,
  SchedulerError,
  type SchedulerTimer,
} from '../src/scheduler.js';
import {
  readSchedulerLock, readStoredTasks, scheduledTasksDir, schedulerLockPath, writeStoredTasks,
} from '../src/scheduler-store.js';

// A deterministic, injectable clock. Tests advance it explicitly instead of
// sleeping, so every fixture is reproducible.
function clock(start: Date) {
  let at = start.getTime();
  return {
    now: () => new Date(at),
    set: (value: Date | number) => {
      at = value instanceof Date ? value.getTime() : value;
    },
    advance: (ms: number) => {
      at += ms;
    },
    at: () => at,
  };
}

// Manual-only scheduler (timer: null) plus a prompt sink for assertions.
function fixture(start: Date, overrides: Partial<LocalSchedulerOptions> = {}) {
  const c = clock(start);
  const prompts: Array<{ prompt: string; id: string }> = [];
  const scheduler = new LocalScheduler({
    now: c.now,
    timer: null,
    onPrompt: (prompt, id) => prompts.push({ prompt, id }),
    ...overrides,
  });
  return { c, prompts, scheduler };
}

// A fake timer that records lifecycle calls and lets a test fire the handler.
function fakeTimer() {
  const calls = { set: 0, clear: 0, unref: 0, handle: null as unknown };
  let handler: (() => void) | null = null;
  const timer: SchedulerTimer = {
    setInterval(fn) {
      calls.set += 1;
      handler = fn;
      return 'handle-1';
    },
    clearInterval(handle) {
      calls.clear += 1;
      calls.handle = handle;
    },
    unref() {
      calls.unref += 1;
    },
  };
  return { timer, calls, fire: () => handler?.() };
}

// ---------------------------------------------------------------------------
// Cron parsing
// ---------------------------------------------------------------------------

test('parseCron expands steps, ranges and lists', () => {
  assert.deepEqual(parseCron('*/15 * * * *')?.minute, [0, 15, 30, 45]);
  assert.deepEqual(parseCron('0 9-17 * * 1-5')?.hour, [9, 10, 11, 12, 13, 14, 15, 16, 17]);
  assert.deepEqual(parseCron('0 9-17 * * 1-5')?.dayOfWeek, [1, 2, 3, 4, 5]);
  assert.deepEqual(parseCron('0 0 1,15 * *')?.dayOfMonth, [1, 15]);
  assert.deepEqual(parseCron('0 6,18 * * *')?.hour, [6, 18]);
  assert.deepEqual(parseCron('0-30/10 * * * *')?.minute, [0, 10, 20, 30]);
  assert.deepEqual(parseCron('5 1-20/6 * * *')?.hour, [1, 7, 13, 19]);
  // 7 in the day-of-week field is accepted as Sunday (0)
  assert.deepEqual(parseCron('0 0 * * 0,7')?.dayOfWeek, [0]);
  assert.deepEqual(parseCron('0 0 * * 5-7')?.dayOfWeek, [0, 5, 6]);
});

test('parseCron records which day fields are restricted', () => {
  const both = parseCron('0 0 13 * 5');
  assert.equal(both?.domRestricted, true);
  assert.equal(both?.dowRestricted, true);
  const domOnly = parseCron('0 0 13 * *');
  assert.equal(domOnly?.domRestricted, true);
  assert.equal(domOnly?.dowRestricted, false);
  const none = parseCron('*/5 * * * *');
  assert.equal(none?.domRestricted, false);
  assert.equal(none?.dowRestricted, false);
});

test('parseCron rejects malformed expressions', () => {
  const bad = ['', '* * * *', '* * * * * *', '60 * * * *', '* 24 * * *', '* * 0 * *',
    '* * * 13 *', '* * * * 8', '*/0 * * * *', '5-1 * * * *', '1-99 * * * *', 'a * * * *', '*/x * * * *'];
  for (const expression of bad) {
    assert.equal(parseCron(expression), null, `expected null for ${JSON.stringify(expression)}`);
  }
});

// ---------------------------------------------------------------------------
// Next occurrence (local time, bounded to one year)
// ---------------------------------------------------------------------------

test('nextOccurrence honours steps, months and local wall-clock time', () => {
  const from = new Date(2024, 0, 1, 0, 0, 0); // Mon 2024-01-01 00:00 local
  assert.equal(nextOccurrence(parseCron('*/15 * * * *')!, from)?.getMinutes(), 15);
  const at9 = nextOccurrence(parseCron('0 9 * * *')!, from)!;
  assert.equal(at9.getHours(), 9); // local hour, no timezone conversion
  assert.equal(at9.getMinutes(), 0);
  assert.equal(at9.getDate(), 1);
  assert.equal(at9.getMonth(), 0);
  const feb = nextOccurrence(parseCron('0 0 1 2 *')!, from)!;
  assert.equal(feb.getMonth(), 1);
  assert.equal(feb.getDate(), 1);
  assert.equal(feb.getFullYear(), 2024);
  const jun = nextOccurrence(parseCron('0 0 1 6 *')!, from)!;
  assert.equal(jun.getMonth(), 5);
  assert.equal(jun.getDate(), 1);
});

test('nextOccurrence handles a leap day and impossible calendar dates', () => {
  const from = new Date(2024, 0, 1, 0, 0, 0);
  const leap = nextOccurrence(parseCron('0 0 29 2 *')!, from)!;
  assert.equal(leap.getMonth(), 1);
  assert.equal(leap.getDate(), 29);
  assert.equal(leap.getFullYear(), 2024);
  // Feb 30 and Apr 31 never exist: bounded search returns null, never a fake date.
  assert.equal(nextOccurrence(parseCron('0 0 30 2 *')!, from), null);
  assert.equal(nextOccurrence(parseCron('0 0 31 4 *')!, from), null);
});

test('nextOccurrence bounds the real epoch, not just iterations', () => {
  // From 2025-01-01 the next Feb 29 is 2028-02-29, well past the one-year bound.
  assert.equal(nextOccurrence(parseCron('0 0 29 2 *')!, new Date(2025, 0, 1, 0, 0, 0)), null);
  // The previous leap day is in range from a year earlier.
  assert.equal(nextOccurrence(parseCron('0 0 29 2 *')!, new Date(2024, 0, 1, 0, 0, 0))?.getFullYear(), 2024);
  // A month reachable within a year is still found from 2025.
  assert.equal(nextOccurrence(parseCron('0 0 1 12 *')!, new Date(2025, 0, 1, 0, 0, 0))?.getMonth(), 11);
});

test('nextOccurrence is strictly increasing in epoch and never skips a minute', () => {
  const parsed = parseCron('* * * * *')!;
  // Two windows straddle northern/southern DST transitions; the assertion is
  // timezone independent because it checks epoch deltas only, which is exactly
  // what a skipped DST fall-back hour (or a wall-clock setMinutes step) breaks.
  for (const start of [new Date(2024, 2, 1, 0, 0, 0), new Date(2024, 9, 1, 0, 0, 0)]) {
    let cursor = start;
    let violation: string | null = null;
    for (let i = 0; i < 100000; i += 1) {
      const next = nextOccurrence(parsed, cursor)!;
      const delta = next.getTime() - cursor.getTime();
      if (delta !== 60000) {
        violation = `step ${delta}ms at ${cursor.toISOString()}`;
        break;
      }
      cursor = next;
    }
    assert.equal(violation, null);
  }
});

test('DST fall-back repeats the hour and spring-forward gaps are handled', () => {
  const hadTz = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const parsed = parseCron('* * * * *')!;

    // Fall-back 2024-11-03: 02:00 EDT -> 01:00 EST, so local hour 1 runs twice.
    let cursor = new Date(2024, 10, 3, 0, 0, 0);
    let hourOneCount = 0;
    for (let i = 0; i < 200; i += 1) {
      const next = nextOccurrence(parsed, cursor)!;
      assert.equal(next.getTime() - cursor.getTime(), 60000);
      if (next.getHours() === 1) hourOneCount += 1;
      cursor = next;
    }
    assert.equal(hourOneCount, 120); // both 01:00-01:59 instances walked, none skipped

    // Spring-forward 2024-03-10: 02:00 EST -> 03:00 EDT, so local hour 2 never exists.
    cursor = new Date(2024, 2, 10, 1, 0, 0);
    let sawHourTwo = false;
    for (let i = 0; i < 130; i += 1) {
      const next = nextOccurrence(parsed, cursor)!;
      assert.equal(next.getTime() - cursor.getTime(), 60000);
      if (next.getHours() === 2) sawHourTwo = true;
      cursor = next;
    }
    assert.equal(sawHourTwo, false);
  } finally {
    if (hadTz === undefined) delete process.env.TZ;
    else process.env.TZ = hadTz;
  }
});

test('day-of-month / day-of-week combine with OR when both restricted', () => {
  const or = parseCron('0 0 13 * 5')!; // the 13th OR any Friday
  const fromThu = new Date(2024, 9, 10, 0, 0, 0); // Thu Oct 10 -> Fri Oct 11
  const a = nextOccurrence(or, fromThu)!;
  assert.equal(a.getDate(), 11);
  assert.equal(a.getDay(), 5);
  const fromSat = new Date(2024, 9, 12, 0, 0, 0); // Sat Oct 12 -> Sun Oct 13
  const b = nextOccurrence(or, fromSat)!;
  assert.equal(b.getDate(), 13);
  assert.equal(b.getMonth(), 9);
  // AND semantics would push to the next Friday-the-13th (Dec 13); OR must not.
  assert.notEqual(b.getTime(), new Date(2024, 11, 13, 0, 0, 0).getTime());
});

test('a single restricted day field matches only that field', () => {
  const from = new Date(2024, 9, 1, 0, 0, 0); // Tue Oct 1
  const domOnly = nextOccurrence(parseCron('0 0 13 * *')!, from)!;
  assert.equal(domOnly.getDate(), 13);
  assert.equal(domOnly.getDay(), 0); // Oct 13 2024 is a Sunday
  const dowOnly = nextOccurrence(parseCron('0 0 * * 1')!, from)!;
  assert.equal(dowOnly.getDay(), 1);
  assert.equal(dowOnly.getDate(), 7); // Oct 7 2024 is a Monday
});

test('describeCron summarises common shapes and falls back to the raw string', () => {
  assert.equal(describeCron('* * * * *'), 'Every minute');
  assert.equal(describeCron('*/15 * * * *'), 'Every 15 minutes');
  assert.equal(describeCron('0 * * * *'), 'Every hour');
  assert.equal(describeCron('30 * * * *'), 'Every hour at :30');
  assert.equal(describeCron('0 9 * * *'), 'Every day at 09:00');
  assert.equal(describeCron('0 0 13 * 5'), '0 0 13 * 5');
});

// ---------------------------------------------------------------------------
// Scheduler lifecycle

test('opt-in jitter bounds cron fires and preserves exact wakeups and legacy timing', () => {
  const start = new Date(2024, 0, 1, 0, 0, 0);
  const { c, scheduler } = fixture(start, { jitter: true });
  const nominal = start.getTime() + 60000;
  const recurring = scheduler.create({ cron: '* * * * *', prompt: 'spread' });
  // Recovered `L9t`: later by at most half the interval, capped at 30 minutes.
  assert.ok(recurring.nextAt >= nominal && recurring.nextAt <= nominal + 30000);
  c.set(recurring.nextAt - 1); assert.equal(scheduler.tick().length, 0);
  c.set(recurring.nextAt); assert.equal(scheduler.tick().length, 1);
  assert.equal(scheduler.tick().length, 0);
  const second = scheduler.getJob(recurring.id)!;
  assert.ok(second.nextAt >= nominal + 60000 && second.nextAt <= nominal + 90000);
  const early = scheduler.create({ cron: '30 0 * * *', prompt: 'early', recurring: false });
  const halfHour = new Date(2024, 0, 1, 0, 30).getTime();
  assert.ok(early.nextAt <= halfHour && early.nextAt >= halfHour - 90000 && early.nextAt >= c.at());
  const exact = scheduler.create({ cron: '31 0 * * *', prompt: 'exact', recurring: false });
  assert.equal(exact.nextAt, halfHour + 60000);
  const wakeup = scheduler.scheduleWakeup(60, 'wake');
  assert.equal(wakeup.scheduledFor, c.at() + 60000);
  scheduler.close();
  const legacy = fixture(start).scheduler;
  assert.equal(legacy.create({ cron: '* * * * *', prompt: 'legacy' }).nextAt, nominal);
  legacy.close();
});

test('a */5 schedule fires cacheLeadMs early under jitter (recovered `L9t`)', () => {
  const start = new Date(2024, 0, 1, 0, 0, 0);
  const { scheduler } = fixture(start, { jitter: true });
  const job = scheduler.create({ cron: '*/5 * * * *', prompt: 'warm' });
  // Interval 5 minutes: the recovered arm returns `from + interval - 15000`.
  assert.equal(job.nextAt, start.getTime() + 300_000 - 15_000);
  scheduler.close();
});
// ---------------------------------------------------------------------------

test('one-shot jobs fire once and auto-delete', () => {
  const { c, prompts, scheduler } = fixture(new Date(2024, 0, 1, 0, 0, 0));
  const job = scheduler.create({ cron: '30 2 1 1 *', prompt: 'check the deploy', recurring: false });
  assert.equal(scheduler.list().length, 1);
  assert.equal(scheduler.tick().length, 0); // not due yet
  c.set(new Date(2024, 0, 1, 2, 30, 0));
  const events = scheduler.tick();
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'cron');
  assert.equal(events[0].prompt, 'check the deploy');
  assert.equal(events[0].recurring, false);
  assert.equal(scheduler.list().length, 0); // deleted after firing
  assert.deepEqual(prompts.map((p) => p.prompt), ['check the deploy']);
  assert.equal(scheduler.tick().length, 0); // no duplicate
  assert.equal(scheduler.delete(job.id), false);
});

test('recurring jobs advance and never fire twice for one occurrence', () => {
  const { c, prompts, scheduler } = fixture(new Date(2024, 0, 1, 0, 0, 0));
  scheduler.create({ cron: '*/5 * * * *', prompt: 'poll', recurring: true });
  c.set(new Date(2024, 0, 1, 0, 5, 0));
  assert.equal(scheduler.tick().length, 1);
  assert.equal(scheduler.list()[0].nextAt, new Date(2024, 0, 1, 0, 10, 0).getTime());
  assert.equal(scheduler.tick().length, 0); // same instant: no re-fire
  c.set(new Date(2024, 0, 1, 0, 6, 0));
  assert.equal(scheduler.tick().length, 0); // between occurrences
  c.set(new Date(2024, 0, 1, 0, 10, 0));
  assert.equal(scheduler.tick().length, 1);
  assert.equal(prompts.length, 2);
});

test('recurring jobs expire after 7 days with one final fire', () => {
  const { c, scheduler } = fixture(new Date(2024, 0, 1, 0, 0, 0));
  scheduler.create({ cron: '*/1 * * * *', prompt: 'tick', recurring: true });
  c.set(new Date(2024, 0, 1, 0, 1, 0));
  assert.equal(scheduler.tick().length, 1); // first fire, still young
  assert.equal(scheduler.list().length, 1);
  c.set(new Date(2024, 0, 8, 0, 2, 0)); // >= 7 days since creation
  assert.equal(scheduler.tick().length, 1); // one final fire
  assert.equal(scheduler.list().length, 0); // then deleted
});

test('job count is capped at 50', () => {
  const { scheduler } = fixture(new Date(2024, 0, 1, 0, 0, 0));
  for (let i = 0; i < MAX_JOBS; i += 1) scheduler.create({ cron: '0 0 1 1 *', prompt: `job-${i}` });
  assert.equal(scheduler.list().length, MAX_JOBS);
  assert.throws(
    () => scheduler.create({ cron: '0 0 1 1 *', prompt: 'overflow' }),
    (error: unknown) => error instanceof SchedulerError && error.code === 3,
  );
});

test('invalid cron and impossible dates raise typed errors', () => {
  const { scheduler } = fixture(new Date(2024, 0, 1, 0, 0, 0));
  assert.throws(
    () => scheduler.create({ cron: 'bogus', prompt: 'x' }),
    (error: unknown) => error instanceof SchedulerError && error.code === 1,
  );
  assert.throws(
    () => scheduler.create({ cron: '0 0 30 2 *', prompt: 'x' }),
    (error: unknown) => error instanceof SchedulerError && error.code === 2,
  );
});

// ---------------------------------------------------------------------------
// Dynamic wakeup
// ---------------------------------------------------------------------------

test('scheduleWakeup clamps to [60, 3600] and replaces the previous slot', () => {
  const { scheduler } = fixture(new Date(2024, 0, 1, 0, 0, 0));
  const low = scheduler.scheduleWakeup(10, 'too soon');
  assert.equal(low.clampedDelaySeconds, 60);
  assert.equal(low.wasClamped, true);
  const high = scheduler.scheduleWakeup(99999, 'too late');
  assert.equal(high.clampedDelaySeconds, 3600);
  assert.equal(high.wasClamped, true);
  const exact = scheduler.scheduleWakeup(120, 'ok');
  assert.equal(exact.clampedDelaySeconds, 120);
  assert.equal(exact.wasClamped, false);
  assert.equal(scheduler.getWakeup()?.prompt, 'ok'); // only one slot survives
});

test('stop clears only the dynamic wakeup', () => {
  const { scheduler } = fixture(new Date(2024, 0, 1, 0, 0, 0));
  scheduler.create({ cron: '0 9 * * *', prompt: 'daily' });
  assert.equal(scheduler.stop(), false); // nothing armed
  scheduler.scheduleWakeup(60, 'wake');
  assert.equal(scheduler.stop(), true);
  assert.equal(scheduler.getWakeup(), null);
  assert.equal(scheduler.list().length, 1); // cron job untouched
});

test('the dynamic wakeup fires once through onPrompt', () => {
  const { c, prompts, scheduler } = fixture(new Date(2024, 0, 1, 0, 0, 0));
  scheduler.scheduleWakeup(90, 'resume loop');
  const id = scheduler.getWakeup()!.id;
  c.advance(60 * 1000);
  assert.equal(scheduler.tick().length, 0); // not yet
  c.advance(30 * 1000);
  const events = scheduler.tick();
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'wakeup');
  assert.deepEqual(prompts, [{ prompt: 'resume loop', id }]);
  assert.equal(scheduler.getWakeup(), null);
  assert.equal(scheduler.tick().length, 0); // no duplicate
});

// ---------------------------------------------------------------------------
// Timer injection, close
// ---------------------------------------------------------------------------

test('injected timer is armed once, unref-ed, and cleared on close', () => {
  const c = clock(new Date(2024, 0, 1, 0, 0, 0));
  const { timer, calls } = fakeTimer();
  const scheduler = new LocalScheduler({ onPrompt: () => {}, now: c.now, timer, tickIntervalMs: 250 });
  assert.equal(calls.set, 1);
  assert.equal(calls.unref, 1);
  scheduler.close();
  assert.equal(calls.clear, 1);
  assert.equal(calls.handle, 'handle-1');
  assert.equal(scheduler.isClosed(), true);
  assert.equal(scheduler.tick().length, 0);
  assert.equal(scheduler.list().length, 0);
});

test('auto-tick drives fires through the injected timer', () => {
  const c = clock(new Date(2024, 0, 1, 0, 0, 0));
  const { timer, fire } = fakeTimer();
  const prompts: string[] = [];
  const scheduler = new LocalScheduler({ onPrompt: (prompt) => prompts.push(prompt), now: c.now, timer });
  scheduler.create({ cron: '* * * * *', prompt: 'minute', recurring: false });
  c.set(new Date(2024, 0, 1, 0, 1, 0));
  fire();
  assert.deepEqual(prompts, ['minute']);
  scheduler.close();
});

test('the default timer path constructs and closes without leaking', () => {
  const scheduler = new LocalScheduler({ onPrompt: () => {}, timer: undefined, tickIntervalMs: DEFAULT_TICK_MS });
  assert.equal(scheduler.isClosed(), false);
  scheduler.close();
  assert.equal(scheduler.isClosed(), true);
});

test('close clears jobs and wakeup and blocks further creates', () => {
  const { scheduler } = fixture(new Date(2024, 0, 1, 0, 0, 0));
  scheduler.create({ cron: '0 9 * * *', prompt: 'daily' });
  scheduler.scheduleWakeup(60, 'wake');
  scheduler.close();
  assert.equal(scheduler.list().length, 0);
  assert.equal(scheduler.getWakeup(), null);
  assert.equal(scheduler.isClosed(), true);
  assert.throws(
    () => scheduler.create({ cron: '0 9 * * *', prompt: 'x' }),
    (error: unknown) => error instanceof SchedulerError && error.code === 3,
  );
});

test('RECURRING_MAX_AGE_MS is exactly seven days', () => {
  assert.equal(RECURRING_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1000);
});

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

test('createSchedulerTools exposes the four tools with compact originals-shaped schemas', () => {
  const { scheduler } = fixture(new Date(2024, 0, 1, 0, 0, 0));
  const tools = createSchedulerTools(scheduler);
  assert.deepEqual(Object.keys(tools).sort(), ['cron_create', 'cron_delete', 'cron_list', 'schedule_wakeup']);
  assert.deepEqual(tools.cron_create.input_schema.required, ['cron', 'prompt']);
  assert.deepEqual(tools.cron_create.input_schema.properties.cron.type, 'string');
  assert.deepEqual(tools.cron_list.input_schema.properties, {});
});

test('cron tools create, list and delete through the scheduler', () => {
  const { scheduler } = fixture(new Date(2024, 0, 1, 0, 0, 0));
  const tools = createSchedulerTools(scheduler);

  const created = tools.cron_create.run({ cron: '*/10 * * * *', prompt: 'poll' });
  assert.equal(created.ok, true);
  const id = (created.data as { id: string }).id;
  // Source `Pot`: the id is the first eight hex characters of a fresh UUID.
  assert.match(id, /^[0-9a-f]{8}$/);

  const invalid = tools.cron_create.run({ cron: 'nope', prompt: 'x' });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, 1);

  const listed = tools.cron_list.run({});
  assert.equal((listed.data as { jobs: unknown[] }).jobs.length, 1);

  const removed = tools.cron_delete.run({ id });
  assert.equal((removed.data as { deleted: boolean }).deleted, true);
  assert.equal(tools.cron_delete.run({}).ok, false);
});

test('schedule_wakeup tool clamps, replaces and stops', () => {
  const { scheduler } = fixture(new Date(2024, 0, 1, 0, 0, 0));
  const { schedule_wakeup } = createSchedulerTools(scheduler);

  const armed = schedule_wakeup.run({ delaySeconds: 30, prompt: 'soon' });
  assert.equal(armed.ok, true);
  assert.equal((armed.data as { clampedDelaySeconds: number }).clampedDelaySeconds, 60);
  assert.equal((armed.data as { wasClamped: boolean }).wasClamped, true);

  const missingDelay = schedule_wakeup.run({ prompt: 'x' });
  assert.equal(missingDelay.ok, false);
  assert.equal(missingDelay.code, 1);

  const stopped = schedule_wakeup.run({ stop: true });
  assert.equal((stopped.data as { stopped: boolean }).stopped, true);
});

test('prompts are only ever handed to the injected callback', () => {
  const start = new Date(2024, 0, 1, 0, 0, 0);
  const { c, prompts, scheduler } = fixture(start);
  scheduler.create({ cron: '* * * * *', prompt: 'only-sink', recurring: false });
  assert.equal(prompts.length, 0); // nothing fires without a tick
  c.set(new Date(2024, 0, 1, 0, 1, 0));
  scheduler.tick();
  assert.deepEqual(prompts.map((p) => p.prompt), ['only-sink']);
});

// ---------------------------------------------------------------------------
// Strict input validation (runtime API and tools)
// ---------------------------------------------------------------------------

test('create validates input types and size budgets', () => {
  const { scheduler } = fixture(new Date(2024, 0, 1, 0, 0, 0));
  const code1 = (error: unknown): boolean => error instanceof SchedulerError && error.code === 1;

  assert.throws(() => scheduler.create({ cron: '0 9 * * *', prompt: 'ok', recurring: 'yes' as unknown as boolean }), code1);
  assert.throws(() => scheduler.create({ cron: '0 9 * * *', prompt: 'ok', durable: 1 as unknown as boolean }), code1);
  assert.throws(() => scheduler.create({ cron: 'x'.repeat(MAX_CRON_LENGTH + 1), prompt: 'ok' }), code1);
  assert.throws(() => scheduler.create({ cron: '0 9 * * *', prompt: '' }), code1);
  assert.throws(() => scheduler.create({ cron: '0 9 * * *', prompt: 'x'.repeat(MAX_PROMPT_LENGTH + 1) }), code1);
  assert.throws(() => scheduler.create({ cron: 42 as unknown as string, prompt: 'ok' }), code1);
  assert.throws(() => scheduler.create({ cron: '0 9 * * *', prompt: 7 as unknown as string }), code1);
  assert.throws(() => scheduler.create(null as unknown as { cron: string; prompt: string }), code1);

  // Valid jobs (with explicit and defaulted recurring) still succeed.
  assert.equal(scheduler.create({ cron: '0 9 * * *', prompt: 'a', recurring: false }).recurring, false);
  assert.equal(scheduler.create({ cron: '0 9 * * *', prompt: 'b' }).recurring, true);
  assert.equal(scheduler.create({ cron: '0 9 * * *', prompt: 'c', durable: true }).durable, false); // forced session-only
});

test('create and scheduleWakeup reject an invalid clock date', () => {
  const bad = new LocalScheduler({ onPrompt: () => {}, now: () => new Date(NaN), timer: null });
  assert.throws(
    () => bad.create({ cron: '0 9 * * *', prompt: 'ok' }),
    (error: unknown) => error instanceof SchedulerError && error.code === 1,
  );
  assert.throws(
    () => bad.scheduleWakeup(120, 'ok'),
    (error: unknown) => error instanceof SchedulerError && error.code === 1,
  );
  // tick is a safe no-op with an invalid clock (never throws for a timer host)
  assert.equal(bad.tick().length, 0);
});

test('a throwing onPrompt is contained and does not strand other due jobs', () => {
  const c = clock(new Date(2024, 0, 1, 0, 0, 0));
  const seen: string[] = [];
  const scheduler = new LocalScheduler({
    now: c.now,
    timer: null,
    onPrompt: (prompt) => {
      seen.push(prompt);
      if (prompt === 'bad') throw new Error('callback boom');
    },
  });
  scheduler.create({ cron: '*/1 * * * *', prompt: 'bad', recurring: false });
  scheduler.create({ cron: '*/1 * * * *', prompt: 'good', recurring: false });
  c.set(new Date(2024, 0, 1, 0, 1, 0));
  const events = scheduler.tick();
  assert.equal(events.length, 2);
  assert.equal(events[0].prompt, 'bad');
  assert.equal(events[0].callbackError, 'callback boom');
  assert.equal(events[1].prompt, 'good');
  assert.equal(events[1].callbackError, undefined);
  assert.deepEqual(seen, ['bad', 'good']); // second job still delivered
  assert.equal(scheduler.list().length, 0); // both one-shot jobs still cleaned up
});

test('tools strictly reject unknown keys and wrong types', () => {
  const { scheduler } = fixture(new Date(2024, 0, 1, 0, 0, 0));
  const tools = createSchedulerTools(scheduler);

  const unknownCreate = tools.cron_create.run({ cron: '0 9 * * *', prompt: 'x', extra: 1 });
  assert.equal(unknownCreate.ok, false);
  assert.equal(unknownCreate.code, 1);

  const wrongRecurring = tools.cron_create.run({ cron: '0 9 * * *', prompt: 'x', recurring: 'true' });
  assert.equal(wrongRecurring.ok, false);
  assert.equal(wrongRecurring.code, 1);

  // A numeric string delay must be rejected, not coerced to a number.
  const stringDelay = tools.schedule_wakeup.run({ delaySeconds: '120', prompt: 'x' });
  assert.equal(stringDelay.ok, false);
  assert.equal(stringDelay.code, 1);

  const wrongPrompt = tools.schedule_wakeup.run({ delaySeconds: 120, prompt: 42 });
  assert.equal(wrongPrompt.ok, false);
  assert.equal(wrongPrompt.code, 1);

  const unknownWake = tools.schedule_wakeup.run({ delaySeconds: 120, prompt: 'x', bogus: true });
  assert.equal(unknownWake.ok, false);
  assert.equal(unknownWake.code, 1);

  const listUnknown = tools.cron_list.run({ nope: 1 });
  assert.equal(listUnknown.ok, false);
  assert.equal(listUnknown.code, 1);

  const deleteUnknown = tools.cron_delete.run({ id: 'a', extra: true });
  assert.equal(deleteUnknown.ok, false);
  assert.equal(deleteUnknown.code, 1);
});

// ---------------------------------------------------------------------------
// Durable store (`chunk-atzjaveb.js`, `chunk-jrz2zk22.js`)
// ---------------------------------------------------------------------------

function workspace(): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scheduler-store-')));
}

test('a durable job survives a restart through the store and the lock', async () => {
  const dir = workspace();
  const first = new LocalScheduler({ now: () => new Date(2024, 0, 1, 0, 0, 0), timer: null,
    onPrompt: () => {}, store: { workspace: dir, sessionId: 'session-a' } });
  assert.equal(await first.attachStore(), true);
  const job = first.create({ cron: '0 9 * * *', prompt: 'daily', durable: true });
  assert.equal(job.durable, true);
  await new Promise(resolve => setTimeout(resolve, 20));
  const stored = await readStoredTasks(dir);
  assert.deepEqual(stored.map(task => ({ id: task.id, cron: task.cron, prompt: task.prompt })),
    [{ id: job.id, cron: '0 9 * * *', prompt: 'daily' }]);
  first.close();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(await readSchedulerLock(dir), undefined);

  const second = new LocalScheduler({ now: () => new Date(2024, 0, 1, 0, 1, 0), timer: null,
    onPrompt: () => {}, store: { workspace: dir, sessionId: 'session-b' } });
  assert.equal(await second.attachStore(), true);
  assert.deepEqual(second.list().map(entry => entry.id), [job.id]);
  second.close();
});

test('a second session cannot take a lock a live process holds', async () => {
  const dir = workspace();
  const first = new LocalScheduler({ timer: null, onPrompt: () => {}, store: { workspace: dir, sessionId: 'a' } });
  assert.equal(await first.attachStore(), true);
  const second = new LocalScheduler({ timer: null, onPrompt: () => {}, store: { workspace: dir, sessionId: 'b' } });
  assert.equal(await second.attachStore(), false);
  // A session that does not hold the lock fires nothing.
  second.create({ cron: '* * * * *', prompt: 'silent' });
  assert.equal(second.tick().length, 0);
  first.close();
  second.close();
});

test('a lock left by a dead process is recovered', async () => {
  const dir = workspace();
  await fs.promises.mkdir(scheduledTasksDir(dir), { recursive: true });
  await fs.promises.writeFile(schedulerLockPath(dir), JSON.stringify({ sessionId: 'dead', pid: 999_999, acquiredAt: 0 }));
  const scheduler = new LocalScheduler({ timer: null, onPrompt: () => {}, store: { workspace: dir, sessionId: 'live' } });
  assert.equal(await scheduler.attachStore(), true);
  scheduler.close();
});

test('a missed one-shot task is surfaced once and removed, a recurring one stays', async () => {
  const dir = workspace();
  await writeStoredTasks(dir, [
    { id: 'aaaa1111', cron: '0 9 * * *', prompt: 'missed one', createdAt: new Date(2024, 0, 1, 0, 0).getTime() },
    { id: 'bbbb2222', cron: '0 9 * * *', prompt: 'recurring', createdAt: new Date(2024, 0, 1, 0, 0).getTime(), recurring: true },
  ]);
  const seen: string[] = [];
  const scheduler = new LocalScheduler({ now: () => new Date(2024, 0, 2, 12, 0, 0), timer: null, onPrompt: () => {},
    store: { workspace: dir, sessionId: 'catch-up', onMissed: prompt => seen.push(prompt) } });
  assert.equal(await scheduler.attachStore(), true);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /^The following one-shot scheduled task was missed while the harness was not running\./);
  assert.match(seen[0], /Do NOT execute this prompt yet\. First use the AskUserQuestion tool/);
  assert.match(seen[0], /```\nmissed one\n```/);
  assert.deepEqual((await readStoredTasks(dir)).map(task => task.id), ['bbbb2222']);
  assert.deepEqual(scheduler.list().map(entry => entry.id), ['bbbb2222']);
  scheduler.close();
});

test('a durable recurring fire stamps lastFiredAt and an aged-out job is removed', async () => {
  const dir = workspace();
  let at = new Date(2024, 0, 1, 0, 0, 0).getTime();
  const scheduler = new LocalScheduler({ now: () => new Date(at), timer: null, onPrompt: () => {},
    store: { workspace: dir, sessionId: 'stamp' }, recurringMaxAgeMs: 2 * 60_000 });
  await scheduler.attachStore();
  const job = scheduler.create({ cron: '* * * * *', prompt: 'tick', durable: true });
  await new Promise(resolve => setTimeout(resolve, 20));
  at += 60_000;
  assert.equal(scheduler.tick().length, 1);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal((await readStoredTasks(dir))[0]?.lastFiredAt, at);
  // The next tick is past the two-minute expiry: the final fire removes the stored task.
  at += 120_000;
  assert.equal(scheduler.tick().length, 1);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(await readStoredTasks(dir), []);
  scheduler.close();
});

test('a session-only job never reaches the store', async () => {
  const dir = workspace();
  const scheduler = new LocalScheduler({ timer: null, onPrompt: () => {}, store: { workspace: dir, sessionId: 'x' } });
  await scheduler.attachStore();
  const job = scheduler.create({ cron: '0 9 * * *', prompt: 'local' });
  assert.equal(job.durable, false);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(await readStoredTasks(dir), []);
  scheduler.close();
});

test('a scheduler with the same lock identity adopts the held lock (`de`)', async () => {
  const dir = workspace();
  const first = new LocalScheduler({ timer: null, onPrompt: () => {}, store: { workspace: dir, sessionId: 'pid-1' } });
  assert.equal(await first.attachStore(), true);
  // Same identity: the lock is adopted, not refused. A different identity is refused.
  const same = new LocalScheduler({ timer: null, onPrompt: () => {}, store: { workspace: dir, sessionId: 'pid-1' } });
  assert.equal(await same.attachStore(), true);
  const other = new LocalScheduler({ timer: null, onPrompt: () => {}, store: { workspace: dir, sessionId: 'pid-2' } });
  assert.equal(await other.attachStore(), false);
  // The identity that owns the lock releases it; another identity leaves it alone.
  await other.detachStore();
  assert.notEqual(await readSchedulerLock(dir), undefined);
  await same.detachStore();
  assert.equal(await readSchedulerLock(dir), undefined);
  first.close();
  other.close();
  same.close();
});
