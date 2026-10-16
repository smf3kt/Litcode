// The local settings store (W45-56). The ported body is src/plugin-chain-local-store-source.ts
// (13 blocks, 6,401 units: ten statements from chunk-4bw62nzm.js and the policy pin with its state
// and setter from chunk-k1419ccf.js) and the seam is src/plugin-chain-local-store.ts. These tests
// call the store the way the settings path does — one store per host, seeded parsed files, install
// verdicts — and assert what the source really answers.
//
// The pin is write-once per process (a disagreeing value answers `conflict` and leaves the flag), so
// the test that pins it is declared last.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  bindLocalStore, bindLocalStoreHost, changedSourceKeys, Ht, isPolicyPinned, ji, localStore,
  normalizeEmptySettings, setPolicyPin, wrapSourceSnapshot,
} from '../src/plugin-chain-local-store.js';
import { F8e, j } from '../src/plugin-chain-local-store-source.js';

const host = () => ({});

test('the store is one per host, and ji answers it', () => {
  const a = host();
  const b = host();
  assert.equal(localStore(a), localStore(a), 'the same host key answers the same store');
  assert.notEqual(localStore(a), localStore(b), 'a different host key builds its own');
  assert.ok(localStore(a) instanceof F8e);
  assert.ok(ji() instanceof F8e, 'with nothing bound, ji answers the process store');

  bindLocalStoreHost(a);
  assert.equal(ji(), localStore(a), 'binding the host points the default store at it');
  bindLocalStoreHost(host());

  // The narrower handle W45-54 introduced still wins while it is bound, which is how the
  // settings-source suite substitutes a probe cache.
  const store = localStore(b);
  bindLocalStore({ localStoreProbes: store.localStoreProbes });
  assert.notEqual(ji(), store);
  assert.equal(ji().localStoreProbes, store.localStoreProbes);
  bindLocalStore(undefined);
  assert.ok(ji() instanceof F8e, 'unbinding restores the real store');
});

test('a fresh store carries the fields the settings readers read', () => {
  const store = localStore(host());
  assert.equal(store.mergedSettings, null);
  assert.equal(store.isLoadingFromDisk, false);
  assert.equal(store.epoch, 0);
  assert.equal(store.pluginBase, undefined);
  assert.equal(store.pluginBaseLoaded, false);
  assert.equal(store.lastPolicyEnvComposition, null);
  assert.equal(store.autoModeUntrustedSourceWarned, false);
  assert.equal(store.systemSpaceServingLogged, false);
  assert.equal(store.systemAttestationContradicted, false);
  assert.equal(store.enabledSources, undefined, 'a field the source declares but does not initialize');
  assert.equal(store.repoTierFreeze.holders, 0);
  assert.equal(store.repoTierFreeze.tiers, undefined);
  assert.ok(store.localStoreProbes instanceof Ht, 'the store owns its own probe cache');
  assert.equal(store.perSource.size, 0);
  assert.equal(store.parsedFiles.size, 0);
  assert.equal(store.folderListings.size, 0);
  assert.equal(store.managedFileReads.size, 0);
  assert.equal(store.walkedFolders.size, 0);
  assert.equal(store.policyWalkCount, 0, 'a getter over the walk counter, not a field');
  assert.equal(typeof store.onInvalidate, 'function');
});

test('the empty-settings normalize and the snapshot the diff compares', () => {
  assert.equal(normalizeEmptySettings({}), null);
  assert.equal(normalizeEmptySettings(null), null);
  assert.deepEqual(normalizeEmptySettings({ a: 1 }), { a: 1 });

  assert.deepEqual(wrapSourceSnapshot({ source: 'user', settings: {}, unfiltered: {}, legacy: {} }), {
    source: 'user', settings: null, unfiltered: null, legacy: null,
  });
  assert.deepEqual(wrapSourceSnapshot({ settings: { a: 1 }, unfiltered: { b: 2 } }), {
    settings: { a: 1 }, unfiltered: { b: 2 },
  }, 'no legacy key is added when the entry carries none');
  // The source's own limit, measured rather than smoothed over: both fields are passed through
  // `Object.keys`, so an entry that carries only `settings` throws.
  assert.throws(() => wrapSourceSnapshot({ source: 'user', settings: { a: 1 } }), (error: unknown) => {
    assert.ok(error instanceof TypeError);
    assert.equal((error as Error).message, 'Cannot convert undefined or null to object');
    return true;
  });
});

