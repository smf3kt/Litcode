// The settings source → file layer (W45-54). The ported bodies are
// src/plugin-chain-settings-source-source.ts (36 statements, 7,881 units, five chunks) and the probe
// cache is src/plugin-chain-local-store-probes-source.ts, with the seams in
// src/plugin-chain-settings-source.ts and src/plugin-chain-local-store.ts. These tests call the seam
// the way a settings read does and assert what the source really answers: which file backs each
// source, the directory behind it, the names, the managed-settings cache, the ownership gate with its
// own warn texts, and the store handle the probes are read through.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
import { bindLocalStore, Ht } from '../src/plugin-chain-local-store.js';
import {
  canonicalRootOwnedByUser, claudeDirectory, localSettingsRoot, managedSettingsDir,
  managedSettingsDropInDir, managedSettingsPath, NoProjectDirectoryError, normalizePath,
  normalizedRealHomeDir, realHomeDir, realpathOrNull, resetManagedSettingsCache,
  SETTINGS_FILE_NAMES, settingsFileName, settingsFilePath, settingsSourceDirectory,
  settingsSourceRelativePath, sourceCwd, sourceFs,
} from '../src/plugin-chain-settings-source.js';

const warns = (): string[] => chainRecords()
  .filter((record) => record.kind === 'log' && record.level === 'warn')
  .map((record) => String(record.message));

/** A directory the current user owns, with the `.git` and `.claude` entries the gate checks. */
function ownedRoot(entries: { git?: boolean; claude?: boolean } = { git: true, claude: true }): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-54-root-'));
  if (entries.git) fs.mkdirSync(path.join(root, '.git'));
  if (entries.claude) fs.mkdirSync(path.join(root, '.claude'));
  return root;
}

test('every source resolves to the file the source names, and only those', () => {
  const cwd = '/tmp/w45-54-resolve';
  const claude = claudeDirectory();
  assert.equal(settingsFilePath('userSettings', { cwd }), path.join(claude, 'settings.json'));
  assert.equal(settingsFilePath('projectSettings', { cwd }), path.join(cwd, '.claude/settings.json'));
  assert.equal(settingsFilePath('localSettings', { cwd }), path.join(cwd, '.claude/settings.local.json'));
  assert.equal(settingsFilePath('policySettings', { cwd }), managedSettingsPath());
  assert.equal(settingsFilePath('flagSettings', { cwd }), undefined, 'no flag path means no flag file');
  assert.equal(settingsFilePath('flagSettings', { cwd, flagPath: '/tmp/w45-54-flag/settings.json' }), '/tmp/w45-54-flag/settings.json');
  assert.equal(settingsFilePath('nope', { cwd }), undefined, 'a name that is not a source has no file');
  // Project and local refuse a context with neither: the resolver answers undefined rather than
  // guessing a directory, while the directory resolver below throws the source's own error.
  assert.equal(settingsFilePath('projectSettings', { cwd: null }), undefined);
  // The guard is `n.cwd===null`, so *null* is "this session has no working directory" and
  // *undefined* is not: an absent cwd falls through the `Ynn` branch that throws, and the throw is
  // the source's own (`FWn` checks `===null` too), reaching the caller as a path error.
  assert.throws(() => settingsFilePath('localSettings', { cwd: undefined }), /paths\[0\]/);
  assert.equal(settingsFilePath('projectSettings', { cwd: null, projectConfigDir: '/tmp/w45-54-proj' }),
    '/tmp/w45-54-proj/.claude/settings.json');
});

test('the directory behind a source, and the source own error for a source with no cwd', () => {
  const cwd = '/tmp/w45-54-resolve';
  assert.equal(settingsSourceDirectory('userSettings', { cwd }), claudeDirectory());
  assert.equal(settingsSourceDirectory('projectSettings', { cwd }), cwd);
  // Measured: the *file* for policy is the managed settings file, but the *directory* `Ynn` answers
  // for it is `resolve(cwd)` — the managed directory is reached through `m_`, not through this branch.
  assert.equal(settingsSourceDirectory('policySettings', { cwd }), cwd);
  assert.equal(settingsSourceDirectory('flagSettings', { cwd }), cwd, 'no flag path falls back to the cwd');
  assert.equal(settingsSourceDirectory('flagSettings', { cwd, flagPath: '/tmp/w45-54-flag/settings.json' }), '/tmp/w45-54-flag');
  assert.equal(sourceCwd({ cwd }), cwd);

  assert.throws(() => settingsSourceDirectory('projectSettings', { cwd: null }), (error: unknown) => {
    assert.ok(error instanceof NoProjectDirectoryError);
    assert.equal((error as Error).name, 'NoProjectDirectoryError');
    assert.equal((error as Error).message, 'This session has no working directory.');
    return true;
  });
});

test('the settings file names, and the relative path a project or local file is joined under', () => {
  assert.deepEqual(SETTINGS_FILE_NAMES, { default: 'settings.json', cowork: 'cowork_settings.json' });
  assert.equal(settingsFileName({ cwd: null }), 'settings.json');
  assert.equal(settingsFileName({ cwd: null, coworkPlugins: true }), 'cowork_settings.json');
  // `TO` is a relative path, not a bare name: the project and local resolvers join it under the
  // directory `Ynn` answers with, which is why the resolved paths above carry `.claude/`.
  assert.equal(settingsSourceRelativePath('projectSettings'), '.claude/settings.json');
  assert.equal(settingsSourceRelativePath('localSettings'), '.claude/settings.local.json');
  assert.equal(settingsSourceRelativePath('userSettings'), undefined);
});

