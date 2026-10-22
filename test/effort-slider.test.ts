import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import type { Terminal } from '@xterm/headless';
import { effortSliderRequest } from '../src/effort-slider.js';
import { TuiDocumentRenderer } from '../src/tui-document-renderer.js';
import { TuiTerminal } from '../src/tui.js';
import { ge } from '../src/tui-color.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };

function screen(columns: number, rows: number) {
  const terminal = new HeadlessTerminal({ cols: columns, rows, allowProposedApi: true, logLevel: 'off' });
  const write = (value: string) => (terminal as unknown as { _core: { writeSync(text: string): void } })._core.writeSync(value);
  const lines = () => Array.from({ length: terminal.rows }, (_, row) =>
    terminal.buffer.active.getLine(terminal.buffer.active.viewportY + row)?.translateToString(true) ?? '');
  return { terminal, write, lines };
}

test('effort slider paints the source geometry, selected colors and motion frames', () => {
  const renderer = new TuiDocumentRenderer();
  const decoded = screen(80, 12);
  const colors = ge as unknown as { level: number }, previousColor = colors.level;
  colors.level = 3;
  const previousEffort = process.env.LLM_EFFORT;
  delete process.env.LLM_EFFORT;
  try {
    const request = effortSliderRequest(undefined);
    const axis = request.adjust;
    assert.equal(axis?.kind, 'slider');
    if (axis?.kind !== 'slider') throw new Error('Slider missing');
    assert.equal(axis.initial, 'high');
    const paint = (level: string, frame = 0, reducedMotion = true, columns = 80) => {
      decoded.terminal.resize(columns, 12); decoded.terminal.reset();
      const rows = renderer.renderElement(axis.render(level, frame, reducedMotion), columns, { theme: 'dark' });
      decoded.write(rows.map(row => row.ansi).join('\r\n'));
      return rows.map(row => row.text);
    };
    const high = paint('high');
    assert.equal(high[0]?.trimStart(), 'Faster                             Smarter');
    assert.equal(high[1]?.trimStart(), '─'.repeat(20) + '▲' + '─'.repeat(21));
    assert.equal(high[2]?.trimStart(), 'low     medium     high     xhigh      max');
    assert.equal(high.length, 3);
    const highColumn = high[2]!.indexOf('high');
    assert.ok(decoded.terminal.buffer.active.getLine(2)!.getCell(highColumn)!.isBold());
    assert.equal(decoded.terminal.buffer.active.getLine(2)!.getCell(highColumn)!.getFgColor(), 0xb1b9f9);
    for (const [level, position] of [['low', 1], ['medium', 10], ['high', 20], ['xhigh', 30], ['max', 40]] as const) {
      assert.equal(paint(level)[1]?.trimStart().indexOf('▲'), position);
    }
    const max = paint('max');
    assert.equal(max.slice(3).map(row => row.trim()).join(' '),
      'May use excessive tokens resulting in long response times or overthinking. Use sparingly for the hardest tasks.');
    const maxColumn = max[2]!.indexOf('max');
    const letterColor = () => decoded.terminal.buffer.active.getLine(2)!.getCell(maxColumn)!.getFgColor();
    const fixed = letterColor(); paint('max', 10); assert.equal(letterColor(), fixed);
    paint('max', 1, false); assert.notEqual(letterColor(), fixed);
    const narrow = paint('high', 0, true, 44);
    assert.equal(narrow[1]?.trimStart(), '─'.repeat(20) + '▲' + '─'.repeat(21));
    assert.equal(narrow[2]?.trimStart(), 'low     medium     high     xhigh      max');
    paint('xhigh', 0, false);
    const xColumn = decoded.lines()[2]!.indexOf('xhigh');
    assert.equal(decoded.terminal.buffer.active.getLine(2)!.getCell(xColumn)!.getFgColor(), 0xd0b4ff);
    paint('xhigh', 0, true);
    assert.notEqual(decoded.terminal.buffer.active.getLine(2)!.getCell(xColumn)!.getFgColor(), 0xd0b4ff);
    process.env.LLM_EFFORT = 'low'; assert.equal(effortSliderRequest('max').adjust?.initial, 'low');
    process.env.LLM_EFFORT = 'auto'; assert.equal(effortSliderRequest('low').adjust?.initial, 'high');
  } finally {
    if (previousEffort === undefined) delete process.env.LLM_EFFORT; else process.env.LLM_EFFORT = previousEffort;
    renderer.close(); decoded.terminal.dispose(); colors.level = previousColor;
  }
  assert.equal(renderer.liveNodes, 0);
});

