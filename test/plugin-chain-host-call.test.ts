// The module-to-host call path (W45-20): the raise a plugin method call funnels into. The raise
// machinery is this package's copy (src/plugin-chain-host-call-source.ts, `Hze`
// chunk-sfn1dbxq.js [1842591,1843388)); this test binds its three observable rules to the source's
// own bodies: a chain with no handler runs the call table's floor directly, a chain with one answers
// through it, and only the twelve names in `Cme` get a copied argument on the dispatch path. The
// last case covers the placeholder this package retired: `TDe` (chunk-n3ykh62m.js
// [266967,267031)) used to hand the answer through, and now copies it for the four `_yt` names.

import assert from 'node:assert/strict';
import { test } from 'node:test';

// The registry import installs the environment host factory and registers every chain site.
import '../src/plugin-chain-registry.js';
import { ga } from '../src/plugin-chain-entry.js';
import { clearChainRecords, installChainModule } from '../src/plugin-chain-host.js';
import { hostCallCopied, raiseHostCall } from '../src/plugin-chain-host-call.js';
import { TDe } from '../src/plugin-chain-host-call-source.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const caller = (plugin = 'fixture-host-call') => ({ plugin, origin: ORIGIN });

function moduleWith(events: string[], handler: ChainHandler): ChainModule {
  return {
    name: handler.name,
    tier: handler.tier,
    hooks: (event: string) => events.includes(event),
    record: () => handler,
  };
}

test('host call: a name no module hooks runs the floor with the caller\'s own argument', async () => {
  clearChainRecords();
  const seen: unknown[] = [];
  const args = { text: 'hello' };
  const floor = {
    run: (received: unknown) => {
      seen.push(received);
      return `floor:${(received as { text: string }).text}`;
    },
  };

  const answer = await raiseHostCall({ event: 'ui.log', args, caller: caller(), bottom: floor });
  assert.equal(answer, 'floor:hello');
  // `Hze`'s short circuit: no handlers and a floor means the floor is the whole call — no dispatch,
  // no copy, no `check`. The object it receives is the caller's.
  assert.equal(seen.length, 1);
  assert.equal(seen[0], args);

  const remove = installChainModule(moduleWith(['ui.log'], {
    name: 'fixture-answer',
    tier: 'user',
    run: async () => ({ value: 'from-hook' }),
  }));
  try {
    const hooked = await raiseHostCall({ event: 'ui.log', args, caller: caller(), bottom: floor });
    assert.equal(hooked, 'from-hook', 'a hooked name answers through its handler');
    assert.equal(seen.length, 1, 'the floor does not run when a handler answers');
  } finally {
    remove();
  }

  const removeDeny = installChainModule(moduleWith(['ui.log'], {
    name: 'fixture-deny',
    tier: 'user',
    run: async () => ({ deny: 'the plugin refused this write' }),
  }));
  try {
    await assert.rejects(
      () => raiseHostCall({ event: 'ui.log', args, caller: caller(), bottom: floor }),
      // The source's own text: `${caller.plugin}: $.${event}: ${deny}`.
      /HooksError: fixture-host-call: \$\.ui\.log: the plugin refused this write/,
    );
  } finally {
    removeDeny();
  }
});

