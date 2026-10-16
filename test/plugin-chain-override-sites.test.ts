import assert from 'node:assert/strict';
import {test} from 'node:test';
import {$be} from '../src/plugin-chain-host.js';
// The registry import is what registers every family.
import '../src/plugin-chain-registry.js';

// The seven value events the source's table writes by hand after the generated spreads
// (`{...co(Q$n, se), ...co(HFs, Bbr), "ui.open": Ni, ...}`): a later key wins, and each of these
// carries an argument rule the generated value site does not have. Sources: chunk-nyce03br.js
// [34559,34627) `Si`, [34627,34678) `Oi`, [36470,36842) `Hi`, [36842,36994) `Ni`, [42466,42756) `oa`,
// [100138,100210) `Pa`, [100210,100308) `Ha`; the plan is research/ports/W45-chain-override-sites-blocks.plan.json.

const site = (name: string) => $be()[name] as {
  event: string;
  check: (answer: unknown, raised: unknown, fromBelow: readonly unknown[]) => unknown;
  checkArgument?: (passed: unknown, received: unknown) => unknown;
  restoreArgument?: (passed: unknown, received: unknown) => unknown;
};

const HAND_WRITTEN = ['ui.open', 'ui.close', 'ui.blit', 'env.get', 'env.set', 'state.get', 'state.set'];

test('override sites: the seven names carry the hand-written descriptor, not the generated one', () => {
  for (const name of HAND_WRITTEN) {
    const entry = site(name);
    assert.equal(entry.event, name);
    assert.equal(typeof entry.check, 'function');
    assert.equal(typeof entry.checkArgument, 'function',
      `${name} is the hand-written site: the generated value site has no checkArgument`);
  }
  assert.equal(typeof site('state.set').restoreArgument, 'function');
  assert.equal(site('env.set').restoreArgument, undefined);
  // A generated value event still has no argument rule, which is what makes the seven above visible.
  assert.equal(site('model.complete').checkArgument, undefined);
  assert.equal(Object.keys($be()).length, 113, '12 hand-written + prompt.edit + 56 values + 32 classic + 7 overrides + 3 classic hand-written + 2 from W45-71');
});

test('override sites: the copied argument rules answer with the source\'s own sentences', () => {
  const open = site('ui.open');
  assert.equal(open.checkArgument?.({id: 'a'}, {id: 'a'}), undefined);
  assert.equal(open.checkArgument?.({id: 'b'}, {id: 'a'}), 'a changed id (the pane being opened; next(e) passes it on)');

  const close = site('ui.close');
  assert.equal(close.checkArgument?.({id: 'a b'}, {id: 'a b'}), 'an unusable id: id is 1 to 64 of letters, digits, _ or -');
  assert.equal(close.checkArgument?.({id: 'abc', origin: {}}, {id: 'ab', origin: {}}),
    'a changed id (the pane being closed; next(e) passes it on)');
  assert.equal(close.checkArgument?.({id: 'ab'}, {id: 'ab'}),
    'no origin (next(e) passes e.origin on; a rewrite spreads it: next({ ...e, id }))');
  assert.equal(close.checkArgument?.({id: 'ab', origin: {x: 1}}, {id: 'ab', origin: {x: 2}}),
    'an origin other than the engine set (next(e) passes e.origin on)');

  const blit = site('ui.blit');
  assert.equal(blit.checkArgument?.({requestId: 1, key: 'k', source: 7}, {requestId: 1, key: 'k'}),
    'a changed requestId, key or kind (the Raster or Image being blitted; next(e) passes them on)');
  assert.equal(blit.checkArgument?.({requestId: 1, key: 'k'}, {requestId: 1, key: 'k'}), undefined);

  const envGet = site('env.get');
  assert.equal(envGet.checkArgument?.({name: 'A'}, {name: 'B'}),
    'a changed name (the variable read or written; next(e) passes it on)');
  const stateGet = site('state.get');
  assert.equal(stateGet.checkArgument?.({plugin: 'p', key: 'k', id: 'i'}, {plugin: 'p', key: 'k', id: 'j'}),
    'a changed reference (plugin, key and id say which value; next(e) passes them on)');

  // The two setters check the answer with `Er`, which appends its own clause when a `deny` arrives
  // after the next() beneath the hook was already answered.
  const envSet = site('env.set');
  assert.equal(envSet.check({value: 1}, {}, []), undefined);
  assert.equal(envSet.check({}, {}, []), 'neither { value } nor { deny }');
  assert.equal(envSet.check({deny: 'no'}, {}, [{deny: undefined}]),
    'a deny after its next() was answered (deny in place of next)');

  const stateSet = site('state.set');
  assert.equal(stateSet.checkArgument?.({plugin: 'p', key: 'k', id: 'i', ifVersion: 3, previous: 1},
    {plugin: 'p', key: 'k', id: 'i', ifVersion: 2, previous: 1}),
  'a changed ifVersion (the condition is the caller\'s)');
  assert.equal(stateSet.checkArgument?.({plugin: 'p', key: 'k', id: 'i', ifVersion: 3, previous: 1},
    {plugin: 'p', key: 'k', id: 'i', ifVersion: 3, previous: 2}),
  'a changed previous (the host stamps it)');
});

test('override sites: state.set restores only the keys a rewrite dropped', () => {
  const stateSet = site('state.set');
  const received = {plugin: 'p', key: 'k', id: 'i', previous: {a: 2}, ifVersion: 8, value: 1};
  // `m$` fills a key back only when the passed object does not own it, so a rewrite that dropped
  // `previous` and `ifVersion` gets them back and then passes the check (the reference keys, which
  // `Bt` pins, are the rewrite's own to keep).
  const rewrite = {plugin: 'p', key: 'k', id: 'i', value: 5};
  const filled = stateSet.restoreArgument?.(rewrite, received) as Record<string, unknown>;
  assert.deepEqual(filled, {plugin: 'p', key: 'k', id: 'i', value: 5, previous: {a: 2}, ifVersion: 8});
  assert.equal(stateSet.checkArgument?.(filled, received), undefined);
  // A rewrite that kept its own `previous` keeps it: the host's value does not overwrite the hook's.
  assert.deepEqual(stateSet.restoreArgument?.({...rewrite, previous: {a: 9}}, received),
    {plugin: 'p', key: 'k', id: 'i', value: 5, previous: {a: 9}, ifVersion: 8});
});
