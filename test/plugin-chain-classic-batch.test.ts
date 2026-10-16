// The classic PostToolBatch raise: the batch boundary on the agent's tool path. The raise machinery is
// W45-16's copy (src/plugin-chain-classic-raise-source.ts); this test binds the call site to the
// source's own, `Hkn` (chunk-sfn1dbxq.js [3062957,3063491), hook input
// `{hook_event_name: 'PostToolBatch', tool_calls}` and entries `{tool_name, tool_input, tool_use_id,
// tool_response}`) and to its caller's end-turn rule (chunk-5b2hxy2e.js [123688,123900): a batch block
// is discarded once the turn has ended by a tool result, because no model re-invoke follows).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import type Anthropic from '@anthropic-ai/sdk';

import { Agent, defaultConfig } from '../src/agent.js';
import { clearChainRecords } from '../src/plugin-chain-host.js';
// The registry import installs the environment host factory and registers every chain site.
import '../src/plugin-chain-registry.js';
import { createChainRun, loadChainModuleFileInto } from '../src/plugin-chain-loader.js';
import {
  CLASSIC_POST_TOOL_BATCH,
  classicEventRaised,
  classicHookInput,
  raiseClassicEvent,
} from '../src/plugin-chain-classic-raise.js';
import { Session, type SessionConfig } from '../src/session.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolDefinition } from '../src/tools.js';

type Req = Parameters<ModelProvider['complete']>[0];
type Res = Awaited<ReturnType<ModelProvider['complete']>>;

const tempDirs: string[] = [];
function tmpDir(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccrev-classic-batch-')));
  tempDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

class FakeProvider implements ModelProvider {
  private script: Res[];
  constructor(script: Res[]) {
    this.script = [...script];
  }
  async complete(_request: Req, signal: AbortSignal, onText?: (text: string) => void): Promise<Res> {
    signal.throwIfAborted();
    const next = this.script.shift();
    if (!next) throw new Error('FakeProvider script exhausted');
    if (onText) for (const block of next.content) if (block.type === 'text') onText(block.text);
    return next;
  }
  async count(_request: Req, signal: AbortSignal): Promise<number> {
    signal.throwIfAborted();
    return 1;
  }
}

const serverMessage = (content: unknown[], stop: Anthropic.StopReason): Res =>
  ({ id: 'msg_1', type: 'message', role: 'assistant', model: 'test-model', content, stop_reason: stop, stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 } }) as unknown as Res;

function makeConfig(workspace: string, tools: ToolDefinition[]): SessionConfig {
  const base = defaultConfig(workspace, tools);
  return { ...base, model: 'test-model', system: 'test-system', maxOutputBytes: 64_000 };
}

/** Writes one plugin hooks module answering `classic.PostToolBatch`. */
function batchModule(answer: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'classic-batch-mod-'));
  const file = path.join(dir, 'hooks.mjs');
  fs.writeFileSync(file, `export default {
  name: 'fixture-batch',
  tier: 'user',
  patterns: [{pattern: 'classic.PostToolBatch'}],
  handlers: {'classic.PostToolBatch': async (input, next) => (${answer})},
};
`);
  return file;
}

const pair = (names: string[]): ToolDefinition[] => names.map((name) => ({
  readOnly: false,
  schema: { name, description: name, input_schema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] } },
  execute: async (input: Record<string, unknown>) => `out:${name}:${String((input as { x?: string }).x)}`,
}));

const batchTurn = (tools: ToolDefinition[]): Res[] => [
  serverMessage(tools.map((tool, index) => ({ type: 'tool_use', id: `t${index + 1}`, name: tool.schema.name, input: { x: String(index + 1) } })), 'tool_use'),
  serverMessage([{ type: 'text', text: 'done' }], 'end_turn'),
];