test('host call: the twelve copied names run the argument through the copier, the rest do not', async () => {
  clearChainRecords();
  assert.equal(hostCallCopied('ui.log'), true);
  assert.equal(hostCallCopied('ui.status'), true);
  assert.equal(hostCallCopied('prompt.read'), false);

  const seen: unknown[] = [];
  const floor = {
    check: (received: unknown) => (typeof (received as { text?: unknown }).text === 'string' ? undefined : 'takes a string text'),
    run: (received: unknown) => {
      seen.push(received);
      return 'floor';
    },
  };

  const remove = installChainModule(moduleWith(['ui.log', 'prompt.read', 'interface.call'], {
    name: 'fixture-passthrough',
    tier: 'user',
    // `next` hands the call down to the floor, which is where the copier is observable.
    run: async (input: unknown, next: (value: unknown) => Promise<unknown>) => await next(input),
  }));
  try {
    // The copier is `tIt`, which rebuilds only what it repairs: a lone surrogate is replaced on the
    // way down, and the caller's own object is untouched.
    const loneSurrogate = { text: 'he\ud800llo', nested: { deep: 1 } };
    await raiseHostCall({ event: 'ui.log', args: loneSurrogate, caller: caller(), bottom: floor });
    const repaired = seen.at(-1) as typeof loneSurrogate;
    assert.notEqual(repaired, loneSurrogate);
    assert.equal(repaired.text, 'he�llo');
    assert.equal(loneSurrogate.text, 'he\ud800llo', 'the caller\'s argument is not mutated');
    assert.equal(repaired.nested, loneSurrogate.nested, 'an untouched subtree stays shared');

    // A well-formed argument is already well-formed, so the copier hands the same object on.
    const wellFormed = { text: 'hello' };
    await raiseHostCall({ event: 'ui.log', args: wellFormed, caller: caller(), bottom: floor });
    assert.equal(seen.at(-1), wellFormed);

    // `prompt.read` is not one of the twelve, so the same argument arrives as it left the caller.
    await raiseHostCall({ event: 'prompt.read', args: loneSurrogate, caller: caller(), bottom: floor });
    assert.equal(seen.at(-1), loneSurrogate);
    assert.equal((seen.at(-1) as typeof loneSurrogate).text, 'he\ud800llo');

    // The table entry's `check` runs on the dispatch path only, so it is observable here and not
    // on a call no module hooks. Its refusal is the source's own `${event}: ${text} (host check)`.
    await assert.rejects(
      () => raiseHostCall({
        event: 'ui.log',
        args: { text: 'hello' },
        caller: caller(),
        bottom: { check: () => 'takes a string text', run: () => 'unreachable' },
      }),
      /HooksError: ui\.log: takes a string text \(host check\)/,
    );
    // A two-segment name whose first segment is no catalog group (`Z$n`) and whose args are no
    // object is refused before the dispatch — and after the short circuit, so it takes a hooked name
    // to be reachable at all. `ui.log` is not such a name: `ui` is a catalog group, so the refusal
    // belongs to the floor's own `check` there.
    await assert.rejects(
      () => raiseHostCall({ event: 'interface.call', args: 'not an object', caller: caller(), bottom: floor }),
      /its input is no object, which the hooks on it \(fixture-passthrough\) take as e; pass one/,
    );
  } finally {
    remove();
  }
});

test('host call: the entry path runs the four copied chain names through the copier', async () => {
  clearChainRecords();
  const answer = { label: 'Theme', description: 'the colour \ud800 scheme', isHidden: false };
  const core = { name: 'core', tier: 'core' as const, run: async () => answer };

  const copied = (await ga('config.describe', { origin: ORIGIN, core: { 'config.describe': core } })({ key: 'theme' })) as typeof answer;
  assert.notEqual(copied, answer, 'config.describe is one of the four names `ga` copies');
  assert.equal(copied.description, 'the colour � scheme');
  assert.equal(answer.description, 'the colour \ud800 scheme', 'the core\'s own answer is untouched');
  assert.equal(copied.isHidden, false);

  // Outside `_yt` the answer is handed back exactly as the core returned it, and `TDe` on its own
  // follows the same rule: the same object when there is nothing to repair, a new one when there is.
  const plain = { text: 'plain', cursor: 5 };
  const outside = await ga('prompt.edit', { origin: ORIGIN, core: { 'prompt.edit': { ...core, run: async () => plain } } })({ text: 'x' });
  assert.equal(outside, plain);
  assert.equal(TDe(plain), plain);
  assert.notEqual(TDe({ ...plain, text: 'a\udfff' }), undefined);
  assert.equal(TDe('a string'), 'a string', 'a primitive string comes back repaired or as it is');
});
