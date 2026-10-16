import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test, type TestContext} from 'node:test';
import {loadProjectConfig} from '../src/config.js';
import {createPluginTools, discoverInstalledPluginComponents} from '../src/plugins.js';
import {chainRecords, clearChainRecords} from '../src/plugin-chain-host.js';
import {
  adoptedPluginHooksModules, adoptPluginHooksModules, pluginHooksModulesSettled,
} from '../src/plugin-chain-registry.js';
import {chainHooked} from '../src/plugin-chain-relay.js';
import type {ToolContext} from '../src/tools.js';

// A plugin's chain hooks module is declared by its hooks file, not by its manifest: `modules` is one
// of the keys that file may carry (`PGn`, chunk-sfn1dbxq.js [269575,269666)), and `aUr`
// ([4056182,4056874)) resolves the one entry into `plugin.modulePath`. These tests drive that surface
// end to end through the store, the config read and the chain.
// Sources: research/ports/W45-chain-runner.md#w45-6-reconnaissance.

/** A chain module that answers `prompt.edit`, named to match the plugin that ships it. */
function hooksModule(name: string): string {
  return `export default {
  name: ${JSON.stringify(name)},
  tier: 'user',
  patterns: [{pattern: 'prompt.edit'}],
  handlers: {'prompt.edit': async (input, next) => ({...await next(input), tag: ${JSON.stringify(name)}})},
};\n`;
}

function fixture(t: TestContext, manifest: Record<string, unknown>, files: Record<string, string>) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-hooks-module-')));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const workspace = path.join(root, 'workspace');
  const source = path.join(root, 'source');
  const userDir = path.join(root, 'user');
  for (const dir of [workspace, source, userDir]) fs.mkdirSync(dir);
  const put = (base: string, relative: string, value: unknown) => {
    const file = path.join(base, relative);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  put(source, 'plugin.json', {name: 'sample', version: '1', hooks: 'hooks/hooks.json', ...manifest});
  for (const [relative, body] of Object.entries(files)) put(source, relative, body);
  // Every fixture starts and ends with an empty chain: the store's own calls load and unload modules.
  t.after(async () => {
    await adoptPluginHooksModules([]);
  });
  const context: ToolContext = {workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000};
  const run = (tool: string, input: unknown) => createPluginTools({enabled: true})
    .find(candidate => candidate.schema.name === tool)!.execute(input as never, context);
  const install = () => run('plugin_install', {directory: source});
  /** Reads the config the way the CLI does, which is what starts the chain's adoption. */
  const readConfig = () => {
    put(workspace, '.harness/settings.json', {plugins: {enabled: true}});
    return loadProjectConfig(workspace, {userDir});
  };
  const discovered = () => discoverInstalledPluginComponents(workspace, {enabled: true})[0];
  const discoveredPath = () => path.join(workspace, '.harness', 'plugins', 'sample', 'hooks');
  return {workspace, source, userDir, put, install, run, readConfig, discovered, discoveredPath};
}

/** The adoption starts behind a lazy import inside the config read; wait for the chain to see it. */
async function until(predicate: () => boolean, what: string): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    await pluginHooksModulesSettled();
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail(`the chain never reported ${what}`);
}

const HOOKS = {hooks: {SessionStart: [{command: 'plugin-hook'}]}};

test('hooks modules: one entry loads, and the module path is exposed resolved', async t => {
  const f = fixture(t, {}, {
    'hooks/hooks.json': JSON.stringify({...HOOKS, modules: ['./register.mjs']}),
    'hooks/register.mjs': hooksModule('sample'),
  });
  const installed = JSON.parse(await f.install());
  assert.equal(installed.status, 'installed');
  const component = f.discovered()!;
  // The store keeps the verified copy, so the path is the installed one, resolved against the folder
  // the hooks file sits in.
  assert.equal(component.hooksModulePath, path.join(f.workspace, '.harness', 'plugins', 'sample', 'hooks', 'register.mjs'));
  assert.equal(component.hooksModuleProblem, undefined);
  assert.equal(fs.readFileSync(component.hooksModulePath!, 'utf8'), hooksModule('sample'));
  assert.deepEqual(component.hooks, HOOKS.hooks, 'the hooks themselves still load');
  assert.deepEqual(adoptedPluginHooksModules(), ['sample'], 'the install loaded it in the same call');
});

test('hooks modules: a specifier that leaves the plugin folder is refused', async t => {
  // Escaping the hooks folder is allowed — the source's `$9o` confines the module to the *plugin*
  // folder and adds the module's own folder as a root when it leaves `hooks`. Escaping the plugin is
  // what is refused.
  const f = fixture(t, {}, {
    'hooks/hooks.json': JSON.stringify({...HOOKS, modules: ['../../escape.mjs']}),
  });
  await f.install();
  const component = f.discovered()!;
  assert.equal(component.hooksModulePath, undefined);
  assert.deepEqual(component.hooksModuleProblem, {type: 'path-traversal', path: '../../escape.mjs'});
  assert.deepEqual(component.hooks, HOOKS.hooks, 'the plugin still loads without its module');
});

