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

const ws = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w45-17-agent-')));
const config = (tools: ToolDefinition[]): SessionConfig => {
  const base = defaultConfig(ws, tools);
  return { ...base, model: 'test-model', system: 'test-system', maxOutputBytes: 64_000 };
};
const moduleFile = (answer: string) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-17-mod-'));
  const file = path.join(dir, 'hooks.mjs');
  fs.writeFileSync(file, `export default {
  name: 'fixture-batch',
  tier: 'user',
  patterns: [{pattern: 'classic.PostToolBatch'}],
  handlers: {'classic.PostToolBatch': async (input, next) => (${answer})},
};
`);
  return file;
};

const tools: ToolDefinition[] = ['alpha', 'beta'].map((name) => ({
  readOnly: false,
  schema: { name, description: name, input_schema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] } },
  execute: async (input: Record<string, unknown>) => `out:${name}:${String((input as { x?: string }).x)}`,
}));

const run = createChainRun();
const { unload } = await loadChainModuleFileInto(run, {
  pluginName: 'fixture-batch',
  modulePath: moduleFile("{block: 'the fixture blocks the batch', additionalContexts: ['batch ctx']}"),
});
try {
  const session = Session.open(ws, { config: config(tools) });
  const seen: string[] = [];
  const agent = new Agent(session, new FakeProvider([
    serverMessage([
      { type: 'tool_use', id: 't1', name: 'alpha', input: { x: '1' } },
      { type: 'tool_use', id: 't2', name: 'beta', input: { x: '2' } },
    ], 'tool_use'),
    serverMessage([{ type: 'text', text: 'done' }], 'end_turn'),
  ]), tools, { status: (text: string) => { seen.push(text); } });
  const returned = await agent.run('go');
  console.log('status lines', JSON.stringify(seen.filter((line) => line.includes('PostToolBatch'))));
  console.log('run result', JSON.stringify(returned).slice(0, 200));
  const messages = session.messages as unknown as { role: string; content: unknown }[];
  console.log('messages', JSON.stringify(messages.slice(0, 4)));
} finally {
  unload();
}
clearChainRecords();
fs.rmSync(ws, { recursive: true, force: true });
