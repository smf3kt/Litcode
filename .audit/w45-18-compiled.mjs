// W45-18 against the built artifact: the two permission-side classic events, the answer arms the
// approval path folds, and the denial kind that deliberately raises nothing, driven through dist with
// a real fixture module.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Agent, defaultConfig } from '../dist/agent.js';
import { clearChainRecords } from '../dist/plugin-chain-host.js';
import '../dist/plugin-chain-registry.js';
import { createChainRun, loadChainModuleFileInto } from '../dist/plugin-chain-loader.js';
import {
  CLASSIC_PERMISSION_DENIED,
  CLASSIC_PERMISSION_REQUEST,
  classicEventRaised,
  classicHookInput,
} from '../dist/plugin-chain-classic-raise.js';
import { Session } from '../dist/session.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-18-compiled-'));
const moduleFile = (name, event, answer, seen) => {
  const file = path.join(dir, `${name}.mjs`);
  fs.writeFileSync(file, `import fs from 'node:fs';
export default {
  name: '${name}',
  tier: 'user',
  patterns: [{pattern: '${event}'}],
  handlers: {'${event}': async (input, next) => {
    fs.appendFileSync(${JSON.stringify(seen)}, JSON.stringify(input) + '\\n');
    return (${answer});
  }},
};
`);
  return file;
};
const seenInputs = (file) => fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));

assert.equal(CLASSIC_PERMISSION_REQUEST, 'PermissionRequest');
assert.equal(CLASSIC_PERMISSION_DENIED, 'PermissionDenied');
assert.deepEqual(classicHookInput(CLASSIC_PERMISSION_REQUEST, { session_id: 's1', cwd: '/w', tool_name: 'probe', tool_input: { x: '1' } }), {
  session_id: 's1', transcript_path: '', cwd: '/w', hook_event_name: 'PermissionRequest', tool_name: 'probe', tool_input: { x: '1' },
});
assert.equal(classicEventRaised(CLASSIC_PERMISSION_REQUEST), false);
assert.equal(classicEventRaised(CLASSIC_PERMISSION_DENIED), false);

