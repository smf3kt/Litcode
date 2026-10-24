import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getEventListeners } from 'node:events';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import type Anthropic from '@anthropic-ai/sdk';
import type { Terminal } from '@xterm/headless';
import { defaultConfig } from '../src/agent.js';
import { agentPlanContent, agentTaskFrame, type AgentTaskDetail } from '../src/agent-details.js';
import { agentProgressSnapshot, createAgentProgress, observeAgentResponse, observeAgentStream } from '../src/agent-progress.js';
import type { ModelProvider } from '../src/provider.js';
import { createRuntime } from '../src/runtime.js';
import { Session } from '../src/session.js';
import type { BackgroundTaskDetail } from '../src/task-details.js';
import type { ToolContext, ToolDefinition } from '../src/tools.js';
import { TuiTerminal } from '../src/tui.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'agent-detail-test-')));
const message = (id: string, content: Anthropic.ContentBlock[], input = 10, output = 5): Anthropic.Message => ({
  id, model: 'fixture', type: 'message', role: 'assistant', content,
  stop_reason: content.some(block => block.type === 'tool_use') ? 'tool_use' : 'end_turn', stop_sequence: null,
  usage: { input_tokens: input, output_tokens: output, cache_creation_input_tokens: 2, cache_read_input_tokens: 3 },
} as Anthropic.Message);
const text = (value: string): Anthropic.ContentBlock => ({ type: 'text', text: value, citations: null });
const tool = (id: string, name = 'read_file'): Anthropic.ContentBlock => ({ type: 'tool_use', id, name, input: { path: 'fixture.txt' }, caller: { type: 'direct' } });
const selected = (tools: ToolDefinition[], name: string): ToolDefinition => {
  const result = tools.find(item => item.schema.name === name); assert.ok(result, name); return result;
};

function detail(): AgentTaskDetail {
  return { kind: 'agent', id: 'child', name: 'reader', status: 'running', mode: 'explore', model: 'fixture/child',
    effort: 'high', agentType: '  local\nreader  ', prompt: 'original prompt', error: null, startedAt: Date.now() - 1000,
    progress: { tokenCount: 1234, toolUseCount: 1, recentActivities: [{ toolName: 'read_file', input: {}, toolUseId: 'r', recordedAtMs: 0 }] } };
}

test('agent details preserve recovered usage arithmetic, recent activities, prompt and plan rendering', () => {
  const tracker = createAgentProgress();
  observeAgentResponse(tracker, message('first', [tool('read')]));
  assert.deepEqual(agentProgressSnapshot(tracker), { tokenCount: 20, toolUseCount: 1,
    recentActivities: [{ toolName: 'read_file', input: { path: 'fixture.txt' }, toolUseId: 'read', recordedAtMs: tracker.recentActivities[0]!.recordedAtMs }] });
  observeAgentStream(tracker, { type: 'response_start' }); observeAgentStream(tracker, { type: 'tokens', estimatedTokensDelta: 8 });
  assert.equal(agentProgressSnapshot(tracker).tokenCount, 28);
  for (let index = 0; index < 7; index++) observeAgentResponse(tracker, message(`tool-${index}`, [tool(`id-${index}`, `tool-${index}`)]));
  observeAgentResponse(tracker, message('special', [tool('special', 'StructuredOutput'), tool('repl', 'REPL'), tool('id-6')]));
  assert.equal(tracker.toolUseCount, 11);
  assert.deepEqual(tracker.recentActivities.map(activity => activity.toolName), ['tool-2', 'tool-3', 'tool-4', 'tool-5', 'tool-6']);
  assert.equal(agentProgressSnapshot(tracker).tokenCount, 68);
  observeAgentStream(tracker, { type: 'response_start' });
  observeAgentStream(tracker, { type: 'tokens', estimatedTokensDelta: 3 });
  observeAgentResponse(tracker, message('next-response', []));
  assert.equal(agentProgressSnapshot(tracker).tokenCount, 68);
  const copy = agentProgressSnapshot(tracker); copy.recentActivities[0]!.toolName = 'changed';
  const copiedInput = copy.recentActivities[0]!.input;
  assert.ok(copiedInput && typeof copiedInput === 'object' && 'path' in copiedInput);
  copiedInput.path = 'changed';
  assert.equal(tracker.recentActivities[0]!.toolName, 'tool-2');
  assert.deepEqual(tracker.recentActivities[0]!.input, { path: 'fixture.txt' });
  assert.equal(agentPlanContent('<PLAN scope="local">steps</PLAN>', 'plan'), 'steps');
  assert.equal(agentPlanContent('<plan></plan><plan>valid</plan>', 'plan'), 'valid');
  assert.equal(agentPlanContent('plain prompt', 'plan'), null);
  const value = detail();
  const frame = agentTaskFrame(value, 100);
  assert.equal(frame.title, 'local reader › reader');
  assert.match(frame.lines[0]!, /1\.2k tokens · 1 tool · fixture\/child \(high\)/);
  assert.ok(frame.lines.includes('› read_file')); assert.ok(frame.lines.includes('original prompt'));
  const clipped = agentTaskFrame({ ...value, prompt: 'p'.repeat(301) }, 400);
  assert.equal(clipped.lines.at(-1), 'p'.repeat(297) + '…');
  const plan = agentTaskFrame({ ...value, prompt: '<plan>keep plan body</plan>' }, 80);
  assert.ok(plan.lines.includes('Plan to implement')); assert.ok(plan.lines.includes('keep plan body')); assert.equal(plan.lines.includes('Prompt'), false);
  const failed = agentTaskFrame({ ...value, status: 'failed', endedAt: value.startedAt + 2000, error: '\x1b[2Jfailed\x07' }, 80);
  assert.match(failed.lines[0]!, /^Failed · 2s/); assert.ok(failed.lines.includes('Error')); assert.equal(failed.lines.at(-1), 'failed');
  assert.equal(failed.lines.includes('Progress'), false);
});

