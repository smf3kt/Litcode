import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import type Anthropic from '@anthropic-ai/sdk';
import { createRequire } from 'node:module';
import type { Terminal } from '@xterm/headless';
import { defaultConfig } from '../src/agent.js';
import { AgentRegistry } from '../src/agent-registry.js';
import { agentTranscriptEntries, agentViewCommandGate, type AgentTranscript, type AgentViewHost } from '../src/agent-transcript.js';
import { createRuntime } from '../src/runtime.js';
import type { ModelProvider } from '../src/provider.js';
import { Session } from '../src/session.js';
import { createTools } from '../src/tools.js';
import { TuiTerminal } from '../src/tui.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'agent-view-test-')));
const response = (value: string): Anthropic.Message => ({ id: value, model: 'fixture', type: 'message', role: 'assistant',
  content: [{ type: 'text', text: value, citations: null }], stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message);
const until = async (check: () => boolean) => { const end = Date.now() + 5000;
  while (!check()) { assert.ok(Date.now() < end, 'owned lifecycle settles'); await delay(10); } };
const snapshot = (text = 'CHILD_VISIBLE'): AgentTranscript => ({ id: 'child', name: 'reader', model: 'fixture', status: 'running',
  records: [{ kind: 'message', message: { role: 'user', content: 'CHILD_PROMPT' } },
    { kind: 'message', message: { role: 'assistant', content: text } }], inProgressToolUseIDs: [] });

test('child transcript preserves human echoes, origin, completion and bounded retention without consuming events', async () => {
  const workspace = temporary(), tools = createTools(), config = { ...defaultConfig(workspace, tools), model: 'fixture' };
  let release: (() => void) | undefined, calls = 0, failNext = false, holdNext = true;
  const provider: ModelProvider = { count: async () => 0, complete: async (_request, signal) => {
    calls++;
    if (failNext) { failNext = false; throw new Error('OWNED_FAILURE'); }
    if (holdNext) {
      holdNext = false;
      await new Promise<void>((resolve, reject) => {
        release = resolve; signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }
    return response(`ANSWER_${calls}`);
  } };
  const registry = new AgentRegistry({ source: config, provider, tools, limits: { maxHistory: 1, maxConcurrency: 1 } });
  const abort = new AbortController();
  const runtime = await createRuntime({ ...config, features: { tasks: false, subagents: true, agentMessaging: true } }, provider, abort.signal);
  try {
    assert.equal(runtime.agentTranscript!('absent', 'absent'), undefined);
    assert.equal(runtime.retainAgentView!('absent', 'absent'), undefined);
    await assert.rejects(runtime.submitAgentInput!('absent', 'absent', 'no owner'), /owner/);
    assert.deepEqual(fs.readdirSync(workspace), []);
    const child = await registry.launch({ prompt: 'ORIGINAL', background: true });
    await until(() => release !== undefined);
    const retained = registry.retainView(child.id)!;
    await registry.sendMessage(child.id, 'HUMAN_ONE', undefined, { human: true });
    await registry.sendMessage(child.id, 'HUMAN_TWO', undefined, { human: true });
    let view = registry.transcript(child.id)!;
    assert.deepEqual(agentTranscriptEntries(view).filter(row => row.kind === 'user').map(row => row.text), ['ORIGINAL', 'HUMAN_ONE', 'HUMAN_TWO']);
    const before = await registry.poll();
    for (let index = 0; index < 20; index++) registry.transcript(child.id);
    assert.equal((await registry.poll()).revision, before.revision);
    view.records.length = 0; assert.ok(registry.transcript(child.id)!.records.length >= 3);
    release!(); await registry.get(child.id, { waitMs: 5000 });
    view = registry.transcript(child.id)!;
    assert.equal(view.status, 'completed'); assert.equal(view.records.some(row => row.kind === 'pending_input'), false);
    assert.deepEqual(agentTranscriptEntries(view).filter(row => row.kind === 'user').map(row => row.text), ['ORIGINAL', 'HUMAN_ONE', 'HUMAN_TWO']);
    const stored = Session.open(workspace, { id: child.id });
    try { assert.deepEqual(stored.events.flatMap(event => event.kind === 'message' && event.message.role === 'user'
      ? [event.classifier?.origin.kind] : []), ['peer', 'human', 'human']); } finally { stored.close(); }
    assert.ok(registry.drainNotifications().events.length > 0); assert.deepEqual(registry.drainNotifications().events, []);
    await registry.sendMessage(child.id, 'PEER_FOLLOWUP'); await registry.get(child.id, { waitMs: 5000 });
    assert.equal(agentTranscriptEntries(registry.transcript(child.id)!).filter(row => row.text === 'PEER_FOLLOWUP').length, 1);
    await registry.stop(child.id);
    await assert.rejects(registry.sendMessage(child.id, 'PEER_AFTER_STOP'), /cancelled/);
    for (const [message, error] of [['', /empty/], ['x'.repeat(32 * 1024 + 1), /byte limit/]] as const) {
      await assert.rejects(registry.sendMessage(child.id, message, undefined, { human: true }), error);
      await assert.rejects(registry.sendMessage(child.id, 'PEER_AFTER_INVALID_HUMAN'), /cancelled/);
    }
    holdNext = true; release = undefined;
    const held = await registry.launch({ prompt: 'HOLD_CAPACITY', background: true });
    await until(() => release !== undefined);
    await assert.rejects(registry.sendMessage(child.id, 'HUMAN_WITHOUT_CAPACITY', undefined, { human: true }), /concurrency/);
    await assert.rejects(registry.sendMessage(child.id, 'PEER_AFTER_CAPACITY_FAILURE'), /cancelled/);
    await registry.stop(held.id);
    await registry.sendMessage(child.id, 'HUMAN_AFTER_STOP', undefined, { human: true });
    assert.equal((await registry.get(child.id, { waitMs: 5000 })).status, 'completed');
    assert.equal(agentTranscriptEntries(registry.transcript(child.id)!).filter(row => row.text === 'HUMAN_AFTER_STOP').length, 1);
    failNext = true;
    await registry.sendMessage(child.id, 'HUMAN_FAIL_ONCE', undefined, { human: true });
    assert.equal((await registry.get(child.id, { waitMs: 5000 })).status, 'failed');
    await assert.rejects(registry.sendMessage(child.id, 'PEER_AFTER_FAILURE'), /failed/);
    await assert.rejects(registry.sendMessage(child.id, '', undefined, { human: true }), /empty/);
    assert.equal((await registry.get(child.id)).error, 'OWNED_FAILURE');
    await registry.sendMessage(child.id, 'HUMAN_AFTER_FAILURE', undefined, { human: true });
    assert.equal((await registry.get(child.id, { waitMs: 5000 })).status, 'completed');
    assert.equal((await registry.get(child.id)).error, null);
    assert.equal(agentTranscriptEntries(registry.transcript(child.id)!).filter(row => row.text === 'HUMAN_AFTER_FAILURE').length, 1);
    await registry.launch({ prompt: 'SECOND' }); await registry.launch({ prompt: 'THIRD' });
    assert.ok(registry.transcript(child.id)); retained(); await until(() => registry.transcript(child.id) === undefined); retained();
    await registry.close(); assert.equal(registry.transcript(child.id), undefined);
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(file => file.endsWith('.lock')), false);
  } finally { release?.(); await registry.close(); await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('agent projection keeps tool pairing and local-command gates with exact human text', () => {
  const value = snapshot();
  value.records.push({ kind: 'message', isMeta: true, message: { role: 'user', content: 'HIDDEN_META' } },
    { kind: 'message', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'read', name: 'read_file', input: { path: 'fixture' } }] } },
    { kind: 'tool_start', id: 'read', name: 'read_file' },
    { kind: 'tool_result', result: { type: 'tool_result', tool_use_id: 'read', content: 'first\nsecond\n' } },
    { kind: 'message', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'read', content: 'first\nsecond\n' }] } },
    { kind: 'message', message: { role: 'user', content: 'raw plus Hook context' }, classifier: { origin: { kind: 'human' }, humanText: 'EXACT\tHUMAN\nTEXT' } });
  const entries = agentTranscriptEntries(value);
  assert.equal(entries.some(row => row.text === 'HIDDEN_META'), false);
  assert.equal(entries.filter(row => row.tool?.id === 'read').length, 1);
  assert.equal(entries.find(row => row.tool)?.tool?.content, 'first\nsecond\n');
  assert.equal(entries.at(-1)?.text, 'EXACT\tHUMAN\nTEXT');
  assert.deepEqual(agentViewCommandGate('model', 'model'), { kind: 'block', message: "/model changes the main conversation's model, not this agent's" });
  assert.equal(agentViewCommandGate('fast', 'fast')?.kind, 'block');
  for (const command of ['compact', 'clear', 'rewind']) assert.equal(agentViewCommandGate(command, command)?.kind, 'confirm');
  assert.equal(agentViewCommandGate('help', 'help'), undefined);
});

