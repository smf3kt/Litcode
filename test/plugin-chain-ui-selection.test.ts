// The `$` call table's ui.selection floor (W45-47). The entry `"ui.selection":{run:u2t}` sits verbatim
// in src/plugin-chain-ui.ts (chunk-sfn1dbxq.js [2353525,2353549) 24 units) and its whole floor is the
// copied `u2t` (chunk-sfn1dbxq.js [1869714,1869767) 53 units) in src/plugin-chain-ui-source.ts:
// `()=>Promise.resolve(bI()?.selection?.read())`. These tests bind what that body answers — the bound
// context's own selection, `undefined` for a context without one and for no context at all, and the
// absence of a check in front of it.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import '../src/plugin-chain-registry.js';
import { installChainModule } from '../src/plugin-chain-host.js';
import { bI } from '../src/plugin-chain-loader-source.js';
import { bindPluginSession, raiseUiCall, uiCallTable } from '../src/plugin-chain-ui.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const caller = (plugin = 'fixture-selection') => ({ plugin, origin: ORIGIN });

/** A session that answers no writes; only its `selection` matters here. */
const session = (selection?: { read: () => unknown }) => ({ status: () => {}, toast: () => {}, ...(selection && { selection }) });

function moduleWith(event: string, handler: ChainHandler): ChainModule {
  return { name: handler.name, tier: handler.tier, hooks: (e: string) => e === event, record: () => handler };
}

test('ui.selection answers the bound context\'s selection, read through its own accessor', async () => {
  assert.equal(bI(), undefined, 'nothing bound: the loader context is undefined');

  const seen: string[] = [];
  const selection = { read: () => { seen.push('read'); return { text: 'the selected text', surface: 'terminal' }; } };
  const unbind = bindPluginSession(session(selection));
  try {
    assert.equal(bI()?.selection, selection, 'the bound context is what the floor reads');
    assert.deepEqual(await raiseUiCall({ event: 'ui.selection', args: {}, caller: caller() }),
      { text: 'the selected text', surface: 'terminal' });
    assert.deepEqual(seen, ['read'], 'the accessor is called, not the value taken');
  } finally {
    unbind();
  }
});

test('no context, and a context without a selection, both answer undefined rather than throwing', async () => {
  assert.equal(await raiseUiCall({ event: 'ui.selection', args: {}, caller: caller() }), undefined);

  const unbind = bindPluginSession(session());
  try {
    assert.equal(await raiseUiCall({ event: 'ui.selection', args: {}, caller: caller() }), undefined);
  } finally {
    unbind();
  }
});

test('the entry has no check: any argument reaches the floor unchanged', async () => {
  const unbind = bindPluginSession(session({ read: () => 'selection without arguments' }));
  try {
    // A check would be reached only through a handler (W45-20's `Hze`), and this entry carries none,
    // so even a passing handler sees the argument handed on as it stands.
    const gate = installChainModule(moduleWith('ui.selection', {
      name: 'fixture-selection-check',
      tier: 'user',
      // `next()` answers the floor's own `{value}` answer, which the dispatch unwraps: handing it back
      // as it stands is what a passthrough does.
      run: async (args: unknown, next: (value: unknown) => Promise<unknown>) => await next(args),
    } as unknown as ChainHandler));
    try {
      assert.equal(await raiseUiCall({ event: 'ui.selection', args: 7, caller: caller() }), 'selection without arguments');
      assert.equal(await raiseUiCall({ event: 'ui.selection', args: {}, caller: caller() }), 'selection without arguments');
      assert.equal(uiCallTable()['ui.selection'].check, undefined, 'the source gives this entry a run and nothing else');
    } finally {
      gate();
    }
  } finally {
    unbind();
  }
});

test('a handler in the chain answers the call before the floor', async () => {
  const unbind = bindPluginSession(session({ read: () => 'from the floor' }));
  const gate = installChainModule(moduleWith('ui.selection', {
    name: 'fixture-selection-answer',
    tier: 'user',
    run: async () => ({ value: 'from the handler' }),
  } as unknown as ChainHandler));
  try {
    assert.equal(await raiseUiCall({ event: 'ui.selection', args: {}, caller: caller() }), 'from the handler');
  } finally {
    gate();
    unbind();
  }
});

test('the table now binds five ui names', async () => {
  // W45-57 added `ui.notify` beside the four this suite's package bound.
  assert.equal(Object.keys(uiCallTable()).sort().join(','), 'ui.blit,ui.log,ui.notify,ui.selection,ui.status,ui.toast');
});
