// The two permission-side classic events. Both are read out of the source before anything is wired:
// `dze` (chunk-sfn1dbxq.js [3063858,3064190), input schema `aK` chunk-r2vtj1kh.js [192753,192908),
// answer schema chunk-n3ykh62m.js [395544,395771), consumed by `sxr` [3317869,3319984)) is raised on
// the approval path, and `I9r` ([3063491,3063858)) is raised for exactly one denial kind — the
// auto-mode classifier's ([2288685,2289127)) — which this product has no counterpart for.

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
  CLASSIC_PERMISSION_DENIED,
  CLASSIC_PERMISSION_REQUEST,
  classicEventRaised,
  classicHookInput,
} from '../src/plugin-chain-classic-raise.js';
import { Session, type SessionConfig } from '../src/session.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolDefinition } from '../src/tools.js';

type Req = Parameters<ModelProvider['complete']>[0];
type Res = Awaited<ReturnType<ModelProvider['complete']>>;

const tempDirs: string[] = [];
function tmpDir(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccrev-classic-permission-')));
  tempDirs.push(dir);
  return dir;
}
function tempFile(name: string): string {
  const file = path.join(tmpDir(), name);
  fs.writeFileSync(file, '');
  return file;
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

const probeTool = (execute: ToolDefinition['execute']): ToolDefinition => ({
  readOnly: false,
  schema: { name: 'probe', description: 'a probe', input_schema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] } },
  execute,
});

/** The approval path of `permissions.mode === 'ask'` with nothing pre-allowed. */
function askConfig(workspace: string, tools: ToolDefinition[]): SessionConfig {
  return { ...defaultConfig(workspace, tools), model: 'test-model', system: 'test-system', maxOutputBytes: 64_000,
    permissions: { mode: 'ask', allow: [], deny: [] } };
}

function denyConfig(workspace: string, tools: ToolDefinition[]): SessionConfig {
  return { ...defaultConfig(workspace, tools), model: 'test-model', system: 'test-system', maxOutputBytes: 64_000,
    permissions: { mode: 'default', allow: [], deny: ['probe'] } };
}

/** Writes one plugin hooks module that answers a single classic event and appends every input it was
 *  handed to `seen`, so "did not fire" is distinguishable from "fired with nothing observable". */
function moduleFile(event: string, answer: string, seen: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'classic-permission-mod-'));
  const file = path.join(dir, 'hooks.mjs');
  fs.writeFileSync(file, `import fs from 'node:fs';
export default {
  name: 'fixture-classic-permission',
  tier: 'user',
  patterns: [{pattern: '${event}'}],
  handlers: {'${event}': async (input, next) => {
    fs.appendFileSync(${JSON.stringify(seen)}, JSON.stringify(input) + '\\n');
    return (${answer});
  }},
};
`);
  return file;
}

const seenInputs = (file: string): Record<string, unknown>[] =>
  fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);

