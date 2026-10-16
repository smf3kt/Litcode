import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import '../src/plugin-chain-registry.js';
import { clearChainRecords, it } from '../src/plugin-chain-host.js';
import { createChainRun, loadChainModuleFileInto } from '../src/plugin-chain-loader.js';
import {
  classicEventHooked,
  classicEventRaised,
  classicHookInput,
  raiseClassicEvent,
} from '../src/plugin-chain-classic-raise.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-16-probe-'));
const file = path.join(dir, 'hooks.mjs');
const body = (answer: string, event = 'classic.PostToolUse') => `export default {
  name: 'fixture-classic',
  tier: 'user',
  patterns: [{pattern: '${event}'}],
  handlers: {'${event}': async (input, next) => (${answer})},
};
`;

console.log('input', JSON.stringify(classicHookInput('PostToolUse', { tool_name: 'probe', tool_input: { x: 1 } })));
console.log('input with session', JSON.stringify(classicHookInput('PostToolUse', { session_id: 's1', cwd: '/w', tool_name: 'probe' })));

clearChainRecords();
console.log('gates before', classicEventRaised('PostToolUse'), classicEventHooked('PostToolUse'), classicEventRaised('PreToolUse'));

const run = createChainRun();
const modulePath = file;
fs.writeFileSync(modulePath, body(`{block: 'the fixture blocks the post event', additionalContexts: ['ctx from the fixture']}`));
const { unload } = await loadChainModuleFileInto(run, { pluginName: 'fixture-classic', modulePath });
try {
  console.log('gates after', classicEventRaised('PostToolUse'), classicEventRaised('PreToolUse'), classicEventHooked('PreToolUse'));
  console.log('loaded', it().loadedModules.map((m: { name: string }) => m.name).join(','));
  const answer = await raiseClassicEvent({
    event: 'PostToolUse',
    hookInput: classicHookInput('PostToolUse', { session_id: 's1', cwd: '/w', tool_name: 'probe', tool_response: 'ok' }),
  });
  console.log('raise', JSON.stringify(answer));
  const records = clearChainRecords();
  console.log('records', JSON.stringify(records));
} finally {
  unload();
}

// A module that answers with a rewritten tool output instead of a block.
const run2 = createChainRun();
const file2 = path.join(dir, 'hooks2.mjs');
fs.writeFileSync(file2, body(`{updatedToolOutput: 'rewritten by the fixture', additionalContexts: ['extra']}`));
const second = await loadChainModuleFileInto(run2, { pluginName: 'fixture-classic-2', modulePath: file2 });
try {
  const answer = await raiseClassicEvent({
    event: 'PostToolUse',
    hookInput: classicHookInput('PostToolUse', { tool_name: 'probe', tool_response: 'ok' }),
  });
  console.log('rewrite answer', JSON.stringify(answer));
} finally {
  second.unload();
}

// The failure event, with nothing hooking it.
console.log('failure gate', classicEventRaised('PostToolUseFailure'));
fs.rmSync(dir, { recursive: true, force: true });
