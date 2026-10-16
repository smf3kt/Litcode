// The classic PreToolUse raise point, end to end: a plugin module's answer reaches the agent's tool
// call. The copied bodies live in src/plugin-chain-tool-raise-source.ts (sources: chunk-nyce03br.js
// [103321,103575) `Da`/`No`, [103918,103945) `rIt`, [111504,111567) `a8`/`CFe`, [112820,112985) `RFe`,
// [121822,121896) `$go`; chunk-kwp08k6x.js [17196,17365) `xe`, [17365,17723) `ye`/`ke`, [17723,17793)
// `Mo`; chunk-sfn1dbxq.js [504161,504681) `p_t`/`mDe`). The agent path that raises it is the one
// #[504681,505531) of the same module describes.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import type Anthropic from '@anthropic-ai/sdk';

import { Agent, defaultConfig } from '../src/agent.js';
import { clearChainRecords, it } from '../src/plugin-chain-host.js';
// The registry import installs the environment host factory and registers every chain site.
import '../src/plugin-chain-registry.js';
import { createChainRun, loadChainModuleFileInto } from '../src/plugin-chain-loader.js';
import {
  CLASSIC_PRE_TOOL_USE,
  classicPreToolUseEnvelope,
  classicPreToolUseHooked,
  newDenialRecord,
  raiseClassicPreToolUse,
  toolCallCores,
} from '../src/plugin-chain-tool-raise.js';
import { Session, type SessionConfig } from '../src/session.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolDefinition } from '../src/tools.js';

type Req = Parameters<ModelProvider['complete']>[0];
type Res = Awaited<ReturnType<ModelProvider['complete']>>;

