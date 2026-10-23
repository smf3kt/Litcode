import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import type { Terminal } from '@xterm/headless';
import type Anthropic from '@anthropic-ai/sdk';

import { assertPaired, defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import { analyzeLoopFold, scheduledFire, loopNoopCompanion } from '../src/loop-noop-fold.js';
import { classifierMessage } from '../src/message-origin.js';
import type { ModelProvider } from '../src/provider.js';
import { createRuntime, pinToolSchemas } from '../src/runtime.js';
import { Session, type SessionEvent } from '../src/session.js';
import { forkSession } from '../src/sessions.js';
import { relocateSession } from '../src/workspace-session.js';
import { TuiTerminal } from '../src/tui.js';

const stamp = new Date('2024-01-01T12:00:00.000Z');
const assistant = (noop: unknown, id = 'arm'): Exclude<SessionEvent, { kind: 'metadata' }> => ({ kind: 'message', message: { role: 'assistant',
  content: [{ type: 'tool_use', id, name: 'schedule_wakeup', input: { noop } }] } });
const result = (id = 'arm'): Exclude<SessionEvent, { kind: 'metadata' }> => ({ kind: 'message', message: { role: 'user',
  content: [{ type: 'tool_result', tool_use_id: id, content: 'armed' }] } });
const finish = { kind: 'turn_end', reason: 'end_turn' } satisfies SessionEvent;
const usage = { input_tokens: 1, output_tokens: 1, cache_creation: null, cache_creation_input_tokens: null,
  cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null };
const compactResponse: Anthropic.Message = { id: 'compact', type: 'message', role: 'assistant', content: [],
  model: 'fixture', stop_reason: 'end_turn', stop_sequence: null, container: null, diagnostics: null, stop_details: null, usage };

test('source no-op analysis keeps last-call semantics and vetoes foreign, split, failed and compact spans', () => {
  const first = scheduledFire([], 'job', true, 'UTC', stamp);
  const quiet: SessionEvent[] = [first, { kind: 'message', classifier: { origin: { kind: 'generated', source: `loop-wakeup:${first.uuid}` } },
    message: { role: 'user', content: 'tick' } }, assistant(true), result(), finish];
  assert.equal(analyzeLoopFold([]).kind, 'none');
  assert.equal(scheduledFire([], 'invalid-zone', true, 'UTC+8', stamp).content,
    scheduledFire([], 'default-zone', true, undefined, stamp).content);
  assert.match(scheduledFire([], 'tokyo-zone', true, 'Asia/Tokyo', stamp).content, /Jan 1 9:00pm/);
  assert.equal(analyzeLoopFold(quiet).kind, 'fold');
  const second = scheduledFire(quiet, 'next-job', true, 'UTC', new Date(stamp.getTime() + 60_000));
  assert.equal(second.noOpStreak, 1); assert.equal(second.streakStartedAt, first.timestamp);
  assert.deepEqual(second.foldedFireIds, [first.uuid]);
  assert.match(second.content, /1 no-op tick since Jan 1 12:00pm/);
  const third = scheduledFire([...quiet, second, assistant(true, 'two'), result('two'), finish], 'three', true, 'UTC', stamp);
  assert.equal(third.noOpStreak, 2); assert.equal(third.streakStartedAt, first.timestamp);
  for (const last of [false, undefined, 'true']) {
    assert.deepEqual(analyzeLoopFold([...quiet, assistant(last, 'last')]), { kind: 'veto', reason: 'model_reported_work' });
  }
  assert.equal(analyzeLoopFold([...quiet, assistant(false), assistant(true)]).kind, 'fold');
  const barriers: [SessionEvent, string][] = [
    [{ kind: 'loop_boundary', reason: 'foreign_user_input' }, 'foreign_user_input'],
    [{ kind: 'message', message: { role: 'user', content: 'human' } }, 'foreign_user_input'],
    [{ kind: 'message', classifier: { origin: { kind: 'peer', source: 'uds' } }, message: { role: 'user', content: 'peer' } }, 'foreign_user_input'],
    [{ kind: 'message', isMeta: true, classifier: { origin: { kind: 'peer', source: 'uds' } }, message: { role: 'user', content: 'meta peer' } }, 'foreign_user_input'],
    [result('outside'), 'split_tool_pair'],
    [{ kind: 'tool_result', result: { type: 'tool_result', tool_use_id: 'arm', content: 'denied', is_error: true } }, 'tool_denial'],
    [{ kind: 'turn_end', reason: 'aborted' }, 'tool_abort'],
    [scheduledFire([], 'cron', false, 'UTC', stamp), 'blocking_system_in_span'],
    [{ kind: 'compact', summary: 'summary', response: compactResponse }, 'blocking_system_in_span'],
  ];
  for (const [event, reason] of barriers) assert.deepEqual(analyzeLoopFold([...quiet, event]), { kind: 'veto', reason });
  assert.equal(analyzeLoopFold([...quiet, { kind: 'message', isMeta: true, message: { role: 'user', content: 'host companion' } }]).kind, 'fold');
  assert.deepEqual(analyzeLoopFold([barriers.at(-1)![0], ...quiet]), { kind: 'veto', reason: 'blocking_system_before_anchor' });
  assert.equal(analyzeLoopFold([{ kind: 'loop_boundary', reason: 'foreign_user_input' }, ...quiet]).kind, 'fold');
});

test('fold metadata resumes and copies while model history retains paired tools and generated companions', () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'loop-fold-session-')));
  const target = fs.mkdtempSync(path.join(workspace, 'target-'));
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  let session = Session.open(workspace, { config });
  try {
    const first = scheduledFire([], 'job', true, 'UTC', stamp);
    for (const event of [first, assistant(true), result(), finish]) session.append(event);
    const folded = scheduledFire(session.events, 'job2', true, 'UTC', stamp);
    session.append(folded);
    assert.equal(session.awaitingResponse, false, 'a display marker does not create an unfinished turn');
    const companion = session.messages.at(-1)!;
    assert.equal(companion.content, loopNoopCompanion(1));
    assert.deepEqual(classifierMessage(companion)?.origin, { kind: 'generated', source: 'loop-noop-companion' });
    assertPaired(session.messages);
    const id = session.id, before = fs.readFileSync(session.file, 'utf8');
    session.close(); session = Session.open(workspace, { id });
    assert.equal(fs.readFileSync(session.file, 'utf8'), before);
    assert.equal(session.messages.at(-1)!.content, loopNoopCompanion(1));
    const fork = forkSession(session);
    try { assert.deepEqual(fork.messages, session.messages); assert.ok(fork.events.some(event => event.kind === 'scheduled_task_fire')); }
    finally { fork.close(); }
    const moved = relocateSession(session, target, () => []);
    try { assert.ok(moved.messages.some(message => message.content === loopNoopCompanion(1))); assertPaired(moved.messages); }
    finally { moved.close(); }
    assert.equal(fs.readFileSync(session.file, 'utf8'), before);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('interactive dynamic chain folds decoded terminal rows and retains verbose, transcript and human boundaries', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'loop-fold-interactive-')));
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  config.features = { tasks: false, subagents: false, scheduler: true }; config.prefersReducedMotion = true;
  config.timeZone = 'UTC+8';
  config.configSources = { userDir: path.join(workspace, 'user') };
  const input = new PassThrough(); Object.assign(input, { isTTY: true, setRawMode() {} });
  const { Terminal: Headless } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
  const screen = new Headless({ cols: 120, rows: 55, allowProposedApi: true, logLevel: 'off' });
  const output = new Writable({ write(chunk, _encoding, done) {
    (screen as unknown as { _core: { writeSync(text: string): void } })._core.writeSync(String(chunk)); done();
  } }); Object.assign(output, { isTTY: true, columns: 120, rows: 55 });
  const frame = () => Array.from({ length: 55 }, (_, row) => screen.buffer.active.getLine(row)?.translateToString(true) ?? '').join('\n');
  let at = stamp.getTime(), calls = 0, ticks = 0;
  const requests: Anthropic.MessageParam[][] = [];
  const provider: ModelProvider = { count: async () => 1, complete: async (request, _signal, onText) => {
    requests.push(structuredClone(request.messages)); calls++;
    const last = request.messages.at(-1)!.content;
    const toolResult = Array.isArray(last) && last.some(block => block.type === 'tool_result');
    if (!toolResult && calls > 1) ticks++;
    if (toolResult) onText?.(`quiet-${ticks}`);
    return { id: randomUUID(), type: 'message', role: 'assistant', model: 'fixture', stop_sequence: null,
      container: null, diagnostics: null, stop_details: null, usage,
      stop_reason: toolResult ? 'end_turn' : 'tool_use', content: toolResult
        ? [{ type: 'text', text: `quiet-${ticks}`, citations: null }]
        : [{ type: 'tool_use', name: 'schedule_wakeup', id: `call-${calls}`, caller: { type: 'direct' },
          input: { delaySeconds: 60, prompt: 'quiet', noop: ticks > 0, reason: 'Await fixture' } }] };
  } };
  const controller = new AbortController();
  const runtime = await createRuntime(config, provider, controller.signal, { scheduler: { timer: null, now: () => new Date(at) } });
  config.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(workspace, { config });
  const terminal = new TuiTerminal({ input, output, prefersReducedMotion: true, userDir: config.configSources.userDir });
  const running = interactiveLoop(session, provider, runtime, { input, output, status: new Writable({ write(_chunk, _encoding, done) { done(); } }), terminal, signal: controller.signal });
  const waitFor = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) { assert.ok(Date.now() < deadline, frame()); await delay(10); }
  };
  try {
    await waitFor(() => frame().includes('ctrl+o'));
    input.emit('data', 'arm\r');
    await waitFor(() => session.events.filter(event => event.kind === 'turn_end').length === 1);
    for (let turn = 1; turn <= 3; turn++) {
      at += 60_000; runtime.checkScheduler!(session.id);
      await waitFor(() => session.events.filter(event => event.kind === 'turn_end').length === turn + 1);
    }
    await waitFor(() => frame().includes('2 no-op ticks since') && frame().includes('quiet-3'));
    assert.equal(frame().includes('quiet-1'), false);
    terminal.setVerbose(true); assert.ok(frame().includes('quiet-1'));
    terminal.setVerbose(false); assert.equal(frame().includes('quiet-1'), false);
    input.emit('data', '\u000f'); assert.ok(frame().includes('quiet-1'));
    input.emit('data', '\u000f'); assert.equal(frame().includes('quiet-1'), false);
    assert.ok(requests.some(messages => messages.some(message => message.content === loopNoopCompanion(2))));
    assertPaired(session.messages);
    input.emit('data', '/effort medium\r');
    await waitFor(() => session.events.at(-1)?.kind === 'loop_boundary' || session.events.some(event => event.kind === 'loop_boundary'));
    const marker = scheduledFire(session.events, 'after-human', true, 'UTC', stamp);
    assert.equal(marker.noOpStreak, undefined);
    assert.ok(terminal.transcriptState.entries.some(entry => entry.text.includes('quiet-1')));
    input.emit('data', '/exit\r'); await running;
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  } finally {
    controller.abort(); input.destroy(); await running; terminal.close(); session.close(); await runtime.close(); screen.dispose();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
