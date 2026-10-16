// The `$` call table's ui.toast floor and the admission policy behind it (W45-26). The ported
// bodies are src/plugin-chain-toast-source.ts, the entry sits verbatim in src/plugin-chain-ui.ts
// (chunk-sfn1dbxq.js [2351998,2352180)), and the policy is re-exported from there under the names a
// surface reads it by. These tests bind the behaviour those bodies produce to the source's own
// texts: the gate's drop line, the write and its remote-limit truncation, the timeoutMs refusal,
// the give-way decision at the cap, and the give-way report's once-per-plugin notice.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import '../src/plugin-chain-registry.js';
import { chainRecords, clearChainRecords, installChainModule } from '../src/plugin-chain-host.js';
import {
  DEFAULT_TOAST_TIMEOUT_MS,
  PluginUiSession,
  TOAST_PRIORITY,
  TOAST_TIMEOUT_MAX_MS,
  TOASTS_PER_PLUGIN,
  bindPluginSession,
  noteToastOnce,
  pluginOfToastKey,
  onPluginUiLog,
  raiseUiCall,
  reportToastGiveWay,
  splitToastQueue,
  toastAdmission,
  toastKey,
  toastThatGivesWay,
} from '../src/plugin-chain-ui.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const caller = (plugin = 'fixture-toast') => ({ plugin, origin: ORIGIN });
const logs = (): string[] => chainRecords().filter((r) => r.kind === 'log').map((r) => r.message);

function moduleWith(event: string, handler: ChainHandler): ChainModule {
  return { name: handler.name, tier: handler.tier, hooks: (e: string) => e === event, record: () => handler };
}

/** A handler whose `next` hands the call to the floor, which is where the entry's `check` runs. */
function passthrough(name: string, event: string): ChainModule {
  return moduleWith(event, {
    name,
    tier: 'user',
    run: async (args: unknown, next: (value: unknown) => Promise<unknown>) => ({ value: await next(args) }),
  });
}

/** The session surface a toast write reaches. */
function surface(): { writes: [string, string, number | undefined][]; session: PluginUiSession } {
  const writes: [string, string, number | undefined][] = [];
  return {
    writes,
    session: {
      status: () => {},
      toast: (plugin: string, text: string, timeoutMs: number | undefined) => { writes.push([plugin, text, timeoutMs]); },
    },
  };
}

test('ui.toast floor: the gate writes through the bound session and drops an unbound one', async () => {
  clearChainRecords();
  const { writes, session } = surface();

  // No session bound: `Vyt` logs the drop and never reaches the session's toast.
  await raiseUiCall({ event: 'ui.toast', args: { text: 'hello' }, caller: caller() });
  assert.equal(writes.length, 0);
  assert.deepEqual(logs(), ['$.ui.toast (fixture-toast): no session bound; dropped: hello']);

  const unbind = bindPluginSession(session);
  try {
    // A plugin that asks for no timeout passes none through: the bar's own `Sqt` (4000) applies.
    clearChainRecords();
    await raiseUiCall({ event: 'ui.toast', args: { text: 'hello' }, caller: caller() });
    assert.deepEqual(writes, [['fixture-toast', 'hello', undefined]]);
    assert.deepEqual(logs(), ['$.ui.toast (fixture-toast): hello']);

    // A timeout the plugin asked for is handed over as it is.
    clearChainRecords();
    await raiseUiCall({ event: 'ui.toast', args: { text: 'timed', timeoutMs: 60000 }, caller: caller() });
    assert.deepEqual(writes.at(-1), ['fixture-toast', 'timed', 60000]);

    // The text is truncated at the remote limit (`BDe`, 10000) before it reaches the session, and
    // the log line carries the same truncated text.
    clearChainRecords();
    await raiseUiCall({ event: 'ui.toast', args: { text: 'z'.repeat(10001) }, caller: caller() });
    const written: string | undefined = writes[writes.length - 1]?.[1];
    assert.equal(written?.length, 10001, '10000 characters and the ellipsis');
    assert.equal(written?.endsWith('…'), true);
    assert.equal(logs()[0]?.endsWith('…'), true);

    // The table entry is the chain's floor: a handler that answers keeps the session untouched.
    const remove = installChainModule(moduleWith('ui.toast', {
      name: 'fixture-answer-toast',
      tier: 'user',
      run: async () => ({ value: 'claimed by the plugin' }),
    }));
    try {
      clearChainRecords();
      const before = writes.length;
      const answer = await raiseUiCall({ event: 'ui.toast', args: { text: 'mine' }, caller: caller() });
      assert.equal(answer, 'claimed by the plugin');
      assert.equal(writes.length, before, 'the floor did not run');
    } finally {
      remove();
    }
  } finally {
    unbind();
  }
});