test('standalone slider owns arrows and acceptance, retains the draft and releases repaint clocks', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode(raw: boolean): void };
  input.isTTY = true; input.setRawMode = () => {};
  const decoded = screen(100, 24);
  let writes = 0;
  const output = new Writable({ write(chunk, _encoding, done) { writes++; decoded.write(String(chunk)); done(); } });
  Object.assign(output, { isTTY: true, columns: 100, rows: 24 });
  const previous = process.env.LLM_EFFORT;
  delete process.env.LLM_EFFORT;
  const colors = ge as unknown as { level: number }, previousColor = colors.level;
  colors.level = 3;
  const tui = new TuiTerminal({ input, output, prefersReducedMotion: true }).start();
  const key = (value: string) => input.emit('data', value);
  const track = () => decoded.lines().find(row => /[─▲]{42}/u.test(row))?.trim();
  try {
    key('retained draft');
    let pending = tui.prompt(effortSliderRequest(undefined), new AbortController().signal);
    assert.equal(track(), '─'.repeat(20) + '▲' + '─'.repeat(21));
    assert.equal(decoded.lines().some(row => row.includes('Selected:') || row.startsWith('> ')), false);
    key('\x1b[A\x1b[B\tx');
    assert.equal(track(), '─'.repeat(20) + '▲' + '─'.repeat(21));
    key('\x1b[D'.repeat(6));
    assert.equal(track(), '─▲' + '─'.repeat(40));
    key('s'); assert.deepEqual(await pending, { selected: [], key: 's', adjusted: 'low' });
    assert.equal(tui.state.text, 'retained draft');
    pending = tui.prompt(effortSliderRequest('high'), new AbortController().signal);
    key('\x1b[C'.repeat(6));
    assert.equal(track(), '─'.repeat(40) + '▲─');
    assert.ok(decoded.lines().some(row => row.includes('May use excessive tokens')));
    key('\r'); assert.deepEqual(await pending, { selected: [], adjusted: 'max' });
    pending = tui.prompt(effortSliderRequest('high'), new AbortController().signal);
    key('\x1b[C\x1b'); assert.equal(await pending, undefined);
    assert.equal(tui.state.text, 'retained draft');
    const aborted = new AbortController();
    pending = tui.prompt(effortSliderRequest('low'), aborted.signal);
    aborted.abort(); assert.equal(await pending, undefined);
    const model = tui.prompt({ title: 'Select model', message: '', choices: [
      { label: 'One', value: 'one' }, { label: 'Two', value: 'two' },
    ], adjust: { kind: 'line', values: ['low', 'high'], initial: 'low', label: value => `Effort ${value}` },
    keys: [{ key: 's', label: 'session' }] }, new AbortController().signal);
    key('\x1b[C\x1b[Bs');
    assert.deepEqual(await model, { selected: ['two'], key: 's', adjusted: 'high' });
    tui.setPrefersReducedMotion(false);
    pending = tui.prompt(effortSliderRequest('max'), new AbortController().signal);
    const color = () => {
      const row = decoded.lines().findIndex(line => line.includes('low     medium'));
      return decoded.terminal.buffer.active.getLine(row)?.getCell(decoded.lines()[row]!.indexOf('max'))?.getFgColor();
    };
    const initialColor = color();
    const deadline = Date.now() + 3000;
    while (color() === initialColor) {
      assert.ok(Date.now() < deadline, 'active max animation changed a decoded cell');
      await delay(20);
    }
    tui.close(); assert.equal(await pending, undefined);
    const closed = writes; await delay(250); assert.equal(writes, closed);
  } finally {
    tui.close(); decoded.terminal.dispose(); colors.level = previousColor;
    if (previous === undefined) delete process.env.LLM_EFFORT; else process.env.LLM_EFFORT = previous;
  }
});

