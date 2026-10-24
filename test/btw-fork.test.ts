import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import { interactiveLoop } from '../src/interactive.js';
import type { ModelProvider } from '../src/provider.js';
import { createRuntime, type Runtime } from '../src/runtime.js';
import { Session } from '../src/session.js';
import { subtaskDirective, type SubtaskLaunch } from '../src/subtask.js';
import type { TerminalCallbacks, TerminalPromptRequest, TerminalSurface } from '../src/terminal.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'btw-fork-test-')));
const reply = (text: string): Anthropic.Message => ({ id: 'side', type: 'message', role: 'assistant', model: 'test',
  content: [{ type: 'text', text, citations: null }], stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 5, output_tokens: 3, cache_creation: null, cache_creation_input_tokens: null,
    cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null },
  container: null, diagnostics: null, stop_details: null });
const until = async (check: () => boolean) => { const end = Date.now() + 5000;
  while (!check()) { assert.ok(Date.now() < end, 'owned lifecycle settles'); await delay(10); } };

type ForkCall = { owner: string; task: string; conversation: readonly Anthropic.MessageParam[];
  extra: readonly Anthropic.MessageParam[] | undefined };
async function drive(options: { actions: readonly string[]; synthetic?: boolean;
  result?: SubtaskLaunch; error?: Error; seam?: boolean }) {
  const workspace = temporary(), config = { ...defaultConfig(workspace, []), model: 'test' };
  const session = Session.open(workspace, { config });
  session.append({ kind: 'message', message: { role: 'user', content: 'PARENT_TASK' } });
  session.append({ kind: 'message', message: { role: 'assistant', content: 'PARENT_ANSWER' } });
  session.append({ kind: 'turn_end', reason: 'end_turn' });
  const before = JSON.stringify(session.messages), calls: ForkCall[] = [], prompts: TerminalPromptRequest[] = [];
  let callbacks: TerminalCallbacks | undefined, text = '', ordinal = 0;
  const output = new Writable({ write(chunk, _encoding, done) { text += String(chunk); done(); } });
  const terminal: TerminalSurface = {
    isTTY: true, outputStream: output,
    subscribe(value) { callbacks = value; return () => { callbacks = undefined; }; },
    start() { queueMicrotask(() => callbacks?.onSubmit?.('/btw REVIEW_THIS_QUESTION')); },
    close() {}, setRunning() {}, setKeybindings() {}, writeTerminalSequence() {},
    async prompt(request) {
      if (request.sideQuestion) { await request.sideQuestion.settled; return { selected: [], key: 'side-settled' }; }
      prompts.push(request);
      const action = options.actions[ordinal++];
      if (ordinal >= options.actions.length) setImmediate(() => callbacks?.onExit?.());
      return action === undefined ? undefined : { selected: [], key: action };
    },
  };
  const launch: NonNullable<Runtime['launchSubtask']> = async (_config, owner, task, _signal, conversation, extra) => {
    calls.push({ owner, task, conversation: structuredClone(conversation), extra: structuredClone(extra) });
    if (options.error) throw options.error;
    return options.result ?? { kind: 'forked', name: 'review-this-question', agentId: 'aaaa1111' };
  };
  const runtime = { tools: [], buildTools: () => [], close: async () => {}, limits: [],
    ...(options.seam === false ? {} : { launchSubtask: launch }) };
  const provider: ModelProvider = { count: async () => 0, complete: async () => {
    const answer = reply('REVIEWED_ANSWER');
    if (options.synthetic) answer.content = [{ type: 'tool_use', id: 'unexecuted', name: 'read_file', input: {}, caller: { type: 'direct' } }];
    return answer;
  } };
  try {
    await interactiveLoop(session, provider, runtime, { input: new PassThrough(), output, status: output,
      terminal, signal: new AbortController().signal });
    assert.equal(JSON.stringify(session.messages), before);
    return { calls, prompts, text, owner: session.id };
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
}

test('the current normal answer forks with its exact pair, while browsing and synthetic replies keep their gates', async () => {
  const normal = await drive({ actions: ['[', 'f', ']', 'f'] });
  assert.equal(normal.prompts[0]!.keys?.some(key => key.key === 'f'), true);
  assert.equal(normal.prompts[1]!.keys?.some(key => key.key === 'f'), false);
  assert.equal(normal.prompts[2]!.keys?.some(key => key.key === 'f'), false);
  assert.equal(normal.prompts[3]!.keys?.some(key => key.key === 'f'), true);
  assert.equal(normal.calls.length, 1);
  assert.deepEqual(normal.calls[0], { owner: normal.owner, task: 'REVIEW_THIS_QUESTION',
    conversation: [{ role: 'user', content: 'PARENT_TASK' }, { role: 'assistant', content: 'PARENT_ANSWER' }],
    extra: [{ role: 'user', content: 'REVIEW_THIS_QUESTION' }, { role: 'assistant', content: 'REVIEWED_ANSWER' }] });
  assert.match(normal.text, /forked review-this-question \(1111\)/);
  for (const options of [{ synthetic: true }, { seam: false }]) {
    const skipped = await drive({ ...options, actions: ['f', 'c'] });
    assert.equal(skipped.calls.length, 0);
    assert.equal(skipped.prompts[0]!.keys?.some(key => key.key === 'f'), false);
  }
});

test('unavailable and failed fork setup close the panel with feedback and leave the parent usable', async () => {
  const absent = await drive({ actions: ['f'], result: { kind: 'unavailable', reason: 'no-conversation' } });
  assert.match(absent.text, /Cannot fork before the first conversation turn/);
  assert.equal(absent.calls.length, 1);
  const disabled = await drive({ actions: ['f'], result: { kind: 'unavailable', reason: 'disabled' } });
  assert.match(disabled.text, /Forking is disabled in this session/);
  const failed = await drive({ actions: ['f'], error: new Error('OWNED_SETUP_FAILURE') });
  assert.match(failed.text, /Failed to fork: OWNED_SETUP_FAILURE/);
  assert.equal(failed.calls.length, 1);
});

test('both agent-type modes seed the retained child, inherit restrictions, continue it and release running work', async () => {
  for (const agentTypes of [false, true]) {
    const workspace = temporary(), tools: never[] = [], config = { ...defaultConfig(workspace, tools), model: 'test',
      features: { tasks: false, subagents: true, agentMessaging: true, agentTypes }, skills: [] };
    const requests: Anthropic.MessageParam[][] = [];
    let hold = false, aborted = false;
    const provider: ModelProvider = { count: async () => 0, complete: async (request, signal) => {
      requests.push(structuredClone(request.messages));
      if (hold) await new Promise<void>((_resolve, reject) => {
        const abort = () => { aborted = true; reject(signal.reason); };
        if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
      });
      return reply('CHILD_DONE');
    } };
    const runtime = await createRuntime(config, provider, new AbortController().signal);
    const session = Session.open(workspace, { config });
    session.append({ kind: 'message', message: { role: 'user', content: 'PARENT_TASK' } });
    session.append({ kind: 'message', message: { role: 'assistant', content: 'PARENT_ANSWER' } });
    session.append({ kind: 'turn_end', reason: 'end_turn' });
    const before = JSON.stringify(session.messages), extra: Anthropic.MessageParam[] = [
      { role: 'user', content: 'REVIEW_THIS_QUESTION' }, { role: 'assistant', content: 'REVIEWED_ANSWER' },
    ];
    try {
      const launched = await runtime.launchSubtask!(config, session.id, 'REVIEW_THIS_QUESTION',
        new AbortController().signal, session.messages, extra);
      assert.equal(launched.kind, 'forked');
      if (launched.kind !== 'forked') throw new Error('fixture fork unavailable');
      await until(() => runtime.agentTranscript!(session.id, launched.agentId)?.status === 'completed');
      assert.deepEqual(requests[0]!.slice(0, 4), [...session.messages, ...extra]);
      const last = requests[0]!.at(-1)!;
      assert.equal(last.role, 'user');
      assert.equal(last.content, subtaskDirective('REVIEW_THIS_QUESTION'));
      assert.match(String(last.content), /^<fork-boilerplate>/);
      assert.match(String(last.content), /Your directive: REVIEW_THIS_QUESTION$/);
      const detail = runtime.backgroundTaskDetail!(session.id, launched.agentId);
      assert.ok(detail?.kind === 'agent');
      assert.equal(detail.prompt, 'REVIEW_THIS_QUESTION');
      const metadata = fs.readFileSync(path.join(workspace, '.agent', `${launched.agentId}.jsonl`), 'utf8').split('\n')[0];
      const opened = Session.open(workspace, { id: launched.agentId });
      try {
        assert.equal(opened.config.model, config.model);
        assert.equal(opened.config.permissions?.mode, config.permissions?.mode);
        assert.equal(opened.config.tools.some(tool => tool.name === 'agent'), false);
        assert.equal(opened.events.some(event => event.kind === 'turn_end' && event.reason === 'fork_seed'), true);
      } finally { opened.close(); }
      await runtime.submitAgentInput!(session.id, launched.agentId, 'HUMAN_FOLLOWUP');
      await until(() => runtime.agentTranscript!(session.id, launched.agentId)?.status === 'completed');
      assert.equal(requests.at(-1)!.at(-1)!.content, 'HUMAN_FOLLOWUP');
      assert.equal(fs.readFileSync(path.join(workspace, '.agent', `${launched.agentId}.jsonl`), 'utf8').split('\n')[0], metadata);
      assert.equal(JSON.stringify(session.messages), before);
      hold = true;
      const running = await runtime.launchSubtask!(config, session.id, 'HOLD_CHILD', new AbortController().signal, session.messages, extra);
      assert.equal(running.kind, 'forked');
      await until(() => requests.length === 3);
      await runtime.releaseSession!(session.id);
      assert.equal(aborted, true);
      assert.deepEqual(runtime.backgroundTasks!(session.id), { jobs: [], agents: [], crons: [] });
    } finally {
      session.close(); await runtime.close();
      assert.deepEqual(fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.lock')), []);
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  }
});
