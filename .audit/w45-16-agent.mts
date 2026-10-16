import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type Anthropic from '@anthropic-ai/sdk';

import { Agent, defaultConfig } from '../src/agent.js';
import '../src/plugin-chain-registry.js';
import { clearChainRecords } from '../src/plugin-chain-host.js';
import { createChainRun, loadChainModuleFileInto } from '../src/plugin-chain-loader.js';
import { Session, type SessionConfig } from '../src/session.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolDefinition } from '../src/tools.js';

type Req = Parameters<ModelProvider['complete']>[0];
type Res = Awaited<ReturnType<ModelProvider['complete']>>;

class FakeProvider implements ModelProvider {
  private script: Res[];
  constructor(script: Res[]) { this.script = [...script]; }
  async complete(_request: Req, signal: AbortSignal, onText?: (text: string) => void): Promise<Res> {
    signal.throwIfAborted();
    const next = this.script.shift();
    if (!next) throw new Error('FakeProvider script exhausted');
    if (onText) for (const block of next.content) if (block.type === 'text') onText(block.text);
    return next;
  }
  async count(_request: Req, signal: AbortSignal): Promise<number> { signal.throwIfAborted(); return 1; }
}
const serverMessage = (content: unknown[], stop: Anthropic.StopReason): Res =>
  ({ id: 'msg_1', type: 'message', role: 'assistant', model: 'test-model', content, stop_reason: stop, stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 } }) as unknown as Res;

const ws = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w45-16-agent-')));
const config = (tools: ToolDefinition[]): SessionConfig => {
  const base = defaultConfig(ws, tools);
  return { ...base, model: 'test-model', system: 'test-system', maxOutputBytes: 64_000 };
};
const moduleFile = (body: string, name = 'hooks.mjs') => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-16-mod-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, body);
  return file;
};
const ANSWER = (event: string, answer: string) => `export default {
  name: 'fixture-${event}',
  tier: 'user',
  patterns: [{pattern: '${event}'}],
  handlers: {'${event}': async (input, next) => (${answer})},
};
`;

const tool = (out: string, fail = false): ToolDefinition => ({
  readOnly: false,
  schema: { name: 'probe', description: 'returns a fixed string', input_schema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] } },
  execute: async () => { if (fail) throw new Error('the fixture tool fails'); return out; },
});

// (a) a module rewrites the tool's result through classic.PostToolUse.
clearChainRecords();
const rewriteRun = createChainRun();
const rewritePath = moduleFile(ANSWER('classic.PostToolUse', `{updatedToolOutput: 'rewritten by the fixture', additionalContexts: ['ctx from the fixture']}`));
const rewrite = await loadChainModuleFileInto(rewriteRun, { pluginName: 'fixture-post', modulePath: rewritePath });
try {
  const tools = [tool('the original output')];
  const session = Session.open(ws, { config: config(tools) });
  const agent = new Agent(session, new FakeProvider([
    serverMessage([{ type: 'tool_use', id: 't1', name: 'probe', input: { x: 'first' } }], 'tool_use'),
    serverMessage([{ type: 'text', text: 'done' }], 'end_turn'),
  ]), tools);
  await agent.run('go');
  const events = session.events as unknown as { kind: string; result?: { content: unknown } }[];
  console.log('rewrite outputs', JSON.stringify(events.filter((e) => e.kind === 'tool_output' || e.kind === 'tool_result').map((e) => e.result?.content)));
  console.log('messages tail', JSON.stringify(session.messages.slice(-2)));
} finally {
  rewrite.unload();
}

// (b) a module fails a tool through classic.PostToolUseFailure.
clearChainRecords();
const failRun = createChainRun();
const failPath = moduleFile(ANSWER('classic.PostToolUseFailure', `{block: 'the fixture blocks the failure'}`));
const failed = await loadChainModuleFileInto(failRun, { pluginName: 'fixture-failure', modulePath: failPath });
try {
  const tools = [tool('', true)];
  const session = Session.open(ws, { config: config(tools) });
  const agent = new Agent(session, new FakeProvider([
    serverMessage([{ type: 'tool_use', id: 't2', name: 'probe', input: { x: 'first' } }], 'tool_use'),
    serverMessage([{ type: 'text', text: 'done' }], 'end_turn'),
  ]), tools);
  await agent.run('go');
  console.log('failure messages tail', JSON.stringify(session.messages.slice(-2)));
  const errorRun = createChainRun();
  const errorPath = moduleFile(ANSWER('classic.PostToolUseFailure', `{updatedToolOutput: 'rewritten failure'}`));
  const errored = await loadChainModuleFileInto(errorRun, { pluginName: 'fixture-failure-2', modulePath: errorPath });
  try {
    const tools2 = [tool('', true)];
    const session2 = Session.open(ws, { config: config(tools2) });
    const agent2 = new Agent(session2, new FakeProvider([
      serverMessage([{ type: 'tool_use', id: 't3', name: 'probe', input: { x: 'first' } }], 'tool_use'),
      serverMessage([{ type: 'text', text: 'done' }], 'end_turn'),
    ]), tools2);
    await agent2.run('go');
    const results = (session2.events as unknown as { kind: string; result?: { content: unknown; is_error?: boolean } }[])
      .filter((e) => e.kind === 'tool_result');
    console.log('error-path messages', JSON.stringify(session2.messages.slice(-2)));
  } finally {
    errored.unload();
  }
} finally {
  failed.unload();
}
fs.rmSync(ws, { recursive: true, force: true });
