import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PassThrough, Writable } from 'node:stream';
import { createRequire } from 'node:module';
import type { Terminal } from '@xterm/headless';
import { setTimeout as delay } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { loadProjectConfig } from '../src/config.js';
import { interactiveLoop } from '../src/interactive.js';
import { pluginDetailRequest, pluginStatusText, parsePluginCommand } from '../src/plugin-panel.js';
import { desiredPluginConfig, setPluginEnabled } from '../src/plugin-toggle.js';
import { createPluginTools, discoverInstalledPluginComponents, installedPluginCatalogIdentity, pluginConfigSchema, readPluginStore } from '../src/plugins.js';
import { adoptedPluginHooksModules, adoptPluginHooksModules, pluginHooksModulesSettled } from '../src/plugin-chain-registry.js';
import { chainHooked } from '../src/plugin-chain-relay.js';
import type { ModelProvider } from '../src/provider.js';
import { createRuntime, type Runtime } from '../src/runtime.js';
import { reloadConfig } from '../src/reload.js';
import { Session } from '../src/session.js';
import { TuiTerminal } from '../src/tui.js';
import type { ToolContext } from '../src/tools.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };

async function fixture(t: TestContext, modules = false) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w299-plugin-')));
  const workspace = path.join(root, 'workspace'), userDir = path.join(root, 'user');
  fs.mkdirSync(workspace); fs.mkdirSync(userDir); fs.mkdirSync(path.join(workspace, '.git')); fs.mkdirSync(path.join(workspace, '.harness'));
  const user = path.join(userDir, 'settings.json'), project = path.join(workspace, '.harness/settings.json'), local = path.join(workspace, '.harness/settings.local.json');
  fs.writeFileSync(user, JSON.stringify({ plugins: { enabled: true }, keep: 7 }));
  const pidFile = path.join(root, 'mcp-pids'), server = path.join(root, 'owned-mcp.mjs');
  if (modules) fs.writeFileSync(server, "import fs from 'node:fs';import readline from 'node:readline';fs.appendFileSync(process.argv[2],process.pid+'\\n');readline.createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.id===undefined)return;const result=m.method==='initialize'?{protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'owned',version:'1'}}:m.method==='tools/list'?{tools:[{name:'echo',description:'Owned local echo',inputSchema:{type:'object',properties:{}}}]}:{};process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\\n')});");
  const pids = () => fs.existsSync(pidFile) ? fs.readFileSync(pidFile, 'utf8').trim().split('\n').filter(Boolean).map(Number) : [];
  const live = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  const install = createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_install')!;
  const context: ToolContext = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 };
  for (const name of ['alpha', 'beta']) {
    const source = path.join(root, name); fs.mkdirSync(source); fs.mkdirSync(path.join(source, 'skills/helper'), { recursive: true });
    fs.mkdirSync(path.join(source, 'agents')); fs.mkdirSync(path.join(source, 'themes'));
    fs.writeFileSync(path.join(source, 'plugin.json'), JSON.stringify({ name, version: '1.0', description: `${name} description`, hooks: 'hooks.json', ...(modules && name === 'alpha' ? { mcpServers: 'mcp.json' } : {}) }));
    fs.writeFileSync(path.join(source, 'skills/helper/SKILL.md'), `---\nname: ${name}-helper\ndescription: ${name} skill\n---\n${name} body`);
    fs.writeFileSync(path.join(source, 'agents/reviewer.md'), `---\nname: ${name}-reviewer\ndescription: ${name} reviewer\n---\nreview`);
    fs.writeFileSync(path.join(source, 'themes/owned.json'), JSON.stringify({ name: `${name}-theme`, base: 'dark' }));
    fs.writeFileSync(path.join(source, 'hooks.json'), JSON.stringify({ hooks: { PreToolUse: [{ command: 'true' }] },
      ...(modules && name === 'alpha' ? { modules: ['./register.mjs'] } : {}) }));
    if (modules && name === 'alpha') {
      fs.writeFileSync(path.join(source, 'register.mjs'), "export default {name:'alpha',tier:'user',patterns:[{pattern:'prompt.edit'}],handlers:{'prompt.edit':async(input,next)=>next(input)}};");
      fs.writeFileSync(path.join(source, 'mcp.json'), JSON.stringify({ mcpServers: { local: { command: process.execPath, args: [server, pidFile] } } }));
    }
    await install.execute({ directory: source }, context);
  }
  const config = { ...defaultConfig(workspace, []), model: 'fixture', plugins: { enabled: true }, configSources: { userDir }, prefersReducedMotion: true };
  t.after(() => { for (const pid of pids()) if (live(pid)) process.kill(pid, 'SIGTERM'); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, workspace, userDir, user, project, local, config, pids, live };
}

