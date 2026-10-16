// Measures the classic PreToolUse raise through the copied dispatcher with a real fixture module
// loaded, before any assertion is written from it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
// The registry import installs the environment host factory and registers every chain site.
import '../src/plugin-chain-registry.js';
import { createChainRun, loadChainModuleFileInto } from '../src/plugin-chain-loader.js';
import {
  CLASSIC_PRE_TOOL_USE,
  classicPreToolUseEnvelope,
  classicPreToolUseHooked,
  raiseClassicPreToolUse,
  toolCallCores,
  newDenialRecord,
} from '../src/plugin-chain-tool-raise.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-raise-'));
const modulePath = path.join(dir, 'hooks.mjs');
fs.writeFileSync(modulePath, `export default {
  name: 'fixture-raise',
  tier: 'user',
  patterns: [{pattern: 'classic.PreToolUse'}],
  handlers: {'classic.PreToolUse': async (input, next) => ({deny: 'the fixture denies ' + input.tool, updatedInput: {path: '/rewritten'}})},
};
`);

const run = createChainRun();
clearChainRecords();
const loaded = await loadChainModuleFileInto(run, { pluginName: 'fixture-raise', modulePath });
console.log('loaded ->', loaded.record.label);
console.log('hooked ->', classicPreToolUseHooked());
console.log('envelope ->', JSON.stringify(classicPreToolUseEnvelope('Bash', 'toolu_1', {command: 'ls'})));
console.log('cores (hooked) ->', JSON.stringify(toolCallCores([{kind: 'composer'}], newDenialRecord())));
const raised = await raiseClassicPreToolUse({tool: 'Bash', toolUseId: 'toolu_1', input: {command: 'ls'}, origin: [{kind: 'composer'}]});
console.log('answer ->', JSON.stringify(raised.answer));
console.log('permission ->', JSON.stringify(raised.permission));
const noOrigin = await raiseClassicPreToolUse({tool: 'Bash', toolUseId: 'toolu_1', input: {command: 'ls'}});
console.log('answer (no origin) ->', JSON.stringify(noOrigin.answer));
console.log('records ->', JSON.stringify(chainRecords().map((r) => r.kind + ':' + (r.status ?? ''))));
