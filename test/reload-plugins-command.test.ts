import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { PassThrough, Writable } from 'node:stream';
import { defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import { createPluginTools } from '../src/plugins.js';
import type { ModelProvider } from '../src/provider.js';
import { Session } from '../src/session.js';
import type { TerminalCallbacks, TerminalSurface } from '../src/terminal.js';
import type { ToolContext } from '../src/tools.js';

function packageAt(root: string, name: string, version: string, files: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(root, `${name}-source-`));
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({ name, version, description: `${name} fixture` }));
  for (const [relative, bytes] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true });
    fs.writeFileSync(path.join(dir, relative), bytes);
  }
  return dir;
}
async function install(workspace: string, sourceRoot: string, name: string, version: string,
  files: Record<string, string> = {}): Promise<void> {
  const tool = createPluginTools({ enabled: true }).find(item => item.schema.name === 'plugin_install')!;
  const context: ToolContext = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000 };
  await tool.execute({ directory: packageAt(sourceRoot, name, version, files) }, context);
}

/**
 * The runtime the loop needs for `/reload-plugins`: a `reconfigure` that returns the same
 * runtime, so the successor session binds in place like the real local runtime does.
 */
function reloadRuntime() {
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [],
    reconfigure: async () => runtime };
  return runtime;
}

async function drive(commands: readonly string[], options: { install?: readonly (readonly [string, string,
  Record<string, string>?])[]; reconfigure?: boolean; interactive?: boolean } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-reload-plugins-')));
  const workspace = path.join(root, 'workspace');
  const sources = path.join(root, 'sources');
  const userDir = path.join(root, 'user');
  fs.mkdirSync(workspace); fs.mkdirSync(sources); fs.mkdirSync(userDir);
  // The gate lives in settings, the way a real session carries it; the reload re-reads it.
  fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ plugins: { enabled: true } }));
  for (const [name, version, files] of options.install ?? []) await install(workspace, sources, name, version, files);
  const config = { ...defaultConfig(workspace, []), model: 'test', plugins: { enabled: true },
    configSources: { userDir } };
  const provider: ModelProvider = { count: async () => 0,
    complete: async () => { throw new Error('no completion in this fixture'); } };
  const session = Session.open(workspace, { config });
  const chunks: string[] = [];
  const watcher = new Writable({ write(chunk, _encoding, done) { chunks.push(String(chunk)); done(); } });
  let callbacks: TerminalCallbacks | undefined;
  const queue = [...commands];
  const input = new PassThrough();
  const base = { outputStream: watcher,
    subscribe(value: TerminalCallbacks) { callbacks = value; return () => { callbacks = undefined; }; },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    start() {
      const next = () => {
        const command = queue.shift();
        if (command === undefined) { setImmediate(() => callbacks?.onExit?.()); return; }
        queueMicrotask(() => callbacks!.onSubmit!(command));
        setTimeout(next, 30);
      };
      next();
    } };
  const surface: TerminalSurface = options.interactive === false
    ? { ...base, isTTY: false }
    : { ...base, isTTY: true, async prompt() { return undefined; } };
  const runtime = options.reconfigure === false
    ? { tools: [], buildTools: () => [], close: async () => {}, limits: [] }
    : reloadRuntime();
  try {
    await interactiveLoop(session, provider, runtime,
      { input, output: watcher, status: watcher, signal: new AbortController().signal, terminal: surface });
    return { text: chunks.join(''), session, workspace };
  } finally {
    session.close(); fs.rmSync(root, { recursive: true, force: true });
  }
}

test('/reload-plugins reports the plugin counts from the store', async () => {
  const run = await drive(['/reload-plugins'], { install: [['alpha', '1.0.0'], ['beta', '2.0.0']] });
  assert.ok(run.text.includes('Reloaded: 2 plugins · 0 skills · 0 agents · 0 hooks · 0 plugin MCP servers · 0 plugin LSP servers'),
    run.text);
  assert.equal(run.text.includes('during load'), false, run.text);
});

test('an empty store reloads with zero plugins', async () => {
  const run = await drive(['/reload-plugins']);
  assert.ok(run.text.includes('Reloaded: 0 plugins'), run.text);
});