test('local plugin toggles persist the deciding layer and filter every discovered component without changing installed bytes', async t => {
  const f = await fixture(t), before = readPluginStore(f.workspace, f.config.plugins), identity = installedPluginCatalogIdentity(f.workspace, f.config.plugins);
  fs.writeFileSync(f.project, JSON.stringify({ plugins: { enabledPlugins: { beta: false } }, keep: 'project' }));
  const disabled = await setPluginEnabled(f.config, 'alpha', false);
  assert.deepEqual(disabled, { success: true, name: 'alpha', enabled: false, scope: 'project', message: 'Successfully disabled plugin: alpha (scope: project)' });
  const disk = JSON.parse(fs.readFileSync(f.project, 'utf8'));
  assert.deepEqual(disk, { plugins: { enabledPlugins: { beta: false, alpha: false } }, keep: 'project' });
  assert.equal(JSON.parse(fs.readFileSync(f.user, 'utf8')).keep, 7);
  assert.equal(readPluginStore(f.workspace, desiredPluginConfig(f.config)).identity, before.identity);
  assert.deepEqual(readPluginStore(f.workspace, desiredPluginConfig(f.config)).entries.map(row => row.enabled), [false, false]);
  assert.deepEqual(discoverInstalledPluginComponents(f.workspace, desiredPluginConfig(f.config)), []);
  assert.notEqual(installedPluginCatalogIdentity(f.workspace, desiredPluginConfig(f.config)), identity);
  assert.deepEqual(loadProjectConfig(f.workspace, { userDir: f.userDir }).skills, []);
  fs.writeFileSync(f.local, JSON.stringify({ plugins: { enabledPlugins: { alpha: false } }, keep: 'local' }));
  assert.equal((await setPluginEnabled(f.config, 'alpha', true)).success, true);
  assert.equal(JSON.parse(fs.readFileSync(f.local, 'utf8')).plugins.enabledPlugins.alpha, true);
  const active = discoverInstalledPluginComponents(f.workspace, desiredPluginConfig(f.config));
  assert.equal(active.length, 1); assert.equal(active[0]!.plugin.manifest.name, 'alpha');
  assert.equal(active[0]!.skillDirectories.length, 1); assert.equal(active[0]!.agentPaths.length, 1);
  assert.equal(active[0]!.themePaths?.name, 'alpha'); assert.equal(active[0]!.hooks?.PreToolUse?.length, 1);
  assert.deepEqual(await setPluginEnabled(f.config, 'alpha', true), { success: false, alreadyInGoalState: true, message: 'Plugin "alpha" is already enabled' });
  assert.match((await setPluginEnabled(f.config, 'missing', true)).message, /not installed/);
  fs.writeFileSync(f.local, JSON.stringify({ plugins: { enabled: false } }));
  assert.match((await setPluginEnabled(f.config, 'alpha', true)).message, /plugins.enabled/);
  assert.equal(JSON.parse(fs.readFileSync(f.local, 'utf8')).plugins.enabled, false);
  assert.throws(() => pluginConfigSchema.parse({ enabled: true, enabledPlugins: { alpha: 'wrong' } }));
  fs.writeFileSync(f.local, '{broken'); await assert.rejects(setPluginEnabled(f.config, 'alpha', false));
  assert.equal(fs.readFileSync(f.local, 'utf8'), '{broken');
  assert.deepEqual(readPluginStore(f.workspace, f.config.plugins).entries.map(row => row.digest), before.entries.map(row => row.digest));
});

test('typed plugin grammar, explicit overrides and concurrent writes retain pending versus applied state', async t => {
  const f = await fixture(t);
  assert.deepEqual(parsePluginCommand('ENABLE alpha'), { type: 'enable', plugin: 'alpha' });
  assert.deepEqual(parsePluginCommand('ls --disabled'), { type: 'list', filter: 'disabled' });
  assert.deepEqual(parsePluginCommand('disable'), { type: 'disable', plugin: undefined });
  await Promise.all(['alpha', 'beta'].map(name => setPluginEnabled(f.config, name, false)));
  assert.deepEqual(JSON.parse(fs.readFileSync(f.project, 'utf8')).plugins.enabledPlugins, { alpha: false, beta: false });
  const pending = { name: 'alpha', scope: 'project', enabled: false, appliedEnabled: true, verified: true };
  assert.equal(pluginStatusText(pending), '✘ disabled — run /reload-plugins to apply');
  assert.equal(pluginDetailRequest(pending).choices?.[0]?.label, 'Enable plugin');
  const flag = path.join(f.root, 'explicit.json'); fs.writeFileSync(flag, JSON.stringify({ plugins: { enabledPlugins: { alpha: true } } }));
  assert.match((await setPluginEnabled({ ...f.config, configSources: { userDir: f.userDir, settingsFile: flag } }, 'alpha', false)).message, /explicit settings file/);
  const refreshed = reloadConfig(f.config); assert.equal(refreshed.plugins?.enabledPlugins?.alpha, false);
  const session = Session.open(f.workspace, { config: refreshed }); const id = session.id; session.close();
  const resumed = Session.open(f.workspace, { id }); assert.equal(resumed.config.plugins?.enabledPlugins?.alpha, false); resumed.close();
});