const ws = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w45-18-ws-')));
const tools = [{
  readOnly: false,
  schema: { name: 'probe', description: 'probe', input_schema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] } },
  execute: async (input) => { await new Promise((resolve) => setTimeout(resolve, 12)); return `ran:${JSON.stringify(input)}`; },
}];
const base = { ...defaultConfig(ws, tools), model: 'test-model', system: 'test-system', maxOutputBytes: 64000 };
const askConfig = { ...base, permissions: { mode: 'ask', allow: [], deny: [] } };
const denyConfig = { ...base, permissions: { mode: 'default', allow: [], deny: ['probe'] } };
const provider = () => {
  let turn = 0;
  return {
    complete: async (request, signal, onText) => {
      signal.throwIfAborted();
      if (onText) onText('done');
      if (turn++ > 0) {
        return { id: 'm2', type: 'message', role: 'assistant', model: 'test-model', content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
      }
      return { id: 'm1', type: 'message', role: 'assistant', model: 'test-model', content: [{ type: 'tool_use', id: 't1', name: 'probe', input: { x: '1' } }], stop_reason: 'tool_use', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
    },
    count: async () => 1,
  };
};

// A denial by rule raises nothing, even with the event hooked and its gate open.
clearChainRecords();
const deniedSeen = path.join(dir, 'denied.jsonl');
fs.writeFileSync(deniedSeen, '');
const deniedRun = createChainRun();
const denied = await loadChainModuleFileInto(deniedRun, {
  pluginName: 'fixture-denied',
  modulePath: moduleFile('fixture-denied', 'classic.PermissionDenied', "{additionalContexts: ['unreachable']}", deniedSeen),
});
assert.equal(classicEventRaised(CLASSIC_PERMISSION_DENIED), true);
{
  const session = Session.open(ws, { config: denyConfig });
  await new Agent(session, provider(), tools, { permission: async () => true, status: () => {} }).run('go');
  assert.deepEqual(seenInputs(deniedSeen), []);
  assert.deepEqual(session.messages[2].content.map((block) => [block.content, block.is_error]), [['Tool denied by permission rule: probe', true]]);
}
denied.unload();
assert.equal(classicEventRaised(CLASSIC_PERMISSION_DENIED), false);

// The approval path: each answer arm, and the post input's own `duration_ms`.
for (const [name, answer, expected, prompts] of [
  ['allow', "{permissionRequestResult: {behavior: 'allow'}}", ['ran:{"x":"1"}', undefined], 0],
  ['rewrite', "{permissionRequestResult: {behavior: 'allow', updatedInput: {x: 'rewritten'}}}", ['ran:{"x":"rewritten"}', undefined], 0],
  ['refuse', "{permissionRequestResult: {behavior: 'deny', message: 'the fixture refuses'}}", ['the fixture refuses', true], 0],
  ['bare', "{permissionRequestResult: {behavior: 'deny'}}", ['Permission denied by hook', true], 0],
]) {
  clearChainRecords();
  const seen = path.join(dir, `${name}.jsonl`);
  fs.writeFileSync(seen, '');
  const run = createChainRun();
  const { unload } = await loadChainModuleFileInto(run, {
    pluginName: `fixture-${name}`,
    modulePath: moduleFile(`fixture-${name}`, 'classic.PermissionRequest', answer, seen),
  });
  assert.equal(classicEventRaised(CLASSIC_PERMISSION_REQUEST), true);
  let asked = 0;
  const session = Session.open(ws, { config: askConfig });
  await new Agent(session, provider(), tools, { permission: async () => { asked += 1; return true; }, status: () => {} }).run('go');
  assert.equal(asked, prompts, `${name}: the hook's answer replaces the prompt`);
  assert.equal(classicEventRaised(CLASSIC_PERMISSION_REQUEST), true);
  const observed = seenInputs(seen);
  assert.equal(observed.length, 1, `${name}: the event is raised once`);
  assert.deepEqual(Object.keys(observed[0]).sort(), ['cwd', 'hook_event_name', 'session_id', 'tool_input', 'tool_name', 'transcript_path']);
  assert.equal(observed[0].hook_event_name, 'PermissionRequest');
  assert.deepEqual(session.messages[2].content.map((block) => [block.content, block.is_error]), [expected]);
  unload();
}

// The unhooked path prompts exactly as before, and its post event carries `duration_ms`.
clearChainRecords();
let asked = 0;
{
  const session = Session.open(ws, { config: askConfig });
  await new Agent(session, provider(), tools, { permission: async () => { asked += 1; return true; }, status: () => {} }).run('go');
  assert.equal(asked, 1);
}
const postSeen = path.join(dir, 'post.jsonl');
fs.writeFileSync(postSeen, '');
const postRun = createChainRun();
const post = await loadChainModuleFileInto(postRun, {
  pluginName: 'fixture-post',
  modulePath: moduleFile('fixture-post', 'classic.PostToolUse', '{}', postSeen),
});
{
  const session = Session.open(ws, { config: askConfig });
  await new Agent(session, provider(), tools, { permission: async () => true, status: () => {} }).run('go');
  const [observed] = seenInputs(postSeen);
  assert.deepEqual(Object.keys(observed).sort(), ['cwd', 'duration_ms', 'hook_event_name', 'session_id', 'tool_input', 'tool_name', 'tool_response', 'tool_use_id', 'transcript_path']);
  assert.equal(typeof observed.duration_ms, 'number');
  assert.ok(observed.duration_ms >= 10, `duration_ms covers the tool call: ${observed.duration_ms}`);
  assert.equal(observed.tool_response, 'ran:{"x":"1"}');
}
post.unload();

fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(ws, { recursive: true, force: true });
console.log('W45PermissionCompiled.v1');
