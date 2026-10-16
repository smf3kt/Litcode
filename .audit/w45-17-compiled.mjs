// W45-17 against the built artifact: the classic PostToolBatch raise on the batch boundary, its hook
// input and the source's end-turn discard rule, driven through dist with a real fixture module.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Agent, defaultConfig } from '../dist/agent.js';
import { clearChainRecords } from '../dist/plugin-chain-host.js';
import '../dist/plugin-chain-registry.js';
import { createChainRun, loadChainModuleFileInto } from '../dist/plugin-chain-loader.js';
import {
  CLASSIC_POST_TOOL_BATCH,
  classicEventRaised,
  classicHookInput,
  raiseClassicEvent,
} from '../dist/plugin-chain-classic-raise.js';
import { Session } from '../dist/session.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-17-compiled-'));
const moduleFile = (name, answer) => {
  const file = path.join(dir, `${name}.mjs`);
  fs.writeFileSync(file, `export default {
  name: '${name}',
  tier: 'user',
  patterns: [{pattern: 'classic.PostToolBatch'}],
  handlers: {'classic.PostToolBatch': async (input, next) => (${answer})},
};
`);
  return file;
};

assert.equal(CLASSIC_POST_TOOL_BATCH, 'PostToolBatch');
assert.deepEqual(classicHookInput(CLASSIC_POST_TOOL_BATCH, {
  session_id: 's1', cwd: '/w',
  tool_calls: [{ tool_name: 'alpha', tool_input: { x: '1' }, tool_use_id: 't1', tool_response: 'out:alpha:1' }],
}), {
  session_id: 's1', transcript_path: '', cwd: '/w', hook_event_name: 'PostToolBatch',
  tool_calls: [{ tool_name: 'alpha', tool_input: { x: '1' }, tool_use_id: 't1', tool_response: 'out:alpha:1' }],
});
assert.equal(classicEventRaised(CLASSIC_POST_TOOL_BATCH), false);

const ws = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w45-17-ws-')));
const tools = ['alpha', 'beta'].map((name) => ({
  readOnly: false,
  schema: { name, description: name, input_schema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] } },
  execute: async (input) => `out:${name}:${String(input.x)}`,
}));
const config = { ...defaultConfig(ws, tools), model: 'test-model', system: 'test-system', maxOutputBytes: 64000 };
const provider = () => {
  let turn = 0;
  return {
    complete: async (request, signal, onText) => {
      signal.throwIfAborted();
      if (onText) onText('done');
      if (turn++ > 0) {
        return { id: 'm2', type: 'message', role: 'assistant', model: 'test-model', content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
      }
      return { id: 'm1', type: 'message', role: 'assistant', model: 'test-model', content: tools.map((tool, index) =>
        ({ type: 'tool_use', id: `t${index + 1}`, name: tool.schema.name, input: { x: String(index + 1) } })), stop_reason: 'tool_use', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
    },
    count: async () => 1,
  };
};

clearChainRecords();
const run = createChainRun();
const { unload } = await loadChainModuleFileInto(run, {
  pluginName: 'fixture-batch',
  modulePath: moduleFile('fixture-batch', "{block: 'the fixture blocks the batch', additionalContexts: [JSON.stringify(input.tool_calls)]}"),
});
assert.equal(classicEventRaised(CLASSIC_POST_TOOL_BATCH), true);

const raised = await raiseClassicEvent({
  event: CLASSIC_POST_TOOL_BATCH,
  hookInput: classicHookInput(CLASSIC_POST_TOOL_BATCH, { tool_calls: [{ tool_name: 'alpha', tool_input: { x: '1' }, tool_use_id: 't1', tool_response: 'out:alpha:1' }] }),
});
assert.deepEqual(raised.records, [{ command: 'classic.PostToolBatch hook', succeeded: false, output: 'the fixture blocks the batch', blocked: true }]);
assert.equal(raised.block, 'the fixture blocks the batch');

const session = Session.open(ws, { config });
const status = [];
const agent = new Agent(session, provider(), tools, { status: (text) => { status.push(text); } });
const outcome = await agent.run('go');
assert.equal(outcome.reason, 'end_turn');
assert.deepEqual(status.filter((line) => line.includes('PostToolBatch')), [
  '[end-turn] PostToolBatch block discarded (turn ended by tool result, no model re-invoke): preventContinuation',
]);
const context = session.messages.filter((message) => Array.isArray(message.content) &&
  message.content.some((block) => block.type === 'text' && block.text?.startsWith('Hook context:')));
assert.deepEqual(context.map((message) => message.content.map((block) => block.text)), [
  ['Hook context:\n' + JSON.stringify([
    { tool_name: 'alpha', tool_input: { x: '1' }, tool_use_id: 't1', tool_response: 'out:alpha:1' },
    { tool_name: 'beta', tool_input: { x: '2' }, tool_use_id: 't2', tool_response: 'out:beta:2' },
  ])],
]);
assert.deepEqual(session.messages[2].content.map((block) => block.content), ['out:alpha:1', 'out:beta:2']);
unload();

// The gate again, unhooked.
assert.equal(classicEventRaised(CLASSIC_POST_TOOL_BATCH), false);
const idleSession = Session.open(ws, { config });
const idleStatus = [];
await new Agent(idleSession, provider(), tools, { status: (text) => { idleStatus.push(text); } }).run('go');
assert.deepEqual(idleStatus.filter((line) => line.includes('PostToolBatch')), []);

fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(ws, { recursive: true, force: true });
console.log('W45PostToolBatchCompiled.v1');
