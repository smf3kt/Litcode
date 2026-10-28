import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test, type TestContext} from 'node:test';
import {pathToFileURL} from 'node:url';
import {it, modulesChanged, onChainModulesChanged} from '../src/plugin-chain-host.js';
import {chainHooked, composerEditRelay} from '../src/plugin-chain-relay.js';
import {adoptedPluginHooksModules, adoptPluginHooksModules, pluginHooksModulesSettled} from '../src/plugin-chain-registry.js';

function files(t: TestContext) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'chain-queue-order-')));
  t.after(async () => {
    await pluginHooksModulesSettled();
    await adoptPluginHooksModules([]);
    for (const record of [...it().loadedModules]) {
      if (!record.args.modulePath?.startsWith(dir + path.sep)) continue;
      const index = it().loadedModules.indexOf(record);
      if (index >= 0) it().loadedModules.splice(index, 1);
      if ('retire' in record && typeof record.retire === 'function') record.retire();
    }
    modulesChanged();
    fs.rmSync(dir, {recursive: true, force: true});
  });
  const gatePath = path.join(dir, 'gate.mjs');
  fs.writeFileSync(gatePath, `let start, release;
export const entered = new Promise(resolve => { start = resolve; });
export const ready = new Promise(resolve => { release = resolve; });
export function mark() { start(); }
export function open() { release(); }`);
  const create = (name: string, file: string, held = false) => {
    const modulePath = path.join(dir, file);
    fs.writeFileSync(modulePath, `${held ? "import {mark, ready} from './gate.mjs'; mark(); await ready;" : ''}
export default {name: ${JSON.stringify(name)}, tier: 'user', patterns: [{pattern: 'prompt.edit'}],
handlers: {'prompt.edit': async (input, next) => next(input)}};`);
    return {name, modulePath, path: dir};
  };
  return {dir, gatePath, create};
}

function records(name: string) {
  return it().loadedModules.filter(record => record.name === name);
}

test('hooks coordination orders concurrent duplicates, removal and replacement', async t => {
  for (const scenario of ['duplicate', 'remove', 'replace'] as const) {
    await t.test(scenario, async t => {
      const f = files(t);
      const old = f.create('ordered', 'old.mjs', true);
      const next = f.create('ordered', 'next.mjs');
      const gate = await import(pathToFileURL(f.gatePath).href);
      const first = adoptPluginHooksModules([old]);
      try {
        await gate.entered;
        const second = adoptPluginHooksModules(scenario === 'duplicate' ? [old] : scenario === 'replace' ? [next] : []);
        let complete = false;
        const settled = pluginHooksModulesSettled().then(() => { complete = true; });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(complete, false);
        gate.open();
        await Promise.all([first, second, settled]);
        assert.equal(records('ordered').length, scenario === 'remove' ? 0 : 1);
        assert.deepEqual(adoptedPluginHooksModules(), scenario === 'remove' ? [] : ['ordered']);
        if (scenario !== 'remove') {
          assert.equal(records('ordered')[0]?.args.modulePath, scenario === 'replace' ? next.modulePath : old.modulePath);
        }
        await adoptPluginHooksModules([]);
        assert.equal(records('ordered').length, 0);
      } finally {
        gate.open();
        await Promise.allSettled([first]);
      }
    });
  }
});

