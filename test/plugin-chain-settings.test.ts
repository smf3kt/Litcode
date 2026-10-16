// The `$` table's `settings.read` (W45-53). The ported bodies are src/plugin-chain-settings-read-source.ts
// and the entry sits verbatim in src/plugin-chain-settings.ts (chunk-sfn1dbxq.js [2354546,2354605)).
// These tests call the seam the way the plugin-method dispatcher does and assert what the source really
// does: the five source names, the check's refusals, the JSON copy the body answers with, the file name
// the store is asked for, and the refusal this seam owns while the settings store itself is unported.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import '../src/plugin-chain-registry.js';
import { installChainModule } from '../src/plugin-chain-host.js';
import { raiseHostCall } from '../src/plugin-chain-host-call.js';
import {
  bindSettingsStore, checkSettingsRead, copySettingsValue, raiseSettingsRead, readSettings,
  settingsReadEntry, SETTINGS_SOURCES,
} from '../src/plugin-chain-settings.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const caller = { plugin: 'fixture-settings', origin: ORIGIN };

function moduleWith(event: string, handler: ChainHandler): ChainModule {
  return { name: handler.name, tier: handler.tier, hooks: (e: string) => e === event, record: () => handler };
}

test('the five source names, and the check that admits only them', () => {
  assert.deepEqual(SETTINGS_SOURCES, {
    user: 'userSettings',
    project: 'projectSettings',
    local: 'localSettings',
    flag: 'flagSettings',
    policy: 'policySettings',
  });
  // The entry is `check:(n)=>yGo(n?.source)`: the check reads the argument's `source`, so an argument
  // with none is admitted, and what is refused is a source that is neither absent nor a known name.
  const refused = 'takes { source } naming one of user, project, local, flag, policy';
  assert.equal(checkSettingsRead(undefined), undefined, 'no argument is admitted');
  assert.equal(checkSettingsRead({}), undefined, 'an argument with no source is admitted');
  assert.equal(checkSettingsRead({ source: 'user' }), undefined);
  assert.equal(checkSettingsRead({ source: 'policy' }), undefined);
  assert.equal(checkSettingsRead('user'), undefined, 'a bare string has no source either');
  assert.equal(checkSettingsRead({ source: 'nope' }), `${refused} (got nope)`, 'an unknown name echoes itself');
  assert.equal(checkSettingsRead({ source: 1 }), `${refused} (got number)`);
  assert.equal(checkSettingsRead({ source: {} }), `${refused} (got object)`);
  assert.equal(checkSettingsRead({ source: null }), `${refused} (got object)`);
});

test('the answer is a JSON copy, not the store\'s own object', async () => {
  assert.equal(copySettingsValue(undefined), undefined, 'undefined stays undefined');
  assert.equal(copySettingsValue(null), null);
  assert.deepEqual(copySettingsValue({ a: [1, { b: 2 }] }), { a: [1, { b: 2 }] });

  const held = { theme: 'dark', nested: { width: 100 } };
  bindSettingsStore({ all: () => held, one: () => held });
  try {
    const answer = await readSettings({}) as typeof held;
    assert.deepEqual(answer, held);
    assert.notEqual(answer, held, 'the caller gets its own object');
    answer.theme = 'mutated';
    answer.nested.width = 1;
    assert.equal(held.theme, 'dark', 'the store is untouched');
    assert.equal(held.nested.width, 100);
  } finally {
    bindSettingsStore(undefined);
  }
});

test('with no source the merged settings come back; a source asks the store for its file', async () => {
  const asked: (string | undefined)[] = [];
  bindSettingsStore({
    all: () => ({ merged: true }),
    one: (source) => { asked.push(source); return source === 'flagSettings' ? null : { from: source }; },
  });
  try {
    assert.deepEqual(await readSettings({}), { merged: true });
    assert.deepEqual(await readSettings({ source: 'project' }), { from: 'projectSettings' });
    assert.deepEqual(await readSettings({ source: 'flag' }), {}, 'a source the store answers null for is {}');
    assert.deepEqual(await readSettings({ source: 'bogus' }), {}, 'a name the check would refuse is {} here');
    assert.deepEqual(asked, ['projectSettings', 'flagSettings', undefined], 'the store is asked by file name');
  } finally {
    bindSettingsStore(undefined);
  }
});

test('a value the JSON helpers cannot carry is their error, not a silent answer', async () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  bindSettingsStore({ all: () => circular, one: () => ({}) });
  try {
    // The store is read before the promise is built, so this throws synchronously (the source's own
    // `Promise.resolve(ZH(…))` shape); an async thunk turns it into the rejection under test.
    await assert.rejects(async () => readSettings({}), /Converting circular structure to JSON/);
  } finally {
    bindSettingsStore(undefined);
  }
});

test('the store the ported bodies read through must be bound', async () => {
  await assert.rejects(async () => readSettings({}), /the settings store is not bound; bindSettingsStore\(\) installs one/);
  await assert.rejects(async () => readSettings({ source: 'user' }), /the settings store is not bound/);
  assert.equal(checkSettingsRead({ source: 'user' }), undefined, 'the check does not need the store');
});

test('the entry is the table\'s shape: the check in front of the body', async () => {
  const entry = settingsReadEntry();
  assert.equal(typeof entry.check, 'function');
  assert.equal(typeof entry.run, 'function');
  bindSettingsStore({ all: () => ({ merged: true }), one: () => ({}) });
  try {
    assert.deepEqual(await entry.run?.({}, caller), { merged: true });
    assert.equal(entry.check?.({ source: 'bogus' }, caller), 'takes { source } naming one of user, project, local, flag, policy (got bogus)');
  } finally {
    bindSettingsStore(undefined);
  }
});

test('raised through the chain, the refusal reaches the caller, and the floor answers', async () => {
  bindSettingsStore({ all: () => ({ merged: true }), one: () => ({}) });
  try {
    assert.deepEqual(
      await raiseSettingsRead({ args: {}, caller }),
      { merged: true },
      'with no handler the call short-circuits to the floor',
    );
  } finally {
    bindSettingsStore(undefined);
  }

  const remover = installChainModule(moduleWith('settings.read', {
    name: 'fixture-settings-read',
    tier: 'user',
    run: async (args: unknown, next: (value: unknown) => Promise<unknown>) => ({ value: await next(args) }),
  } as ChainHandler));
  bindSettingsStore({ all: () => ({ merged: true }), one: () => ({}) });
  try {
    await assert.rejects(
      () => raiseSettingsRead({ args: { source: 'bogus' }, caller }),
      /HooksError: settings\.read: takes \{ source \} naming one of user, project, local, flag, policy \(got bogus\) \(host check\)/,
    );
    assert.deepEqual(
      await raiseSettingsRead({ args: {}, caller }),
      { value: { merged: true } },
      'with a handler, the chain answers with what the handler returned around the floor\'s value',
    );
  } finally {
    bindSettingsStore(undefined);
    remover();
  }

  // The body has no guard of its own — the check is what guards it, and the no-handler path skips the
  // check (the shape W45-20 recorded) — so an absent argument fails inside `hGo` itself.
  await assert.rejects(async () => raiseHostCall({ event: 'settings.read', args: undefined, caller, bottom: settingsReadEntry() }),
    /Cannot read properties of undefined \(reading 'source'\)/);

  // With an argument, the refusal this seam owns is what reaches the caller while the store is unbound.
  await assert.rejects(async () => raiseHostCall({ event: 'settings.read', args: {}, caller, bottom: settingsReadEntry() }),
    /the settings store is not bound; bindSettingsStore\(\) installs one/);
});
