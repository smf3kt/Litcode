import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  bindSettingsConfigState,
  createSettingsConfigState,
  createSettingsWriteQueue,
  settingsConfigState,
  type SettingsConfigState,
} from '../src/plugin-chain-settings-schema.js';

let clock = 1_000;

function state(): SettingsConfigState {
  return createSettingsConfigState({
    now: () => clock,
    testGlobalConfig: { verbose: true },
    testProjectConfig: { theme: 'dark' },
  });
}

afterEach(() => {
  clock = 1_000;
  bindSettingsConfigState(undefined);
});

test('readCache counts misses and hits, and takeCacheStats resets both', () => {
  const config = state();

  assert.equal(config.readCache(), null);
  assert.equal(config.readCache(), null);
  config.installDiskRead({ verbose: true }, { mtimeMs: 5, size: 9 });

  assert.deepEqual(config.readCache(), { verbose: true });
  assert.deepEqual(config.takeCacheStats(), { hits: 1, misses: 2 });
  assert.deepEqual(config.takeCacheStats(), { hits: 0, misses: 0 });
});

test('installDiskRead and writeThrough emit the change signal', () => {
  const config = state();
  let emitted = 0;
  config.installed.subscribe(() => {
    emitted += 1;
  });

  config.installDiskRead({ a: 1 }, { mtimeMs: 7, size: 3 });
  assert.deepEqual(config.lastReadFileStats, { mtime: 7, size: 3 });
  assert.equal(emitted, 1);

  const generation = config.writeGeneration;
  config.writeThrough({ a: 2 });
  assert.equal(config.writeGeneration, generation + 1);
  assert.equal(config.lastReadFileStats, null);
  assert.deepEqual(config.readCache(), { a: 2 });
  assert.equal(emitted, 2);

  config.advanceFreshnessCursor();
  assert.equal(config.writeGeneration, generation + 2);
  assert.deepEqual(config.cache, { config: { a: 2 }, mtime: clock });
});

test('the enable gate runs the opener once and remembers its outcome', async () => {
  const config = state();
  let opened = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const first = config.enable(() => {
    opened += 1;
    return gate;
  });
  const second = config.enable(() => {
    opened += 1;
    return Promise.reject(new Error('not this one'));
  });
  assert.equal(first, second);
  assert.equal(opened, 1);

  release();
  await first;
  config.markEnableSettled();
  assert.equal(await config.enable(() => Promise.reject(new Error('settled'))), undefined);

  const failed = state();
  const boom = new Error('boom');
  failed.recordEnableError(boom);
  failed.markEnableSettled();
  const rejected = failed.enable(() => Promise.resolve());
  assert.ok(rejected);
  await assert.rejects(rejected, (error: unknown) => error === boom);
});

test('reloadThroughStorageOnce spends the owed reload exactly once', async () => {
  const config = state();
  let calls = 0;

  const idle = config.reloadThroughStorageOnce(() => {
    calls += 1;
    return Promise.resolve('idle');
  });
  assert.equal(calls, 0);
  await idle;

  config.oweReloadThroughStorage();
  const one = config.reloadThroughStorageOnce(() => {
    calls += 1;
    return Promise.resolve('one');
  });
  const again = config.reloadThroughStorageOnce(() => {
    calls += 1;
    return Promise.resolve('again');
  });
  assert.equal(calls, 1);
  assert.equal(again, one);
  assert.equal(await one, 'one');
});

test('pending write counts rise and fall per account', () => {
  const config = state();

  assert.equal(config.pendingWriteCount('user'), 0);
  config.beginPendingWrite('user');
  config.beginPendingWrite('user');
  assert.equal(config.pendingWriteCount('user'), 2);

  assert.equal(config.endPendingWrite('user'), 1);
  assert.equal(config.pendingWriteCount('user'), 1);
  assert.equal(config.endPendingWrite('user'), 0);
  assert.equal(config.pendingWriteCount('user'), 0);
  assert.equal(config.endPendingWrite('user'), 0);
});

test('the boot phase closes at its deadline and stays closed', () => {
  clock = 1_000;
  const config = state();

  assert.equal(config.bootPhaseStillOpen(100), true);
  clock = 1_099;
  assert.equal(config.bootPhaseStillOpen(100), true);
  clock = 1_100;
  assert.equal(config.bootPhaseStillOpen(100), false);
  clock = 1_001;
  assert.equal(config.bootPhaseStillOpen(1_000), false);

  const zero = state();
  assert.equal(zero.bootPhaseStillOpen(0), false);
});

test('parse errors are logged once per key until the dedup clears', () => {
  const config = state();

  assert.equal(config.claimParseErrorLog('a.json'), true);
  assert.equal(config.claimParseErrorLog('a.json'), false);
  assert.equal(config.claimParseErrorLog('b.json'), true);
  config.clearParseErrorDedup();
  assert.equal(config.claimParseErrorLog('a.json'), true);
});

