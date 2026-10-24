import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { Terminal } from '@xterm/headless';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultConfig } from '../src/agent.js';
import { createProviderSlot } from '../src/login.js';
import { DEFAULT_GATEWAY, GatewayProvider, type ModelProvider, type ModelRetry } from '../src/provider.js';
import { Session } from '../src/session.js';
import { SideQuestionProgress, sideQuestionWaitingText } from '../src/side-question-progress.js';
import { UsageBudget, withUsageBudget } from '../src/structured-output.js';
import { TuiTerminal } from '../src/tui.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'btw-progress-test-')));
const until = async (check: () => boolean) => { const end = Date.now() + 5000;
  while (!check()) { assert.ok(Date.now() < end, 'owned progress settles'); await delay(10); } };
const reply = (text: string): Anthropic.Message => ({ id: 'side', type: 'message', role: 'assistant', model: 'fixture',
  content: [{ type: 'text', text, citations: null }], stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 5, output_tokens: 3, cache_creation: null, cache_creation_input_tokens: null,
    cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null },
  container: null, diagnostics: null, stop_details: null });
function responseStream() {
  const events = [
    { type: 'message_start', message: { ...reply(''), content: [] } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'SIDE_DONE' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 3 } },
    { type: 'message_stop' },
  ];
  return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''),
    { headers: { 'content-type': 'text/event-stream' } });
}

test('request-local retry progress survives provider slots and budgets without changing retry admission or tool-free journal ownership', async () => {
  const workspace = temporary(), config = { ...defaultConfig(workspace, []), model: 'fixture' };
  const session = Session.open(workspace, { config }), before = fs.readFileSync(session.file, 'utf8');
  const attempts: number[] = [], seen: (ModelRetry | null)[] = [], input: string[] = [];
  const gateway = new GatewayProvider('owned-fixture', { ...DEFAULT_GATEWAY, baseURL: 'http://owned.test' }, async (_url, init) => {
    const count = Number(new Headers(init?.headers).get('x-stainless-retry-count')); attempts.push(count);
    const body = JSON.parse(String(init?.body)); assert.deepEqual(body.tools, []); assert.deepEqual(body.tool_choice, { type: 'none' });
    if (count === 0) return Response.json({ error: { type: 'rate_limit_error', message: 'owned' } },
      { status: 429, headers: { 'retry-after-ms': '15' } });
    return responseStream();
  });
  const slot = createProviderSlot(() => 'missing'); slot.adopt(gateway);
  const budget = new UsageBudget(), provider = withUsageBudget(slot.provider, budget);
  try {
    const result = await new Agent(session, provider, []).askSideQuestion('OWNED_QUESTION', [], new AbortController().signal,
      event => seen.push(event));
    assert.deepEqual(result, { response: 'SIDE_DONE', synthetic: false });
    assert.deepEqual(attempts, [0, 1]);
    assert.deepEqual(seen, [null, { retryAttempt: 1, maxRetries: 2, status: 429, retryInMs: 15 }, null]);
    assert.equal(budget.snapshot().model_calls, 1); assert.equal(fs.readFileSync(session.file, 'utf8'), before);
    const delegated: ModelProvider = { count: async () => 0, complete: async (_request, _signal, text, thinking, retry) => {
      text?.('text'); thinking?.(); retry?.({ retryAttempt: 1, maxRetries: 2 }); return reply('done');
    } };
    slot.adopt(delegated);
    await provider.complete({ model: 'fixture', max_tokens: 8, messages: [] }, new AbortController().signal,
      text => input.push(text), () => input.push('thinking'), event => input.push(event === null ? 'clear' : 'retry'));
    assert.deepEqual(input, ['text', 'thinking', 'retry']);
    let refusedCalls = 0, refusedEvents = 0;
    const refused = new GatewayProvider('owned-fixture', DEFAULT_GATEWAY, async () => { refusedCalls++;
      return Response.json({ error: { type: 'rate_limit_error', message: 'owned' } },
        { status: 429, headers: { 'x-should-retry': 'false' } }); });
    await assert.rejects(refused.complete({ model: 'fixture', max_tokens: 8, messages: [] }, new AbortController().signal,
      undefined, undefined, event => { if (event) refusedEvents++; }));
    assert.equal(refusedCalls, 1); assert.equal(refusedEvents, 0);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('side progress isolates concurrent requests, preserves source countdowns and retires abort, empty and failure outcomes', async () => {
  let report: ((event: ModelRetry | null) => void) | undefined, aborted = false, publications = 0;
  const parent = new AbortController();
  const held = new SideQuestionProgress('held', parent.signal, async (signal, retry) => {
    report = retry; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true }));
  });
  const peer = new SideQuestionProgress('peer', parent.signal, async () => ({ response: 'peer answer', synthetic: false }));
  held.subscribe(() => { publications++; });
  await until(() => report !== undefined);
  report!({ status: 429, retryAttempt: 1, maxRetries: 2, retryInMs: 1500 });
  const pending = held.state; assert.equal(pending.kind, 'pending');
  if (pending.kind !== 'pending' || !pending.retry?.retryAt) throw new Error('fixture retry absent');
  assert.match(sideQuestionWaitingText('held', pending.retry, 0, pending.retry.retryAt - 1200), /Rate limited · retrying in 2s · attempt 1\/2/);
  assert.match(sideQuestionWaitingText('held', { status: 529, retryAttempt: 2, maxRetries: 2 }, 0), /API overloaded · retrying · attempt 2\/2/);
  assert.match(sideQuestionWaitingText('held', null, 1), /Answering/);
  assert.deepEqual(await peer.settled, { kind: 'answer', outcome: { response: 'peer answer', synthetic: false } });
  const before = publications; held.close(); report!(null);
  assert.deepEqual(await held.settled, { kind: 'closed' }); assert.equal(aborted, true); assert.equal(publications, before);
  const empty = new SideQuestionProgress('empty', parent.signal, async () => ({ response: null, synthetic: false }));
  assert.deepEqual(await empty.settled, { kind: 'error', message: 'No response received' });
  const failed = new SideQuestionProgress('failure', parent.signal, async () => { throw new Error('OWNED_ERROR'); });
  assert.deepEqual(await failed.settled, { kind: 'error', message: 'OWNED_ERROR' });
  const preAborted = new SideQuestionProgress('pre-aborted', AbortSignal.abort(), async () => { throw new Error('must remain uncalled'); });
  assert.deepEqual(await preAborted.settled, { kind: 'closed' });
});