test('the managed settings file, its directory and its drop-in, cached until reset', () => {
  resetManagedSettingsCache();
  const directory = managedSettingsDir();
  assert.equal(path.isAbsolute(directory), true);
  assert.equal(managedSettingsPath(), path.join(directory, 'managed-settings.json'));
  assert.equal(managedSettingsDropInDir(), path.join(directory, 'managed-settings.d'));
  resetManagedSettingsCache();
  assert.equal(managedSettingsDir(), directory, 'the cache answers the same path after a reset');
});

test('the .claude directory, the home realpath, and the facade the probes read through', () => {
  const home = os.homedir();
  assert.equal(claudeDirectory(), process.env.CLAUDE_CONFIG_DIR ?? path.join(home, '.claude'));
  assert.equal(normalizedRealHomeDir(), fs.realpathSync.native(home));
  assert.equal(realHomeDir(), fs.realpathSync.native(home));
  assert.equal(realpathOrNull('/tmp/w45-54-definitely-absent'), null, 'an absent path answers null, not a throw');
  assert.equal(realpathOrNull('/tmp'), fs.realpathSync.native('/tmp'));
  assert.equal(normalizePath('/tmp/é'), '/tmp/é', 'the NFC normalization leaves an already-composed path alone');
  assert.equal(normalizePath('/tmp/é'), '/tmp/é', 'and composes a decomposed one');
  const facade = sourceFs() as { lstatSync?: unknown; statSync?: unknown };
  assert.equal(typeof facade.lstatSync, 'function');
  assert.equal(typeof facade.statSync, 'function');
});

test('the ownership gate: the source own three answers, with the source own warn texts', () => {
  const root = ownedRoot();
  const noGit = ownedRoot({ git: false });
  try {
    clearChainRecords();
    assert.equal(canonicalRootOwnedByUser(root), true, 'the fixture, its .git entry and its .claude entry are all owned by the current user');
    assert.deepEqual(warns(), [], 'an owned root writes nothing');

    assert.equal(canonicalRootOwnedByUser(noGit), false);
    assert.deepEqual(warns(), [
      `localSettings: not canonicalizing the consent store to ${noGit} — its ownership could not be verified `
      + `(ENOENT: no such file or directory, lstat '${path.join(noGit, '.git')}'); the store stays at the session cwd`,
    ]);

    // A path owned by another user takes the middle branch, with its own longer text.
    clearChainRecords();
    const parent = path.dirname(root);
    assert.equal(canonicalRootOwnedByUser(parent), false);
    assert.deepEqual(warns(), [
      `localSettings: not canonicalizing the consent store to ${parent} — its ownership could not be verified `
      + `(ENOENT: no such file or directory, lstat '${path.join(parent, '.git')}'); the store stays at the session cwd`,
    ]);

    // The cache is per root and remembers *answers*, not throws: the owned fixture is answered from
    // the cache, while the path whose probe threw is probed again.
    clearChainRecords();
    assert.equal(canonicalRootOwnedByUser(root), true);
    assert.deepEqual(warns(), [], 'an answer is remembered');
    assert.equal(canonicalRootOwnedByUser(noGit), false);
    assert.equal(warns().length, 1, 'a probe that threw is not remembered, so it warns again');
  } finally {
    clearChainRecords();
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(noGit, { recursive: true, force: true });
  }
});

test('the local settings root takes the canonical root only when the user owns it', () => {
  const root = ownedRoot();
  const cwd = '/tmp/w45-54-local';
  try {
    assert.equal(localSettingsRoot(cwd), cwd, 'with no canonical git root there is nothing to prefer');
    assert.equal(localSettingsRoot(cwd, (at) => at), cwd, 'a root equal to the cwd is still the cwd');
    clearChainRecords();
    assert.equal(localSettingsRoot(cwd, () => root), root, 'an owned root wins over the session cwd');
    assert.equal(localSettingsRoot(cwd, () => os.homedir()), cwd, 'the real home directory is never preferred');

    const unowned = path.dirname(root);
    clearChainRecords();
    assert.equal(localSettingsRoot(cwd, () => unowned), cwd, 'an unowned root leaves the store at the cwd');
    assert.deepEqual(warns().length, 1, 'and says why');
  } finally {
    clearChainRecords();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the probes are read through the store handle, and the handle can be replaced', () => {
  const root = ownedRoot();
  try {
    clearChainRecords();
    assert.equal(canonicalRootOwnedByUser(root), true, 'with the source own cache the fixture is owned');
    clearChainRecords();
    const fake = new Ht();
    (fake as unknown as { canonicalRootOwnerUids: (root: string) => unknown }).canonicalRootOwnerUids =
      () => ({ rootUid: 1, gitEntryUid: 1, claudeEntryUid: 2 });
    bindLocalStore({ localStoreProbes: fake });
    try {
      assert.equal(canonicalRootOwnedByUser(root), false, 'a bound handle answers instead');
      assert.equal(warns().length, 1);
      assert.match(warns()[0] ?? '', /it \(uid 1\), its \.git entry \(uid 1\), or its \.claude entry \(uid 2\) is not owned by the current user/);
    } finally {
      bindLocalStore(undefined);
    }
    clearChainRecords();
    assert.equal(canonicalRootOwnedByUser(root), true, 'unbinding restores the source own cache');
    assert.deepEqual(warns(), []);
  } finally {
    clearChainRecords();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