test('classic permission: the events carry the source\'s own input fields', async () => {
  clearChainRecords();
  const seen = tempFile('post.jsonl');
  const workspace = tmpDir();
  const tools = [probeTool(async () => { await new Promise((resolve) => setTimeout(resolve, 12)); return 'the original output'; })];

  // `fe` sets the session context first, spreads the payload over it and names the event last; `aK`
  // declares `{hook_event_name, tool_name, tool_input, permission_suggestions?, mcp_server?}` and no
  // `tool_use_id`, and this product sends neither optional field.
  assert.deepEqual(Object.keys(classicHookInput(CLASSIC_PERMISSION_REQUEST, { tool_name: 'probe', tool_input: { x: '1' } })),
    ['session_id', 'transcript_path', 'cwd', 'tool_name', 'tool_input', 'hook_event_name']);

  // The gates on both events answer before any module exists, and the PermissionDenied gate can open
  // on its own — the raise is simply never called, because the source calls it only for an auto-mode
  // classifier denial and this product has no classifier.
  assert.equal(classicEventRaised(CLASSIC_PERMISSION_REQUEST), false);
  assert.equal(classicEventRaised(CLASSIC_PERMISSION_DENIED), false);

  const run = createChainRun();
  const { unload } = await loadChainModuleFileInto(run, { pluginName: 'fixture-post', modulePath: moduleFile('classic.PostToolUse', '{}', seen) });
  try {
    const session = Session.open(workspace, { config: askConfig(workspace, tools) });
    const agent = new Agent(session, new FakeProvider([
      serverMessage([{ type: 'tool_use', id: 't1', name: 'probe', input: { x: '1' } }], 'tool_use'),
      serverMessage([{ type: 'text', text: 'done' }], 'end_turn'),
    ]), tools, { permission: async () => true, status: () => {} });
    await agent.run('go');
    const [observed] = seenInputs(seen);
    // `Okn`'s input, including `duration_ms` — the source measures the tool's own call, excluding the
    // prompt and the hooks, so the fixture's own sleep is inside it.
    assert.deepEqual(Object.keys(observed!).sort(),
      ['cwd', 'duration_ms', 'hook_event_name', 'session_id', 'tool_input', 'tool_name', 'tool_response', 'tool_use_id', 'transcript_path']);
    assert.equal(observed!.tool_response, 'the original output');
    assert.equal(typeof observed!.duration_ms, 'number');
    assert.ok((observed!.duration_ms as number) >= 10, `duration_ms should cover the tool call: ${String(observed!.duration_ms)}`);
  } finally {
    unload();
  }
});

test('classic permission: PermissionRequest joins the approval path on the source\'s answer arms', async () => {
  const workspace = tmpDir();
  const tools = [probeTool(async (input) => `ran:${JSON.stringify(input)}`)];
  const turns = () => new FakeProvider([
    serverMessage([{ type: 'tool_use', id: 't1', name: 'probe', input: { x: '1' } }], 'tool_use'),
    serverMessage([{ type: 'text', text: 'done' }], 'end_turn'),
  ]);
  const run = async (answer: string): Promise<{ prompts: number; pair: unknown; input: Record<string, unknown> }> => {
    clearChainRecords();
    const seen = tempFile(`request-${answer.length}-${Math.random()}.jsonl`);
    const chainRun = createChainRun();
    const loaded = await loadChainModuleFileInto(chainRun, { pluginName: 'fixture-request', modulePath: moduleFile('classic.PermissionRequest', answer, seen) });
    try {
      let prompts = 0;
      const session = Session.open(workspace, { config: askConfig(workspace, tools) });
      const agent = new Agent(session, turns(), tools, { permission: async () => { prompts += 1; return true; }, status: () => {} });
      await agent.run('go');
      return { prompts, pair: session.messages.at(-2), input: seenInputs(seen)[0]! };
    } finally {
      loaded.unload();
    }
  };

  const allowed = await run(`{permissionRequestResult: {behavior: 'allow'}}`);
  // The hook's allow replaces the prompt, and the tool's own result stands unchanged.
  assert.equal(allowed.prompts, 0);
  assert.deepEqual(allowed.pair, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ran:{"x":"1"}' }] });
  // The module saw the host's own context under the event's fields. The site name is
  // `classic.PermissionRequest` (`FDe`) while the input names the bare event, exactly as `dze`
  // hardcodes `hook_event_name: "PermissionRequest"`.
  assert.equal(allowed.input.hook_event_name, 'PermissionRequest');
  assert.equal(allowed.input.tool_name, 'probe');
  assert.deepEqual(allowed.input.tool_input, { x: '1' });
  assert.equal(allowed.input.tool_use_id, undefined);
  assert.equal(allowed.input.permission_suggestions, undefined);

  // An allow that rewrites the input runs the tool on the rewrite, through the same re-check a
  // rewritten native answer goes through.
  const rewritten = await run(`{permissionRequestResult: {behavior: 'allow', updatedInput: {x: 'rewritten'}}}`);
  assert.equal(rewritten.prompts, 0);
  assert.deepEqual(rewritten.pair, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ran:{"x":"rewritten"}' }] });

  // A deny blocks with its own message…
  const refused = await run(`{permissionRequestResult: {behavior: 'deny', message: 'the fixture refuses'}}`);
  assert.equal(refused.prompts, 0);
  assert.deepEqual(refused.pair, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'the fixture refuses', is_error: true }] });

  // …and with the source's own fallback when there is none (`dze`'s consumer reads
  // `V.message || "Permission denied by hook"`).
  const bare = await run(`{permissionRequestResult: {behavior: 'deny'}}`);
  assert.equal(bare.prompts, 0);
  assert.deepEqual(bare.pair, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'Permission denied by hook', is_error: true }] });

  // With nothing hooking the event the same config still prompts — the raise is the only difference.
  clearChainRecords();
  let prompts = 0;
  const plain = Session.open(workspace, { config: askConfig(workspace, tools) });
  const plainAgent = new Agent(plain, turns(), tools, { permission: async () => { prompts += 1; return true; }, status: () => {} });
  await plainAgent.run('go');
  assert.equal(prompts, 1);
});