test('the mounted waiting dialog renders live state, settles once and releases input and its refresh clock', async () => {
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode(_value: boolean) {} });
  const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
  const screen = new HeadlessTerminal({ cols: 100, rows: 30, allowProposedApi: true, logLevel: 'off' });
  const frame = () => Array.from({ length: screen.rows }, (_, row) =>
    screen.buffer.active.getLine(screen.buffer.active.viewportY + row)?.translateToString(true) ?? '').join('\n');
  let printed = '';
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) { printed += String(chunk);
    (screen as unknown as { _core: { writeSync(text: string): void } })._core.writeSync(String(chunk)); done(); } }),
    { isTTY: true, columns: 100, rows: 30 });
  const terminal = new TuiTerminal({ input, output, prefersReducedMotion: true }), errors: Error[] = [];
  terminal.on('inputError', error => errors.push(error)); terminal.start();
  let report: ((event: ModelRetry | null) => void) | undefined, finish: ((value: { response: string; synthetic: boolean }) => void) | undefined;
  const side = new SideQuestionProgress('live', new AbortController().signal, async (_signal, retry) => {
    report = retry; return new Promise(resolve => { finish = resolve; });
  });
  try {
    const dialog = terminal.prompt({ title: 'Btw', readOnly: true, message: '', sideQuestion: side }, new AbortController().signal);
    await until(() => frame().includes('Answering') && finish !== undefined);
    report!({ status: 429, retryAttempt: 1, maxRetries: 2, retryInMs: 1200 });
    await until(() => frame().includes('Rate limited'));
    finish!({ response: 'answer', synthetic: false });
    assert.deepEqual(await dialog, { selected: [], key: 'side-settled' });
    side.close();
    for (const close of ['\x1b', '\r', ' ']) {
      const other = new SideQuestionProgress('cancel', new AbortController().signal, async signal => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }));
      const pending = terminal.prompt({ title: 'Btw', readOnly: true, message: '', sideQuestion: other }, new AbortController().signal);
      await delay(5); input.emit('data', close); assert.equal(await pending, undefined); other.close();
      assert.deepEqual(await other.settled, { kind: 'closed' });
    }
    const next = terminal.prompt({ title: 'Next owner', readOnly: true, message: 'OWNED_REPLACEMENT' }, new AbortController().signal);
    const length = printed.length; report!({ retryAttempt: 1, maxRetries: 2 }); await delay(170);
    assert.equal(printed.length, length); input.emit('data', '\x1b'); await next; assert.deepEqual(errors, []);
  } finally { side.close(); terminal.close(); screen.dispose(); }
});