test('native agent view isolates main producers, draft, modal input, stale submissions and view cleanup', async () => {
  const userDir = temporary();
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode() {} });
  const screen = new HeadlessTerminal({ cols: 120, rows: 40, allowProposedApi: true, logLevel: 'off' });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) {
    const core = Reflect.get(screen, '_core'); Reflect.apply(Reflect.get(core, 'writeSync'), core, [String(chunk)]); done();
  } }), { isTTY: true, columns: 120, rows: 40 });
  const tui = new TuiTerminal({ input, output, userDir, prefersReducedMotion: true }).start();
  const frame = () => Array.from({ length: 40 }, (_, row) => screen.buffer.active.getLine(row)?.translateToString(true) ?? '').join('\n');
  const key = (value: string) => input.emit('data', value);
  let value: AgentTranscript | undefined = snapshot(), releases = 0, escapes = 0;
  let finish: ((value: 'child' | 'main' | false) => void) | undefined, isCurrent: (() => boolean) | undefined;
  const host: AgentViewHost = { read: () => value, release: () => { releases++; }, escape: () => { escapes++; },
    submit: async (_text, current) => { isCurrent = current; return new Promise(resolve => { finish = resolve; }); } };
  try {
    tui.append({ kind: 'assistant', text: 'MAIN_ORIGINAL' }); key('retained draft'); tui.viewAgent(host);
    assert.match(frame(), /CHILD_VISIBLE/); assert.doesNotMatch(frame(), /MAIN_ORIGINAL/); assert.equal(tui.state.text, 'retained draft');
    key('\x1b[1;2F');
    const selection = structuredClone(Reflect.get(tui, 'selectionState'));
    assert.ok(selection.anchor);
    tui.beginAssistantMessage(); tui.writeAssistantText('MAIN_STREAM_HIDDEN'); tui.endAssistantMessage();
    assert.deepEqual(Reflect.get(tui, 'selectionState'), selection);
    assert.doesNotMatch(frame(), /MAIN_STREAM_HIDDEN/);
    tui.scheduledFire({ kind: 'scheduled_task_fire', uuid: '00000000-0000-4000-8000-000000000001', taskId: 'owned',
      timestamp: '2026-10-24T00:00:00.000Z', content: 'MAIN_SCHEDULE_HIDDEN' });
    assert.deepEqual(Reflect.get(tui, 'selectionState'), selection);
    assert.doesNotMatch(frame(), /MAIN_SCHEDULE_HIDDEN/);
    value = snapshot('CHILD_UPDATED'); tui.backgroundWorkChanged(); assert.match(frame(), /CHILD_UPDATED/);
    key('\x15HUMAN_PENDING\r'); assert.equal(isCurrent?.(), true); key('x'); assert.equal(isCurrent?.(), false);
    finish!('child'); await delay(0); assert.equal(tui.state.text, 'HUMAN_PENDINGx');
    key('\x15HUMAN_ACCEPTED\r'); finish!('child'); await delay(0); assert.equal(tui.state.text, '');
    const pending = tui.prompt({ title: 'FORM_OWNS_INPUT', message: '', allowText: true }, new AbortController().signal);
    key('answer\r'); assert.equal((await pending)?.text, 'answer'); assert.equal(escapes, 0);
    key('\x0f'); assert.equal(tui.currentScreen, 'transcript'); assert.match(frame(), /CHILD_UPDATED/); key('q');
    assert.equal(tui.currentScreen, 'chat'); assert.match(frame(), /Viewing agent/);
    tui.setEditorMode('vim'); key('vim draft'); key('\x1b'); await delay(70); assert.equal(escapes, 0);
    assert.equal(tui.state.text, 'vim draft');
    key('\x1b'); await delay(70); assert.equal(escapes, 1); tui.setEditorMode('normal');
    tui.clearAgentView(); assert.equal(releases, 1); assert.match(frame(), /MAIN_ORIGINAL/); assert.match(frame(), /MAIN_STREAM_HIDDEN/);
    assert.equal(tui.transcriptState.entries.some(row => row.text.includes('HUMAN_ACCEPTED')), false);
    tui.viewAgent(host); value = undefined; tui.backgroundWorkChanged(); assert.equal(releases, 2);
    value = snapshot(); tui.viewAgent(host); tui.close(); assert.equal(releases, 3);
    tui.backgroundWorkChanged(); assert.equal(releases, 3);
  } finally { tui.close(); screen.dispose(); fs.rmSync(userDir, { recursive: true, force: true }); }
});
