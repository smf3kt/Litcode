import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, assertPaired, defaultConfig } from '../src/agent.js';
import { createInteractionTools } from '../src/interaction-tools.js';
import { interactiveLoop } from '../src/interactive.js';
import type { ModelProvider } from '../src/provider.js';
import { Session } from '../src/session.js';

function message(content: unknown[], stop = 'end_turn'): Anthropic.Message {
  return { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', content,
    stop_reason: stop, usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
const call = (name: string, input: unknown) => message([{ type: 'tool_use', id: name, name, input }], 'tool_use');

for (const approved of [true, false]) {
  test(`interactive question, plan review and findings dispatch through the actual Agent (${approved})`, { timeout: 10_000 }, async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-interaction-runtime-')));
    const tools = createInteractionTools();
    const config = defaultConfig(root, tools); config.model = 'fixture';
    config.permissions = { mode: 'plan', allow: [], deny: [] };
    const session = Session.open(root, { config });
    const input = new PassThrough();
    let text = ''; let step = 0; let answeredQuestion = false; let answeredPlan = false;
    const output = new Writable({ write(chunk, _encoding, done) {
      text += String(chunk);
      if (!answeredQuestion && text.includes('or Other text:')) { answeredQuestion = true; setImmediate(() => input.write('2\n')); }
      if (!answeredPlan && text.includes('Approve this plan?')) { answeredPlan = true; setImmediate(() => input.write(approved ? 'yes\n' : 'no\n')); }
      done();
    } });
    const provider: ModelProvider = { count: async () => 1, complete: async request => {
      assertPaired(request.messages);
      const previous = request.messages.at(-1)!;
      const blocks = typeof previous.content === 'string' ? [] : previous.content;
      const result = blocks.find(block => block.type === 'tool_result') as Anthropic.ToolResultBlockParam | undefined;
      switch (++step) {
        case 1: return call('ask_user_question', { questions: [{ question: 'Which fixture?', options: [
          { label: 'First', description: 'first fixture' }, { label: 'Second', description: 'second fixture' },
        ], multiSelect: false }] });
        case 2: {
          assert.equal(result?.is_error, undefined);
          assert.deepEqual(JSON.parse(String(result!.content)).answers, [{ questionIndex: 0, selected: ['Second'] }]);
          return call('submit_plan', { plan: 'Inspect the selected fixture and report its result.' });
        }
        case 3: {
          assert.equal(result?.is_error, undefined);
          assert.deepEqual(JSON.parse(String(result!.content)), { approved });
          return call('report_findings', { findings: [{ file: 'fixture.ts', line: 3, summary: 'fixture observation', severity: 'info' }] });
        }
        case 4:
          assert.equal(result?.is_error, undefined); setImmediate(() => input.write('/exit\n'));
          return message([{ type: 'text', text: 'finished' }]);
        default: assert.fail('Unexpected task model request');
      }
    } };
    try {
      const running = interactiveLoop(session, provider, { tools, buildTools: () => tools, close: async () => {}, limits: [] },
        { input, output, status: new Writable({ write(_chunk, _encoding, done) { done(); } }), signal: new AbortController().signal });
      input.write('review fixture\n'); await running;
      assert.equal(step, 4); assert.equal(answeredQuestion, true); assert.equal(answeredPlan, true);
      assert.match(text, /info: fixture.ts:3 fixture observation/);
      assertPaired(session.messages);
      assert.equal(fs.readdirSync(path.join(root, '.agent')).some(file => file.endsWith('.lock')), false);
    } finally { input.destroy(); session.close(); fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('headless question tool returns a paired explicit host callback error', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-interaction-headless-')));
  const tools = createInteractionTools(); const config = defaultConfig(root, tools); config.model = 'fixture';
  const session = Session.open(root, { config }); let step = 0;
  const provider: ModelProvider = { count: async () => 1, complete: async request => {
    if (++step === 1) return call('ask_user_question', { questions: [{ question: 'Choose', options: [
      { label: 'A', description: 'first' }, { label: 'B', description: 'second' },
    ], multiSelect: false }] });
    const result = (request.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0]!;
    assert.equal(result.is_error, true); assert.match(String(result.content), /host ask callback is missing/);
    return message([{ type: 'text', text: 'handled' }]);
  } };
  try { await new Agent(session, provider, tools).run('ask'); assertPaired(session.messages); }
  finally { session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
