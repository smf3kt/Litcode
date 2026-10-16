// W45-15 against the built artifact: the classic PreToolUse raise, its gate and its answer mapping,
// driven through dist with a real fixture module, and then through the agent's own tool path.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Agent, defaultConfig } from '../dist/agent.js';
import { clearChainRecords, it } from '../dist/plugin-chain-host.js';
import '../dist/plugin-chain-registry.js';
import { createChainRun, loadChainModuleFileInto } from '../dist/plugin-chain-loader.js';
import {
  CLASSIC_PRE_TOOL_USE,
  classicPreToolUseEnvelope,
  classicPreToolUseHooked,
  newDenialRecord,
  raiseClassicPreToolUse,
  toolCallCores,
} from '../dist/plugin-chain-tool-raise.js';
import { Session } from '../dist/session.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-15-compiled-'));
const moduleFile = (name, body, pattern = 'classic.PreToolUse') => {
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

assert.equal(CLASSIC_PRE_TOOL_USE, 'classic.PreToolUse');
assert.deepEqual(classicPreToolUseEnvelope('Bash', 'toolu_9', { command: 'ls' }),
  { command: 'ls', tool: 'Bash', tool_use_id: 'toolu_9' });
assert.deepEqual(classicPreToolUseEnvelope('Bash', 'toolu_9', { command: 'ls', consent: 'yes', agentId: 'a1', requestMeta: { k: 'v' } }),
  { command: 'ls', tool: 'Bash', tool_use_id: 'toolu_9', $shadowed: { agentId: 'a1', consent: 'yes', requestMeta: { k: 'v' } } });

clearChainRecords();
const run = createChainRun();
const noHooks = await loadChainModuleFileInto(run, { pluginName: 'other', modulePath: moduleFile('other', '{allow: true}', 'prompt.edit') });
// The gate reads the event, so a module hooking something else leaves it closed.
assert.equal(classicPreToolUseHooked(), false);
assert.deepEqual(toolCallCores([{ kind: 'composer' }], newDenialRecord()), {});
await assert.rejects(() => raiseClassicPreToolUse({ tool: 'Bash', toolUseId: 'toolu_1', input: { command: 'ls' } }),
  /no implementation for classic\.PreToolUse/);
noHooks.unload();

const denyRun = createChainRun();
const denied = await loadChainModuleFileInto(denyRun, {
  pluginName: 'fixture-deny',
  modulePath: moduleFile('fixture-deny', "{deny: 'the fixture denies ' + input.tool, additionalContext: ['from the fixture']}"),
});
assert.equal(classicPreToolUseHooked(), true);
const cores = toolCallCores([{ kind: 'composer' }], newDenialRecord());
assert.deepEqual(Object.keys(cores), ['tool.call']);
assert.deepEqual({ ...cores['tool.call'], run: typeof cores['tool.call'].run },
  { name: 'core', isCore: true, budgetMs: 0, run: 'function' });
const raised = await raiseClassicPreToolUse({ tool: 'Bash', toolUseId: 'toolu_1', input: { command: 'ls' }, origin: [{ kind: 'composer' }] });
assert.deepEqual(raised.answer, { deny: 'the fixture denies Bash', additionalContext: ['from the fixture'] });
assert.deepEqual(raised.permission, { permissionBehavior: 'deny', hookPermissionDecisionReason: 'the fixture denies Bash',
  additionalContexts: ['from the fixture'] });
assert.equal(it().loadedModules.length, 1);

const ws = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w45-15-agent-')));
const seen = [];
const tool = {
  readOnly: false,
  schema: { name: 'probe', description: 'records its input', input_schema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] } },
  execute: async (input) => { seen.push(input); return 'ok'; },
};
const script = [
  { id: 'm1', type: 'message', role: 'assistant', model: 'test-model', stop_reason: 'tool_use', stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'tool_use', id: 't1', name: 'probe', input: { x: 'first' } }] },
  { id: 'm2', type: 'message', role: 'assistant', model: 'test-model', stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: 'done' }] },
];
const provider = {
  complete: async () => script.shift(),
  count: async () => 1,
};
const session = Session.open(ws, { config: { ...defaultConfig(ws, [tool]), model: 'test-model', system: 'test-system' } });
await new Agent(session, provider, [tool]).run('go');
assert.deepEqual(seen, [], 'the plugin module’s denial stopped the tool call');
const results = session.events.filter((event) => event.kind === 'tool_result');
assert.match(JSON.stringify(results.at(-1).result.content), /the fixture denies probe/);
denied.unload();

const rewriteRun = createChainRun();
const rewritten = await loadChainModuleFileInto(rewriteRun, {
  pluginName: 'fixture-rewrite',
  modulePath: moduleFile('fixture-rewrite', "{updatedInput: {x: 'rewritten by the fixture'}}"),
});
const script2 = [
  { id: 'm3', type: 'message', role: 'assistant', model: 'test-model', stop_reason: 'tool_use', stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'tool_use', id: 't2', name: 'probe', input: { x: 'second' } }] },
  { id: 'm4', type: 'message', role: 'assistant', model: 'test-model', stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: 'done' }] },
];
const session2 = Session.open(ws, { config: { ...defaultConfig(ws, [tool]), model: 'test-model', system: 'test-system' } });
await new Agent(session2, { complete: async () => script2.shift(), count: async () => 1 }, [tool]).run('go');
assert.deepEqual(seen, [{ x: 'rewritten by the fixture' }], 'the plugin module’s rewrite reached the tool');
rewritten.unload();

fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(ws, { recursive: true, force: true });
console.log('W45ToolRaiseCompiled.v1');
