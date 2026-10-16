// The generic classic raise, end to end: a plugin module's answer to any classic hook event reaches
// the agent's tool path. The copied bodies live in src/plugin-chain-classic-raise-source.ts (sources:
// chunk-sfn1dbxq.js [556225,556265) `Q_t`, [556293,556325) `die`, [558335,558460) `gkt`,
// [559965,560231) `znr`, [561742,562773) `Rkt`/`p7n`/`cU`/`cie`/`Pkt`/`h7n`; chunk-kwp08k6x.js
// [16626,17014) `fe`/`le`; chunk-2kdsvp3x.js [38835,39124) `N5t`/`Cro`; chunk-nyce03br.js
// [123587,123677) `Bde`). The product's own raise is `Ikt` (chunk-sfn1dbxq.js [562773,563154)), whose
// outer arms are the engine's configured-hook runner and arrive here as inputs.

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
  classicEventHooked,
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
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccrev-classic-raise-')));
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

/** Writes one plugin hooks module that answers a single classic event. */
function moduleFile(event: string, answer: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'classic-raise-mod-'));
  const file = path.join(dir, 'hooks.mjs');
  fs.writeFileSync(file, `export default {
  name: 'fixture-classic',
  tier: 'user',
  patterns: [{pattern: '${event}'}],
  handlers: {'${event}': async (input, next) => (${answer})},
};
`);
  return file;
}

test('classic raise: the hook input is the source\'s `fe` shape and the gate is the source\'s `Q_t`', async () => {
  clearChainRecords();
  // `fe` sets the session context first, spreads the payload over it, and names the event last.
  assert.deepEqual(classicHookInput('PostToolUse', { tool_name: 'probe', tool_input: { x: 1 } }),
    { session_id: '', transcript_path: '', cwd: '', tool_name: 'probe', tool_input: { x: 1 }, hook_event_name: 'PostToolUse' });
  // The engine's own session id and cwd are host values, so a payload carrying both wins.
  assert.deepEqual(classicHookInput('PostToolUse', { session_id: 's1', cwd: '/w', tool_name: 'probe' }),
    { session_id: 's1', transcript_path: '', cwd: '/w', tool_name: 'probe', hook_event_name: 'PostToolUse' });

  // `Q_t` is `Gnr` and `Jl`: nothing hooks the event, and PreToolUse is never a classic raise — the
  // tool call owns it (W45-15) — so both gates are closed whatever hooks exist.
  assert.equal(classicEventRaised('PostToolUse'), false);
  assert.equal(classicEventRaised('PostToolUseFailure'), false);
  assert.equal(classicEventRaised('PreToolUse'), false);

  const run = createChainRun();
  const { unload } = await loadChainModuleFileInto(run, { pluginName: 'fixture-classic', modulePath: moduleFile('classic.PostToolUse', '{}') });
  try {
    assert.equal(classicEventRaised('PostToolUse'), true, 'a module hooks the event');
    assert.equal(classicEventRaised('PostToolUseFailure'), false, 'only the event a pattern names is hooked');
    assert.equal(classicEventHooked('PreToolUse'), false, '`die` reads the same pattern set');
    assert.equal(classicEventRaised('PreToolUse'), false, 'PreToolUse stays the tool call\'s, even with a module hooking it');
  } finally {
    unload();
  }
});