test('actual plugin list space, detail action and reload update the live command catalog with owned runtime cleanup', { timeout: 15000 }, async t => {
  const f = await fixture(t, true), controller = new AbortController(), screen = new HeadlessTerminal({ cols: 110, rows: 36, allowProposedApi: true, logLevel: 'off' });
  const core: unknown = Reflect.get(screen, '_core');
  if (!core || typeof core !== 'object' || !('writeSync' in core) || typeof core.writeSync !== 'function') throw new Error('Pinned xterm decoder unavailable');
  const write = core.writeSync.bind(core);
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_value: boolean) {} });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) { write(String(chunk)); done(); } }), { isTTY: true, columns: 110, rows: 36 });
  const tui = new TuiTerminal({ input, output, userDir: f.userDir, prefersReducedMotion: true, sourceInputGestures: true }).start();
  const config = reloadConfig(f.config), provider: ModelProvider = { count: async () => 1, complete: async () => { throw new Error('unexpected model request'); } };
  const runtime = await createRuntime(config, provider, controller.signal), session = Session.open(f.workspace, { config });
  let currentRuntime = runtime, failReplacement = false, replacementAttempts = 0;
  const track = (value: Runtime) => {
    const reconfigure = value.reconfigure?.bind(value);
    value.reconfigure = async next => {
      replacementAttempts++;
      if (failReplacement) throw new Error('owned replacement failure');
      assert.ok(reconfigure);
      const replacement = await reconfigure(next); track(replacement); currentRuntime = replacement; return replacement;
    };
  };
  track(runtime);
  const loop = interactiveLoop(session, provider, runtime, { input, output, status: output, signal: controller.signal, terminal: tui });
  const text = () => Array.from({ length: screen.rows }, (_, row) => screen.buffer.active.getLine(screen.buffer.active.viewportY + row)?.translateToString(true) ?? '').join('\n');
  const until = async (predicate: () => boolean) => { for (let i = 0; i < 1000; i++) { if (predicate()) return; await delay(5); } assert.fail(text()); };
  const key = (value: string) => input.emit('data', value);
  try {
    await until(() => text().includes('· ready')); await until(() => f.pids().length === 1);
    const firstPid = f.pids()[0]!;
    assert.equal(f.live(firstPid), true); assert.equal(Object.hasOwn(currentRuntime.mcpServers!(), 'alpha/local'), true);
    key('/plugin\r'); await until(() => tui.currentScreen === 'dialog');
    key(' '); await until(() => text().includes('run /reload-plugins to apply'));
    assert.equal(JSON.parse(fs.readFileSync(f.project, 'utf8')).plugins.enabledPlugins.alpha, false);
    key('\r'); await until(() => text().includes('Enable plugin')); key('\r');
    await until(() => text().includes('Successfully enabled plugin: alpha')); key('\x1b'); await delay(70); await until(() => tui.currentScreen === 'chat');
    key('/plugin disable alpha\r'); await until(() => text().includes('Successfully disabled plugin: alpha'));
    await pluginHooksModulesSettled(); assert.equal(chainHooked('prompt.edit'), true);
    const preview = reloadConfig(config, 'preview'); await delay(20); await pluginHooksModulesSettled();
    assert.equal(preview.plugins?.enabledPlugins?.alpha, false);
    assert.equal(chainHooked('prompt.edit'), true); assert.deepEqual(adoptedPluginHooksModules(), ['alpha']);
    key('/memory\r'); await until(() => text().includes('Memory') && tui.currentScreen === 'dialog');
    key('\x1b'); await delay(70); await until(() => tui.currentScreen === 'chat');
    await pluginHooksModulesSettled(); assert.equal(chainHooked('prompt.edit'), true); assert.equal(f.live(firstPid), true);
    key('/config\r'); await until(() => text().includes('Type to filter')); key('progressBar\r');
    await until(() => text().includes('Enter/Space change')); key('\r');
    await until(() => JSON.parse(fs.readFileSync(f.user, 'utf8')).terminalProgressBarEnabled === false);
    key('\x1b'); await delay(70); await until(() => tui.currentScreen === 'chat');
    await pluginHooksModulesSettled(); assert.equal(chainHooked('prompt.edit'), true); assert.equal(f.live(firstPid), true);
    key('/reload-plugins\r'); await until(() => text().includes('This reload changes MCP tools'));
    await delay(40); await pluginHooksModulesSettled();
    assert.equal(chainHooked('prompt.edit'), true); assert.equal(f.live(firstPid), true); assert.equal(currentRuntime, runtime);
    key('/alpha-'); await until(() => text().includes('/alpha-helper')); key('\x15');
    failReplacement = true; key('/reload-plugins --force\r'); await until(() => text().includes('owned replacement failure'));
    await pluginHooksModulesSettled();
    assert.equal(chainHooked('prompt.edit'), true); assert.equal(f.live(firstPid), true); assert.equal(currentRuntime, runtime);
    assert.equal(config.plugins?.enabledPlugins?.alpha, undefined);
    key('/alpha-'); await until(() => text().includes('/alpha-helper')); key('\x15');
    key('/reload-skills\r'); await until(() => text().includes('Reloaded skills:'));
    await pluginHooksModulesSettled(); assert.equal(chainHooked('prompt.edit'), true); assert.equal(f.live(firstPid), true);
    failReplacement = false; key('/reload-plugins --force\r'); await until(() => text().includes('Reloaded: 1 plugin'));
    await until(() => !f.live(firstPid)); assert.equal(chainHooked('prompt.edit'), false);
    key('/alpha-'); await delay(50); assert.equal(text().includes('/alpha-helper'), false); key('\x15');
    key('/beta-'); await until(() => text().includes('/beta-helper')); key('\x15');
    key('/plugin enable alpha\r'); await until(() => text().includes('Successfully enabled plugin: alpha'));
    const warningCount = () => (text().match(/This reload changes MCP tools/g) ?? []).length;
    const previousWarnings = warningCount(); key('/reload-plugins\r'); await until(() => warningCount() > previousWarnings);
    await delay(40); await pluginHooksModulesSettled();
    assert.equal(chainHooked('prompt.edit'), false); assert.equal(f.pids().length, 1);
    key('/alpha-'); await delay(50); assert.equal(text().includes('/alpha-helper'), false); key('\x15');
    key('/reload-plugins --force\r'); await until(() => text().includes('Reloaded: 2 plugins'));
    await until(() => f.pids().length === 2); assert.equal(chainHooked('prompt.edit'), true);
    const secondPid = f.pids()[1]!; assert.equal(f.live(secondPid), true);
    key('/alpha-'); await until(() => text().includes('/alpha-helper')); key('\x15');
    fs.writeFileSync(f.user, JSON.stringify({ plugins: { enabled: true }, keep: 7, watchConfig: true }));
    const beforeWatch = currentRuntime; key('/reload\r');
    await until(() => text().includes('Local configuration reloaded;') && currentRuntime !== beforeWatch);
    await until(() => f.pids().length === 3 && !f.live(secondPid));
    const watchedRuntime = currentRuntime, watchedPid = f.pids()[2]!, beforeAttempts = replacementAttempts;
    failReplacement = true; key('/plugin disable alpha\r');
    await until(() => replacementAttempts > beforeAttempts); await delay(40); await pluginHooksModulesSettled();
    assert.equal(currentRuntime, watchedRuntime); assert.equal(chainHooked('prompt.edit'), true); assert.equal(f.live(watchedPid), true);
    assert.equal(Object.hasOwn(currentRuntime.mcpServers!(), 'alpha/local'), true);
    key('/alpha-'); await until(() => text().includes('/alpha-helper')); key('\x15');
    failReplacement = false; key('/reload\r'); await until(() => currentRuntime !== watchedRuntime && !f.live(watchedPid));
    await until(() => !chainHooked('prompt.edit')); key('/alpha-'); await delay(50); assert.equal(text().includes('/alpha-helper'), false);
    key('\x15/exit\r'); await loop;
    await until(() => f.pids().every(pid => !f.live(pid)));
    assert.equal(fs.readdirSync(path.join(f.workspace, '.agent')).some(file => file.endsWith('.lock')), false);
  } finally { controller.abort(); await loop; tui.close(); session.close(); await currentRuntime.close(); await runtime.close(); await adoptPluginHooksModules([]); screen.dispose(); }
});
