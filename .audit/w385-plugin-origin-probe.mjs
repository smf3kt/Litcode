// Owned local fixtures only; recovered modules are never executed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createPluginTools } from '../dist/plugins.js';
import { loadProjectConfig } from '../dist/config.js';
import { runHooks } from '../dist/hooks.js';
import { AsyncHookRegistry } from '../dist/async-hooks.js';
import { duplicateSessionStart } from '../dist/async-hook-response.js';
import { Session } from '../dist/session.js';
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-origin-')));
const workspace = path.join(root, 'workspace'), userDir = path.join(root, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(userDir);
let registry;
try {
  const command = `printf '%s' '{"systemMessage":"SAME_PLUGIN_OUTPUT"}'`;
  const install = createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_install');
  for (const name of ['alpha', 'beta']) {
    const source = path.join(root, name); fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'plugin.json'), JSON.stringify({ name, version: '1', hooks: 'hooks.json' }));
    fs.writeFileSync(path.join(source, 'hooks.json'), JSON.stringify({ hooks: { SessionStart: [{ command, async: true }] } }));
    const result = JSON.parse(await install.execute({ directory: source }, { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 }));
    assert.equal(result.status, 'installed');
  }
  fs.mkdirSync(path.join(workspace, '.harness'), { recursive: true });
  fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ plugins: { enabled: true } }));
  const loaded = loadProjectConfig(workspace, { userDir, pluginHooks: 'preview' });
  const hooks = loaded.settings.hooks;
  assert.equal(hooks.SessionStart.length, 2);
  registry = new AsyncHookRegistry({ workspace });
  const result = await runHooks(hooks, 'SessionStart', { cwd: workspace }, new AbortController().signal,
    { startAsyncCommand: registry.start });
  assert.equal(result.backgroundTasks.length, 2);
  const completions = await Promise.all(result.backgroundTasks.map(id => registry.wait(id)));
  assert.ok(completions.every(value => value.delivery.kind === 'attachment'));
  const attachments = completions.map(value => value.delivery.attachment);
  const crossPluginSuppressed = duplicateSessionStart(attachments[1], [attachments[0]]);
  assert.equal(crossPluginSuppressed, false);
  assert.equal(duplicateSessionStart(attachments[0], [attachments[0]]), true);
  assert.notEqual(attachments[0].pluginId, attachments[1].pluginId);
  const preload = path.join(root, 'provider.mjs');
  fs.writeFileSync(preload, `globalThis.fetch=()=>{throw Error('network disabled')};
    const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});
    GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{
      await new Promise(resolve=>setTimeout(resolve,100));
      return {id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'done'}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
  const cli = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', workspace, '--user-dir', userDir, '--model', 'fixture',
    '--interactive', '--no-tui', '--no-inherit-gateway'], { input: 'task\n', encoding: 'utf8', timeout: 20000,
    env: { ...process.env, HOME: userDir, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
  assert.equal(cli.status, 0, cli.stderr + cli.stdout);
  const journal = fs.readdirSync(path.join(workspace, '.agent')).find(name => name.endsWith('.jsonl'));
  const saved = Session.open(workspace, { id: journal.slice(0, -6) });
  try {
    const ids = saved.events.filter(row => row.kind === 'notification_intent_v2' && row.batch.kind === 'async_hook')
      .map(row => row.batch.attachment.pluginId);
    assert.equal(ids.length, 2); assert.equal(new Set(ids).size, 2);
    assert.deepEqual(saved.config.hooks.SessionStart.map(row => row.pluginOrigin.id), hooks.SessionStart.map(row => row.pluginOrigin.id));
  } finally { saved.close(); }
  console.log(JSON.stringify({ probe: 'two installed plugins with identical commands/output',
    mergedEntriesIdentical: JSON.stringify(hooks.SessionStart[0]) === JSON.stringify(hooks.SessionStart[1]),
    pluginIds: attachments.map(row => row.pluginId ?? null),
    sameHomeScope: completions[0].commandScope === completions[1].commandScope,
    crossPluginSuppressed, expectedAfterRepair: false, cli: 'two distinct plugin intents; saved config cold read retains IDs' }));
} finally { await registry?.close(); fs.rmSync(root, { recursive: true, force: true }); }
