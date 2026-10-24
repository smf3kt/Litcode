import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { Terminal } from '@xterm/headless';
import { PassThrough, Writable } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';
import { test } from 'node:test';
import type { McpServerStatus } from '../src/mcp.js';
import type { TerminalCallbacks, TerminalPromptRequest, TerminalSurface } from '../src/terminal.js';
import type { ModelProvider } from '../src/provider.js';

process.env.FORCE_COLOR = '3';
const { mcpStatusRows, statusPanelRows } = await import('../src/status-panel.js');
const { defaultConfig } = await import('../src/agent.js');
const { interactiveLoop } = await import('../src/interactive.js');
const { Session } = await import('../src/session.js');
const { DEFAULT_GATEWAY } = await import('../src/provider.js');
const { TuiTerminal } = await import('../src/tui.js');
const status = (state: McpServerStatus['state']): McpServerStatus => ({ state, generation: 1, attempts: 0 });
const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('Unexpected model completion'); } };

test('MCP summary preserves source order, IDE exclusion, state counts and native theme colors', async () => {
  const servers = { gone: status('closed'), disabled: status('disabled'), pending: status('reconnecting'),
    healthy: { ...status('connected'), lastError: 'Retained transport warning', retryPhase: 'stopped' as const },
    offline: status('disconnected'), ide: status('connected'), other: status('connected') };
  const before = structuredClone(servers);
  assert.deepEqual(mcpStatusRows(), []);
  assert.deepEqual(mcpStatusRows({ ide: status('connected') }), []);
  assert.equal(mcpStatusRows(servers)[0]!.value, '2 connected, 1 pending, 1 disabled, 2 failed · /mcp');
  const rows = statusPanelRows({ version: '1.2.3', sessionId: 'owned', sessionKind: 'interactive', cwd: '/work',
    model: 'fixture', gatewayURL: 'http://127.0.0.1', mcpServers: servers });
  assert.deepEqual(rows.slice(-3).map(row => row.label), ['Model', 'Gateway URL', 'MCP servers']);
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_value: boolean) {} });
  const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
  const screen = new HeadlessTerminal({ cols: 120, rows: 40, allowProposedApi: true, logLevel: 'off' });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) {
    (screen as unknown as { _core: { writeSync(text: string): void } })._core.writeSync(String(chunk)); done();
  } }), { isTTY: true, columns: 120, rows: 40 });
  const terminal = new TuiTerminal({ input, output, theme: 'light-ansi', prefersReducedMotion: true });
  const lines = () => Array.from({ length: screen.rows }, (_, row) =>
    screen.buffer.active.getLine(screen.buffer.active.viewportY + row)?.translateToString(true) ?? '');
  const cell = (text: string) => {
    const row = lines().findIndex(line => line.includes(text)); assert.ok(row >= 0, lines().join('\n'));
    return screen.buffer.active.getLine(screen.buffer.active.viewportY + row)!.getCell(lines()[row]!.indexOf(text))!;
  };
  let dialog: Promise<unknown> | undefined;
  try {
    terminal.start();
    dialog = terminal.prompt({ title: 'Status', message: rows.map(row => `${row.label}: ${row.value}`).join('\n'),
      statusRows: rows, readOnly: true }, new AbortController().signal);
    assert.match(lines().join('\n'), /MCP servers: 2 connected, 1 pending, 1 disabled, 2 failed · \/mcp/);
    assert.equal(cell('2 connected').getFgColor(), 2);
    assert.equal(cell('2 failed').getFgColor(), 1);
    terminal.setTheme('dark');
    assert.equal(cell('2 connected').isFgRGB(), true);
    assert.notEqual(cell('2 connected').getFgColor(), 2);
    assert.doesNotMatch(lines().join('\n'), /\[38;2;/);
    assert.deepEqual(servers, before);
  } finally { terminal.close(); await dialog; screen.dispose(); }
});

test('/status reads the current accepted MCP snapshot once per opening and keeps its journal passive', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'status-mcp-command-')));
  const session = Session.open(workspace, { config: { ...defaultConfig(workspace, []), model: 'fixture' } });
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  let callbacks: TerminalCallbacks | undefined, reads = 0;
  let current: Record<string, McpServerStatus> = { alpha: status('connected'), ide: status('connected') };
  const prompts: TerminalPromptRequest[] = [];
  let shown = () => {};
  const nextPrompt = () => new Promise<void>(resolve => { shown = resolve; });
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: output,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks!.onSubmit!('/status')); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt(request) { prompts.push(request); shown(); return undefined; },
  };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [],
    mcpServers: () => { reads++; return structuredClone(current); } };
  const before = structuredClone(session.events), first = nextPrompt();
  const loop = interactiveLoop(session, provider, runtime,
    { input: new PassThrough(), output, status: output, signal: new AbortController().signal, terminal });
  try {
    await first;
    assert.match(prompts[0]!.message, /MCP servers: 1 connected · \/mcp$/);
    assert.deepEqual(prompts[0]!.statusRows?.at(-1)?.spans, [
      { text: '1 connected', color: 'success' }, { text: ' · /mcp', color: 'inactive' }]);
    current = { alpha: status('disabled'), beta: status('disconnected') };
    const second = nextPrompt(); setImmediate(() => callbacks!.onSubmit!('/status')); await second;
    assert.match(stripVTControlCharacters(prompts[1]!.message!), /MCP servers: 1 disabled, 1 failed · \/mcp$/);
    current = {};
    const third = nextPrompt(); setImmediate(() => callbacks!.onSubmit!('/status')); await third;
    assert.doesNotMatch(prompts[2]!.message!, /MCP servers:/);
    assert.equal(reads, 3);
    assert.deepEqual(session.events, before);
    assert.ok(prompts.every(request => request.title === 'Status' && request.readOnly === true));
  } finally {
    callbacks?.onExit?.(); await loop; session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('piped /status retains its JSON contract without querying MCP snapshots', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'status-mcp-headless-')));
  const session = Session.open(workspace, { config: { ...defaultConfig(workspace, []), model: 'fixture',
    gateway: { ...DEFAULT_GATEWAY, baseURL: 'http://127.0.0.1:9999', tokenCounting: 'estimate' } } });
  const input = new PassThrough(); let printed = '', reads = 0;
  const output = new Writable({ write(chunk, _encoding, done) { printed += String(chunk); done(); } });
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [],
    mcpServers: () => { reads++; return { alpha: status('connected') }; } };
  try {
    const loop = interactiveLoop(session, provider, runtime,
      { input, output, status: new Writable({ write(_chunk, _encoding, done) { done(); } }), signal: new AbortController().signal });
    input.end('/status\n/exit\n'); await loop;
    assert.deepEqual(JSON.parse(printed), { session: session.id, model: 'fixture', theme: 'dark',
      gateway: 'http://127.0.0.1:9999', unfinished: false,
      contextTokens: 1000000, compactAt: 512000, skills: 0, counting: 'estimate', cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0, modelCalls: 0, inputTokens: 0, outputTokens: 0 });
    assert.equal(reads, 0);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