test('hooks modules: a specifier with no file in the snapshot is refused', async t => {
  const f = fixture(t, {}, {
    'hooks/hooks.json': JSON.stringify({...HOOKS, modules: ['./missing.mjs']}),
  });
  await f.install();
  const component = f.discovered()!;
  assert.equal(component.hooksModulePath, undefined);
  assert.deepEqual(component.hooksModuleProblem, {
    type: 'path-not-found', path: path.join(f.workspace, '.harness', 'plugins', 'sample', 'hooks', 'missing.mjs'),
  });
});

test('hooks modules: two entries load neither, in the source\'s words', async t => {
  const f = fixture(t, {}, {
    'hooks/hooks.json': JSON.stringify({...HOOKS, modules: ['./one.mjs', './two.mjs']}),
    'hooks/one.mjs': hooksModule('sample'),
    'hooks/two.mjs': hooksModule('sample'),
  });
  await f.install();
  const component = f.discovered()!;
  const hooksFile = path.join(f.workspace, '.harness', 'plugins', 'sample', 'hooks', 'hooks.json');
  assert.equal(component.hooksModulePath, undefined);
  assert.deepEqual(component.hooksModuleProblem, {
    type: 'hook-load-failed', path: hooksFile,
    reason: `Plugin sample names one hooks module per plugin, but ${hooksFile} and ${hooksFile} each name one in \`modules\`; neither is loaded`,
  });
});

test('hooks modules: installing loads the module in the same call, removing unloads it', async t => {
  const f = fixture(t, {}, {
    'hooks/hooks.json': JSON.stringify({...HOOKS, modules: ['./register.mjs']}),
    'hooks/register.mjs': hooksModule('sample'),
  });
  clearChainRecords();
  const installed = JSON.parse(await f.install());
  // No config read: the install itself awaited the load, as the source's installer awaits `tGe`.
  assert.equal(chainHooked('prompt.edit'), true, 'the install left the module loaded');
  assert.deepEqual(adoptedPluginHooksModules(), ['sample']);

  await f.run('plugin_remove', {name: 'sample', expected_digest: installed.plugin.digest});
  assert.equal(chainHooked('prompt.edit'), false, 'the removal unloaded it');
  assert.deepEqual(adoptedPluginHooksModules(), []);
  // `CVo`'s own sentence, with the record's label.
  assert.ok(chainRecords().some(record => record.kind === 'log'
    && record.message === 'hooks modules unloaded: ' + path.dirname(f.discoveredPath()) + '+sample (plugin disabled or uninstalled)'),
    'the unload is reported the way the source reports it: ' + JSON.stringify(chainRecords().filter(record => record.kind === 'log').map(record => record.message)));
});

test('hooks modules: a config read still loads a plugin another process installed', async t => {
  const f = fixture(t, {}, {
    'hooks/hooks.json': JSON.stringify({...HOOKS, modules: ['./register.mjs']}),
    'hooks/register.mjs': hooksModule('sample'),
  });
  const installed = JSON.parse(await f.install());
  f.readConfig();
  await until(() => chainHooked('prompt.edit'), 'a loaded module hooking prompt.edit');
  assert.deepEqual(adoptedPluginHooksModules(), ['sample']);

  await f.run('plugin_remove', {name: 'sample', expected_digest: installed.plugin.digest});
  // The next read declares nothing, which is the removal the previous read loaded against.
  f.readConfig();
  await until(() => !chainHooked('prompt.edit'), 'the unloaded module');
  assert.deepEqual(adoptedPluginHooksModules(), []);
});

test('hooks modules: a settle already waiting also covers the next adoption', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-queue-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const first = path.join(dir, 'first.mjs');
  const second = path.join(dir, 'second.mjs');
  fs.writeFileSync(first, hooksModule('queue-one'));
  fs.writeFileSync(second, hooksModule('queue-two'));
  t.after(async () => {
    await adoptPluginHooksModules([]);
  });
  const one = {name: 'queue-one', modulePath: first};
  await adoptPluginHooksModules([one]);
  // An adoption replaces the whole declaration list, so the next one names both plugins.
  const settling = pluginHooksModulesSettled();
  await adoptPluginHooksModules([one, {name: 'queue-two', modulePath: second}]);
  await settling;
  assert.deepEqual([...adoptedPluginHooksModules()].sort(), ['queue-one', 'queue-two']);
});