test('the catalog counts what the installed plugins declare', async () => {
  const run = await drive(['/reload-plugins'], { install: [
    ['alpha', '1.0.0', { 'skills/helper/SKILL.md': '---\nname: helper\ndescription: helper skill\n---\nbody\n' }],
    ['beta', '2.0.0', { 'agents/reviewer.md': '---\nname: reviewer\ndescription: reviewer agent\n---\nbody\n' }],
  ] });
  assert.ok(/Reloaded: 2 plugins · 1 skill · 1 agent · 0 hooks/.test(run.text), run.text);
});

test('a bare argument other than --force is refused with the usage line', async () => {
  const run = await drive(['/reload-plugins now']);
  assert.ok(run.text.includes('error: Use /reload-plugins [--force]'), run.text);
  assert.equal(run.text.includes('Reloaded:'), false, run.text);
});

test('--force is accepted and reloads', async () => {
  const run = await drive(['/reload-plugins --force'], { install: [['alpha', '1']] });
  assert.ok(run.text.includes('Reloaded: 1 plugin'), run.text);
});

test('a runtime without reconfigure prints the declined line', async () => {
  const run = await drive(['/reload-plugins'], { reconfigure: false });
  assert.ok(run.text.includes("/reload-plugins isn't available over a remote connection in this session."), run.text);
  assert.equal(run.text.includes('Reloaded:'), false, run.text);
});

/**
 * A settings file that gains an MCP server after the session opened is the cache-invalidating
 * change the source guards: the plain command warns, `--force` applies and repeats the warning.
 */
async function driveWithLateServer(commands: readonly string[]) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-reload-plugins-late-')));
  const workspace = path.join(root, 'workspace');
  const userDir = path.join(root, 'user');
  fs.mkdirSync(workspace); fs.mkdirSync(userDir);
  const settings = path.join(userDir, 'settings.json');
  fs.writeFileSync(settings, JSON.stringify({ plugins: { enabled: true } }));
  const config = { ...defaultConfig(workspace, []), model: 'test', plugins: { enabled: true },
    configSources: { userDir } };
  const provider: ModelProvider = { count: async () => 0,
    complete: async () => { throw new Error('no completion in this fixture'); } };
  const session = Session.open(workspace, { config });
  // The server lands after the session pinned its config, so the reload sees a diff.
  fs.writeFileSync(settings, JSON.stringify({ plugins: { enabled: true },
    mcpServers: { 'sample/fs': { command: 'true' } } }));
  const chunks: string[] = [];
  const watcher = new Writable({ write(chunk, _encoding, done) { chunks.push(String(chunk)); done(); } });
  let callbacks: TerminalCallbacks | undefined;
  const queue = [...commands];
  const input = new PassThrough();
  const surface: TerminalSurface = { isTTY: true, outputStream: watcher,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    start() {
      const next = () => {
        const command = queue.shift();
        if (command === undefined) { setImmediate(() => callbacks?.onExit?.()); return; }
        queueMicrotask(() => callbacks!.onSubmit!(command));
        setTimeout(next, 30);
      };
      next();
    },
    async prompt() { return undefined; } };
  const runtime = reloadRuntime();
  try {
    await interactiveLoop(session, provider, runtime,
      { input, output: watcher, status: watcher, signal: new AbortController().signal, terminal: surface });
    return { text: chunks.join(''), session };
  } finally { session.close(); fs.rmSync(root, { recursive: true, force: true }); }
}

test('a changed MCP set warns before applying and applies only with --force', async () => {
  const run = await driveWithLateServer(['/reload-plugins', '/reload-plugins --force']);
  const [warned, forced] = run.text.split('Reloaded:');
  assert.ok(warned!.includes('This reload changes MCP tools (sample/fs)'), run.text);
  assert.ok(warned!.includes('Run /reload-plugins --force to apply.'), run.text);
  // The forced run applies and reports the same warning after the counts.
  assert.ok(forced !== undefined && forced.includes('This reload changes MCP tools (sample/fs)'), run.text);
});
