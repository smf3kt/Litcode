import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, assertPaired, defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolDefinition } from '../src/tools.js';

function reply(content: Anthropic.Message['content'], stop: Anthropic.StopReason): Anthropic.Message {
  return { id: 'output-fixture', type: 'message', role: 'assistant', model: 'fixture', content,
    stop_reason: stop, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}

for (const transformed of [false, true]) test(`final text budget bounds ${transformed ? 'post-hook replacement' : 'custom tool output'} before journal and model delivery`, async t => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-output-')));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const original = JSON.stringify({ evidence: '世界'.repeat(2000), tail: 'OMITTED_TAIL' });
  const tool: ToolDefinition = {
    readOnly: true,
    schema: { name: 'fixture_output', description: 'Return fixture evidence.', input_schema: { type: 'object', properties: {}, additionalProperties: false } },
    async execute() { return transformed ? 'small original' : original; },
  };
  const config = { ...defaultConfig(workspace, [tool]), model: 'fixture', maxOutputBytes: 256 };
  if (transformed) {
    const output = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', updatedToolOutput: original } });
    const script = `process.stdout.write(${JSON.stringify(output)})`;
    config.hooks = { PostToolUse: [{ command: `${JSON.stringify(process.execPath)} -e '${script.replaceAll("'", "'\\''")}'` }] };
  }
  let calls = 0;
  const provider: ModelProvider = {
    async count(request) { assertPaired(request.messages); return 1; },
    async complete(request) {
      assertPaired(request.messages);
      if (++calls === 1) return reply([{ type: 'tool_use', id: 'bounded', name: 'fixture_output', input: {}, caller: { type: 'direct' } }], 'tool_use');
      const result = (request.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0]!;
      assert.equal(result.tool_use_id, 'bounded');
      assert.equal(typeof result.content, 'string');
      assert.ok(Buffer.byteLength(result.content as string) <= config.maxOutputBytes);
      const parsed = JSON.parse(result.content as string) as { truncated: boolean; originalBytes: number };
      assert.equal(parsed.truncated, true);
      assert.equal(parsed.originalBytes, Buffer.byteLength(original));
      assert.doesNotMatch(result.content as string, /OMITTED_TAIL/);
      return reply([{ type: 'text', text: 'verified', citations: null }], 'end_turn');
    },
  };
  const session = Session.open(workspace, { config });
  const agent = new Agent(session, provider, [tool]);
  try {
    assert.equal((await agent.run('Inspect the bounded fixture result.')).reason, 'end_turn');
    assert.equal(calls, 2);
    const outputs = session.events.filter(event => event.kind === (transformed ? 'tool_output' : 'tool_result'));
    assert.equal(outputs.length, 1);
    assert.ok(outputs[0]!.kind === 'tool_output' || outputs[0]!.kind === 'tool_result');
    const saved = outputs[0]!.result;
    assert.ok(Buffer.byteLength(saved.content as string) <= config.maxOutputBytes);
    assert.deepEqual(JSON.parse(saved.content as string).truncated, true);
  } finally { session.close(); }
  const resumed = Session.open(workspace, { id: session.id, config });
  try { assertPaired(resumed.messages); assert.equal(resumed.awaitingResponse, false); }
  finally { resumed.close(); }
});
