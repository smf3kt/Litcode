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
import type { TerminalCallbacks, TerminalPromptRequest, TerminalSurface } from '../src/terminal.js';
import type { ToolContext } from '../src/tools.js';

function packageAt(root: string, name: string, version: string): string {
  const dir = fs.mkdtempSync(path.join(root, `${name}-source-`));
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({ name, version, description: `${name} fixture` }));
  return dir;
}
async function install(workspace: string, sourceRoot: string, name: string, version: string): Promise<void> {
  const tool = createPluginTools({ enabled: true }).find(item => item.schema.name === 'plugin_install')!;
  const context: ToolContext = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000 };
  await tool.execute({ directory: packageAt(sourceRoot, name, version) }, context);
}

async function drive(commands: readonly string[], options: { install?: readonly [string, string][]; enabled?: boolean; answers?: readonly string[] } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-plugin-')));
  const workspace = path.join(root, 'workspace');
  const sources = path.join(root, 'sources');
  fs.mkdirSync(workspace); fs.mkdirSync(sources);
  for (const [name, version] of options.install ?? []) await install(workspace, sources, name, version);
  const config = { ...defaultConfig(workspace, []), model: 'test',
    plugins: options.enabled === false ? { enabled: false } : { enabled: true } };
  const provider: ModelProvider = {
    count: async () => 0,
    complete: async () => { throw new Error('no completion in this fixture'); },
  };
  const session = Session.open(workspace, { config });
  const chunks: string[] = [];
  const watcher = new Writable({ write(chunk, _encoding, done) { chunks.push(String(chunk)); done(); } });
  let callbacks: TerminalCallbacks | undefined;
  const prompts: TerminalPromptRequest[] = [];
  const queue = [...commands];
  const answers = options.answers ?? [];
  let escaped!: () => void;
  const settled = new Promise<void>(resolve => { escaped = resolve; });
  const input = new PassThrough();
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: watcher,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() {
      const next = () => {
        const command = queue.shift();
        if (command === undefined) { setImmediate(() => callbacks?.onExit?.()); return; }
        queueMicrotask(() => callbacks!.onSubmit!(command));
        setTimeout(next, 30);
      };
      next();
    },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt(request) {
      prompts.push(request);
      const answer = answers[prompts.length - 1];
      if (answer !== undefined) return { selected: [], key: answer };
      setImmediate(escaped);
      return undefined;
    },
  };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
  try {
    const loop = interactiveLoop(session, provider, runtime,
      { input, output: watcher, status: watcher, signal: new AbortController().signal, terminal });
    // A refused arm never opens a dialog, so the loop can finish without the escape.
    await Promise.race([loop, settled]);
    await loop;
    return { prompts, text: chunks.join(''), workspace, session, root };
  } finally {
    session.close(); fs.rmSync(root, { recursive: true, force: true });
  }
}

test('/plugin opens the Installed list with each row and its state', async () => {
  const run = await drive(['/plugin'], { install: [['zeta', '2.0.0'], ['alpha', '1.0.0']] });
  assert.equal(run.prompts.length, 1);
  assert.equal(run.prompts[0]!.title, 'Plugins');
  assert.equal(run.prompts[0]!.readOnly, true);
  assert.equal(run.prompts[0]!.message, ['Installed plugins:',
    '  • alpha (v1.0.0, project) ✔ enabled', '  • zeta (v2.0.0, project) ✔ enabled'].join('\n'));
  assert.deepEqual(run.prompts[0]!.keys, [{ key: 'f', label: 'filter enabled' }]);
});

test('/plugins and /marketplace reach the same panel', async () => {
  for (const command of ['/plugins', '/marketplace']) {
    const run = await drive([command], { install: [['sample', '1']] });
    assert.equal(run.prompts[0]?.title, 'Plugins', command);
    assert.ok(run.prompts[0]!.message.includes('sample (v1, project)'), command);
  }
});

test('an empty store names the install command', async () => {
  const run = await drive(['/plugin']);
  assert.equal(run.prompts[0]!.message, 'No plugins installed. Use `/plugin install` to install a plugin.');
});

test('the filter key walks all, enabled, disabled and clears', async () => {
  const run = await drive(['/plugin list'], { install: [['sample', '1']], answers: ['f', 'f', 'f'] });
  assert.equal(run.prompts.length, 4);
  assert.deepEqual(run.prompts.map(prompt => prompt.keys?.[0]?.label),
    ['filter enabled', 'filter disabled', 'clear filter', 'filter enabled']);
  assert.ok(run.prompts[1]!.message.includes('sample (v1, project) ✔ enabled'));
  assert.equal(run.prompts[2]!.message, 'No disabled plugins.');
  assert.ok(run.prompts[3]!.message.includes('Installed plugins:'));
});

test('a gated store renders its rows disabled', async () => {
  const run = await drive(['/plugin'], { install: [['sample', '1']], enabled: false });
  assert.equal(run.prompts[0]!.message, ['Installed plugins:', '  • sample (v1, project) ✘ disabled'].join('\n'));
});

test('a piped session keeps the text list', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-plugin-pipe-')));
  const workspace = path.join(root, 'workspace');
  fs.mkdirSync(workspace);
  await install(workspace, root, 'sample', '1');
  const config = { ...defaultConfig(workspace, []), model: 'test', plugins: { enabled: true } };
  const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('no completion in this fixture'); } };
  const session = Session.open(workspace, { config });
  const chunks: string[] = [];
  const watcher = new Writable({ write(chunk, _encoding, done) { chunks.push(String(chunk)); done(); } });
  let callbacks: TerminalCallbacks | undefined;
  const input = new PassThrough();
  const surface: TerminalSurface = {
    isTTY: false, outputStream: watcher,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks!.onSubmit!('/plugin')); setImmediate(() => callbacks?.onExit?.()); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
  };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
  try {
    await interactiveLoop(session, provider, runtime,
      { input, output: watcher, status: watcher, signal: new AbortController().signal, terminal: surface });
    assert.ok(chunks.join('').includes('  • sample (v1, project) ✔ enabled'), chunks.join(''));
  } finally {
    session.close(); fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an unknown arm is refused with the recovered list usage', async () => {
  const run = await drive(['/plugin install foo']);
  assert.ok(run.text.includes('error: Use /plugin list [--enabled|--disabled]'), run.text);
  assert.equal(run.prompts.length, 0);
});
