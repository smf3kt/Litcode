// W45-20 against the built artifact: the module-to-host call path from dist, with a real fixture
// module on disk — the floor a call no module hooks runs, the answer a hooked module wins with, the
// denial text, the copier's repair of a lone surrogate on the twelve `Cme` names, and the entry
// path's copy for the four `_yt` names.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ga } from '../dist/plugin-chain-entry.js';
import { clearChainRecords } from '../dist/plugin-chain-host.js';
import '../dist/plugin-chain-registry.js';
import { createChainRun, loadChainModuleFileInto } from '../dist/plugin-chain-loader.js';
import { hostCallCopied, raiseHostCall } from '../dist/plugin-chain-host-call.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-20-compiled-'));
const moduleFile = (name, event, answer) => {
  const file = path.join(dir, `${name}.mjs`);
  fs.writeFileSync(file, `export default {
  name: '${name}',
  tier: 'user',
  patterns: [{pattern: '${event}'}],
  handlers: {'${event}': async (input, next) => (${answer})},
};
`);
  return file;
};

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const caller = { plugin: 'fixture-host-call', origin: ORIGIN };
const seen = [];
const floor = {
  check: (args) => (typeof args?.text === 'string' ? undefined : 'takes a string text'),
  run: (args) => {
    seen.push(args);
    return 'floor';
  },
};

clearChainRecords();
const args = { text: 'hello', nested: { deep: 1 } };
assert.equal(await raiseHostCall({ event: 'ui.log', args, caller, bottom: floor }), 'floor');
assert.equal(seen.at(-1), args, 'no handler: the floor runs with the caller\'s own argument');

assert.equal(hostCallCopied('ui.log'), true);
assert.equal(hostCallCopied('prompt.read'), false);

const hooked = createChainRun();
const { unload } = await loadChainModuleFileInto(hooked, {
  pluginName: 'fixture-answer',
  modulePath: moduleFile('fixture-answer', 'ui.log', "{value: 'from-hook'}"),
});
try {
  assert.equal(await raiseHostCall({ event: 'ui.log', args, caller, bottom: floor }), 'from-hook');
  assert.equal(seen.length, 1, 'a hooked name never reaches the floor');
} finally {
  unload();
}

const passthrough = createChainRun();
const { unload: unloadPassthrough } = await loadChainModuleFileInto(passthrough, {
  pluginName: 'fixture-passthrough',
  modulePath: moduleFile('fixture-passthrough', 'ui.log', 'await next(input)'),
});
try {
  const lone = { text: 'he\ud800llo', nested: { deep: 1 } };
  await raiseHostCall({ event: 'ui.log', args: lone, caller, bottom: floor });
  assert.notEqual(seen.at(-1), lone);
  assert.equal(seen.at(-1).text, 'he�llo');
  assert.equal(lone.text, 'he\ud800llo');
  assert.equal(seen.at(-1).nested, lone.nested);
  const wellFormed = { text: 'hello' };
  await raiseHostCall({ event: 'ui.log', args: wellFormed, caller, bottom: floor });
  assert.equal(seen.at(-1), wellFormed);
  await assert.rejects(
    () => raiseHostCall({
      event: 'ui.log', args: { text: 'x' }, caller,
      bottom: { check: () => 'takes a string text', run: () => 'unreachable' },
    }),
    /HooksError: ui\.log: takes a string text \(host check\)/,
  );
} finally {
  unloadPassthrough();
}

const denier = createChainRun();
const { unload: unloadDenier } = await loadChainModuleFileInto(denier, {
  pluginName: 'fixture-deny',
  modulePath: moduleFile('fixture-deny', 'ui.log', "{deny: 'the plugin refused this write'}"),
});
try {
  await assert.rejects(
    () => raiseHostCall({ event: 'ui.log', args, caller, bottom: floor }),
    /HooksError: fixture-host-call: \$\.ui\.log: the plugin refused this write/,
  );
} finally {
  unloadDenier();
}

clearChainRecords();
const answer = { label: 'Theme', description: 'the colour \ud800 scheme', isHidden: false };
const core = { name: 'core', tier: 'core', run: async () => answer };
const copied = await ga('config.describe', { origin: ORIGIN, core: { 'config.describe': core } })({ key: 'theme' });
assert.notEqual(copied, answer);
assert.equal(copied.description, 'the colour � scheme');
assert.equal(answer.description, 'the colour \ud800 scheme');

const plain = { text: 'plain', cursor: 5 };
const outside = await ga('prompt.edit', { origin: ORIGIN, core: { 'prompt.edit': { ...core, run: async () => plain } } })({ text: 'x' });
assert.equal(outside, plain);

fs.rmSync(dir, { recursive: true, force: true });
console.log('W45HostCallCompiled.v1');