test('the remote-control machine id is computed once', () => {
  const config = state();
  let made = 0;

  assert.equal(config.remoteControlMachineIdOnceFrom(() => {
    made += 1;
    return 'm1';
  }), 'm1');
  assert.equal(config.remoteControlMachineIdOnceFrom(() => {
    made += 1;
    return 'm2';
  }), 'm1');
  assert.equal(made, 1);

  config.clearRemoteControlMachineIdOnce();
  assert.equal(config.remoteControlMachineIdOnceFrom(() => {
    made += 1;
    return 'm3';
  }), 'm3');
  assert.equal(made, 2);
});

test('generated ids and the test config surfaces move through their setters', () => {
  const config = state();

  config.setGeneratedUserID('user-1');
  config.setGeneratedMachineID('machine-1');
  config.setGeneratedSummonSidKey('sid-1');
  assert.equal(config.generatedUserID, 'user-1');
  assert.equal(config.generatedMachineID, 'machine-1');
  assert.equal(config.generatedSummonSidKey, 'sid-1');

  config.clearGeneratedMachineID();
  config.clearGeneratedSummonSidKey();
  assert.equal(config.generatedMachineID, null);
  assert.equal(config.generatedSummonSidKey, null);

  config.overwriteTestGlobalConfig({ verbose: true, autoUpdates: false });
  config.overwriteTestProjectConfig({ theme: 'light', keep: 1 });
  assert.equal(config.testGlobalConfig.autoUpdates, false);
  assert.equal(config.testProjectConfig.theme, 'light');
  config.deleteTestProjectConfigFields(['keep']);
  assert.equal('keep' in config.testProjectConfig, false);
});

test('resetEnableGate restores the gate and watcher defaults', () => {
  const config = state();

  config.allowReading();
  config.recordEnableError(new Error('boom'));
  config.markEnableSettled();
  config.oweReloadThroughStorage();
  config.setFileWatchFallback(false);
  config.setUnhandedWritesInMemory(true);

  config.resetEnableGate();
  assert.equal(config.readingAllowed, false);
  assert.equal(config.enableError, null);
  assert.equal(config.enableSettled, false);
  assert.equal(config.enablePromise, null);
  assert.equal(config.reloadThroughStorageOwed, false);
  assert.equal(config.fileWatchFallback, true);
  assert.equal(config.unhandedWritesInMemory, false);
});

test('freshness flags keep their resubscribe claim until the backend changes', () => {
  const config = state();

  assert.equal(config.claimFreshnessResubscribe(), true);
  assert.equal(config.claimFreshnessResubscribe(), false);
  config.setFreshnessBackend('fs.watch');
  assert.equal(config.claimFreshnessResubscribe(), true);

  config.setFreshnessWatcherStarted(true);
  config.setFreshnessEventWatch('event');
  config.setFreshnessSubscription('subscription');
  config.setLoadedVersion(3);
  config.setTrustAccepted(true);
  config.setLocalSettingsGitTracked(true);
  config.setProjectPathForConfig('/project');
  config.setLastGetConfigOutcome('fallback');
  assert.equal(config.freshnessWatcherStarted, true);
  assert.equal(config.freshnessEventWatch, 'event');
  assert.equal(config.freshnessSubscription, 'subscription');
  assert.equal(config.loadedVersion, 3);
  assert.equal(config.trustAccepted, true);
  assert.equal(config.localSettingsGitTracked, true);
  assert.equal(config.projectPathForConfig, '/project');
  assert.equal(config.lastGetConfigOutcome, 'fallback');
});

test('a deferred external refresh is taken once', () => {
  const config = state();
  const refresh = () => 'refreshed';

  config.deferExternalRefresh(refresh);
  assert.equal(config.takePendingExternalRefresh(), refresh);
  assert.equal(config.takePendingExternalRefresh(), null);
});

test('the write queue serializes one key and keeps running work in its chain', async () => {
  const queue = createSettingsWriteQueue();
  const order: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const first = queue.run('user', async () => {
    order.push('first-start');
    await gate;
    order.push('first-end');
    return 1;
  });
  const second = queue.run('user', async () => {
    order.push('second-start');
    order.push('second-end');
    return 2;
  });

  assert.equal(queue.has('user'), true);
  assert.equal(queue.size, 1);
  release();
  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  assert.deepEqual(order, ['first-start', 'first-end', 'second-start', 'second-end']);
  await queue.settle();
  assert.equal(queue.has('user'), false);
});

test('the write queue drain picks up work queued by running work', async () => {
  const queue = createSettingsWriteQueue();
  const done: number[] = [];

  queue.run('a', async () => {
    done.push(1);
    queue.run('b', async () => {
      done.push(2);
    });
  });
  await queue.drain();
  assert.deepEqual(done, [1, 2]);
});

test('clearForTest empties the write queue', async () => {
  const queue = createSettingsWriteQueue();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  queue.run('blocked', () => gate);

  queue.clearForTest();
  assert.equal(queue.size, 0);
  assert.equal(queue.has('blocked'), false);
  release();
});

test('the seam keeps one lazy state until the binding clears it', () => {
  const first = settingsConfigState();
  assert.equal(settingsConfigState(), first);

  bindSettingsConfigState(undefined);
  const second = settingsConfigState();
  assert.notEqual(second, first);
});