test('classic PostToolBatch: the batch names no session field the source does not send', async () => {
  clearChainRecords();
  // The source's batch site builds its input from the session context plus `tool_calls` alone: no
  // `tool_use_id` and no per-tool alias spread (`_X` is on the single events, not here).
  assert.deepEqual(classicHookInput(CLASSIC_POST_TOOL_BATCH, {
    session_id: 's1', cwd: '/w',
    tool_calls: [{ tool_name: 'alpha', tool_input: { x: '1' }, tool_use_id: 't1', tool_response: 'out:alpha:1' }],
  }), {
    session_id: 's1', transcript_path: '', cwd: '/w', hook_event_name: 'PostToolBatch',
    tool_calls: [{ tool_name: 'alpha', tool_input: { x: '1' }, tool_use_id: 't1', tool_response: 'out:alpha:1' }],
  });

  const run = createChainRun();
  const { unload } = await loadChainModuleFileInto(run, { pluginName: 'fixture-batch', modulePath: batchModule('{}') });
  try {
    assert.equal(classicEventRaised(CLASSIC_POST_TOOL_BATCH), true);
    // The answer echoes the batch it was handed, so the fold's own reading of it is observable.
    const raised = await raiseClassicEvent({
      event: CLASSIC_POST_TOOL_BATCH,
      hookInput: classicHookInput(CLASSIC_POST_TOOL_BATCH, {
        tool_calls: [{ tool_name: 'alpha', tool_input: { x: '1' }, tool_use_id: 't1', tool_response: 'out:alpha:1' }],
      }),
    });
    assert.deepEqual(raised.records, [], 'an answer that blocks nothing adds no record');
    assert.deepEqual(raised.answer, {});
  } finally {
    unload();
  }
});

test('classic PostToolBatch: the agent raises it once per batch, with every call in it', async () => {
  clearChainRecords();
  const ws = tmpDir();
  const tools = pair(['alpha', 'beta']);
  const run = createChainRun();
  const { unload } = await loadChainModuleFileInto(run, {
    pluginName: 'fixture-batch',
    // The handler reports the batch it saw through the answer's own context field.
    modulePath: batchModule("{additionalContexts: [JSON.stringify(input.tool_calls)]}"),
  });
  try {
    const session = Session.open(ws, { config: makeConfig(ws, tools) });
    const agent = new Agent(session, new FakeProvider(batchTurn(tools)), tools);
    const outcome = await agent.run('go');
    assert.equal(outcome.reason, 'end_turn');
    const messages = session.messages as unknown as { role: string; content: { type: string; text?: string }[] | string }[];
    const context = messages.filter((message) => Array.isArray(message.content) &&
      message.content.some((block) => block.type === 'text' && block.text?.startsWith('Hook context:')));
    assert.deepEqual(context.map((message) => (message.content as { text?: string }[]).map((block) => block.text)), [
      ['Hook context:\n' + JSON.stringify([
        { tool_name: 'alpha', tool_input: { x: '1' }, tool_use_id: 't1', tool_response: 'out:alpha:1' },
        { tool_name: 'beta', tool_input: { x: '2' }, tool_use_id: 't2', tool_response: 'out:beta:2' },
      ])],
    ]);
  } finally {
    unload();
  }
});

test('classic PostToolBatch: a block is discarded and logged, and the event is not raised unhooked', async () => {
  clearChainRecords();
  const ws = tmpDir();
  const tools = pair(['alpha', 'beta']);

  // Nothing hooks the event: the gate is closed, so no batch is raised and no status line appears.
  const idleSession = Session.open(ws, { config: makeConfig(ws, tools) });
  const idleStatus: string[] = [];
  const idle = new Agent(idleSession, new FakeProvider(batchTurn(tools)), tools, { status: (text) => { idleStatus.push(text); } });
  await idle.run('go');
  assert.deepEqual(idleStatus.filter((line) => line.includes('PostToolBatch')), []);

  const run = createChainRun();
  const { unload } = await loadChainModuleFileInto(run, {
    pluginName: 'fixture-batch',
    modulePath: batchModule("{block: 'the fixture blocks the batch', additionalContexts: ['batch ctx']}"),
  });
  try {
    assert.equal(classicEventRaised(CLASSIC_POST_TOOL_BATCH), true);
    const session = Session.open(ws, { config: makeConfig(ws, tools) });
    const status: string[] = [];
    const agent = new Agent(session, new FakeProvider(batchTurn(tools)), tools, { status: (text) => { status.push(text); } });
    const outcome = await agent.run('go');
    // The source's own rule and sentence: the turn already ended by a tool result, so the block is
    // discarded and logged rather than stopping the turn.
    assert.equal(outcome.reason, 'end_turn');
    assert.deepEqual(status.filter((line) => line.includes('PostToolBatch')), [
      '[end-turn] PostToolBatch block discarded (turn ended by tool result, no model re-invoke): preventContinuation',
    ]);
    const appended = (session.messages as unknown as { content: unknown }[])
      .filter((message) => JSON.stringify(message.content).includes('batch ctx'));
    assert.equal(appended.length, 1, 'the batch context still reaches the transcript');
  } finally {
    unload();
  }
});