test('the changed-source keys are the entries whose snapshots differ', () => {
  const entry = (settings: unknown) => ({ settings, unfiltered: settings });
  const left = new Map<string, unknown>([
    ['user', entry({ a: 1 })], ['project', entry({ b: 1 })], ['gone', entry({ c: 1 })],
  ]);
  const right = new Map<string, unknown>([
    ['user', entry({ a: 1 })], ['project', entry({ b: 2 })], ['added', entry({ d: 1 })],
  ]);
  assert.deepEqual(changedSourceKeys(left, right), ['project', 'gone', 'added']);
  assert.deepEqual(changedSourceKeys(new Map(), new Map()), []);
  // A key on one side only differs by construction: the missing side is `undefined`.
  assert.deepEqual(changedSourceKeys(new Map([['z', entry({})]]), new Map([['a', entry({})]])), ['z', 'a']);
});

test('the store clears its plugin base, drops every cache and bumps the epoch', () => {
  const store = localStore(host());
  store.setPluginBase({ marker: 1 });
  assert.deepEqual(store.pluginBase, { marker: 1 });
  assert.equal(store.pluginBaseLoaded, true);
  store.clearPluginBase();
  assert.equal(store.pluginBase, undefined);

  // The field is typed from its `null` initializer, so the test writes it through a wider view.
  (store as { mergedSettings: unknown }).mergedSettings = { a: 1 };
  store.perSource.set('userSettings', { settings: { a: 1 }, unfiltered: { a: 1 } });
  store.seedParsedFile('/tmp/w45-56.json', 'userSettings', { a: 1 }, store.epoch);
  assert.equal(store.parsedFiles.size, 1);
  store.invalidateAll({});
  assert.equal(store.epoch, 1);
  assert.equal(store.mergedSettings, null);
  assert.equal(store.perSource.size, 0);
  assert.equal(store.parsedFiles.size, 0);
  assert.equal(store.policyWalkCount, 0);
  assert.equal(store.folderListings.size, 0);
  assert.equal(store.walkedFolders.size, 0);
});

test('the epoch guards, and the listing caches the walk reads', () => {
  const store = localStore(host());
  assert.equal(store.seedParsedFile('/tmp/w45-56-stale.json', 'userSettings', { a: 1 }, 42), false);
  assert.equal(store.parsedFiles.size, 0);
  assert.equal(store.seedParsedFile('/tmp/w45-56-fresh.json', 'userSettings', { a: 1 }, store.epoch), true);
  assert.equal(store.parsedFiles.size, 1);
  assert.equal(store.walkReadDiffers('/tmp/w45-56-fresh.json', { a: 2 }), false, 'the file is primed, so it does not differ');
  assert.equal(store.unseedParsedFile('/tmp/w45-56-fresh.json', 'userSettings', 42), undefined, 'a stale epoch unseeds nothing');
  assert.equal(store.parsedFiles.size, 1, 'and the file is still parsed');
  store.unseedParsedFile('/tmp/w45-56-fresh.json', 'userSettings', store.epoch);
  assert.equal(store.parsedFiles.size, 0);
  assert.equal(store.walkReadDiffers('/tmp/w45-56-fresh.json', { a: 2 }), false, 'an unparsed file does not differ either');

  assert.equal(store.seedFolderListing('/tmp/w45-56-folder', { entries: [] }, 42), false);
  assert.equal(store.folderListings.size, 0);
  assert.equal(store.seedFolderListing('/tmp/w45-56-folder', { entries: [] }, store.epoch), true);
  assert.equal(store.folderListings.size, 1);
  store.clearFolderListing('/tmp/w45-56-folder', store.epoch);
  assert.equal(store.folderListings.size, 0);
  // A retained layer and a retained listing are undone by the closure the store hands back, and a
  // stale closure leaves a newer entry alone.
  const undoFirst = store.retainLayer('userSettings', { a: 1 });
  assert.equal(store.retained.size, 1);
  undoFirst();
  assert.equal(store.retained.size, 0);
  const undoOne = store.retainLayer('userSettings', { a: 1 });
  const undoTwo = store.retainLayer('userSettings', { a: 2 });
  undoOne();
  assert.deepEqual(store.retained.get('userSettings'), { parsed: { a: 2 } });
  undoTwo();
  assert.equal(store.retained.size, 0);
  const undoListing = store.retainFolderListing('/tmp/w45-56-folder', { entries: [] });
  assert.equal(typeof undoListing, 'function');
  undoListing();
  assert.equal(store.retainedListings.size, 0);
});

