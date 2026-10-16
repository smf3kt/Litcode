// W45-16 against the built artifact: the generic classic raise, its gates and its record fold, driven
// through dist with real fixture modules, and then through the agent's own tool path.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Agent, defaultConfig } from '../dist/agent.js';
import { clearChainRecords } from '../dist/plugin-chain-host.js';
import '../dist/plugin-chain-registry.js';
import { createChainRun, loadChainModuleFileInto } from '../dist/plugin-chain-loader.js';
import {
  classicEventHooked,
  classicEventRaised,
  classicHookInput,
  raiseClassicEvent,
} from '../dist/plugin-chain-classic-raise.js';
import { Session } from '../dist/session.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-16-compiled-'));
const moduleFile = (name, body, pattern) => {
  const file = path.join(dir, `${name}.mjs`);
  fs.writeFileSync(file, `export default {
  name: '${name}',
  tier: 'user',
  patterns: [{pattern: '${pattern}'}],
  handlers: {'${pattern}': async (input, next) => (${body})},
};
`);
  return file;
};

assert.deepEqual(classicHookInput('PostToolUse', { tool_name: 'probe', tool_input: { x: 1 } }),
  { session_id: '', transcript_path: '', cwd: '', tool_name: 'probe', tool_input: { x: 1 }, hook_event_name: 'PostToolUse' });
assert.deepEqual(classicHookInput('PostToolUse', { session_id: 's1', cwd: '/w', tool_name: 'probe' }),
  { session_id: 's1', transcript_path: '', cwd: '/w', tool_name: 'probe', hook_event_name: 'PostToolUse' });
assert.equal(classicEventRaised('PostToolUse'), false);

clearChainRecords();
const run = createChainRun();
const other = await loadChainModuleFileInto(run, { pluginName: 'other', modulePath: moduleFile('other', '{ok: true}', 'prompt.edit') });
assert.equal(classicEventRaised('PostToolUse'), false);
assert.equal(classicEventHooked('PostToolUse'), false);
other.unload();

const blockRun = createChainRun();
const blocked = await loadChainModuleFileInto(blockRun, {
  pluginName: 'fixture-block',
  modulePath: moduleFile('fixture-block', "{block: 'the fixture blocks the post event', additionalContexts: ['ctx from the fixture']}", 'classic.PostToolUse'),
});
assert.equal(classicEventRaised('PostToolUse'), true);
assert.equal(classicEventRaised('PreToolUse'), false);
const raising = await raiseClassicEvent({ event: 'PostToolUse', hookInput: classicHookInput('PostToolUse', { tool_name: 'probe' }) });
assert.deepEqual(raising.records, [
  { command: 'classic.PostToolUse hook', succeeded: false, output: 'the fixture blocks the post event', blocked: true },
]);
assert.equal(raising.block, 'the fixture blocks the post event');
assert.deepEqual(raising.answer, { block: 'the fixture blocks the post event', additionalContexts: ['ctx from the fixture'] });
blocked.unload();

const rewriteRun = createChainRun();
const rewrite = await loadChainModuleFileInto(rewriteRun, {
  pluginName: 'fixture-rewrite',
  modulePath: moduleFile('fixture-rewrite', "{updatedToolOutput: 'rewritten by the fixture', additionalContexts: ['extra']}", 'classic.PostToolUse'),
});
const rewritten = await raiseClassicEvent({ event: 'PostToolUse', hookInput: classicHookInput('PostToolUse', { tool_name: 'probe' }) });
assert.deepEqual(rewritten.records, []);
assert.equal(rewritten.block, undefined);
rewrite.unload();

const ws = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w45-16-ws-')));
const tools = (execute) => [{
  readOnly: false,
  schema: { name: 'probe', description: 'probe', input_schema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] } },
  execute,
}];
const config = (list) => ({ ...defaultConfig(ws, list), model: 'test-model', system: 'test-system', maxOutputBytes: 64000 });
const provider = (id) => {
  let turn = 0;
  return {
    complete: async (request, signal, onText) => {
      signal.throwIfAborted();
      if (onText) onText('done');
      if (turn++ > 0) {
        return { id: 'm2', type: 'message', role: 'assistant', model: 'test-model', content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
      }
      return { id: 'm1', type: 'message', role: 'assistant', model: 'test-model', content: [{ type: 'tool_use', id, name: 'probe', input: { x: 'first' } }], stop_reason: 'tool_use', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
    },
    count: async () => 1,
  };
};

clearChainRecords();
const postRun = createChainRun();
const post = await loadChainModuleFileInto(postRun, {
  pluginName: 'fixture-post',
  modulePath: moduleFile('fixture-post', "{updatedToolOutput: 'rewritten by the fixture', additionalContexts: ['ctx from the fixture']}", 'classic.PostToolUse'),
});
const okTools = tools(async () => 'the original output');
const okSession = Session.open(ws, { config: config(okTools) });
await new Agent(okSession, provider('t1'), okTools).run('go');
assert.deepEqual(okSession.messages.at(-2), { role: 'user', content: [
  { type: 'tool_result', tool_use_id: 't1', content: 'rewritten by the fixture' },
  { type: 'text', text: 'Hook context:\nctx from the fixture' },
] });
post.unload();

clearChainRecords();
const failureRun = createChainRun();
const failure = await loadChainModuleFileInto(failureRun, {
  pluginName: 'fixture-failure',
  modulePath: moduleFile('fixture-failure', "{block: 'the fixture blocks the failure'}", 'classic.PostToolUseFailure'),
});
const failTools = tools(async () => { throw new Error('the fixture tool fails'); });
const failSession = Session.open(ws, { config: config(failTools) });
await new Agent(failSession, provider('t2'), failTools).run('go');
assert.deepEqual(failSession.messages.at(-2), { role: 'user', content: [
  { type: 'tool_result', tool_use_id: 't2', content: 'the fixture tool fails', is_error: true },
  { type: 'text', text: 'Hook context:\nthe fixture blocks the failure' },
] });
failure.unload();

fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(ws, { recursive: true, force: true });
console.log('W45ClassicRaiseCompiled.v1');
