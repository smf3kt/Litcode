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

const ws = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w45-18-agent-')));
const tool: ToolDefinition = {
  readOnly: false,
  schema: { name: 'probe', description: 'records its input', input_schema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] } },
  execute: async (input) => { await new Promise((resolve) => setTimeout(resolve, 12)); return `ran:${JSON.stringify(input)}`; },
};
const askConfig = (): SessionConfig => ({
  ...defaultConfig(ws, [tool]), model: 'test-model', system: 'test-system', maxOutputBytes: 64_000,
  permissions: { mode: 'ask', allow: [], deny: [] },
});
const denyConfig = (): SessionConfig => ({
  ...defaultConfig(ws, [tool]), model: 'test-model', system: 'test-system', maxOutputBytes: 64_000,
  permissions: { mode: 'default', allow: [], deny: ['probe'] },
});
// A module whose handler records what it saw, so a case can tell "did not fire" from "fired with
// nothing observable".
const moduleFile = (event: string, answer: string, seenFile: string) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-18-mod-'));
  const file = path.join(dir, 'hooks.mjs');
  fs.writeFileSync(file, `import fs from 'node:fs';
export default {
  name: 'fixture-${event}',
  tier: 'user',
  patterns: [{pattern: 'classic.${event}'}],
  handlers: {'classic.${event}': async (input, next) => {
    fs.appendFileSync(${JSON.stringify(seenFile)}, JSON.stringify(input) + '\\n');
    return (${answer});
  }},
};
`);
  return file;
};

const run = (config: SessionConfig, permission = async () => true) => {
  const session = Session.open(ws, { config });
  const agent = new Agent(session, new FakeProvider([
    serverMessage([{ type: 'tool_use', id: 't1', name: 'probe', input: { x: '1' } }], 'tool_use'),
    serverMessage([{ type: 'text', text: 'done' }], 'end_turn'),
  ]), [tool], { permission, status: () => {} });
  return { session, agent };
};
const lines = (file: string) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean) : [];

// (a) a rule deny must not raise classic.PermissionDenied: the source raises it only for an auto-mode
// classifier denial, and this product has no classifier.
{
  clearChainRecords();
  const seen = path.join(os.tmpdir(), `w45-18-denied-${process.pid}.jsonl`);
  const runHandle = createChainRun();
  const loaded = await loadChainModuleFileInto(runHandle, { pluginName: 'fixture-denied', modulePath: moduleFile('PermissionDenied', '{}', seen) });
  try {
    const { session, agent } = run(denyConfig());
    await agent.run('go');
    console.log('(a) rule deny: handler calls', lines(seen).length, 'result', JSON.stringify(session.messages.at(-2)?.content));
  } finally { loaded.unload(); }
}

// (b) PermissionRequest allow: the prompt is skipped and the tool runs.
{
  clearChainRecords();
  const seen = path.join(os.tmpdir(), `w45-18-allow-${process.pid}.jsonl`);
  const runHandle = createChainRun();
  const loaded = await loadChainModuleFileInto(runHandle, { pluginName: 'fixture-allow', modulePath: moduleFile('PermissionRequest', `{permissionRequestResult: {behavior: 'allow'}}`, seen) });
  try {
    let prompts = 0;
    const { session, agent } = run(askConfig(), async () => { prompts += 1; return true; });
    await agent.run('go');
    console.log('(b) allow: prompts', prompts, 'input', JSON.stringify(lines(seen)[0]), 'ran', JSON.stringify(session.messages.at(-2)?.content));
  } finally { loaded.unload(); }
}

// (c) PermissionRequest deny with a message, and the source's own fallback without one.
for (const answer of [`{permissionRequestResult: {behavior: 'deny', message: 'the fixture refuses'}}`, `{permissionRequestResult: {behavior: 'deny'}}`]) {
  clearChainRecords();
  const seen = path.join(os.tmpdir(), `w45-18-deny-${process.pid}-${answer.length}.jsonl`);
  const runHandle = createChainRun();
  const loaded = await loadChainModuleFileInto(runHandle, { pluginName: 'fixture-refuse', modulePath: moduleFile('PermissionRequest', answer, seen) });
  try {
    let prompts = 0;
    const { session, agent } = run(askConfig(), async () => { prompts += 1; return true; });
    await agent.run('go');
    console.log('(c) deny: prompts', prompts, 'result', JSON.stringify(session.messages.at(-2)?.content));
  } finally { loaded.unload(); }
}

// (d) PermissionRequest allow with a rewritten input.
{
  clearChainRecords();
  const seen = path.join(os.tmpdir(), `w45-18-rewrite-${process.pid}.jsonl`);
  const runHandle = createChainRun();
  const loaded = await loadChainModuleFileInto(runHandle, { pluginName: 'fixture-rewrite', modulePath: moduleFile('PermissionRequest', `{permissionRequestResult: {behavior: 'allow', updatedInput: {x: 'rewritten'}}}`, seen) });
  try {
    let prompts = 0;
    const { session, agent } = run(askConfig(), async () => { prompts += 1; return true; });
    await agent.run('go');
    console.log('(d) rewrite: prompts', prompts, 'ran', JSON.stringify(session.messages.at(-2)?.content));
  } finally { loaded.unload(); }
}

// (e) nothing hooked: the same ask config prompts as before.
{
  clearChainRecords();
  let baselinePrompts = 0;
  const { agent } = run(askConfig(), async () => { baselinePrompts += 1; return true; });
  await agent.run('go');
  console.log('(e) baseline prompts', baselinePrompts);
}

// (f) duration_ms on the classic PostToolUse input, and no prompt under the ask config.
{
  clearChainRecords();
  const post = path.join(os.tmpdir(), `w45-18-post-${process.pid}.jsonl`);
  const runHandle = createChainRun();
  const loaded = await loadChainModuleFileInto(runHandle, { pluginName: 'fixture-post', modulePath: moduleFile('PostToolUse', '{}', post) });
  try {
    const { agent } = run(askConfig());
    await agent.run('go');
    const observed = JSON.parse(lines(post)[0] ?? '{}');
    console.log('(f) post keys', JSON.stringify(Object.keys(observed).sort()), 'duration_ms', observed.duration_ms);
  } finally { loaded.unload(); }
}
fs.rmSync(ws, { recursive: true, force: true });
