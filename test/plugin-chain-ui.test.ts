// The `$` call table's ui.status and ui.log floors (W45-24). The ported bodies are
// src/plugin-chain-ui-source.ts, and the two table entries sit verbatim in
// src/plugin-chain-ui.ts (chunk-sfn1dbxq.js [2352180,2352478)). These tests bind the behaviour those
// bodies produce to the source's own texts: the session gate's drop line, the status write and its
// cleared state, the two ui.log routes, the length notice and its once-per-plugin dedupe, and the two
// `check` refusals that only a chain with a handler can reach.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import '../src/plugin-chain-registry.js';
import { chainRecords, clearChainRecords, installChainModule } from '../src/plugin-chain-host.js';
import { bindPluginSession, currentPluginSession, onPluginUiLog, raiseUiCall } from '../src/plugin-chain-ui.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const caller = (plugin = 'fixture-ui') => ({ plugin, origin: ORIGIN });
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

test('ui.status floor: the session gate drops an unbound write, and clears with no text', async () => {
  clearChainRecords();
  const writes: [string, string | undefined][] = [];
  const session = { status: (plugin: string, text: string | undefined) => { writes.push([plugin, text]); }, toast: () => {} };

  // No session bound: `Vyt` logs `${event} (${plugin}): no session bound; dropped: ${text}` and
  // writes nothing — the session's `status` is never reached.
  await raiseUiCall({ event: 'ui.status', args: { text: 'hello' }, caller: caller() });
  assert.equal(writes.length, 0);
  assert.deepEqual(logs(), ['$.ui.status (fixture-ui): no session bound; dropped: hello']);

  const unbind = bindPluginSession(session);
  try {
    clearChainRecords();
    await raiseUiCall({ event: 'ui.status', args: { text: 'hello' }, caller: caller() });
    assert.deepEqual(writes, [['fixture-ui', 'hello']]);
    assert.deepEqual(logs(), ['$.ui.status (fixture-ui): hello']);

    // No text at all: the session is told to clear, and the line says so.
    clearChainRecords();
    await raiseUiCall({ event: 'ui.status', args: {}, caller: caller() });
    assert.deepEqual(writes.at(-1), ['fixture-ui', undefined]);
    assert.deepEqual(logs(), ['$.ui.status (fixture-ui): (cleared)']);

    // The text is truncated at the remote limit (`BDe`, 10000) before it reaches the session.
    clearChainRecords();
    const long = 'z'.repeat(10001);
    await raiseUiCall({ event: 'ui.status', args: { text: long }, caller: caller() });
    const written: string | undefined = writes[writes.length - 1]?.[1];
    assert.equal(written?.length, 10001, '10000 characters and the ellipsis');
    assert.equal(written?.endsWith('…'), true);

    // The table entry is the chain's floor: a handler that answers keeps the session untouched.
    const remove = installChainModule(moduleWith('ui.status', {
      name: 'fixture-answer-status',
      tier: 'user',
      run: async () => ({ value: 'claimed by the plugin' }),
    }));
    try {
      clearChainRecords();
      const before = writes.length;
      const answer = await raiseUiCall({ event: 'ui.status', args: { text: 'mine' }, caller: caller() });
      assert.equal(answer, 'claimed by the plugin');
      assert.equal(writes.length, before, 'the floor did not run');
      assert.equal(currentPluginSession(), session, 'the binding is the source\'s single slot');
    } finally {
      remove();
    }
  } finally {
    unbind();
  }
  assert.equal(currentPluginSession(), undefined, 'unbind clears the slot it bound');
});