test('request effort honors concrete and auto overrides while preserving the chosen session level', async () => {
  const root = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'effort-wire-'));
  const config = defaultConfig(root, []); config.model = 'fixture'; config.effort = 'low';
  const session = Session.open(root, { config });
  const seen: ModelRequest[] = [];
  const counts: ModelRequest[] = [];
  const reply: Anthropic.Message = { id: 'fixture', model: 'fixture', role: 'assistant', type: 'message',
    container: null, diagnostics: null, stop_details: null,
    content: [{ type: 'text', text: 'done', citations: null }], stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1, cache_creation: null, cache_creation_input_tokens: null,
      cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
  const provider: ModelProvider = {
    count: async request => { counts.push(request); return 1; },
    complete: async request => { seen.push(request); return reply; },
  };
  const agent = new Agent(session, provider, []);
  const previous = process.env.LLM_EFFORT;
  try {
    for (const [environment, expected] of [['high', 'high'], ['auto', undefined], ['unset', undefined],
      ['invalid', 'low'], ['', 'low'], [undefined, 'low']] as const) {
      if (environment === undefined) delete process.env.LLM_EFFORT; else process.env.LLM_EFFORT = environment;
      await agent.run(`request ${environment ?? 'missing'}`);
      await agent.contextStatus();
      assert.equal(seen.at(-1)?.output_config?.effort, expected);
      assert.equal(counts.at(-1)?.output_config?.effort, expected);
      assert.equal(session.config.effort, 'low');
    }
  } finally {
    session.close(); fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.LLM_EFFORT; else process.env.LLM_EFFORT = previous;
  }
});

test('the ultracode row appears only with workflows, and tab flips it without closing', async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode(raw: boolean): void };
  input.isTTY = true; input.setRawMode = () => {};
  const decoded = screen(100, 24);
  const output = new Writable({ write(chunk, _encoding, done) { decoded.write(String(chunk)); done(); } });
  Object.assign(output, { isTTY: true, columns: 100, rows: 24 });
  const previous = process.env.LLM_EFFORT;
  delete process.env.LLM_EFFORT;
  const tui = new TuiTerminal({ input, output, prefersReducedMotion: true }).start();
  const key = (value: string) => input.emit('data', value);
  try {
    // Without dynamic workflows the axis keeps its old shape and declares no toggle.
    assert.equal(effortSliderRequest('high').adjust?.toggle, undefined);
    let pending = tui.prompt(effortSliderRequest('high'), new AbortController().signal);
    assert.equal(decoded.lines().some(row => row.includes('Ultracode')), false);
    key('\x1b');
    assert.equal(await pending, undefined);

    // With them, the row is drawn off, tab flips it on, and the axis answer carries it.
    pending = tui.prompt(effortSliderRequest('high', { workflowsEnabled: true }), new AbortController().signal);
    assert.ok(decoded.lines().some(row => row.includes('Ultracode') && row.includes('off')));
    key('\t');
    assert.ok(decoded.lines().some(row => row.includes('Ultracode  on')));
    assert.ok(decoded.lines().some(row => row.includes('dynamic workflows on every task')));
    key('\r');
    assert.deepEqual(await pending, { selected: [], adjusted: 'high', toggled: true });

    // An existing flag starts on, and tab turns it back off.
    pending = tui.prompt(effortSliderRequest('low', { workflowsEnabled: true, ultracode: true }),
      new AbortController().signal);
    assert.ok(decoded.lines().some(row => row.includes('Ultracode  on')));
    key('\t\r');
    assert.deepEqual(await pending, { selected: [], adjusted: 'low', toggled: false });
  } finally {
    tui.close();
    if (previous === undefined) delete process.env.LLM_EFFORT; else process.env.LLM_EFFORT = previous;
  }
});
