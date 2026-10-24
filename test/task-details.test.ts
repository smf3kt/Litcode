import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getEventListeners } from 'node:events';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import type { Terminal } from '@xterm/headless';
import { defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import type { McpClientRequests } from '../src/mcp-client-requests.js';
import type { ModelProvider } from '../src/provider.js';
import { createRuntime } from '../src/runtime.js';
import { Session } from '../src/session.js';
import { initialTaskDetail, taskDetailClip, taskDetailFrame, taskDetailOutput,
  type ShellTaskDetail } from '../src/task-details.js';
import type { BackgroundTaskSnapshot } from '../src/tasks-panel.js';
import type { ToolContext, ToolDefinition } from '../src/tools.js';
import { TuiTerminal } from '../src/tui.js';
import { backgroundFooterLabel } from '../src/tui-background.js';

const { Terminal: HeadlessTerminal } = createRequire(import.meta.url)('@xterm/headless') as { Terminal: typeof Terminal };
const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'task-detail-test-')));
const detail = (id: string, kind: ShellTaskDetail['kind'] = 'run'): ShellTaskDetail => ({
  id, kind, state: 'running', command: `owned ${id}`, duration_ms: 1250, exit_code: null,
  stdout: 'first output\n', stderr: '', stdout_bytes: 13, stderr_bytes: 0,
});
const empty: BackgroundTaskSnapshot = { jobs: [], agents: [], crons: [] };
const selected = (tools: ToolDefinition[], name: string): ToolDefinition => {
  const tool = tools.find(item => item.schema.name === name);
  assert.ok(tool, name); return tool;
};
const unused: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('Unexpected model call'); } };

test('task details retain source tail selection, grapheme clipping and supported auto-open kinds', () => {
  const job = detail('shell');
  job.stdout = Array.from({ length: 13 }, (_, index) => `line-${index + 1}`).join('\n') + '\n';
  job.stdout_bytes = Buffer.byteLength(job.stdout);
  assert.deepEqual(taskDetailOutput(job).lines, ['line-5', 'line-6', 'line-7', 'line-8', 'line-9', 'line-10', 'line-11', 'line-12', 'line-13']);
  job.stdout = 'a\n\nb\n';
  assert.deepEqual(taskDetailOutput(job).lines, ['a', 'b']);
  job.stdout = 'x'.repeat(20000) + '雪'.repeat(3000);
  job.stdout_bytes = Buffer.byteLength(job.stdout);
  const tail = taskDetailOutput(job);
  assert.equal(Buffer.byteLength(tail.content), 8190);
  assert.equal(tail.content, '雪'.repeat(2730));
  assert.match(taskDetailFrame(job, 40).lines.at(-1)!, /^Showing 1 lines of /);
  assert.equal(taskDetailClip('ábcd', 3), 'áb…');
  assert.equal(taskDetailClip('雪雪雪', 5), '雪雪…');
  job.stdout = '\x1b[2Jvisible\x07\n'; job.stderr = 'stderr tail';
  const frame = taskDetailFrame(job, 40);
  assert.ok(frame.lines.some(line => line.includes('visible')));
  assert.ok(frame.lines.some(line => line.includes('stderr tail')));
  assert.equal(frame.lines.some(line => /[\x1b\x07]/.test(line)), false);
  assert.equal(taskDetailFrame({ ...job, stdout: '', stderr: '' }, 40).lines.at(-1), 'No output available');
  assert.equal(taskDetailFrame({ ...job, kind: 'monitor' }, 40).title, 'Monitor details');
  const row = { id: job.id, kind: job.kind, state: job.state, command: job.command, description: '' };
  assert.equal(initialTaskDetail({ ...empty, jobs: [row] }), 'shell');
  assert.equal(initialTaskDetail({ ...empty, jobs: [{ ...row, source: 'websocket' }] }), undefined);
  assert.equal(initialTaskDetail({ ...empty, agents: [{ id: 'agent', status: 'running' }] }), 'agent');
  assert.equal(initialTaskDetail({ ...empty, jobs: [row], crons: [{ id: 'cron', cron: '* * * * *', prompt: 'tick', recurring: true }] }), undefined);
});