test('hooks coordination settles failed sibling loads before the next request', async t => {
  const f = files(t);
  const slow = f.create('slow-order', 'slow.mjs', true);
  const next = f.create('next-order', 'next.mjs');
  const missing = {name: 'missing-order', modulePath: path.join(f.dir, 'missing.mjs')};
  const gate = await import(pathToFileURL(f.gatePath).href);
  const first = adoptPluginHooksModules([missing, slow]);
  const rejected = assert.rejects(first, {code: 'ERR_MODULE_NOT_FOUND'});
  try {
    await gate.entered;
    await rejected;
    let nextFinished = false;
    const second = adoptPluginHooksModules([next]).then(() => { nextFinished = true; });
    let settleFinished = false;
    const settling = pluginHooksModulesSettled().then(() => { settleFinished = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(nextFinished, false);
    assert.equal(settleFinished, false);
    gate.open();
    await Promise.all([second, settling]);
    assert.deepEqual(adoptedPluginHooksModules(), ['next-order']);
    assert.equal(records('slow-order').length, 0);
    assert.equal(records('next-order').length, 1);
  } finally {
    gate.open();
    await rejected;
  }
});

test('hooks coordination queues listener reentry and reports notification failures', async t => {
  const f = files(t);
  const first = f.create('notify-first', 'first.mjs');
  const second = f.create('notify-second', 'second.mjs');
  await adoptPluginHooksModules([first]);
  const relay = composerEditRelay({read: () => ({text: '', cursor: 0}), commit: () => {}, report: () => {}});
  let nested: Promise<void> | undefined;
  const unsubscribe = onChainModulesChanged(() => {
    if (nested === undefined) nested = adoptPluginHooksModules([]);
  });
  try {
    await adoptPluginHooksModules([first, second]);
    await pluginHooksModulesSettled();
    await nested;
    assert.deepEqual(adoptedPluginHooksModules(), []);
    assert.equal(chainHooked('prompt.edit'), false);
    assert.equal(relay.isRecording(), false);
  } finally {
    unsubscribe();
    relay.dispose();
  }

  let failing = true;
  const stop = onChainModulesChanged(() => { if (failing) throw new Error('notification failed'); });
  try {
    await assert.rejects(adoptPluginHooksModules([first]), {message: 'notification failed'});
    assert.equal(records('notify-first').length, 1);
    await assert.rejects(adoptPluginHooksModules([first]), {message: 'notification failed'});
    failing = false;
    await adoptPluginHooksModules([first]);
    assert.equal(records('notify-first').length, 1);
    failing = true;
    await assert.rejects(adoptPluginHooksModules([]), {message: 'notification failed'});
    assert.deepEqual(adoptedPluginHooksModules(), []);
    failing = false;
    await adoptPluginHooksModules([]);
    assert.equal(records('notify-first').length, 0);
  } finally {
    stop();
  }

  await t.test('batch removal after a notification error', async () => {
    await adoptPluginHooksModules([first, second]);
    const removed = [records('notify-first')[0]!, records('notify-second')[0]!];
    let failRemoval = true;
    const stopRemoval = onChainModulesChanged(() => { if (failRemoval) throw new Error('batch notification failed'); });
    const editor = composerEditRelay({read: () => ({text: '', cursor: 0}), commit: () => {}, report: () => {}});
    try {
      await assert.rejects(adoptPluginHooksModules([]), {message: 'batch notification failed'});
      await pluginHooksModulesSettled();
      assert.deepEqual(adoptedPluginHooksModules(), []);
      assert.equal(records('notify-first').length, 0);
      assert.equal(records('notify-second').length, 0);
      assert.deepEqual(removed.map(record => record.status()), [
        {kind: 'unloaded', retired: true}, {kind: 'unloaded', retired: true},
      ]);
      assert.equal(editor.isRecording(), true);
      failRemoval = false;
      await adoptPluginHooksModules([]);
      assert.equal(editor.isRecording(), false);
    } finally {
      stopRemoval();
      editor.dispose();
    }
  });

  await t.test('retirement failure keeps later modules removable', async () => {
    await adoptPluginHooksModules([first, second]);
    const record = records('notify-first')[0]!;
    assert.ok('retire' in record && typeof record.retire === 'function');
    const retire = record.retire;
    record.retire = () => { throw new Error('retirement failed'); };
    try {
      await assert.rejects(adoptPluginHooksModules([]), {message: 'retirement failed'});
      await pluginHooksModulesSettled();
      assert.ok(adoptedPluginHooksModules().includes('notify-second'));
      assert.equal(records('notify-second').length, 1);
    } finally {
      record.retire = retire;
      retire();
      await adoptPluginHooksModules([]);
      for (const remaining of records('notify-second')) {
        const at = it().loadedModules.indexOf(remaining);
        if (at >= 0) it().loadedModules.splice(at, 1);
        if ('retire' in remaining && typeof remaining.retire === 'function') remaining.retire();
      }
      modulesChanged();
    }
    assert.equal(records('notify-second').length, 0);
  });

  await t.test('duplicate names are rejected before loading', async () => {
    await adoptPluginHooksModules([second]);
    const duplicate = f.create('notify-first', 'duplicate.mjs');
    await assert.rejects(adoptPluginHooksModules([first, duplicate]), /duplicate/i);
    await pluginHooksModulesSettled();
    assert.equal(records('notify-first').length, 0);
    assert.equal(records('notify-second').length, 1);
    assert.deepEqual(adoptedPluginHooksModules(), ['notify-second']);
  });
});
