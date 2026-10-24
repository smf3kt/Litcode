import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { PassThrough, Writable } from 'node:stream';
import { defaultConfig } from '../src/agent.js';
import { osc52Payload } from '../src/clipboard-osc52.js';
import { interactiveLoop } from '../src/interactive.js';
import type { ModelProvider } from '../src/provider.js';
import { Session } from '../src/session.js';
import { SIDE_QUESTION_REMINDER } from '../src/side-question.js';
import type { TerminalCallbacks, TerminalPromptRequest, TerminalSurface } from '../src/terminal.js';

test('/btw answers with no tools and keeps the side answer out of the transcript', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-btw-')));
  const config = { ...defaultConfig(workspace, []), model: 'test' };
  const requests: Record<string, unknown>[] = [];
  const provider: ModelProvider = {
    count: async () => 0,
    complete: async request => {
      requests.push(request as unknown as Record<string, unknown>);
      return { id: 'msg_side', type: 'message', role: 'assistant', model: 'test',
        content: [{ type: 'text', text: 'Blue light scatters.', citations: null }], stop_reason: 'end_turn',
        stop_sequence: null, usage: { input_tokens: 5, output_tokens: 3, cache_creation: null, cache_creation_input_tokens: null, cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null },
        container: null, diagnostics: null, stop_details: null };
    },
  };
  const session = Session.open(workspace, { config });
  const watcher = (() => { let value = ''; return { stream: new Writable({
    write(chunk, _encoding, done) { value += String(chunk); done(); } }), value: () => value }; })();
  let callbacks: TerminalCallbacks | undefined;
  const prompts: TerminalPromptRequest[] = [];
  const clipboard: string[] = [];
  let answered!: () => void;
  const settled = new Promise<void>(resolve => { answered = resolve; });
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: watcher.stream,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks!.onSubmit!('/btw why is the sky blue')); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    writeClipboard(payload) { clipboard.push(payload); },
    async prompt(request) {
      if (request.sideQuestion) { await request.sideQuestion.settled; return { selected: [], key: 'side-settled' }; }
      prompts.push(request);
      if (prompts.length === 1) return { selected: [], key: 'c' };
      setImmediate(answered);
      return undefined;
    },
  };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
  const input = new PassThrough();
  try {
    const loop = interactiveLoop(session, provider, runtime,
      { input, output: watcher.stream, status: watcher.stream, signal: new AbortController().signal, terminal });
    await settled;
    assert.equal(requests.length, 1);
    const request = requests[0]!;
    assert.deepEqual(request.tools, []);
    assert.deepEqual(request.tool_choice, { type: 'none' });
    const messages = request.messages as { role: string; content: { type: string; text: string }[] }[];
    const last = messages.at(-1)!;
    assert.equal(last.role, 'user');
    assert.equal(last.content[0]!.text, SIDE_QUESTION_REMINDER);
    assert.equal(last.content[1]!.text, 'why is the sky blue');
    assert.equal(messages.length, 1, 'the side call carries the empty conversation');
    assert.equal(session.messages.length, 0, 'the side answer never joins the transcript');

    assert.equal(prompts[0]!.title, 'Btw');
    assert.equal(prompts[0]!.readOnly, true);
    assert.match(prompts[0]!.message, /^\/btw why is the sky blue\n\nBlue light scatters\.$/);
    assert.deepEqual(prompts[0]!.keys?.map(entry => entry.key), ['[', ']', 'x', 'c']);
    assert.deepEqual(clipboard, [osc52Payload('Blue light scatters.')]);
    assert.match(watcher.value(), /Copied to clipboard/);
    callbacks!.onExit!();
    await loop;
  } finally {
    session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('bare /btw asks for the question in a text dialog', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-btw-bare-')));
  const config = { ...defaultConfig(workspace, []), model: 'test' };
  const provider: ModelProvider = {
    count: async () => 0,
    complete: async () => ({ id: 'msg_side', type: 'message', role: 'assistant', model: 'test',
      content: [{ type: 'text', text: 'Because Rayleigh scattering.', citations: null }], stop_reason: 'end_turn',
      stop_sequence: null, usage: { input_tokens: 5, output_tokens: 3, cache_creation: null, cache_creation_input_tokens: null, cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null },
      container: null, diagnostics: null, stop_details: null }),
  };
  const session = Session.open(workspace, { config });
  const watcher = new Writable({ write(_chunk, _encoding, done) { done(); } });
  let callbacks: TerminalCallbacks | undefined;
  const prompts: TerminalPromptRequest[] = [];
  let answered!: () => void;
  const settled = new Promise<void>(resolve => { answered = resolve; });
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: watcher,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks!.onSubmit!('/btw')); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt(request) {
      if (request.sideQuestion) { await request.sideQuestion.settled; return { selected: [], key: 'side-settled' }; }
      prompts.push(request);
      if (prompts.length === 1) return { selected: [], text: 'why is the sky blue' };
      setImmediate(answered);
      return undefined;
    },
  };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
  const input = new PassThrough();
  try {
    const loop = interactiveLoop(session, provider, runtime,
      { input, output: watcher, status: watcher, signal: new AbortController().signal, terminal });
    await settled;
    assert.equal(prompts[0]!.title, 'Btw');
    assert.equal(prompts[0]!.allowText, true);
    assert.match(prompts[1]!.message, /^\/btw why is the sky blue\n\nBecause Rayleigh scattering\.$/);
    callbacks!.onExit!();
    await loop;
  } finally {
    session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('a second /btw threads the first side exchange into the call', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-btw-history-')));
  const config = { ...defaultConfig(workspace, []), model: 'test' };
  const messagesSeen: unknown[][] = [];
  const provider: ModelProvider = {
    count: async () => 0,
    complete: async request => {
      const call = messagesSeen.push(request.messages as unknown[]);
      return { id: `msg_side_${call}`, type: 'message', role: 'assistant', model: 'test',
        content: [{ type: 'text', text: `answer ${call}`, citations: null }], stop_reason: 'end_turn',
        stop_sequence: null, usage: { input_tokens: 5, output_tokens: 3, cache_creation: null, cache_creation_input_tokens: null, cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null },
        container: null, diagnostics: null, stop_details: null };
    },
  };
  const session = Session.open(workspace, { config });
  const watcher = new Writable({ write(_chunk, _encoding, done) { done(); } });
  let callbacks: TerminalCallbacks | undefined;
  let panels = 0;
  let firstPanel!: () => void;
  const firstShown = new Promise<void>(resolve => { firstPanel = resolve; });
  let secondPanel!: () => void;
  const secondShown = new Promise<void>(resolve => { secondPanel = resolve; });
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: watcher,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks!.onSubmit!('/btw first question')); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt(request) {
      if (request.sideQuestion) { await request.sideQuestion.settled; return { selected: [], key: 'side-settled' }; }
      panels += 1;
      if (panels === 1) { firstPanel(); return undefined; }
      secondPanel();
      return undefined;
    },
  };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [] };
  const input = new PassThrough();
  try {
    const loop = interactiveLoop(session, provider, runtime,
      { input, output: watcher, status: watcher, signal: new AbortController().signal, terminal });
    await firstShown;
    await new Promise(resolve => setTimeout(resolve, 20));
    callbacks!.onSubmit!('/btw second question');
    await secondShown;
    assert.equal(messagesSeen.length, 2);
    const messages = messagesSeen[1] as { role: string; content: { text: string }[] }[];
    assert.equal(messages.length, 3);
    assert.deepEqual(messages[0], { role: 'user', content: [{ type: 'text', text: 'first question' }] });
    assert.deepEqual(messages[1], { role: 'assistant', content: [{ type: 'text', text: 'answer 1' }] });
    assert.equal(messages[2]!.content[1]!.text, 'second question');
    callbacks!.onExit!();
    await loop;
  } finally {
    session.close(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});
