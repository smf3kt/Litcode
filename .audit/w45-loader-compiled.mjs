// Drives the compiled artifact's module loader: loads a real module file through dist/, answers a
// chain dispatch, checks the composer relay gate, and unloads. Run after `npm run build`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadProjectConfig} from '../dist/config.js';
import {createPluginTools, discoverInstalledPluginComponents} from '../dist/plugins.js';
import {ga} from '../dist/plugin-chain-entry.js';
import {chainRecords, it, Fv} from '../dist/plugin-chain-host.js';
import {createChainRun, loadChainModuleFileInto} from '../dist/plugin-chain-loader.js';
import {chainHooked, composerEditRelay} from '../dist/plugin-chain-relay.js';
import {adoptedPluginHooksModules, pluginHooksModulesSettled, promptEditChain} from '../dist/plugin-chain-registry.js';

// Realpath'd: the plugin store refuses a path that resolves through a symlink (`/var` on macOS).
const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w45-loader-compiled-')));
const modulePath = path.join(dir, 'hooks.mjs');
fs.writeFileSync(modulePath, `export default {
  name: 'compiled-fixture',
  tier: 'user',
  patterns: [{pattern: 'prompt.edit'}],
  handlers: {'prompt.edit': async (input, next) => ({...await next(input), tag: 'compiled'})},
  interface: {demo: {echo: (value) => 'echo:' + value}},
};
`);

const run = createChainRun();
const loaded = await loadChainModuleFileInto(run, {pluginName: 'compiled-fixture', modulePath});
const record = loaded.record;
assert.equal(record.label, `${dir}+compiled-fixture`);
assert.equal(it().loadedModules.length, 1);
assert.equal(chainHooked('prompt.edit'), true);

const answer = await ga('prompt.edit', {core: {'prompt.edit': promptEditChain.core}})({
  text: 'hello world', cursor: 11, start: 6, end: 11, inputText: 'there', origin: [], key: 'compiled-1',
});
assert.equal(answer.text, 'hello there');
assert.equal(answer.tag, 'compiled');
assert.equal(await record.callInterface({owner: 'app', name: 'demo', method: 'echo', args: ['x']}), 'echo:x');

// The composer owner path: a second module file rewrites the raise, so the committed draft is text
// this driver never assigns as a literal.
const rewritePath = path.join(dir, 'rewrite.mjs');
fs.writeFileSync(rewritePath, `export default {
  name: 'compiled-rewrite',
  tier: 'user',
  patterns: [{pattern: 'prompt.edit'}],
  handlers: {'prompt.edit': (input, handle) => handle({...input, inputText: 'there'})},
};
`);
const rewriting = await loadChainModuleFileInto(run, {pluginName: 'compiled-rewrite', modulePath: rewritePath});
let draft = {text: 'hello world', cursor: 11};
const relay = composerEditRelay({
  read: () => ({...draft}),
  commit: (box) => { draft = {text: box.text, cursor: box.cursor}; },
});
draft = {text: 'hello!', cursor: 6};
relay.record({before: {text: 'hello world', cursor: 11}, after: {text: 'hello!', cursor: 6}, key: {key: '!', name: '!'}});
await new Promise((resolve) => setImmediate(resolve));
relay.dispose();
assert.deepEqual(draft, {text: 'hellothere', cursor: 10}, "the loaded module's rewrite landed");
// Two modules are loaded here, so the hop's settle line names both labels and starts with the first:
// the rewriting module's own label is the part this driver checks for.
assert.ok(
  chainRecords().some((r) => r.kind === 'log' && r.message.includes(`hooks module `) && r.message.includes(`${rewriting.record.label} prompt.edit settled in`)),
  'the hop through the loaded module is reported',
);

