// Measurement probe for W45-55. Prints what the source merge layer really answers; the suite's
// assertions are written from this output, not from expectation.
import {
  mergeSettings, normalizeModelPicker, settingsMergeCustomizer, shallowSettingsOverride,
} from '../src/plugin-chain-settings-merge.js';
import { localSettingsPath } from '../src/plugin-chain-settings-source.js';

const show = (label: string, value: unknown): void => {
  console.log(label, JSON.stringify(value));
};

show('deep.plain', mergeSettings({ a: { x: 1 } }, { a: { y: 2 } }));
show('arrays.union', mergeSettings({ permissions: ['a', 'b'] }, { permissions: ['b', 'c'] }));
show('arrays.dup.target', mergeSettings({ permissions: ['a', 'a'] }, { permissions: ['a'] }));
show('fallbackModel', mergeSettings({ fallbackModel: ['a'] }, { fallbackModel: ['b'] }));
show('modelPicker.plain', mergeSettings(
  { modelPicker: { options: [{ id: 1 }, 'x'] } },
  { modelPicker: { options: [{ id: 2 }, 'y'] } },
));
show('modelPicker.nonobject', mergeSettings({ modelPicker: { a: 1 } }, { modelPicker: 'scalar' }));
show('modelPicker.jsdoc', normalizeModelPicker({ options: [{ a: 1 }, 7, null] }));
show('modelPicker.notPlain', normalizeModelPicker([1, 2]));
show('markets.override', mergeSettings(
  { extraKnownMarketplaces: { m: { a: 1, b: 1 } } },
  { extraKnownMarketplaces: { m: { b: 2 } } },
));
show('mcp.override', mergeSettings(
  { managedMcpServers: { s: { a: 1, b: 1 } } },
  { managedMcpServers: { s: { b: 2 } } },
));
show('markets.nonplain', mergeSettings(
  { extraKnownMarketplaces: ['x'] },
  { extraKnownMarketplaces: { m: { b: 2 } } },
));
show('shallow', shallowSettingsOverride({ m: { a: 1, b: 1 } }, { m: { b: 2 } }));
show('undefined.source', mergeSettings({ a: 1, b: 2 }, { a: undefined } as unknown as object));
show('multi.source', mergeSettings({}, { a: 1 }, { b: 2 }));
show('undefined.target', mergeSettings({} as Record<string, unknown>, undefined, null));
show('customizer.plain', settingsMergeCustomizer({ a: 1 }, { b: 2 }, 'k'));
show('customizer.array', settingsMergeCustomizer([1], [2], 'k'));
show('customizer.fallback', settingsMergeCustomizer(['a'], ['b'], 'fallbackModel'));
show('customizer.modelPicker', settingsMergeCustomizer({}, { options: [{ a: 1 }] }, 'modelPicker'));
const target: Record<string, unknown> = { keep: 1 };
show('mutates', mergeSettings(target, { added: 2 }));
show('mutated.same', target === mergeSettings(target, {}) || target);
show('target.identity', mergeSettings(target, { z: 3 }) === target);
show('local.cwd', localSettingsPath({ cwd: '/tmp/w45-55' }));
show('local.null', localSettingsPath({ cwd: null }));
show('local.gitroot', localSettingsPath({ cwd: '/tmp/w45-55', canonicalGitRoot: () => '/tmp/w45-55' }));
show('local.projectdir', localSettingsPath({ cwd: '/tmp/w45-55', projectConfigDir: '/tmp/w45-55/.claude' }));
show('local.relative', localSettingsPath({ cwd: '/tmp/a/../w45-55' }));

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-55-probe-'));
fs.mkdirSync(path.join(root, '.git'));
fs.mkdirSync(path.join(root, '.claude'));
show('local.owned', localSettingsPath({ cwd: '/tmp/w45-55-elsewhere', canonicalGitRoot: () => root }));
show('local.owned.same', localSettingsPath({ cwd: root, canonicalGitRoot: () => root }));
show('local.owned.projectdir', localSettingsPath({
  cwd: '/tmp/w45-55-elsewhere', canonicalGitRoot: () => root, projectConfigDir: '/tmp/x',
}));
fs.rmSync(root, { recursive: true, force: true });

show('markets.extraKey', mergeSettings(
  { extraKnownMarketplaces: { m: { a: 1 }, n: { c: 1 } } },
  { extraKnownMarketplaces: { m: { b: 2 } } },
));
show('modelPicker.optionsNotArray', mergeSettings(
  { modelPicker: { a: 1, options: 'nope' } },
  { modelPicker: { options: 'nope', b: 2 } },
));
const element = { id: 1 };
const picker = { options: [element] };
const normalized = normalizeModelPicker(picker) as { options: unknown[] };
show('modelPicker.copies', normalized.options[0] !== element);
show('fallbackModel.notArrays', mergeSettings({ fallbackModel: 'x' }, { fallbackModel: ['b'] }));
const cyclic: Record<string, unknown> = { name: 'root' };
cyclic.self = cyclic;
const merged = mergeSettings({}, cyclic) as Record<string, unknown>;
show('cyclic', { name: merged.name, selfIsRoot: merged.self === merged });
const deep = { a: { b: { c: 1 } } };
show('deep.identity', (mergeSettings({}, deep) as { a: { b: object } }).a.b === deep.a.b);
