// Measurement probe for W45-56. Prints what the ported local settings store really answers; the
// suite's assertions are written from this output, not from expectation.
import { bindLocalStore, bindLocalStoreHost, ji, localStore } from '../src/plugin-chain-local-store.js';
import { Et, F8e, Gr, XMt, j, nHs } from '../src/plugin-chain-local-store-source.js';

const show = (label: string, value: unknown): void => {
  console.log(label, JSON.stringify(value));
};
const attempt = (label: string, run: () => unknown): void => {
  try { show(label, run()); } catch (error) { show(label, { threw: (error as Error).constructor.name, message: (error as Error).message }); }
};

const a = {};
const store = localStore(a);

show('instance', localStore(a) === localStore(a));
show('other.host', localStore(a) === localStore({}));
show('ji.default.is.store', ji() instanceof F8e);
bindLocalStoreHost(a);
show('ji.after.bind.host', ji() === store);
bindLocalStore({ localStoreProbes: store.localStoreProbes });
show('ji.after.bind.handle', ji() === store);
bindLocalStore(undefined);
show('ji.after.unbind', ji() === store);

show('fields', {
  mergedSettings: store.mergedSettings,
  isLoadingFromDisk: store.isLoadingFromDisk,
  pluginBase: store.pluginBase,
  epoch: store.epoch,
  repoFreeze: { holders: store.repoTierFreeze.holders, tiers: store.repoTierFreeze.tiers },
  probe: store.localStoreProbes.constructor.name,
  perSource: store.perSource.size,
  parsed: store.parsedFiles.size,
  changedKind: Object.prototype.toString.call(store.changed),
  enabledKind: Object.prototype.toString.call(store.enabledSources),
});

// The empty-settings normalize, and the wrapper the diff compares.
show('XMt.empty', XMt({}));
show('XMt.null', XMt(null));
show('XMt.kept', XMt({ a: 1 }));
show('Et.wrap', Et({ source: 'user', settings: {}, unfiltered: {}, legacy: {} }));
attempt('Et.without.unfiltered', () => Et({ source: 'user', settings: { a: 1 } }));
show('Et.legacyAbsent', Et({ settings: { a: 1 }, unfiltered: { b: 1 } }));

// The changed-source diff: keys of both maps whose wrapped entries differ.
const entry = (settings: unknown, unfiltered: unknown = settings) => ({ settings, unfiltered });
const left = new Map<string, unknown>([['user', entry({ a: 1 })], ['project', entry({ b: 1 })], ['gone', entry({ c: 1 })]]);
const right = new Map<string, unknown>([['user', entry({ a: 1 })], ['project', entry({ b: 2 })], ['added', entry({ d: 1 })]]);
show('Gr.diff', Gr(left, right));
show('Gr.order', Gr(new Map([['z', entry({})]]), new Map([['a', entry({})]])));
show('Gr.empty', Gr(new Map(), new Map()));

// The store's own small methods.
show('policyWalkCount', store.policyWalkCount);
show('setPluginBase', (store.setPluginBase({ marker: 1 }), store.pluginBase));
show('clearPluginBase', (store.clearPluginBase(), store.pluginBase));
show('invalidateAll', (store.invalidateAll('test'), store.epoch));
show('retainLayer', store.retainLayer('a', 'b'));
show('dropRetainedLayer', (store.dropRetainedLayer('a'), 'ok'));
show('hasParsedDropInOutside', attempt('x', () => store.hasParsedDropInOutside([], '/tmp')) ?? null);
show('primedFolderListing', store.primedFolderListing('/tmp'));
show('folderListingForPolicyWalk', store.folderListingForPolicyWalk('/tmp'));
show('retainFolderListing', store.retainFolderListing('/tmp', { entries: [] }));
show('clearFolderListing', store.clearFolderListing('/tmp', 'x'));
show('policyInstallVerdict', store.policyInstallVerdict([], 'userSettings', {}));
show('folderInstallVerdict', store.folderInstallVerdict([], 'userSettings', {}));
show('walkReadDiffers', store.walkReadDiffers('/tmp', {}));
show('walkReadMissing', store.walkRead('/tmp/definitely-absent-w45-56'));
show('j', j());

// The pin flag, then everything that is gated on it. The flag is write-once per process, so this
// block runs last.
show('pin.initial', j());
show('pin.first', nHs(true));
show('pin.j', j());
show('pin.same', nHs(true));
show('pin.conflict', nHs(false));
show('pin.still', j());
const pinned = localStore({});
show('pinned.folderListingForPolicyWalk', pinned.folderListingForPolicyWalk('/tmp/w45-56-folder'));
show('pinned.walkCount', pinned.policyWalkCount);
show('pinned.primedFolderListing', pinned.primedFolderListing('/tmp/w45-56-folder'));
pinned.noteWalkListing('/tmp/w45-56-folder', { entries: ['a'] });
show('pinned.walkCount.after', pinned.policyWalkCount);
show('walker.all', pinned.managedDocumentLinks.all().length);

// The verdict ladder, now that a walk has been counted.
const seeded = localStore({ host: 'verdicts' });
show('verdict.unparsed', seeded.policyInstallVerdict('/tmp/v.json', { a: 1 }, 3));
show('verdict.seed', seeded.seedParsedFile('/tmp/v.json', 'userSettings', { a: 1 }, seeded.epoch));
show('verdict.equal', seeded.policyInstallVerdict('/tmp/v.json', { a: 1 }, 3));
show('verdict.changed', seeded.policyInstallVerdict('/tmp/v.json', { a: 2 }, 3));
seeded.folderListingForPolicyWalk('/tmp/v');
show('verdict.deferred', seeded.policyInstallVerdict('/tmp/v.json', { a: 2 }, 3));
show('verdict.raced', seeded.policyInstallVerdict('/tmp/v.json', { a: 2 }, -1));
show('verdict.staleEpoch', seeded.seedParsedFile('/tmp/v.json', 'userSettings', { a: 3 }, 99));
show('verdict.folder.walked', seeded.folderInstallVerdict('/tmp/v', { entries: ['a'] }, -1));
show('verdict.folder.primed', seeded.seedFolderListing('/tmp/v', { entries: ['a'] }, seeded.epoch));
show('verdict.folder.same', seeded.folderInstallVerdict('/tmp/v', { entries: ['a'] }, -1));
show('verdict.walkReadDiffers', seeded.walkReadDiffers('/tmp/v.json', { a: 9 }));
seeded.invalidateAll();
show('verdict.afterInvalidate', { epoch: seeded.epoch, walks: seeded.policyWalkCount, merged: seeded.mergedSettings });

// The retain closures and the epoch guards of the listing caches.
const retained = localStore({ host: 'retain' });
const undoFirst = retained.retainLayer('userSettings', { a: 1 });
show('retain.size', retained.retained.size);
undoFirst();
show('retain.size.afterUndo', retained.retained.size);
const undoOne = retained.retainLayer('userSettings', { a: 1 });
const undoTwo = retained.retainLayer('userSettings', { a: 2 });
undoOne();
show('retain.staleUndoKeeps', retained.retained.get('userSettings'));
undoTwo();
show('retain.size.final', retained.retained.size);
show('retain.folderUndo', typeof retained.retainFolderListing('/tmp/f', { entries: [] }));
show('retain.clearsListing', retained.clearFolderListing('/tmp/f', retained.epoch));
show('retain.listingAfterClear', retained.folderListings.size);
show('unseed.stale', retained.unseedParsedFile('/tmp/x', 'userSettings', 42));
show('seed.folderEpoch', retained.seedFolderListing('/tmp/g', { entries: [] }, 42));