test('runtime details read only the existing owner without draining monitor events or allocating resources', async () => {
  const workspace = temporary(), controller = new AbortController();
  const config = { ...defaultConfig(workspace, []), model: 'fixture', features: { tasks: false, subagents: false, background: true } };
  const runtime = await createRuntime(config, unused, controller.signal);
  const context: ToolContext = { workspace, signal: controller.signal, allowShell: true, maxOutputBytes: 24000 };
  const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;
  try {
    const before = getEventListeners(controller.signal, 'abort').length;
    assert.equal(runtime.backgroundTaskDetail!('absent', 'absent'), undefined);
    assert.equal(getEventListeners(controller.signal, 'abort').length, before);
    assert.deepEqual(fs.readdirSync(workspace), []);
    const tools = runtime.buildTools(config, 'owned');
    const command = `${quote(process.execPath)} -e ${quote("process.stdout.write('queued line\\n');process.stderr.write('stderr output\\n');setInterval(()=>{},1000)")}`;
    const started = JSON.parse(await selected(tools, 'monitor').execute({ command }, context)) as { id: string };
    const end = Date.now() + 5000;
    while (true) {
      const current = runtime.backgroundTaskDetail!('owned', started.id);
      if (current?.kind === 'monitor' && current.stderr.includes('stderr output')) break;
      assert.ok(Date.now() < end, 'monitor output arrived'); await delay(10);
    }
    const first = runtime.backgroundTaskDetail!('owned', started.id)!;
    assert.equal(first.kind, 'monitor'); assert.equal(first.state, 'running');
    assert.equal(first.stdout, 'queued line\n'); assert.equal(first.stderr, 'stderr output\n');
    assert.equal(runtime.backgroundTaskDetail!('other', started.id), undefined);
    assert.equal(runtime.backgroundTaskDetail!('owned', 'missing'), undefined);
    const second = runtime.backgroundTaskDetail!('owned', started.id)!;
    assert.equal(second.kind, 'monitor'); assert.equal(second.stdout_bytes, 12);
    const notifications = JSON.parse(await selected(tools, 'read_notifications').execute({}, context)) as { events: { lines: string[] }[] };
    assert.ok(notifications.events.some(event => event.lines.includes('queued line')));
    const drained = JSON.parse(await selected(tools, 'read_notifications').execute({}, context)) as { events: unknown[] };
    assert.deepEqual(drained.events, []);
    await runtime.releaseSession!('owned');
    assert.equal(runtime.backgroundTaskDetail!('owned', started.id), undefined);
    assert.equal(getEventListeners(controller.signal, 'abort').length, before);
    await runtime.close();
    assert.equal(runtime.backgroundTaskDetail!('owned', started.id), undefined);
  } finally { await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('live details keep model and draft owners while polling, navigating, preempting and closing', async context => {
  context.mock.timers.enable({ apis: ['setInterval'] });
  const workspace = temporary(), userDir = path.join(workspace, 'user'); fs.mkdirSync(userDir);
  const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir }, watchConfig: false };
  const session = Session.open(workspace, { config });
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode() {} });
  const screen = new HeadlessTerminal({ cols: 120, rows: 40, allowProposedApi: true, logLevel: 'off' });
  const output = Object.assign(new Writable({ write(chunk, _encoding, done) {
    Reflect.apply(Reflect.get(Reflect.get(screen, '_core'), 'writeSync'), Reflect.get(screen, '_core'), [String(chunk)]); done();
  } }), { isTTY: true, columns: 120, rows: 40 });
  const tui = new TuiTerminal({ input, output, prefersReducedMotion: true, userDir });
  const frame = () => Array.from({ length: 40 }, (_, row) => screen.buffer.active.getLine(row)?.translateToString(true) ?? '').join('\n');
  const key = (value: string) => input.emit('data', value);
  const jobs = new Map<string, ShellTaskDetail>([['shell', detail('shell')]]);
  const snapshot = (): BackgroundTaskSnapshot => ({ ...empty, jobs: [...jobs.values()].filter(job => job.state === 'running')
    .map(job => ({ id: job.id, kind: job.kind, state: job.state, command: job.command, description: job.id })) });
  let polls = 0, calls = 0, modelSignal: AbortSignal | undefined, release: (() => void) | undefined;
  let elicitation: NonNullable<McpClientRequests['elicitation']> | undefined;
  const listeners = new Set<(owner: string) => void>();
  const notify = () => { for (const listener of listeners) listener(session.id); };
  const provider: ModelProvider = { count: async () => 0, complete: async (_request, signal) => {
    calls++; modelSignal = signal; await new Promise<void>(resolve => { release = resolve; });
    return { id: 'fixture', model: 'fixture', role: 'assistant', type: 'message',
      content: [{ type: 'text', text: 'held turn finished', citations: null }], container: null, diagnostics: null,
      stop_details: null, stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1,
        cache_creation: null, cache_creation_input_tokens: null, cache_read_input_tokens: null, inference_geo: null,
        output_tokens_details: null, server_tool_use: null, service_tier: null } };
  } };
  const stopped: string[] = [];
  const runtime = { tools: [], buildTools: () => [], limits: [], close: async () => {},
    subscribe(listener: (owner: string) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    registerElicitation(_owner: string, callback: NonNullable<McpClientRequests['elicitation']>) {
      elicitation = callback; return () => { elicitation = undefined; };
    },
    backgroundWorkCount: () => snapshot().jobs.length, backgroundTasks: snapshot,
    backgroundTaskDetail(_owner: string, id: string) { polls++; return jobs.get(id); },
    async stopTask(_owner: string, id: string) { stopped.push(id); jobs.delete(id); notify(); return 'shell' as const; },
  };
  const controller = new AbortController();
  const loop = interactiveLoop(session, provider, runtime, { input, output, status: tui.statusStream, signal: controller.signal, terminal: tui });
  const until = async (check: () => boolean) => {
    const end = Date.now() + 5000;
    while (!check()) { assert.ok(Date.now() < end, frame()); await delay(10); }
  };
  const click = () => {
    const label = backgroundFooterLabel(snapshot()); assert.ok(label);
    const column = (screen.buffer.active.getLine(39)?.translateToString(true) ?? '').indexOf(label) + 1;
    assert.ok(column > 0, frame()); key(`\x1b[<0;${column};40M\x1b[<0;${column};40m`);
  };
  const stoppedPolling = async () => {
    const before = polls; context.mock.timers.tick(3000); await delay(0); assert.equal(polls, before);
  };
  try {
    await until(() => listeners.size === 1 && frame().includes('1 shell'));
    key('hold request\r'); await until(() => release !== undefined); key('retained draft'); click();
    await until(() => frame().includes('Shell details') && tui.currentScreen === 'dialog');
    jobs.get('shell')!.stdout = 'live output\n'; context.mock.timers.tick(1000);
    assert.match(frame(), /live output/); assert.equal(calls, 1); assert.equal(modelSignal?.aborted, false);
    key(' '); await until(() => tui.currentScreen === 'chat'); await stoppedPolling();
    assert.equal(tui.state.text, 'retained draft');
    click(); await until(() => frame().includes('Shell details'));
    assert.ok(elicitation);
    const form = elicitation({ mode: 'form', message: 'Local form', requestedSchema: { type: 'object',
      properties: { label: { type: 'string' } }, required: ['label'] } }, controller.signal, { serverName: 'fixture', requestId: 'detail-form' });
    await until(() => frame().includes('MCP form from fixture')); await stoppedPolling();
    key('{"label":"chosen"}\r'); assert.deepEqual(await form, { action: 'accept', content: { label: 'chosen' } });
    assert.equal(tui.state.text, 'retained draft'); assert.equal(modelSignal?.aborted, false);
    jobs.set('monitor', detail('monitor', 'monitor')); notify(); click();
    await until(() => frame().includes('2 active shells'));
    key('\x1b[B\r'); await until(() => frame().includes('Monitor details'));
    key('\x1b[D'); await until(() => frame().includes('2 active shells'));
    key('\r'); await until(() => frame().includes('Monitor details'));
    key('x'); await until(() => frame().includes('1 active shell')); assert.deepEqual(stopped, ['monitor']);
    key('\r'); await until(() => frame().includes('Shell details'));
    jobs.delete('shell'); notify(); await until(() => frame().includes('No tasks currently running')); await stoppedPolling();
    key('\x03'); await until(() => tui.currentScreen === 'chat');
    assert.equal(tui.state.text, 'retained draft'); assert.equal(modelSignal?.aborted, false);
    jobs.set('shell', detail('shell')); notify(); click(); await until(() => frame().includes('Shell details'));
    jobs.set('monitor', detail('monitor', 'monitor')); jobs.delete('shell'); notify();
    await until(() => tui.currentScreen === 'chat'); await stoppedPolling();
    assert.equal(tui.state.text, 'retained draft'); assert.equal(modelSignal?.aborted, false);
    jobs.clear(); for (const id of ['A', 'B', 'C', 'D', 'E', 'F']) jobs.set(id, detail(id)); notify();
    click(); await until(() => frame().includes('6 active shells'));
    jobs.delete('A'); notify(); await until(() => frame().includes('5 active shells'));
    key('\x1b[B\x1b[B\r'); await until(() => frame().includes('Shell details') && frame().includes('Command: owned D'));
    jobs.delete('D'); notify(); await until(() => frame().includes('4 active shells'));
    assert.match(frame(), /Selected: owned E/);
    key('x'); await until(() => frame().includes('3 active shells')); assert.deepEqual(stopped, ['monitor', 'E']);
    key('\x03'); await until(() => tui.currentScreen === 'chat'); await stoppedPolling();
    jobs.clear(); jobs.set('monitor', detail('monitor', 'monitor')); notify();
    click(); await until(() => frame().includes('Monitor details'));
    controller.abort(); release!(); await loop; await stoppedPolling();
    assert.equal(listeners.size, 0); assert.equal(calls, 1);
  } finally {
    release?.(); controller.abort(); await loop; tui.close(); screen.dispose(); session.close();
    context.mock.timers.reset(); fs.rmSync(workspace, { recursive: true, force: true });
  }
});