test('classic raise: the answer folds to the source\'s record list and its block text', async () => {
  clearChainRecords();
  const blockRun = createChainRun();
  const blocked = await loadChainModuleFileInto(blockRun, {
    pluginName: 'fixture-block',
    modulePath: moduleFile('classic.PostToolUse', "{block: 'the fixture blocks the post event', additionalContexts: ['ctx from the fixture']}"),
  });
  try {
    const raised = await raiseClassicEvent({ event: 'PostToolUse', hookInput: classicHookInput('PostToolUse', { tool_name: 'probe' }) });
    // `h7n` turns a blocking answer into the source's own `Rkt` record, named after the site (`FDe`).
    assert.deepEqual(raised.records, [
      { command: 'classic.PostToolUse hook', succeeded: false, output: 'the fixture blocks the post event', blocked: true },
    ]);
    assert.deepEqual(raised.answer, { block: 'the fixture blocks the post event', additionalContexts: ['ctx from the fixture'] });
    // `gkt` resolves the block text; with a block present it is the answer's own.
    assert.equal(raised.block, 'the fixture blocks the post event');
  } finally {
    blocked.unload();
  }

  const rewriteRun = createChainRun();
  const rewrite = await loadChainModuleFileInto(rewriteRun, {
    pluginName: 'fixture-rewrite',
    modulePath: moduleFile('classic.PostToolUse', "{updatedToolOutput: 'rewritten by the fixture', additionalContexts: ['extra']}"),
  });
  try {
    const raised = await raiseClassicEvent({ event: 'PostToolUse', hookInput: classicHookInput('PostToolUse', { tool_name: 'probe' }) });
    assert.deepEqual(raised.records, [], 'an answer that blocks nothing adds no record');
    assert.deepEqual(raised.answer, { updatedToolOutput: 'rewritten by the fixture', additionalContexts: ['extra'] });
    assert.equal(raised.block, undefined);
  } finally {
    rewrite.unload();
  }
});

test('classic raise: the agent\'s tool path applies a post hook\'s rewrite and its block', async () => {
  clearChainRecords();
  const ws = tmpDir();
  const tools: ToolDefinition[] = [{
    readOnly: false,
    schema: { name: 'probe', description: 'returns a fixed string', input_schema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] } },
    execute: async () => 'the original output',
  }];

  const rewriteRun = createChainRun();
  const rewrite = await loadChainModuleFileInto(rewriteRun, {
    pluginName: 'fixture-post',
    modulePath: moduleFile('classic.PostToolUse', "{updatedToolOutput: 'rewritten by the fixture', additionalContexts: ['ctx from the fixture']}"),
  });
  try {
    const session = Session.open(ws, { config: makeConfig(ws, tools) });
    const agent = new Agent(session, new FakeProvider([
      serverMessage([{ type: 'tool_use', id: 't1', name: 'probe', input: { x: 'first' } }], 'tool_use'),
      serverMessage([{ type: 'text', text: 'done' }], 'end_turn'),
    ]), tools);
    await agent.run('go');
    const pair = session.messages.at(-2);
    // The chain's rewrite replaces the tool's own result, and its context rides the same message.
    assert.deepEqual(pair, { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 't1', content: 'rewritten by the fixture' },
      { type: 'text', text: 'Hook context:\nctx from the fixture' },
    ] });
  } finally {
    rewrite.unload();
  }

  clearChainRecords();
  const failing: ToolDefinition[] = [{
    readOnly: false,
    schema: { name: 'probe', description: 'always fails', input_schema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] } },
    execute: async () => { throw new Error('the fixture tool fails'); },
  }];
  const blockRun = createChainRun();
  const blocked = await loadChainModuleFileInto(blockRun, {
    pluginName: 'fixture-failure',
    modulePath: moduleFile('classic.PostToolUseFailure', "{block: 'the fixture blocks the failure'}"),
  });
  try {
    const session = Session.open(ws, { config: makeConfig(ws, failing) });
    const agent = new Agent(session, new FakeProvider([
      serverMessage([{ type: 'tool_use', id: 't2', name: 'probe', input: { x: 'first' } }], 'tool_use'),
      serverMessage([{ type: 'text', text: 'done' }], 'end_turn'),
    ]), failing);
    await agent.run('go');
    const pair = session.messages.at(-2);
    // The failing event is raised under its own name, and its block text is the feedback the same
    // message carries: the error result itself is left as the tool produced it.
    assert.deepEqual(pair, { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 't2', content: 'the fixture tool fails', is_error: true },
      { type: 'text', text: 'Hook context:\nthe fixture blocks the failure' },
    ] });
  } finally {
    blocked.unload();
  }
});