test('classic permission: a deny carrying interrupt aborts the turn', async () => {
  const workspace = tmpDir();
  const tools = [probeTool(async () => 'ran')];
  clearChainRecords();
  const seen = tempFile('interrupt.jsonl');
  const chainRun = createChainRun();
  const loaded = await loadChainModuleFileInto(chainRun, { pluginName: 'fixture-interrupt',
    modulePath: moduleFile('classic.PermissionRequest',
      "{permissionRequestResult: {behavior: 'deny', message: 'stop it', interrupt: true}}", seen) });
  const session = Session.open(workspace, { config: askConfig(workspace, tools) });
  const turn = new AbortController();
  const statuses: string[] = [];
  try {
    const agent = new Agent(session, new FakeProvider([
      serverMessage([{ type: 'tool_use', id: 't1', name: 'probe', input: { x: '1' } }], 'tool_use'),
      serverMessage([{ type: 'text', text: 'done' }], 'end_turn'),
    ]), tools, { permission: async () => { throw new Error('the hook answers before the prompt'); },
      interruptTurn: () => turn.abort(new Error('Hook interrupt')), status: text => statuses.push(text) });
    const result = await agent.run('go', turn.signal);
    assert.equal(result.reason, 'aborted');
    // The turn ends before another model request, so the denied batch is the
    // last message.
    assert.deepEqual(session.messages.at(-1), { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 't1', content: 'stop it', is_error: true },
    ] });
    assert.ok(statuses.includes('Hook interrupt: tool=probe hookMessage=stop it'));
  } finally {
    loaded.unload();
  }
});

test('classic permission: a permission-rule denial raises nothing, whatever hooks the event', async () => {
  const workspace = tmpDir();
  const tools = [probeTool(async () => 'ran')];
  clearChainRecords();
  const seen = tempFile('denied.jsonl');
  const run = createChainRun();
  const loaded = await loadChainModuleFileInto(run, { pluginName: 'fixture-denied', modulePath: moduleFile('classic.PermissionDenied', "{additionalContexts: ['the fixture saw the denial']}", seen) });
  try {
    // The gate is open — a module hooks the event — and the raise is still not called: the source's
    // only caller reads the classifier arm of a denial, and this product's denials are rule outcomes.
    assert.equal(classicEventRaised(CLASSIC_PERMISSION_DENIED), true);
    const session = Session.open(workspace, { config: denyConfig(workspace, tools) });
    const agent = new Agent(session, new FakeProvider([
      serverMessage([{ type: 'tool_use', id: 't1', name: 'probe', input: { x: '1' } }], 'tool_use'),
      serverMessage([{ type: 'text', text: 'done' }], 'end_turn'),
    ]), tools, { permission: async () => true, status: () => {} });
    await agent.run('go');
    assert.equal(seenInputs(seen).length, 0, 'a rule denial raises no classic.PermissionDenied');
    assert.deepEqual(session.messages.at(-2), { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 't1', content: 'Tool denied by permission rule: probe', is_error: true },
    ] });
  } finally {
    loaded.unload();
  }
});
