// Second measurement pass for W45-56, over the two paths the first suite draft got wrong: the
// policy verdict's order of checks, and the listing the folder verdict compares.
import { localStore } from '../src/plugin-chain-local-store.js';
import { j, nHs } from '../src/plugin-chain-local-store-source.js';

const show = (label: string, value: unknown): void => console.log(label, JSON.stringify(value));
const write = (id: string, value: boolean) => nHs(value) === 'conflict' ? null : null;
write('pin', true);
show('pinned', j());

const store = localStore({ probe: 2 });
const file = '/tmp/p2.json';
show('a.unparsed', store.policyInstallVerdict(file, { a: 1 }, -1));
show('a.seed', store.seedParsedFile(file, 'userSettings', { a: 1 }, store.epoch));
show('a.equal.noWalk', store.policyInstallVerdict(file, { a: 1 }, -1));
show('a.changed.noWalk.thresholdNeg', store.policyInstallVerdict(file, { a: 2 }, -1));
show('a.changed.noWalk.threshold3', store.policyInstallVerdict(file, { a: 2 }, 3));
show('a.walks', (store.folderListingForPolicyWalk('/tmp/p2'), store.policyWalkCount));
show('a.changed.walked.threshold3', store.policyInstallVerdict(file, { a: 2 }, 3));
show('a.changed.walked.thresholdNeg', store.policyInstallVerdict(file, { a: 2 }, -1));
// An unprimed parsed file is a race before the threshold is even read.
const other = localStore({ probe: 'unprimed' });
show('b.seed', other.seedParsedFile('/tmp/p2b.json', 'userSettings', { a: 1 }, other.epoch));
other.primedFiles.delete('/tmp/p2b.json');
show('b.unprimed', other.policyInstallVerdict('/tmp/p2b.json', { a: 2 }, -1));

// The folder verdict: unwalked, then walked, then walked with a listing.
const folder = '/tmp/p2-folder';
show('c.unwalked.clean', store.folderInstallVerdict(folder, { entries: [] }, 3));
show('c.note', (store.noteWalkListing(folder, { entries: ['a'] }), 'ok'));
show('c.walked.same', store.folderInstallVerdict(folder, { entries: ['a'] }, 3));
show('c.walked.other.threshold3', store.folderInstallVerdict(folder, { entries: ['b'] }, 3));
show('c.walked.other.thresholdNeg', store.folderInstallVerdict(folder, { entries: ['b'] }, -1));
show('c.primedBefore', store.primedFolderListing(folder));
show('c.seedListing', store.seedFolderListing(folder, { entries: ['b'] }, store.epoch));
show('c.primedAfter', store.primedFolderListing(folder));
// A parsed drop-in inside the folder that the listing does not mention makes an unwalked folder a race.
const drop = localStore({ probe: 'dropin' });
show('d.seedDropIn', drop.seedParsedFile('/tmp/p2-folder/drop.json', 'userSettings', { a: 1 }, drop.epoch));
drop.primedFiles.delete('/tmp/p2-folder/drop.json');
show('d.unwalked.dropIn', drop.folderInstallVerdict(folder, [], 3));
show('d.unwalked.listed', drop.folderInstallVerdict(folder, ['drop.json'], 3));
show('d.walkerAll', drop.managedDocumentLinks.all());