test('a policy verdict is an install until a walk has been counted', () => {
  const store = localStore(host());
  const file = '/tmp/w45-56-verdict/drop.json';
  // Nothing parsed: the source has nothing to compare against, so the answer is to install.
  assert.equal(store.policyInstallVerdict(file, { a: 1 }, 3), 'install');
  assert.equal(store.seedParsedFile(file, 'userSettings', { a: 1 }, store.epoch), true);
  assert.equal(store.policyInstallVerdict(file, { a: 1 }, 3), 'install', 'the same parse is an install');
  assert.equal(store.policyInstallVerdict(file, { a: 2 }, 3), 'install', 'a change with no walk yet is an install');
  assert.equal(store.policyInstallVerdict(file, { a: 2 }, -1), 'install',
    'the threshold is read only past the walk check, so it cannot race on its own');
  // An unprimed parsed file is a race before the threshold is read.
  store.primedFiles.delete(file);
  assert.equal(store.policyInstallVerdict(file, { a: 2 }, 3), 'raced');
  assert.equal(store.policyInstallVerdict(file, { a: 1 }, 3), 'install', 'an equal parse still answers first');

  // With the pin off, `folderListingForPolicyWalk` returns early and counts nothing, so the walk
  // counter cannot move and the listing cache is not readable.
  assert.equal(store.folderListingForPolicyWalk('/tmp/w45-56-verdict'), undefined);
  assert.equal(store.policyWalkCount, 0);
  assert.equal(store.seedFolderListing('/tmp/w45-56-verdict', { entries: ['drop.json'] }, store.epoch), true);
  assert.equal(store.primedFolderListing('/tmp/w45-56-verdict'), undefined,
    'the pin gates the listing read, not just the walk');
  // Unwalked folders: a parsed drop-in the listing does not mention is a race, otherwise an install.
  assert.equal(store.folderInstallVerdict('/tmp/w45-56-verdict', [], 3), 'raced', 'the drop-in is not listed');
  assert.equal(store.folderInstallVerdict('/tmp/w45-56-verdict', ['drop.json'], 3), 'install');
  assert.equal(store.folderInstallVerdict('/tmp/w45-56-empty', [], 3), 'install', 'no drop-in, no walk');
});

test('the policy pin is write-once, and it gates the walk', () => {
  assert.equal(isPolicyPinned(), false, 'nothing pinned the flag yet');
  assert.equal(typeof j(), 'boolean');
  assert.equal(setPolicyPin(true), 'pinned');
  assert.equal(isPolicyPinned(), true);
  assert.equal(setPolicyPin(true), 'unchanged');
  assert.equal(setPolicyPin(false), 'conflict');
  assert.equal(isPolicyPinned(), true, 'a conflict leaves the flag alone, so the pin cannot be undone');

  // With the flag pinned the walk is live: the counter moves, the listing cache is readable, and the
  // policy verdict gains its deferred and raced arms.
  const store = localStore(host());
  const folder = '/tmp/w45-56-pinned';
  const file = '/tmp/w45-56-pinned.json';
  assert.equal(store.seedParsedFile(file, 'userSettings', { a: 1 }, store.epoch), true);
  assert.equal(store.folderListingForPolicyWalk(folder), undefined);
  assert.equal(store.policyWalkCount, 1);
  assert.equal(store.policyInstallVerdict(file, { a: 2 }, 3), 'deferred');
  assert.equal(store.policyInstallVerdict(file, { a: 2 }, -1), 'raced');
  // The walk request noted the folder as walked with no listing; `noteWalkListing` replaces that
  // without counting a second walk.
  store.noteWalkListing(folder, { entries: ['a'] });
  assert.equal(store.policyWalkCount, 1, 'only the walk request counts, not the note');
  assert.equal(store.primedFolderListing(folder), undefined, 'nothing is in the listing cache yet');
  assert.equal(store.seedFolderListing(folder, { entries: ['a'] }, store.epoch), true);
  assert.equal(store.primedFolderListing(folder)?.entries?.[0], 'a', 'the seeded listing is what the cache answers');
  assert.equal(store.folderInstallVerdict(folder, { entries: ['a'] }, 3), 'install',
    'the walked listing matches, so nothing changed');
  assert.equal(store.folderInstallVerdict(folder, { entries: ['b'] }, 3), 'deferred', 'a changed listing past a walk');
  assert.equal(store.folderInstallVerdict(folder, { entries: ['b'] }, -1), 'raced');
  // The walker cache `all()` is the store's own, not the walk counter's.
  assert.deepEqual(store.managedDocumentLinks.all(), []);
});