test('owned child details retain original prompt and progress across fork seeds, completion, mailbox resume and cleanup', async () => {
  const workspace = temporary(), controller = new AbortController();
  const config = { ...defaultConfig(workspace, []), model: 'fixture', features: { tasks: false, subagents: true, agentMessaging: true, agentTypes: true } };
  const context: ToolContext = { workspace, signal: controller.signal, allowShell: false, maxOutputBytes: 24000 };
  let calls = 0, release: (() => void) | undefined, stream: ((text: string) => void) | undefined;
  const provider: ModelProvider = { count: async () => 0, complete: async (_request, signal, onText) => {
    const id = ++calls; stream = onText;
    await new Promise<void>((resolve, reject) => {
      release = resolve; signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
    return message(`response-${id}`, [text('complete')], id * 100, 10);
  } };
  const runtime = await createRuntime(config, provider, controller.signal);
  const until = async (check: () => boolean) => { const end = Date.now() + 5000;
    while (!check()) { assert.ok(Date.now() < end, 'child lifecycle settled'); await delay(10); } };
  try {
    const listeners = getEventListeners(controller.signal, 'abort').length;
    assert.equal(runtime.backgroundTaskDetail!('absent', 'absent'), undefined);
    assert.equal(getEventListeners(controller.signal, 'abort').length, listeners); assert.deepEqual(fs.readdirSync(workspace), []);
    const tools = runtime.buildTools(config, 'owner');
    const first = JSON.parse(await selected(tools, 'agent').execute({ prompt: 'ORIGINAL', background: true, subagent_type: 'fork', name: 'child' },
      { ...context, conversation: [{ role: 'user', content: 'SEED_MESSAGE' }, { role: 'assistant', content: 'SEED_REPLY' }] })) as { id: string };
    await until(() => release !== undefined); stream?.('abcdefgh');
    let value = runtime.backgroundTaskDetail!('owner', first.id)!; assert.equal(value.kind, 'agent');
    assert.equal(value.prompt, 'ORIGINAL'); assert.equal(value.progress.tokenCount, 2);
    assert.equal(runtime.backgroundTaskDetail!('foreign', first.id), undefined);
    const startedAt = value.startedAt;
    release!();
    await selected(tools, 'get_agent').execute({ id: first.id, wait_ms: 5000 }, context);
    value = runtime.backgroundTaskDetail!('owner', first.id)!; assert.equal(value.kind, 'agent');
    assert.equal(value.status, 'completed'); assert.equal(value.progress.tokenCount, 115); assert.ok(value.endedAt! >= startedAt);
    const events = runtime.drainEvents!('owner');
    assert.equal(events.filter(event => event.kind === 'notification' && event.prompt.startsWith('Child agent events')).length, 1);
    assert.deepEqual(runtime.drainEvents!('owner'), []);
    const before = calls; release = undefined;
    await selected(tools, 'send_message').execute({ id: first.id, message: 'FOLLOWUP' }, context);
    await until(() => release !== undefined && calls > before);
    value = runtime.backgroundTaskDetail!('owner', first.id)!; assert.equal(value.kind, 'agent');
    assert.equal(value.prompt, 'ORIGINAL'); assert.equal(value.startedAt, startedAt); assert.equal(value.endedAt, undefined);
    release!(); await selected(tools, 'get_agent').execute({ id: first.id, wait_ms: 5000 }, context);
    value = runtime.backgroundTaskDetail!('owner', first.id)!; assert.equal(value.kind, 'agent');
    assert.equal(value.progress.tokenCount, 225); assert.equal(value.status, 'completed');
    const stored = Session.open(workspace, { id: first.id });
    try { assert.ok(stored.messages.some(entry => entry.content === 'SEED_MESSAGE')); assert.ok(stored.messages.some(entry => entry.content === 'ORIGINAL')); }
    finally { stored.close(); }
    await runtime.releaseSession!('owner'); assert.equal(runtime.backgroundTaskDetail!('owner', first.id), undefined);
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
    assert.equal(getEventListeners(controller.signal, 'abort').length, listeners);
  } finally { release?.(); await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('agent modal polls data under reduced motion and releases keys, refresh and input ownership', async context => {
  context.mock.timers.enable({ apis: ['setInterval'] });
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode() {} });
  const screen = new HeadlessTerminal({ cols: 120, rows: 40, allowProposedApi: true, logLevel: 'off' });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) {
    const core = Reflect.get(screen, '_core'); Reflect.apply(Reflect.get(core, 'writeSync'), core, [String(chunk)]); done();
  } }), { isTTY: true, columns: 120, rows: 40 });
  const userDir = temporary();
  const tui = new TuiTerminal({ input, output, prefersReducedMotion: true, userDir }).start();
  const frame = () => Array.from({ length: 40 }, (_, row) => screen.buffer.active.getLine(row)?.translateToString(true) ?? '').join('\n');
  const key = (text: string) => input.emit('data', text);
  let value: BackgroundTaskDetail | undefined = detail(), polls = 0;
  const request = { title: 'Agent detail', message: '', readOnly: true, titleOrigin: 'live-picker' as const,
    backgroundTasks: () => ({ jobs: [], agents: [{ id: 'child', status: 'running' }], crons: [] }),
    backgroundTaskDetail: () => { polls++; return value; } };
  try {
    key('retained draft');
    let pending = tui.prompt(request, new AbortController().signal);
    assert.match(frame(), /original prompt/);
    if (value.kind === 'agent') value.progress.tokenCount = 2345;
    context.mock.timers.tick(1000); assert.match(frame(), /2\.3k tokens/);
    key('\x1b[D'); assert.deepEqual(await pending, { selected: [], key: 'back' });
    let stopped = polls; context.mock.timers.tick(3000); assert.equal(polls, stopped); assert.equal(tui.state.text, 'retained draft');
    pending = tui.prompt(request, new AbortController().signal); key('x'); assert.deepEqual(await pending, { selected: [], key: 'x' });
    stopped = polls; context.mock.timers.tick(3000); assert.equal(polls, stopped);
    const abort = new AbortController(); pending = tui.prompt(request, abort.signal); abort.abort(); assert.equal(await pending, undefined);
    stopped = polls; context.mock.timers.tick(3000); assert.equal(polls, stopped);
    pending = tui.prompt(request, new AbortController().signal); value = undefined; context.mock.timers.tick(1000);
    assert.deepEqual(await pending, { selected: [], key: 'gone' });
    stopped = polls; context.mock.timers.tick(3000); assert.equal(polls, stopped);
    value = detail(); pending = tui.prompt(request, new AbortController().signal); tui.close(); assert.equal(await pending, undefined);
    stopped = polls; context.mock.timers.tick(3000); assert.equal(polls, stopped);
  } finally { tui.close(); screen.dispose(); context.mock.timers.reset(); fs.rmSync(userDir, { recursive: true, force: true }); }
});
