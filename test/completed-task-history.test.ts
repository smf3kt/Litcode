import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import type Anthropic from '@anthropic-ai/sdk';
import type { Terminal } from '@xterm/headless';
import { defaultConfig } from '../src/agent.js';
import { AgentRegistry } from '../src/agent-registry.js';
import { backgroundTaskItems, backgroundTaskRequest, tasksPanelRows, tasksPanelSubtitle,
  type BackgroundTaskSnapshot } from '../src/tasks-panel.js';
import { initialTaskDetail } from '../src/task-details.js';
import { backgroundFooterLabel } from '../src/tui-background.js';
import { TuiTerminal } from '../src/tui.js';
import { createRuntime } from '../src/runtime.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolContext } from '../src/tools.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'completed-task-test-')));
const empty: BackgroundTaskSnapshot = { jobs: [], agents: [], crons: [] };
const response = (): Anthropic.Message => ({ id: 'owned', model: 'fixture', type: 'message', role: 'assistant',
  content: [{ type: 'text', text: 'OWNED_COMPLETED', citations: null }], stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 } } as Anthropic.Message);
const until = async (check: () => boolean) => { const end = Date.now() + 5000;
  while (!check()) { assert.ok(Date.now() < end, 'owned task lifecycle settles'); await delay(10); } };

test('completed agents keep source grouping and newest-first order without counting as active work', () => {
  const value: BackgroundTaskSnapshot = { ...empty, agents: [
    { id: 'done-old', status: 'completed', startedAt: 1 },
    { id: 'live-old', status: 'running', startedAt: 2 },
    { id: 'done-new', status: 'completed', startedAt: 4 },
    { id: 'live-new', status: 'running', startedAt: 3 },
  ] };
  const items = backgroundTaskItems(value), rows = tasksPanelRows(items);
  assert.deepEqual(items.map(item => item.id), ['live-new', 'live-old', 'done-new', 'done-old']);
  assert.deepEqual(rows.map(row => row.heading), ['Local agents (2)', undefined, 'Completed (2)', undefined]);
  assert.equal(tasksPanelSubtitle(items), '2 active agents');
  assert.equal(backgroundFooterLabel(value), '2 local agents');
  assert.equal(initialTaskDetail({ ...empty, agents: [value.agents[0]!] }), undefined);
  const completed = backgroundTaskRequest({ ...empty, agents: [value.agents[0]!] });
  assert.equal(completed.choices?.[0]?.heading, 'Completed (1)');
  assert.deepEqual(completed.keys, [{ key: 'f', label: 'view agent' }]);
  assert.equal(backgroundFooterLabel({ ...empty, agents: [value.agents[0]!] }), undefined);
  assert.deepEqual(value.agents.map(item => item.id), ['done-old', 'live-old', 'done-new', 'live-new']);
  const shell = { id: 'shell', kind: 'run', state: 'running', command: 'owned', description: '' };
  const mixed = tasksPanelRows(backgroundTaskItems({ ...value, jobs: [shell, { ...shell, id: 'monitor', kind: 'monitor' }] }));
  assert.deepEqual(mixed.slice(0, 2).map(row => row.heading), ['Shells (2)', undefined]);
});