test('ui.toast check: a non-string text and a timeoutMs outside 1..60000 are refused', async () => {
  clearChainRecords();
  const { session } = surface();
  const unbind = bindPluginSession(session);
  const open = installChainModule(passthrough('fixture-open-toast', 'ui.toast'));
  try {
    await assert.rejects(
      () => raiseUiCall({ event: 'ui.toast', args: { text: 1 }, caller: caller() }),
      /HooksError: ui\.toast: takes a string text \(host check\)/,
    );
    for (const timeoutMs of [0, 60001, 1.5, 'later']) {
      await assert.rejects(
        () => raiseUiCall({ event: 'ui.toast', args: { text: 'ok', timeoutMs }, caller: caller() }),
        /HooksError: ui\.toast: timeoutMs is a whole number of ms, 1 to 60000 \(host check\)/,
      );
    }
    // The bounds themselves are accepted, and an absent timeoutMs is not a value to check.
    await raiseUiCall({ event: 'ui.toast', args: { text: 'ok', timeoutMs: 1 }, caller: caller() });
    await raiseUiCall({ event: 'ui.toast', args: { text: 'ok', timeoutMs: 60000 }, caller: caller() });
    await raiseUiCall({ event: 'ui.toast', args: { text: 'ok' }, caller: caller() });
  } finally {
    open();
    unbind();
  }
});

test('toast admission: a plugin waits its turn, gives way at its cap, and cuts its own short', () => {
  const mine = (id: string) => ({ key: toastKey('fixture-p', id), timeoutMs: 4000 });
  const other = { key: toastKey('fixture-other', '1'), timeoutMs: 4000 };

  assert.equal(TOASTS_PER_PLUGIN, 50);
  assert.equal(DEFAULT_TOAST_TIMEOUT_MS, 4000);
  assert.equal(TOAST_TIMEOUT_MAX_MS, 60000);
  assert.equal(TOAST_PRIORITY, 'immediate');

  // The key names its plugin, and only a plugin key does.
  assert.equal(toastKey('fixture-p', '3'), 'plugin-toast-3:fixture-p');
  assert.equal(pluginOfToastKey('plugin-toast-3:fixture-p'), 'fixture-p');
  assert.equal(pluginOfToastKey('app-note'), undefined);
  assert.equal(pluginOfToastKey(undefined), undefined);

  // An empty bar: the toast shows at once.
  assert.deepEqual(toastAdmission({ isHeld: false, current: null, queue: [] }, 'fixture-p'),
    { isWaiting: false, givesWay: undefined, isCutShort: false });
  // Another plugin's toast is running: it waits its turn.
  assert.deepEqual(toastAdmission({ isHeld: false, current: other, queue: [] }, 'fixture-p'),
    { isWaiting: true, givesWay: undefined, isCutShort: false });
  // This plugin's own toast is running: the arriving one cuts it short and takes its place.
  assert.deepEqual(toastAdmission({ isHeld: false, current: mine('1'), queue: [] }, 'fixture-p'),
    { isWaiting: false, givesWay: 'plugin-toast-1:fixture-p', isCutShort: true });
  // A running toast that is not a plugin's leaves the bar free; a plugin toast behind it makes the
  // arriving one wait, and the last of this plugin's own is the one it waits behind.
  assert.deepEqual(toastAdmission({ isHeld: false, current: { key: 'app-note', timeoutMs: 4000 }, queue: [] }, 'fixture-p'),
    { isWaiting: false, givesWay: undefined, isCutShort: false });
  assert.deepEqual(
    toastAdmission({ isHeld: false, current: other, queue: [mine('1'), mine('2')] }, 'fixture-p'),
    { isWaiting: true, givesWay: 'plugin-toast-2:fixture-p', isCutShort: false });
  // A bar that is held never admits: under 50 of this plugin's toasts nothing gives way, at 50 the
  // oldest of them does (`ACn`).
  const held = (count: number) => ({ isHeld: true, current: null, queue: Array.from({ length: count }, (_, i) => mine(String(i))) });
  assert.deepEqual(toastAdmission(held(49), 'fixture-p'), { isWaiting: false, givesWay: undefined, isCutShort: false });
  assert.equal(toastThatGivesWay(held(50).queue, 'fixture-p'), 'plugin-toast-0:fixture-p');
  assert.deepEqual(toastAdmission(held(50), 'fixture-p'), { isWaiting: false, givesWay: 'plugin-toast-0:fixture-p', isCutShort: false });

  // The queue split keeps each waiting toast's own timeout, and the default only where none was set.
  assert.deepEqual(splitToastQueue({ current: mine('1'), queue: [other, { key: 'app-note' }, null] }, false, DEFAULT_TOAST_TIMEOUT_MS),
    { current: { key: 'plugin-toast-1:fixture-p', ms: 4000 }, waiting: [{ key: 'plugin-toast-1:fixture-other', ms: 4000 }], isHidden: false });
  assert.deepEqual(splitToastQueue({ current: null, queue: [{ key: toastKey('fixture-p', '9'), timeoutMs: undefined }, null] }, true, 5000),
    { current: undefined, waiting: [{ key: 'plugin-toast-9:fixture-p', ms: 5000 }], isHidden: true });
});