rewriting.unload();
loaded.unload();
assert.equal(it().loadedModules.length, 0);
const hookedAfterUnload = chainHooked('prompt.edit');
assert.equal(hookedAfterUnload, false);
assert.equal(run.state.environmentArgs.size, 0);
assert.deepEqual(record.status(), {kind: 'unloaded', retired: true});
// The plugin path: an installed plugin that declares `hooksModule` is adopted by the config read and
// its module answers the same chain.
const workspace = path.join(dir, 'workspace');
const source = path.join(dir, 'plugin-source');
const userDir = path.join(dir, 'user');
for (const folder of [workspace, source, userDir]) fs.mkdirSync(folder);
fs.mkdirSync(path.join(source, 'hooks'));
fs.writeFileSync(path.join(source, 'plugin.json'), JSON.stringify({name: 'compiled-plugin', version: '1', hooks: 'hooks/hooks.json'}));
fs.writeFileSync(path.join(source, 'hooks', 'hooks.json'), JSON.stringify({hooks: {SessionStart: [{command: 'compiled-hook'}]}, modules: ['./register.mjs']}));
fs.writeFileSync(path.join(source, 'hooks', 'register.mjs'), `export default {
  name: 'compiled-plugin',
  tier: 'user',
  patterns: [{pattern: 'prompt.edit'}],
  handlers: {'prompt.edit': async (input, next) => ({...await next(input), tag: 'plugin'})},
};
`);
const tools = createPluginTools({enabled: true});
const install = tools.find((tool) => tool.schema.name === 'plugin_install');
const remove = tools.find((tool) => tool.schema.name === 'plugin_remove');
const context = {workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000};
const installed = JSON.parse(await install.execute({directory: source}, context));
// The install itself awaited the load: no config read has run yet.
assert.equal(chainHooked('prompt.edit'), true, 'the install left the module loaded');
assert.deepEqual(adoptedPluginHooksModules(), ['compiled-plugin']);
const [component] = discoverInstalledPluginComponents(workspace, {enabled: true});
assert.equal(component.hooksModulePath, path.join(workspace, '.harness', 'plugins', 'compiled-plugin', 'hooks', 'register.mjs'));
assert.equal(component.hooksModuleProblem, undefined);
assert.equal(Fv('compiled-plugin'), undefined, 'a builtin lookup answers nothing for an installed plugin');
fs.writeFileSync(path.join(workspace, '.harness', 'settings.json'), JSON.stringify({plugins: {enabled: true}}));
loadProjectConfig(workspace, {userDir});
await pluginHooksModulesSettled();
assert.deepEqual(adoptedPluginHooksModules(), ['compiled-plugin'], 'the config read reconciles to the same set');
const pluginAnswer = await ga('prompt.edit', {core: {'prompt.edit': promptEditChain.core}})({
  text: 'hello world', cursor: 11, start: 6, end: 11, inputText: 'there', origin: [], key: 'compiled-2',
});
assert.equal(pluginAnswer.text, 'hello there');
assert.equal(pluginAnswer.tag, 'plugin');

await remove.execute({name: 'compiled-plugin', expected_digest: installed.plugin.digest}, context);
assert.deepEqual(adoptedPluginHooksModules(), [], 'the removal unloaded the module');
assert.ok(chainRecords().some((record) => record.kind === 'log'
  && /^hooks modules unloaded: .*\+compiled-plugin \(plugin disabled or uninstalled\)$/.test(record.message)),
  'the unload is reported the way the source reports it');

fs.rmSync(dir, {recursive: true, force: true});

console.log(JSON.stringify({
  artifact: 'dist',
  label: record.label,
  answer: {text: answer.text, tag: answer.tag},
  interfaceEcho: 'echo:x',
  relayDraft: draft,
  chainRecords: chainRecords().length,
  hookedAfterUnload,
  recordStatus: record.status(),
  pluginHooksModule: {adopted: adoptedPluginHooksModules(), modulePath: component.hooksModulePath,
    loadedByInstall: true, unloadLogged: chainRecords().some((record) => record.kind === 'log'
      && /^hooks modules unloaded: .* \(plugin disabled or uninstalled\)$/.test(record.message)),
    answer: {text: pluginAnswer.text, tag: pluginAnswer.tag}},
}));
