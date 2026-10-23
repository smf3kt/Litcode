import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSchedulerTools, dynamicWakeupTiming, LocalScheduler, nextOneShotFire } from '../src/scheduler.js';

const base = new Date(2024, 0, 1, 12, 0, 0).getTime();

test('dynamic timing uses source minute ceilings, cache lead, clamp status and creation baseline', () => {
  const cases = [
    { delay: 300, offset: 30_000, target: 300_000, created: 299_999, clamped: 300, wasClamped: false },
    { delay: 60, offset: 30_000, target: 120_000, created: 90_000, clamped: 60, wasClamped: false },
    { delay: 270, offset: 0, target: 240_000, created: 239_999, clamped: 270, wasClamped: false },
    { delay: 301, offset: 30_000, target: 360_000, created: 331_000, clamped: 301, wasClamped: false },
    { delay: 3600, offset: 30_000, target: 3_660_000, created: 3_630_000, clamped: 3600, wasClamped: false },
    { delay: 60.4, offset: 0, target: 60_000, created: 59_999, clamped: 60, wasClamped: false },
    { delay: -1, offset: 0, target: 60_000, created: 59_999, clamped: 60, wasClamped: true },
  ];
  for (const row of cases) {
    assert.deepEqual(dynamicWakeupTiming(row.delay, base + row.offset), {
      clamped: row.clamped, wasClamped: row.wasClamped, targetMs: base + row.target, createdAt: base + row.created,
    });
  }
  assert.equal(dynamicWakeupTiming(300, base + 30_000, 0).targetMs, base + 360_000);
  assert.equal(dynamicWakeupTiming(NaN, base).clamped, 60);
  assert.equal(dynamicWakeupTiming(Infinity, base).clamped, 3600);
  assert.equal(dynamicWakeupTiming(-Infinity, base).clamped, 60);
});

test('source wakeup delivery differs from target metadata at half-hours and remains held while busy', async t => {
  let now = base + 25 * 60_000, loading = false;
  const seen: string[] = [];
  const source = new LocalScheduler({ jitter: true, timer: null, now: () => new Date(now),
    isLoading: () => loading, onPrompt: prompt => { seen.push(prompt); } });
  const legacy = new LocalScheduler({ timer: null, now: () => new Date(now), onPrompt: () => {} });
  try {
    const tools = createSchedulerTools(source);
    const result = tools.schedule_wakeup.run({ delaySeconds: 301, prompt: 'rounded', reason: 'Await fixture', noop: false });
    assert.equal(result.ok, true);
    const wakeup = source.getWakeup()!;
    assert.match(wakeup.id, /^[0-9a-f]{8}$/);
    assert.equal(wakeup.scheduledFor, base + 31 * 60_000);
    assert.equal(wakeup.createdAt, base + 30 * 60_000 + 1000);
    assert.equal(wakeup.nextAt, wakeup.scheduledFor);
    assert.equal(source.stop(), true);

    source.scheduleWakeup(3600, 'early');
    const early = source.getWakeup()!;
    assert.equal(early.scheduledFor, base + 85 * 60_000);
    source.stop();
    now = base + 29 * 60_000 - 30_000;
    t.mock.method(Math, 'random', () => 0.123456789);
    source.scheduleWakeup(60, 'half hour');
    const half = source.getWakeup()!;
    const fraction = parseInt(half.id, 16) / 0x100000000;
    assert.equal(half.scheduledFor, base + 30 * 60_000);
    assert.equal(half.createdAt, base + 29 * 60_000 + 30_000);
    assert.equal(half.nextAt, Math.max(half.scheduledFor - fraction * 90_000, half.createdAt));
    assert.equal(half.id, '1f9add37');
    assert.equal(nextOneShotFire('30 12 * * *', half.createdAt, half.id), half.nextAt);
    assert.ok(half.nextAt >= half.createdAt && half.nextAt <= half.scheduledFor);
    now = Math.floor(half.nextAt);
    assert.deepEqual(source.tick(), [], 'the integer millisecond before a fractional deadline remains pending');
    now = Math.ceil(half.nextAt);
    loading = true;
    assert.deepEqual(source.tick(), []);
    assert.equal(source.getWakeup()!.nextAt, half.nextAt);
    loading = false;
    const events = source.tick();
    assert.equal(events.length, 1);
    assert.equal(events[0]!.dueAt, half.nextAt);
    assert.equal(source.getWakeup(), null);
    assert.deepEqual(seen, ['half hour']);

    now = base + 30_123;
    assert.equal(legacy.scheduleWakeup(60.4, 'exact').scheduledFor, now + 60_000);
    assert.equal(legacy.getWakeup()!.nextAt, now + 60_000);
    assert.equal(legacy.scheduleWakeup(60.4, 'exact').wasClamped, true);
    assert.throws(() => source.scheduleWakeup(Infinity, 'invalid'), /finite number/);
  } finally { await source.close(); await legacy.close(); }
});

test('source local minute rounding follows the host Date behavior across both DST transitions', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const spring = new Date(2024, 2, 10, 1, 59, 30).getTime();
    const forward = dynamicWakeupTiming(60, spring);
    assert.equal(forward.targetMs, Date.parse('2024-03-10T07:01:00Z'));
    assert.equal(new Date(forward.targetMs).getHours(), 3);
    const fall = Date.parse('2024-11-03T05:59:30Z');
    const backward = dynamicWakeupTiming(60, fall);
    assert.equal(backward.targetMs, Date.parse('2024-11-03T05:01:00Z'));
    assert.equal(backward.createdAt, backward.targetMs - 1);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