test('toast give-way: the report is logged, and the notice reaches a plugin once', () => {
  clearChainRecords();
  // A cut-short toast is reported and nothing more: its plugin saw it.
  reportToastGiveWay({ key: toastKey('fixture-cut', '1'), plugin: 'fixture-cut', isCutShort: true });
  assert.deepEqual(logs(), ['$.ui.toast (fixture-cut): plugin-toast-1:fixture-cut gave way, cut short']);
  assert.deepEqual(logs().filter((l) => l.includes('gives way to')), []);

  // The unseen notice is a transcript line, and `CK` sends it only while a plugin source is
  // installed — with none, the log line above is all a give-way produces.
  const held: { plugin: string; text: string }[] = [];
  const off = onPluginUiLog((record) => { held.push(record); });
  const open = installChainModule(moduleWith('ui.toast', {
    name: 'fixture-open-toast',
    tier: 'user',
    run: async (args: unknown, next: (value: unknown) => Promise<unknown>) => ({ value: await next(args) }),
  }));
  const notice = '$.ui.toast: a toast that waits to be shown gives way to the plugin\'s newer ones, unseen';
  try {
    clearChainRecords();
    reportToastGiveWay({ key: toastKey('fixture-unseen', '1'), plugin: 'fixture-unseen', isCutShort: false });
    assert.deepEqual(logs().filter((l) => l.includes('gave way, unseen')),
      ['$.ui.toast (fixture-unseen): plugin-toast-1:fixture-unseen gave way, unseen']);
    assert.deepEqual(logs().filter((l) => l.includes('gives way to')), ['[fixture-unseen] $.ui.log: ' + notice]);
    assert.deepEqual(held, [{ plugin: 'fixture-unseen', text: notice }]);

    // Once per plugin and spelling: a second give-way is logged but not noticed again.
    clearChainRecords();
    reportToastGiveWay({ key: toastKey('fixture-unseen', '2'), plugin: 'fixture-unseen', isCutShort: false });
    assert.equal(logs().filter((l) => l.includes('gave way, unseen')).length, 1);
    assert.deepEqual(logs().filter((l) => l.includes('gives way to')), []);
    assert.equal(held.length, 1);
  } finally {
    open();
    off();
  }

  // No key at all is not a give-way.
  clearChainRecords();
  reportToastGiveWay({ key: undefined, plugin: 'fixture-none', isCutShort: false });
  assert.deepEqual(logs(), []);

  // The once-per-spelling helper: `key` is the spelling, and the plugin and environment are part
  // of it, so a second sighting is skipped.
  let ran = 0;
  noteToastOnce('toast stacked', 'fixture-stack', () => { ran++; });
  noteToastOnce('toast stacked', 'fixture-stack', () => { ran++; });
  noteToastOnce('toast stacked', 'fixture-other', () => { ran++; });
  assert.equal(ran, 2);
});