const tempDirs: string[] = [];
function tmpDir(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccrev-chain-raise-')));
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
  constructor(script: Res[] = []) {
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

/** Writes one plugin hooks module file and returns its path. */
function moduleFile(body: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-raise-'));
  const file = path.join(dir, 'hooks.mjs');
  fs.writeFileSync(file, body);
  return file;
}

const ANSWER = (body: string) => `export default {
  name: 'fixture-raise',
  tier: 'user',
  patterns: [{pattern: 'classic.PreToolUse'}],
  handlers: {'classic.PreToolUse': async (input, next) => (${body})},
};
`;

test('classic PreToolUse: the envelope is the source\'s `No`/`Da` shape', () => {
  assert.deepEqual(classicPreToolUseEnvelope('Bash', 'toolu_9', { command: 'ls' }),
    { command: 'ls', tool: 'Bash', tool_use_id: 'toolu_9' });
  // The call's own keys move under `$shadowed` instead of reaching the hook as part of its input.
  assert.deepEqual(classicPreToolUseEnvelope('Bash', 'toolu_9', { command: 'ls', consent: 'yes', agentId: 'a1', requestMeta: { k: 'v' } }),
    { command: 'ls', tool: 'Bash', tool_use_id: 'toolu_9', $shadowed: { agentId: 'a1', consent: 'yes', requestMeta: { k: 'v' } } });
  // With no call id the source still sets the key, to `undefined`.
  assert.deepEqual(classicPreToolUseEnvelope('Bash', undefined, { command: 'ls' }), { command: 'ls', tool: 'Bash', tool_use_id: undefined });
});

test('classic PreToolUse: the raise follows the source\'s gate and its three answer fields', async () => {
  clearChainRecords();
  const run = createChainRun();
  // Nothing hooks the event yet: the source's gate is closed, `Mo` returns no cores, and raising
  // anyway is the source's own error — `$go` passes no core, so the chain's bottom has none.
  assert.equal(classicPreToolUseHooked(), false);
  assert.deepEqual(toolCallCores([{ kind: 'composer' }], newDenialRecord()), {});
  await assert.rejects(
    () => raiseClassicPreToolUse({ tool: 'Bash', toolUseId: 'toolu_1', input: { command: 'ls' } }),
    /no implementation for classic\.PreToolUse/);

  const modulePath = moduleFile(ANSWER("{deny: 'the fixture denies ' + input.tool, updatedInput: {command: 'echo rewritten'}, additionalContext: ['from the fixture']}"));
  const { unload } = await loadChainModuleFileInto(run, { pluginName: 'fixture-raise', modulePath });
  try {
    assert.equal(classicPreToolUseHooked(), true);
    // `Mo`'s core for the tool call: the source's own descriptor, with `ke`'s `run` on it.
    const cores = toolCallCores([{ kind: 'composer' }], newDenialRecord()) as { 'tool.call': Record<string, unknown> };
    assert.deepEqual(Object.keys(cores), ['tool.call']);
    assert.deepEqual({ ...cores['tool.call'], run: typeof cores['tool.call']!.run },
      { name: 'core', isCore: true, budgetMs: 0, run: 'function' });
    const raised = await raiseClassicPreToolUse({ tool: 'Bash', toolUseId: 'toolu_1', input: { command: 'ls' }, origin: [{ kind: 'composer' }] });
    assert.deepEqual(raised.answer, { deny: 'the fixture denies Bash', updatedInput: { command: 'echo rewritten' }, additionalContext: ['from the fixture'] });
    // `mDe` is the source's mapping from a classic answer to the permission the caller applies. Its
    // deny arm returns early, so a denial carries the reason and the context but drops the rewrite,
    // which is the source's own rule rather than this seam's.
    assert.deepEqual(raised.permission, { permissionBehavior: 'deny', hookPermissionDecisionReason: 'the fixture denies Bash',
      additionalContexts: ['from the fixture'] });
    assert.equal(raised.permission.updatedInput, undefined, 'a denial does not carry the rewrite');
    assert.equal(it().loadedModules[0]!.name, 'fixture-raise');
  } finally {
    unload();
  }
});

test('classic PreToolUse: the agent\'s tool path applies a plugin\'s denial and its rewrite', async () => {
  clearChainRecords();
  const ws = tmpDir();
  const seen: unknown[] = [];
  const tool: ToolDefinition = {
    readOnly: false,
    schema: { name: 'probe', description: 'records its input', input_schema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] } },
    execute: async (input) => { seen.push(input); return 'ok'; },
  };
  const tools = [tool];

  const denyRun = createChainRun();
  const denyPath = moduleFile(ANSWER("{deny: 'the fixture denies this call'}"));
  const denied = await loadChainModuleFileInto(denyRun, { pluginName: 'fixture-deny', modulePath: denyPath });
  try {
    const provider = new FakeProvider([
      serverMessage([{ type: 'tool_use', id: 't1', name: 'probe', input: { x: 'first' } }], 'tool_use'),
      serverMessage([{ type: 'text', text: 'done' }], 'end_turn'),
    ]);
    const session = Session.open(ws, { config: makeConfig(ws, tools) });
    const agent = new Agent(session, provider, tools);
    await agent.run('go');
    assert.deepEqual(seen, [], 'the tool never ran');
    const results = session.events.filter((event) => event.kind === 'tool_result') as unknown as
      { result: { content: unknown; is_error?: boolean } }[];
    assert.equal(results.at(-1)?.result.is_error, true);
    assert.match(JSON.stringify(results.at(-1)?.result.content), /the fixture denies this call/);
  } finally {
    denied.unload();
  }

  // The same path with a rewrite instead of a denial: the tool runs with the rewritten input.
  const rewriteRun = createChainRun();
  const rewritePath = moduleFile(ANSWER("{updatedInput: {x: 'rewritten by the fixture'}}"));
  const rewritten = await loadChainModuleFileInto(rewriteRun, { pluginName: 'fixture-rewrite', modulePath: rewritePath });
  try {
    const provider = new FakeProvider([
      serverMessage([{ type: 'tool_use', id: 't2', name: 'probe', input: { x: 'second' } }], 'tool_use'),
      serverMessage([{ type: 'text', text: 'done' }], 'end_turn'),
    ]);
    const session = Session.open(ws, { config: makeConfig(ws, tools) });
    const agent = new Agent(session, provider, tools);
    await agent.run('go');
    assert.deepEqual(seen, [{ x: 'rewritten by the fixture' }]);
  } finally {
    rewritten.unload();
  }
});
