// The settings merge layer (W45-55). The ported body is src/plugin-chain-settings-merge-source.ts
// (52 statements, 4,033 units, chunk-3cynezh1.js) and the seam is
// src/plugin-chain-settings-merge.ts. These tests call the seam the way a settings read does —
// `mergeWith(target, ...sources, Y3)` — and assert what the source really answers per key, plus the
// legacy local path (`vse`) this package added to the settings-source copy.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  mergeSettings, normalizeModelPicker, settingsMergeCustomizer, shallowSettingsOverride,
} from '../src/plugin-chain-settings-merge.js';
import { localSettingsPath } from '../src/plugin-chain-settings-source.js';

/** A directory the current user owns, with the `.git` and `.claude` entries the gate checks. */
function ownedRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-55-root-'));
  fs.mkdirSync(path.join(root, '.git'));
  fs.mkdirSync(path.join(root, '.claude'));
  return root;
}

test('the customizer answers per key, and undefined for every other key', () => {
  // `undefined` is how a customizer asks lodash for the default deep merge, so it is the answer for
  // every ordinary settings key.
  assert.equal(settingsMergeCustomizer({ a: 1 }, { b: 2 }, 'permissions'), undefined);
  assert.equal(settingsMergeCustomizer('x', 'y', 'permissions'), undefined);
  // The array rule is not keyed: any two arrays union, whatever the key is called.
  assert.deepEqual(settingsMergeCustomizer(['a'], ['b', 'a'], 'ignorePatterns'), ['a', 'b']);

  // Two arrays are the union, deduplicated, target first.
  assert.deepEqual(settingsMergeCustomizer(['a', 'b'], ['b', 'c'], 'permissions'), ['a', 'b', 'c']);

  // `fallbackModel` is the exception: the source array replaces the target's outright.
  assert.deepEqual(settingsMergeCustomizer(['a'], ['b'], 'fallbackModel'), ['b']);

  // The two map fields take a one-level override when both sides are plain objects.
  assert.deepEqual(
    settingsMergeCustomizer({ m: { a: 1, b: 1 } }, { m: { b: 2 } }, 'extraKnownMarketplaces'),
    { m: { b: 2 } },
  );
  assert.deepEqual(
    settingsMergeCustomizer({ s: { a: 1 } }, { s: { b: 2 } }, 'managedMcpServers'),
    { s: { b: 2 } },
  );
  // A side that is not a plain object is not this customizer's business.
  assert.equal(settingsMergeCustomizer(['x'], { m: { b: 2 } }, 'extraKnownMarketplaces'), undefined);

  // `modelPicker` is normalized rather than merged, and only for a defined source value.
  assert.deepEqual(
    settingsMergeCustomizer({ options: [{ id: 1 }] }, { options: [{ id: 2 }] }, 'modelPicker'),
    { options: [{ id: 2 }] },
  );
  assert.equal(settingsMergeCustomizer({ a: 1 }, undefined, 'modelPicker'), undefined);
});

test('a settings merge deep-merges, dedupes arrays, and replaces the picker', () => {
  assert.deepEqual(mergeSettings({ a: { x: 1 }, keep: 1 }, { a: { y: 2 } }), { a: { x: 1, y: 2 }, keep: 1 });
  assert.deepEqual(mergeSettings({ permissions: ['a', 'b'] }, { permissions: ['b', 'c'] }), {
    permissions: ['a', 'b', 'c'],
  });
  assert.deepEqual(mergeSettings({ fallbackModel: ['a'] }, { fallbackModel: ['b'] }), {
    fallbackModel: ['b'],
  });
  // The picker is replaced by the normalized source, so a key the source does not carry is gone.
  assert.deepEqual(
    mergeSettings({ modelPicker: { options: [{ id: 1 }, 'x'], gone: true } }, { modelPicker: { options: [{ id: 2 }, 'y'] } }),
    { modelPicker: { options: [{ id: 2 }, 'y'] } },
  );
  // A picker whose `options` is not an array is copied as it stands.
  assert.deepEqual(mergeSettings({ modelPicker: { a: 1 } }, { modelPicker: { options: 'nope', b: 2 } }), {
    modelPicker: { options: 'nope', b: 2 },
  });
  // One-level override: a sibling entry on either side survives, the shared entry does not merge.
  assert.deepEqual(
    mergeSettings({ extraKnownMarketplaces: { m: { a: 1 }, n: { c: 1 } } }, { extraKnownMarketplaces: { m: { b: 2 } } }),
    { extraKnownMarketplaces: { m: { b: 2 }, n: { c: 1 } } },
  );
  assert.deepEqual(mergeSettings({ managedMcpServers: { s: { a: 1, b: 1 } } }, { managedMcpServers: { s: { b: 2 } } }), {
    managedMcpServers: { s: { b: 2 } },
  });
  // Array target with an object source is lodash's own answer, and it is a strange one: the array
  // keeps its elements and the source's keys land on it as own properties. `JSON.stringify` hides
  // this (it prints an array's index properties only), so it is asserted property by property.
  const weird: { extraKnownMarketplaces: unknown[] & { m?: unknown } } =
    mergeSettings({ extraKnownMarketplaces: ['x'] }, { extraKnownMarketplaces: { m: { b: 2 } } });
  assert.deepEqual([...weird.extraKnownMarketplaces], ['x']);
  assert.deepEqual(weird.extraKnownMarketplaces.m, { b: 2 });
  // Several sources, and the flags a read merges: the source's own call shape is
  // `MB({}, c ?? {}, d ?? {}, Y3)`.
  assert.deepEqual(mergeSettings({}, { a: 1 }, { b: 2 }, { permissions: ['x'] }, { permissions: ['y'] }), {
    a: 1, b: 2, permissions: ['x', 'y'],
  });
});

