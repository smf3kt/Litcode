import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { PassThrough, Writable } from 'node:stream';
import { defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import type { McpServerStatus } from '../src/mcp.js';
import type { ModelProvider } from '../src/provider.js';
import { Session } from '../src/session.js';
import type { TerminalCallbacks, TerminalPromptRequest, TerminalSurface } from '../src/terminal.js';

test('/mcp lists the configured servers and reconnects the selected one', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-mcp-')));
  const config = { ...defaultConfig(workspace, []), model: 'test',
    mcpServers: { beta: { command: 'beta-server' }, alpha: { command: 'alpha-server' } } };
  const provider: ModelProvider = {
    count: async () => 0,
    complete: async () => { throw new Error('no completion in this fixture'); },
  };
  const session = Session.open(workspace, { config });
  const statuses: Record<string, McpServerStatus> = {
    alpha: { state: 'connected', generation: 1, attempts: 0 },
    beta: { state: 'disconnected', generation: 0, attempts: 2, lastError: 'boom' },
  };
  const reconnected: string[] = [];
  const watcher = new Writable({ write(_chunk, _encoding, done) { done(); } });
  let callbacks: TerminalCallbacks | undefined;
  const prompts: TerminalPromptRequest[] = [];
  let escaped!: () => void;
  const settled = new Promise<void>(resolve => { escaped = resolve; });
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: watcher,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks!.onSubmit!('/mcp')); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt(request) {
      prompts.push(request);
      if (prompts.length === 1) return { selected: ['alpha'], key: 'r' };
      setImmediate(escaped);
      return undefined;
    },
  };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [],
    mcpServers: () => statuses,
    reconnectMcp: async (server: string) => {
      reconnected.push(server);
      statuses[server] = { state: 'connected', generation: 2, attempts: 0 };
      return statuses[server]!;
    } };
  const input = new PassThrough();
  try {
    const loop = interactiveLoop(session, provider, runtime,
      { input, output: watcher, status: watcher, signal: new AbortController().signal, terminal });
    await settled;
    assert.equal(prompts.length, 2);
    assert.equal(prompts[0]!.title, 'Manage MCP servers');
    assert.equal(prompts[0]!.message, '2 servers\nalpha: connected · no tools\nbeta: disconnected · boom');
    assert.deepEqual(prompts[0]!.choices?.map(choice => choice.value), ['alpha', 'beta']);
    assert.deepEqual(prompts[0]!.choices?.map(choice => choice.description), ['connected · no tools', 'disconnected · boom']);
    assert.deepEqual(prompts[0]!.keys?.map(entry => entry.key), ['r']);
    assert.deepEqual(reconnected, ['alpha']);
    assert.equal(prompts[1]!.message, '2 servers\nalpha: connected · no tools\nbeta: disconnected · boom');
    callbacks!.onExit!();
    await loop;
  } finally {
    session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});
