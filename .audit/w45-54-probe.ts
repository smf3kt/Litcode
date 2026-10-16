// W45-54 probe: what the settings source → file layer actually answers, measured before any
// assertion is written.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  canonicalRootOwnedByUser, claudeDirectory, localSettingsRoot, managedSettingsDir,
  managedSettingsDropInDir, managedSettingsPath, normalizePath, NoProjectDirectoryError,
  normalizedRealHomeDir, realHomeDir, realpathOrNull, resetManagedSettingsCache,
  SETTINGS_FILE_NAMES, settingsFileName, settingsFilePath, settingsSourceDirectory,
  settingsSourceRelativePath, sourceCwd, sourceFs,
} from '../src/plugin-chain-settings-source.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
import { bindLocalStore, Ht } from '../src/plugin-chain-local-store.js';

const show = (label: string, value: unknown) => console.log(label, JSON.stringify(value));

const cwd = '/tmp/w45-54-probe';
const context = { cwd };

show('claudeDirectory', claudeDirectory());
show('home', os.homedir());
show('SETTINGS_FILE_NAMES', SETTINGS_FILE_NAMES);
show('settingsFileName {}', settingsFileName({}));
show('settingsFileName cowork ctx', settingsFileName({ coworkPlugins: true }));
show('managedSettingsDir', managedSettingsDir());
show('managedSettingsPath', managedSettingsPath());
show('managedSettingsDropInDir', managedSettingsDropInDir());
show('settingsSourceRelativePath project', settingsSourceRelativePath('projectSettings'));
show('settingsSourceRelativePath local', settingsSourceRelativePath('localSettings'));
show('settingsSourceRelativePath user', settingsSourceRelativePath('userSettings'));

for (const source of ['userSettings', 'projectSettings', 'localSettings', 'policySettings', 'flagSettings', 'bogus']) {
  show(`file ${source} cwd`, settingsFilePath(source, context));
}
show('file flagSettings with flagPath', settingsFilePath('flagSettings', { cwd, flagPath: '/tmp/flag/settings.json' }));
show('file projectSettings no cwd', settingsFilePath('projectSettings', { cwd: null }));
show('file projectSettings null cwd + dir', settingsFilePath('projectSettings', { cwd: null, projectConfigDir: '/tmp/proj' }));
show('dir userSettings', settingsSourceDirectory('userSettings', context));
show('dir projectSettings', settingsSourceDirectory('projectSettings', context));
show('dir flagSettings with flagPath', settingsSourceDirectory('flagSettings', { cwd, flagPath: '/tmp/flag/settings.json' }));
show('dir flagSettings no flagPath', settingsSourceDirectory('flagSettings', context));
try {
  settingsSourceDirectory('projectSettings', { cwd: null });
  show('dir projectSettings no cwd', 'no throw');
} catch (error) {
  show('dir projectSettings no cwd', `${(error as Error).constructor.name} / name=${(error as Error).name} / ${(error as Error).message}`);
  show('instanceof NoProjectDirectoryError', error instanceof NoProjectDirectoryError);
}

show('sourceCwd', sourceCwd(context));
show('localSettingsRoot /tmp/a no canonical', localSettingsRoot('/tmp/a'));
show('localSettingsRoot same root', localSettingsRoot('/tmp/a', (at) => at));
show('localSettingsRoot other root', localSettingsRoot('/tmp/a', () => '/tmp/w45-54-elsewhere'));
show('canonicalRootOwnedByUser /tmp', canonicalRootOwnedByUser('/tmp'));
show('canonicalRootOwnedByUser home', canonicalRootOwnedByUser(path.dirname(os.homedir())));

const owned = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-54-owned-'));
fs.mkdirSync(path.join(owned, '.git'));
fs.mkdirSync(path.join(owned, '.claude'));
const ownedNoGit = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-54-nogit-'));
show('canonicalRootOwnedByUser owned fixture', canonicalRootOwnedByUser(owned));
show('canonicalRootOwnedByUser fixture without .git', canonicalRootOwnedByUser(ownedNoGit));
show('localSettingsRoot owned root', localSettingsRoot('/tmp/w45-54-probe', () => owned));
show('probe cache memoized', canonicalRootOwnedByUser(owned));
const logs = chainRecords().filter((record) => record.kind === 'log');
show('warn lines', logs.map((record) => `${record.level}: ${record.message}`));
clearChainRecords();
fs.rmSync(owned, { recursive: true, force: true });
fs.rmSync(ownedNoGit, { recursive: true, force: true });
show('normalizedRealHomeDir', normalizedRealHomeDir());
show('realHomeDir', realHomeDir());
show('realpathOrNull missing', realpathOrNull('/tmp/w45-54-definitely-absent'));
show('realpathOrNull tmp', realpathOrNull('/tmp'));
show('normalizePath', normalizePath('/tmp/é'));
show('sourceFs has lstatSync', typeof (sourceFs() as { lstatSync?: unknown })?.lstatSync);
resetManagedSettingsCache();
show('managedSettingsPath after reset', managedSettingsPath());

// The handle is what the probes are read through: bind one whose probe cache answers a fixed triple.
clearChainRecords();
const fake = new Ht();
fake.canonicalRootOwnerUids = ((root: string) => ({ rootUid: 1, gitEntryUid: 1, claudeEntryUid: 2 })) as never;
bindLocalStore({ localStoreProbes: fake });
show('owned through a fake handle', canonicalRootOwnedByUser(owned));
show('warn through a fake handle', chainRecords().filter((r) => r.kind === 'log').map((r) => r.message));
bindLocalStore(undefined);
show('owned after unbinding', canonicalRootOwnedByUser(owned));
clearChainRecords();