test('the merge accumulates into the target the source passes in', () => {
  const target: Record<string, unknown> = { keep: 1 };
  const returned = mergeSettings(target, { added: 2 });
  assert.equal(returned, target, 'the same object comes back');
  assert.deepEqual(target, { keep: 1, added: 2 });
  // This is how `bTr` accumulates: `let r = {}; if (s) r = MB(r, s, Y3); … MB(r, $t(T, N, e), Y3)`.
  mergeSettings(target, { added: 3 });
  assert.deepEqual(target, { keep: 1, added: 3 });
});

test('a merged value is a copy, and a cyclic source terminates', () => {
  const source = { a: { b: { c: 1 } } };
  const merged = mergeSettings({}, source) as { a: { b: { c: number } } };
  assert.deepEqual(merged.a.b, { c: 1 });
  assert.notEqual(merged.a.b, source.a.b, 'the nested object is a copy, not the source object');
  const cyclic: Record<string, unknown> = { name: 'root' };
  cyclic.self = cyclic;
  const walked = mergeSettings({}, cyclic) as Record<string, unknown>;
  assert.equal(walked.name, 'root');
  // The merge stack breaks the cycle: `self` is the copy made for the cycle, never the target.
  assert.notEqual(walked.self, walked);
  assert.deepEqual(Object.keys(walked), ['name', 'self']);
  // Undefined and null sources leave the target alone, and an undefined value never overwrites.
  assert.deepEqual(mergeSettings({ a: 1, b: 2 }, undefined, null), { a: 1, b: 2 });
  assert.deepEqual(mergeSettings({ a: 1, b: 2 }, { a: undefined } as unknown as object), { a: 1, b: 2 });
});

test('the picker normalizer copies the picker and each plain-object option', () => {
  const option = { id: 1 };
  const picker = { options: [option, 7, null, 'raw'], extra: { deep: 1 } };
  const normalized = normalizeModelPicker(picker) as { options: unknown[]; extra: object };
  assert.deepEqual(normalized.options, [{ id: 1 }, 7, null, 'raw']);
  assert.notEqual(normalized, picker);
  assert.notEqual(normalized.options, picker.options);
  assert.notEqual(normalized.options[0], option, 'each plain-object option is spread, not reused');
  assert.equal(normalized.extra, picker.extra, 'the picker itself is a shallow spread: one level only');
  // A value that is not a plain object is answered unchanged.
  const array = [1, 2];
  assert.equal(normalizeModelPicker(array), array);
  assert.equal(normalizeModelPicker('scalar'), 'scalar');
  assert.equal(normalizeModelPicker(null), null);
});

test('the shallow override spreads the source over the target, one level deep', () => {
  const target = { m: { a: 1, b: 1 }, n: { c: 1 } };
  const source = { m: { b: 2 } };
  const overridden = shallowSettingsOverride(target, source) as Record<string, unknown>;
  assert.deepEqual(overridden, { m: { b: 2 }, n: { c: 1 } });
  assert.notEqual(overridden, target);
  assert.equal(overridden.n, target.n, 'an untouched entry is the target entry itself');
});

test('the legacy local settings path answers only when the store root is not the session cwd', () => {
  const root = ownedRoot();
  try {
    // No canonical git root, or a root equal to the session cwd: the store did not move, so a read
    // takes the settings-local file it already resolved and this path is not consulted.
    assert.equal(localSettingsPath({ cwd: '/tmp/w45-55-elsewhere' }), undefined);
    assert.equal(localSettingsPath({ cwd: root, canonicalGitRoot: () => root }), undefined);
    assert.equal(localSettingsPath({ cwd: root, canonicalGitRoot: () => '/tmp' }), undefined, 'an unowned root is not a move');
    assert.equal(localSettingsPath({ cwd: null }), undefined);
    // A root the user owns and that is not the cwd: the legacy file hangs off the session cwd.
    assert.equal(
      localSettingsPath({ cwd: '/tmp/w45-55-elsewhere', canonicalGitRoot: () => root }),
      path.join('/tmp/w45-55-elsewhere', '.claude/settings.local.json'),
    );
    assert.equal(
      localSettingsPath({ cwd: '/tmp/a/../w45-55-elsewhere', canonicalGitRoot: () => root }),
      path.join('/tmp/w45-55-elsewhere', '.claude/settings.local.json'),
      'the cwd is resolved before it is joined',
    );
    // A set project config directory means the project settings come from there, so there is no
    // legacy local file to read either.
    assert.equal(localSettingsPath({
      cwd: '/tmp/w45-55-elsewhere', canonicalGitRoot: () => root, projectConfigDir: '/tmp/w45-55-project',
    }), undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
