import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { createPluginTools, readPluginStore } from '../src/plugins.js';
import { filterPluginEntries, pluginFilteredEmpty, pluginPanelRows, pluginPanelText, pluginRowLabel,
  pluginStatusText, pluginVersionLabel, PLUGIN_PANEL_EMPTY, PLUGIN_PANEL_HEADER } from '../src/plugin-panel.js';
import type { ToolContext } from '../src/tools.js';

const roots: string[] = [];
function root(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-panel-test-')));
  roots.push(dir);
  return dir;
}
after(() => { for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true }); });
function put(dir: string, relative: string, bytes: string): void {
  const file = path.join(dir, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}
function packageAt(name: string, version: string): string {
  const dir = root();
  put(dir, 'plugin.json', JSON.stringify({ name, version, description: `${name} fixture` }));
  return dir;
}
async function install(workspace: string, name: string, version = '1.2.3'): Promise<void> {
  const tool = createPluginTools({ enabled: true }).find(item => item.schema.name === 'plugin_install')!;
  const context: ToolContext = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000 };
  await tool.execute({ directory: packageAt(name, version) }, context);
}

test('pluginVersionLabel takes the first real version and prefixes it', () => {
  assert.equal(pluginVersionLabel(undefined, 'unknown', '', '2.0.0'), 'v2.0.0');
  assert.equal(pluginVersionLabel(undefined, 'unknown'), undefined);
  assert.equal(pluginVersionLabel('1.0.0', '2.0.0'), 'v1.0.0');
});

test('the row label carries the version and scope, or just the scope', () => {
  const base = { name: 'sample', scope: 'project', verified: true, enabled: true } as const;
  assert.equal(pluginRowLabel({ ...base, version: '1.2.3' }), 'sample (v1.2.3, project)');
  assert.equal(pluginRowLabel(base), 'sample (project)');
  // `vt`'s cut counts the prefixed cell, so the ellipsis lands at 100 units including `v`.
  assert.equal(pluginRowLabel({ ...base, version: 'x'.repeat(120) }), `sample (v${'x'.repeat(99)}…, project)`);
});

test('the status cell prefers a failed verification over the store gate', () => {
  const base = { name: 'sample', scope: 'project' } as const;
  assert.equal(pluginStatusText({ ...base, verified: true, enabled: true }), '✔ enabled');
  assert.equal(pluginStatusText({ ...base, verified: true, enabled: false }), '✘ disabled');
  assert.equal(pluginStatusText({ ...base, verified: false, enabled: true }), '✘ failed to load');
});

test('the panel body sorts its rows and names the empty store', () => {
  const entries = [
    { name: 'zeta', version: '2', scope: 'project', verified: true, enabled: true },
    { name: 'alpha', version: '1', scope: 'project', verified: true, enabled: true },
  ];
  assert.equal(pluginPanelText([]), PLUGIN_PANEL_EMPTY);
  assert.equal(pluginPanelText(entries), [PLUGIN_PANEL_HEADER,
    '  • alpha (v1, project) ✔ enabled', '  • zeta (v2, project) ✔ enabled'].join('\n'));
  assert.deepEqual(pluginPanelRows(entries).map(row => row.value), ['alpha', 'zeta']);
});

test('the enabled and disabled filters split the store and report an empty side', () => {
  const entries = [
    { name: 'on', scope: 'project', verified: true, enabled: true },
    { name: 'off', scope: 'project', verified: true, enabled: false },
    { name: 'broken', scope: 'project', verified: false, enabled: true },
  ];
  assert.deepEqual(filterPluginEntries(entries, 'enabled').map(entry => entry.name), ['on']);
  assert.deepEqual(filterPluginEntries(entries, 'disabled').map(entry => entry.name), ['off', 'broken']);
  assert.deepEqual(filterPluginEntries(entries).map(entry => entry.name), ['on', 'off', 'broken']);
  assert.equal(pluginFilteredEmpty('enabled'), 'No enabled plugins.');
});

test('the store reader lists what an install wrote, with its digest and state', async () => {
  const workspace = root();
  assert.deepEqual(readPluginStore(workspace, { enabled: true }).entries, []);
  await install(workspace, 'second', '0.2.0');
  await install(workspace, 'first', '0.1.0');
  const store = readPluginStore(workspace, { enabled: true });
  assert.equal(store.enabled, true);
  assert.deepEqual(store.entries.map(entry => [entry.name, entry.version, entry.modified]),
    [['first', '0.1.0', false], ['second', '0.2.0', false]]);
  assert.equal(store.entries[0]!.digest.length, 64);
  assert.equal(store.identity.length, 64);
  // An edit outside the index marks the row rather than throwing.
  fs.writeFileSync(path.join(store.entries[0]!.directory, 'extra.txt'), 'changed');
  assert.equal(readPluginStore(workspace, { enabled: true }).entries[0]!.modified, true);
  // The list still names what is on disk when the gate is off; the panel renders every row
  // `disabled` from `enabled: false` rather than hiding the store.
  const gated = readPluginStore(workspace, { enabled: false });
  assert.equal(gated.enabled, false);
  assert.equal(gated.identity, 'disabled');
  assert.equal(gated.entries.length, 2);
});