test('ui.log floor: the transcript route reports through mce, the debug route does not', async () => {
  clearChainRecords();
  const seen: { plugin: string; text: string }[] = [];
  const off = onPluginUiLog((record) => { seen.push(record); });
  const unbind = bindPluginSession({ status: () => {}, toast: () => {} });
  try {
    clearChainRecords();
    await raiseUiCall({ event: 'ui.log', args: { text: 'hi' }, caller: caller() });
    assert.deepEqual(logs(), ['[fixture-ui] $.ui.log: hi']);
    assert.deepEqual(seen, [{ plugin: 'fixture-ui', text: 'hi' }]);

    // `to:"debug"` is the other route: `Pzo`'s own line, and the subscriber hears nothing.
    clearChainRecords();
    await raiseUiCall({ event: 'ui.log', args: { text: 'dbg', to: 'debug' }, caller: caller() });
    assert.deepEqual(logs(), ['[fixture-ui] $.ui.log (to debug): dbg']);
    assert.equal(seen.length, 1, 'the debug route is not the transcript route');

    // A text over the terminal limit: the notice is written once per plugin and spelling, and the
    // debug route never reaches it (the source passes `void 0` in its place).
    off();
    const gate = installChainModule(passthrough('fixture-notice', 'ui.log'));
    try {
      clearChainRecords();
      await raiseUiCall({ event: 'ui.log', args: { text: 'x'.repeat(2001) }, caller: caller() });
      const notice = '$.ui.log: a text (2001 characters) is drawn up to its first 2000 on the terminal, its first 10000 on a remote surface';
      assert.deepEqual(logs().filter((l) => l.includes(notice)), ['fixture-ui: ' + notice, '[fixture-ui] $.ui.log: ' + notice]);

      clearChainRecords();
      await raiseUiCall({ event: 'ui.log', args: { text: 'y'.repeat(2001) }, caller: caller() });
      assert.deepEqual(logs().filter((l) => l.includes('[fixture-ui] $.ui.log: $.ui.log')), [], 'the notice is not repeated');

      clearChainRecords();
      await raiseUiCall({ event: 'ui.log', args: { text: 'x'.repeat(2001), to: 'debug' }, caller: caller() });
      assert.deepEqual(logs().filter((l) => l.includes('drawn up to')), [], 'the debug route carries no notice');
    } finally {
      gate();
    }

    // Lines written while no subscriber was bound wait for one, and arrive with the `again` state.
    // (The notice lines above were held the same way, so drain them first.)
    clearChainRecords();
    onPluginUiLog(() => {})();
    const held: [string, string][] = [];
    await raiseUiCall({ event: 'ui.log', args: { text: 'held' }, caller: caller('fixture-held') });
    const offLate = onPluginUiLog((record, state) => { held.push([record.plugin + ':' + record.text, state]); });
    assert.deepEqual(held, [['fixture-held:held', 'again']]);
    offLate();
  } finally {
    unbind();
  }
});

test('ui floor checks: the refusals the table entries carry reach the caller through the chain', async () => {
  clearChainRecords();
  const unbind = bindPluginSession({ status: () => {}, toast: () => {} });
  const removeLog = installChainModule(passthrough('fixture-open-log', 'ui.log'));
  const removeStatus = installChainModule(passthrough('fixture-open-status', 'ui.status'));
  try {
    await assert.rejects(
      () => raiseUiCall({ event: 'ui.log', args: { text: 1 }, caller: caller() }),
      /HooksError: ui\.log: takes a string text \(host check\)/,
    );
    await assert.rejects(
      () => raiseUiCall({ event: 'ui.log', args: { text: 'ok', to: 'bogus' }, caller: caller() }),
      /HooksError: ui\.log: to is "transcript" or "debug" \(got "bogus"\) \(host check\)/,
    );
    await assert.rejects(
      () => raiseUiCall({ event: 'ui.status', args: { text: 1 }, caller: caller() }),
      /HooksError: ui\.status: takes a string text \(host check\)/,
    );
    // `ui.status` accepts an absent text — that is its cleared state, not a refusal.
    await raiseUiCall({ event: 'ui.status', args: {}, caller: caller() });
    await raiseUiCall({ event: 'ui.log', args: { text: 'ok' }, caller: caller() });
  } finally {
    removeStatus();
    removeLog();
    unbind();
  }
});
