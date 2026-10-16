// W45-13 against the built artifact: the seven value sites the source's table writes by hand over the
// generated spread. Sources: dist/plugin-chain-override-sites-source.js, dist/plugin-chain-registry.js
// (which registers every family) and dist/plugin-chain-host.js (`$be` reads the registered table).
import assert from 'node:assert/strict';
import { Ha, Hi, Ni, Oi, Pa, Si, oa } from '../dist/plugin-chain-override-sites-source.js';
import { $be } from '../dist/plugin-chain-host.js';
import '../dist/plugin-chain-registry.js';

const HAND_WRITTEN = { 'ui.open': Ni, 'ui.close': Hi, 'ui.blit': oa, 'env.get': Si, 'env.set': Oi, 'state.get': Pa, 'state.set': Ha };
const site = (name) => $be()[name];

// The registered table holds the hand-written descriptor for each of the seven, not the generated one.
for (const [name, handWritten] of Object.entries(HAND_WRITTEN)) {
  assert.equal(site(name), handWritten, `${name} is the hand-written site object itself`);
  assert.equal(site(name).event, name);
  assert.equal(typeof site(name).checkArgument, 'function', `${name}: the generated value site has no argument check`);
}
assert.equal(typeof site('state.set').restoreArgument, 'function');
assert.equal(site('model.complete').checkArgument, undefined, 'a generated value event still takes no argument check');
assert.equal(Object.keys($be()).length, 113, '12 + prompt.edit + 56 + 32 + 7 + 3 + ui.scroll + ui.focus (W45-71)');

// The sentences, measured through the registered sites.
assert.equal(site('ui.open').checkArgument({ id: 'b' }, { id: 'a' }),
  'a changed id (the pane being opened; next(e) passes it on)');
assert.equal(site('ui.close').checkArgument({ id: 'a b' }, { id: 'a b' }),
  'an unusable id: id is 1 to 64 of letters, digits, _ or -');
assert.equal(site('ui.close').checkArgument({ id: 'ab' }, { id: 'ab' }),
  'no origin (next(e) passes e.origin on; a rewrite spreads it: next({ ...e, id }))');
assert.equal(site('ui.close').checkArgument({ id: 'ab', origin: { x: 1 } }, { id: 'ab', origin: { x: 2 } }),
  'an origin other than the engine set (next(e) passes e.origin on)');
assert.equal(site('ui.blit').checkArgument({ requestId: 1, key: 'k', source: 7 }, { requestId: 1, key: 'k' }),
  'a changed requestId, key or kind (the Raster or Image being blitted; next(e) passes them on)');
assert.equal(site('env.get').checkArgument({ name: 'A' }, { name: 'B' }),
  'a changed name (the variable read or written; next(e) passes it on)');
assert.equal(site('state.get').checkArgument({ plugin: 'p', key: 'k', id: 'i' }, { plugin: 'p', key: 'k', id: 'j' }),
  'a changed reference (plugin, key and id say which value; next(e) passes them on)');

// The two setters use `Er`, whose deny clause fires only when a deny arrives after the next() beneath
// the hook was answered.
assert.equal(site('env.set').check({ value: 1 }, {}, []), undefined);
assert.equal(site('env.set').check({}, {}, []), 'neither { value } nor { deny }');
assert.equal(site('env.set').check({ deny: 'no' }, {}, [{ deny: undefined }]),
  'a deny after its next() was answered (deny in place of next)');

// `state.set`'s restore fills back only the keys a rewrite dropped, and the restored argument passes.
const received = { plugin: 'p', key: 'k', id: 'i', previous: { a: 2 }, ifVersion: 8, value: 1 };
const filled = site('state.set').restoreArgument({ plugin: 'p', key: 'k', id: 'i', value: 5 }, received);
assert.deepEqual(filled, { plugin: 'p', key: 'k', id: 'i', value: 5, previous: { a: 2 }, ifVersion: 8 });
assert.equal(site('state.set').checkArgument(filled, received), undefined);
assert.equal(site('state.set').checkArgument({ ...filled, ifVersion: 3 }, received),
  "a changed ifVersion (the condition is the caller's)");
assert.equal(site('state.set').checkArgument({ ...filled, previous: { a: 2, b: 1 } }, received),
  'a changed previous (the host stamps it)');

console.log('W45ChainOverrideSitesCompiled.v1');
