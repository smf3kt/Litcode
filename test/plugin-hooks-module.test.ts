import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {test, type TestContext} from 'node:test';
import {loadProjectConfig} from '../src/config.js';
import {createPluginTools, discoverInstalledPluginComponents} from '../src/plugins.js';
import {chainRecords, clearChainRecords, onChainRecord} from '../src/plugin-chain-host.js';
import {
  adoptedPluginHooksModules, adoptPluginHooksModules, pluginHooksModulesSettled,
} from '../src/plugin-chain-registry.js';
import {chainHooked, composerEditRelay} from '../src/plugin-chain-relay.js';
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

test('hooks modules: config startup retains each failed module and loads a healthy sibling', async t => {
  const f = fixture(t, {}, {'hooks/hooks.json': JSON.stringify(HOOKS)});
  await f.install();
  const good = path.join(f.workspace, 'good');
  const bad = path.join(f.workspace, 'bad');
  const later = path.join(f.workspace, 'later');
  fs.mkdirSync(good);
  fs.mkdirSync(bad);
  fs.mkdirSync(later);
  const putPlugin = (dir: string, name: string, body: string) => {
    fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({name, version: '1', hooks: 'hooks.json'}));
    fs.writeFileSync(path.join(dir, 'hooks.json'), JSON.stringify({hooks: {}, modules: ['./register.mjs']}));
    fs.writeFileSync(path.join(dir, 'register.mjs'), body);
  };
  putPlugin(good, 'healthy', hooksModule('healthy'));
  putPlugin(bad, 'broken', `throw new Error('broken: first failed'); export default {};`);
  putPlugin(later, 'later', `await new Promise(resolve => setTimeout(resolve, 20)); throw new Error('second failed'); export default {};`);
  await f.run('plugin_install', {directory: good});
  await assert.rejects(f.run('plugin_install', {directory: bad}), /broken: first failed/);
  await pluginHooksModulesSettled();
  await assert.rejects(f.run('plugin_install', {directory: later}));
  await pluginHooksModulesSettled();
  await adoptPluginHooksModules([]);
  clearChainRecords();
  f.readConfig();
  await until(() => chainRecords().some(record => record.kind === 'log' && record.message.includes('second failed')), 'both module failures');
  await pluginHooksModulesSettled();
  assert.deepEqual(adoptedPluginHooksModules(), ['healthy']);
  const errors = chainRecords().flatMap(record => record.kind === 'log' && record.level === 'error' ? [record.message] : []);
  assert.ok(errors.some(message => message.includes('broken: first failed')), JSON.stringify(errors));
  assert.ok(errors.some(message => message.includes('later') && message.includes('second failed')), JSON.stringify(errors));
  assert.equal(chainHooked('prompt.edit'), true);
});

test('hooks modules: a failed load does not poison later edit settlement', async t => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'chain-failure-')));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const first = path.join(dir, 'valid.mjs');
  fs.writeFileSync(first, `export default {name:'survivor',tier:'user',patterns:[{pattern:'prompt.edit'}],handlers:{'prompt.edit':(event,next)=>next({...event,inputText:'there'})}};`);
  const valid = {name: 'survivor', modulePath: first};
  const missing = {name: 'missing', modulePath: path.join(dir, 'absent.mjs')};
  const reports: string[] = [];
  let draft = {text: 'hello world', cursor: 11};
  await adoptPluginHooksModules([valid]);
  await pluginHooksModulesSettled();
  const relay = composerEditRelay({read: () => ({...draft}), commit: box => { draft = box; }, report: message => reports.push(message)});
  try {
    await assert.rejects(adoptPluginHooksModules([valid, missing]), {code: 'ERR_MODULE_NOT_FOUND'});
    await adoptPluginHooksModules([valid]);
    await pluginHooksModulesSettled();
    assert.equal(chainHooked('prompt.edit'), true);
    assert.equal(relay.isRecording(), true);
    const before = draft;
    draft = {text: 'hello!', cursor: 6};
    relay.record({before, after: draft, key: {key: '!', name: '!'}});
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(draft, {text: 'hellothere', cursor: 10});
    assert.deepEqual(reports, []);
  } finally {
    relay.dispose();
    await adoptPluginHooksModules([]);
  }
});

test('hooks modules: a throwing log listener leaves the original load error with its caller', async t => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'chain-log-failure-')));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const modulePath = path.join(dir, 'broken.mjs');
  fs.writeFileSync(modulePath, `throw new Error('module failed'); export default {};`);
  clearChainRecords();
  const unsubscribe = onChainRecord(record => {
    if (record.kind === 'log' && record.message.includes('module failed')) throw new Error('listener failed');
  });
  try {
    await assert.rejects(adoptPluginHooksModules([{name: 'broken', modulePath, path: dir}]), {message: 'module failed'});
    await pluginHooksModulesSettled();
    assert.ok(chainRecords().some(record => record.kind === 'log' && record.message.includes('module failed')));
  } finally {
    unsubscribe();
    await adoptPluginHooksModules([]);
  }
});

test('hooks modules: settlement waits for a slower load after another rejects', async t => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'chain-settling-')));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const gatePath = path.join(dir, 'gate.mjs');
  const slowPath = path.join(dir, 'slow.mjs');
  fs.writeFileSync(gatePath, `let release; export const ready = new Promise(resolve => { release = resolve; }); export function open() { release(); }`);
  fs.writeFileSync(slowPath, `import {ready} from './gate.mjs'; await ready; export default ${hooksModule('slow').replace('export default ', '').trim()}`);
  const gate = await import(pathToFileURL(gatePath).href);
  const slow = {name: 'slow', modulePath: slowPath};
  const missing = {name: 'missing', modulePath: path.join(dir, 'absent.mjs')};
  try {
    await assert.rejects(adoptPluginHooksModules([missing, slow]), {code: 'ERR_MODULE_NOT_FOUND'});
    let completed = false;
    const settling = pluginHooksModulesSettled().then(() => { completed = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(completed, false);
    gate.open();
    await settling;
    assert.deepEqual(adoptedPluginHooksModules(), ['slow']);
    assert.equal(chainHooked('prompt.edit'), true);
  } finally {
    gate.open();
    await pluginHooksModulesSettled();
    await adoptPluginHooksModules([]);
  }
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