test('history projection retains only owned background completions and follows eviction, resume and release', async () => {
  const workspace = temporary(); fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'OWNED_FILE');
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    if (request.messages.at(-1)?.content === 'RUNTIME_BACKGROUND') return { ...response(), stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'owned-read', name: 'read_file', input: { path: 'fixture.txt' } }] } as Anthropic.Message;
    return response();
  } };
  const config = { ...defaultConfig(workspace, []), model: 'fixture', skills: [] };
  const registry = new AgentRegistry({ source: config, provider, tools: [], limits: { maxHistory: 1 } });
  const abort = new AbortController();
  const runtimeConfig = { ...config, features: { tasks: false, subagents: true, agentMessaging: true } };
  const runtime = await createRuntime(runtimeConfig, provider, abort.signal);
  const context: ToolContext = { workspace, signal: abort.signal, allowShell: false, maxOutputBytes: 24000 };
  try {
    await registry.launch({ prompt: 'WAITED_FOREGROUND' });
    assert.deepEqual(registry.backgroundTasks(), []);
    const first = await registry.launch({ prompt: 'BACKGROUND_ONE', background: true });
    await registry.get(first.id, { waitMs: 5000 });
    const release = registry.retainView(first.id)!;
    assert.deepEqual(registry.backgroundTasks().map(row => [row.id, row.status]), [[first.id, 'completed']]);
    const before = await registry.poll();
    for (let index = 0; index < 10; index++) registry.backgroundTasks();
    assert.equal((await registry.poll()).revision, before.revision);
    assert.ok(registry.drainNotifications().events.length > 0);
    const second = await registry.launch({ prompt: 'BACKGROUND_TWO', background: true });
    await registry.get(second.id, { waitMs: 5000 });
    assert.equal(registry.backgroundTasks().length, 2);
    release(); await until(() => registry.transcript(first.id) === undefined);
    assert.deepEqual(registry.backgroundTasks().map(row => row.id), [second.id]);
    await registry.stop(second.id); assert.deepEqual(registry.backgroundTasks(), []);
    const tools = runtime.buildTools(runtimeConfig, 'owner'), agent = tools.find(tool => tool.schema.name === 'agent');
    assert.ok(agent);
    const launched = JSON.parse(await agent.execute({ prompt: 'RUNTIME_BACKGROUND', background: true }, context)) as { id: string };
    await until(() => {
      const detail = runtime.backgroundTaskDetail!('owner', launched.id);
      return detail?.kind === 'agent' && detail.status === 'completed';
    });
    const journal = path.join(workspace, '.agent', `${launched.id}.jsonl`);
    const metadata = fs.readFileSync(journal, 'utf8').split('\n')[0];
    assert.ok(JSON.stringify(runtime.agentTranscript!('owner', launched.id)).includes('OWNED_FILE'));
    assert.deepEqual(runtime.backgroundTasks!('owner').agents.map(row => row.id), [launched.id]);
    assert.deepEqual(runtime.backgroundTasks!('foreign'), empty);
    assert.equal(runtime.backgroundWorkCount!('owner'), 0);
    assert.equal(await runtime.stopTask!('owner', launched.id), undefined);
    await runtime.submitAgentInput!('owner', launched.id, 'HUMAN_RESUME');
    await until(() => runtime.agentTranscript!('owner', launched.id)?.status === 'completed');
    assert.ok(JSON.stringify(runtime.agentTranscript!('owner', launched.id)).includes('HUMAN_RESUME'));
    assert.equal(fs.readFileSync(journal, 'utf8').split('\n')[0], metadata);
    await runtime.releaseSession!('owner'); assert.deepEqual(runtime.backgroundTasks!('owner'), empty);
    await registry.close(); assert.deepEqual(registry.backgroundTasks(), []);
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  } finally { await registry.close(); await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('Completed headings never take focus and live completion preserves the selected child id', async () => {
  const userDir = temporary(), input = Object.assign(new PassThrough(), { isTTY: true, setRawMode() {} });
  const screen = new HeadlessTerminal({ cols: 90, rows: 30, allowProposedApi: true, logLevel: 'off' });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) {
    const core = Reflect.get(screen, '_core'); Reflect.apply(Reflect.get(core, 'writeSync'), core, [String(chunk)]); done();
  } }), { isTTY: true, columns: 90, rows: 30 });
  const tui = new TuiTerminal({ input, output, prefersReducedMotion: true, userDir }).start();
  let snapshot: BackgroundTaskSnapshot = { ...empty, agents: [
    { id: 'live', name: 'LIVE', status: 'running', startedAt: 20 },
    { id: 'old', name: 'OLD_COMPLETED', status: 'completed', startedAt: 10 },
  ] };
  const frame = () => Array.from({ length: 30 }, (_, row) => screen.buffer.active.getLine(row)?.translateToString(true) ?? '').join('\n');
  try {
    input.emit('data', 'retained draft');
    const pending = tui.prompt({ ...backgroundTaskRequest(snapshot), titleOrigin: 'live-picker', backgroundTasks: () => snapshot }, new AbortController().signal);
    assert.match(frame(), /Completed \(1\)/); assert.match(frame(), /Selected: LIVE/);
    input.emit('data', '\x1b[B'); assert.match(frame(), /Selected: OLD_COMPLETED/);
    snapshot = { ...snapshot, agents: snapshot.agents.map(agent => ({ ...agent, status: 'completed' })) };
    tui.backgroundWorkChanged();
    assert.match(frame(), /Completed \(2\)/); assert.match(frame(), /Selected: OLD_COMPLETED/);
    assert.doesNotMatch(frame(), /active agents|x stop/);
    input.emit('data', '\r');
    assert.deepEqual(await pending, { selected: ['task:agent:old'], backgroundTaskIndex: 1 });
    assert.equal(tui.state.text, 'retained draft');
  } finally { tui.close(); screen.dispose(); fs.rmSync(userDir, { recursive: true, force: true }); }
});
