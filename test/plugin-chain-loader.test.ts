import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {ga} from '../src/plugin-chain-entry.js';
import {chainRecords, clearChainRecords, it} from '../src/plugin-chain-host.js';
import {createChainRun, loadChainModuleFileInto} from '../src/plugin-chain-loader.js';
import {loadChainModuleFile} from '../src/plugin-chain-module-host.js';
import {chainHooked, composerEditRelay} from '../src/plugin-chain-relay.js';
import {promptEditChain} from '../src/plugin-chain-registry.js';
import type {ChainHandler} from '../src/plugin-chain-types.js';

// The loader is copied verbatim from the recovered CLI (src/plugin-chain-loader-source.ts); these
// tests load a real module file through it and drive what it registered. Sources:
// research/ports/W45-chain-runner.md.

/** Writes one plugin hooks module file and returns its path. */
function moduleFile(body: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-loader-'));
  const file = path.join(dir, 'hooks.mjs');
  fs.writeFileSync(file, body);
  return file;
}

/** A module that answers `prompt.edit` by tagging the answer the core produced below it. */
const ANSWERS = `export default {
  name: 'fixture-hooks',
  tier: 'user',
  patterns: [{pattern: 'prompt.edit'}],
  handlers: {'prompt.edit': async (input, next) => ({...await next(input), tag: 'fixture'})},
  interface: {demo: {echo: (value) => 'echo:' + value}},
  press: (name, argument) => ({name, argument}),
};
`;

const ORIGIN = Object.freeze([Object.freeze({kind: 'composer'})]);

function draftEvent() {
  return {text: 'hello world', cursor: 11, start: 6, end: 11, inputText: 'there', origin: ORIGIN, key: 'draft-1'};
}

function core(): ChainHandler {
  return promptEditChain.core as ChainHandler;
}

test('module loader: a plugin module file loads and its handler answers the chain', async () => {
  const modulePath = moduleFile(ANSWERS);
  const run = createChainRun();
  clearChainRecords();
  const loaded = await loadChainModuleFileInto(run, {pluginName: 'fixture-hooks', modulePath});
  try {
    // The label is `D5t`'s: the storage id, which is the plugin's directory, plus the plugin name.
    assert.equal(loaded.record.label, `${path.dirname(modulePath)}+fixture-hooks`);
    assert.equal(loaded.record.name, 'fixture-hooks');
    assert.equal(run.state.environmentCounter, 1);
    assert.ok(it().loadedModules.includes(loaded.record), 'the record joins the loaded module inventory');
    assert.equal(it().moduleSeats.get('fixture-hooks'), 'user');

    const answer: any = await ga('prompt.edit', {core: {'prompt.edit': core()}})(draftEvent());
    // The core spliced the raised text and the module above it kept its own tag.
    assert.equal(answer.text, 'hello there');
    assert.equal(answer.tag, 'fixture');
  } finally {
    loaded.unload();
  }
  assert.equal(it().loadedModules.length, 0, 'unload takes the record back off the inventory');
});

test('module loader: registered patterns are checked against the module scan and the catalog', async () => {
  const run = createChainRun();
  // The module has no handler for the event it registers: the scan does not see it, so the load is
  // refused with the copied host check's message.
  const unseen = moduleFile(`export default {
  name: 'unseen', patterns: [{pattern: 'prompt.submit'}], handlers: {'prompt.edit': (input) => input},
};
`);
  await assert.rejects(
    () => loadChainModuleFileInto(run, {pluginName: 'unseen', modulePath: unseen}),
    /unseen: registered prompt\.submit, which the scan of its hooks module did not see \(host check\)/,
  );

  // A name the catalog does not carry is refused before that, with the pattern problem in front.
  const unknown = moduleFile(`export default {
  name: 'unknown', patterns: [{pattern: 'not a name'}], handlers: {'not a name': (input) => input},
};
`);
  await assert.rejects(
    () => loadChainModuleFileInto(run, {pluginName: 'unknown', modulePath: unknown}),
    /unknown: registered "not a name" is not an event name or a pattern/,
  );
});

test('module loader: a pattern that cannot be a noun is reported and its hook never runs', async () => {
  const run = createChainRun();
  clearChainRecords();
  const noun = moduleFile(`export default {
  name: 'noun', patterns: [{pattern: '__proto__.x'}], handlers: {'__proto__.x': async (input, next) => ({...await next(input), text: 'NOUN RAN'})},
};
`);
  const loaded = await loadChainModuleFileInto(run, {pluginName: 'noun', modulePath: noun});
  try {
    const warnings = chainRecords().filter((r) => r.kind === 'log' && r.message.includes('cannot be a noun'));
    assert.deepEqual(
      warnings.map((r) => (r as {message: string}).message),
      ['noun: registered __proto__.x; that name cannot be a noun, so this hook is never run'],
    );
    const answer: any = await ga('prompt.edit', {core: {'prompt.edit': core()}})(draftEvent());
    // The handler would have replaced the text had it run, so the core's own answer is the proof.
    assert.equal(answer.text, 'hello there', 'the noun hook did not run');
    assert.equal(answer.text.includes('NOUN RAN'), false);
  } finally {
    loaded.unload();
  }
});

test('module loader: an interface call and a press reach the module', async () => {
  const run = createChainRun();
  const modulePath = moduleFile(ANSWERS);
  const loaded = await loadChainModuleFileInto(run, {pluginName: 'fixture-hooks', modulePath});
  const record = loaded.record as any;
  assert.equal(await record.callInterface({owner: 'app', name: 'demo', method: 'echo', args: ['x']}), 'echo:x');
  await assert.rejects(
    () => record.callInterface({owner: 'app', name: 'demo', method: 'missing', args: []}),
    /\$demo\.missing is not an interface the module fixture-hooks answers/,
  );
  assert.deepEqual(await record.press('ui.press', {key: 'a'}), {name: 'ui.press', argument: {key: 'a'}});

  loaded.unload();
  // The copied `w3` gate answers an unloaded environment with the loader's own message.
  await assert.rejects(() => record.callInterface({owner: 'app', name: 'demo', method: 'echo', args: ['x']}),
    new RegExp(`hooks module ${loaded.record.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} unloaded`));
});

test('module loader: a second load gets a fresh environment and the first record stays dead', async () => {
  const run = createChainRun();
  const modulePath = moduleFile(ANSWERS);
  const first = await loadChainModuleFileInto(run, {pluginName: 'fixture-hooks', modulePath});
  const second = await loadChainModuleFileInto(run, {pluginName: 'fixture-hooks', modulePath});
  try {
    assert.deepEqual([first.record.environmentId, second.record.environmentId], [1, 2]);
    assert.equal(run.state.environmentArgs.size, 2);
  } finally {
    first.unload();
    second.unload();
  }
  assert.equal(run.state.environmentArgs.size, 0, 'both environments are gone from the run');
  // The removal path is the source's plugin-removal one: retired, then unloaded once idle.
  assert.deepEqual((first.record as any).status(), {kind: 'unloaded', retired: true});
});

test('module loader: two loaded modules answer one dispatch, folded in load order', async () => {
  const run = createChainRun();
  clearChainRecords();
  // The first module only tags what it gets; the second raises the replacement text the core below
  // splices. Both run in the one dispatch the hop sends, so the answer carries the tag *and* the
  // spliced text — which only the second module can produce, since the event this call hands the
  // core carries no `inputText`.
  const tagging = await loadChainModuleFileInto(run, {pluginName: 'fixture-tag', modulePath: moduleFile(`export default {
  name: 'fixture-tag',
  tier: 'user',
  patterns: [{pattern: 'prompt.edit'}],
  handlers: {'prompt.edit': async (input, next) => ({...await next(input), tag: 'tagged'})},
};
`)});
  const rewriting = await loadChainModuleFileInto(run, {pluginName: 'fixture-rewrite', modulePath: moduleFile(`export default {
  name: 'fixture-rewrite',
  tier: 'user',
  patterns: [{pattern: 'prompt.edit'}],
  handlers: {'prompt.edit': (input, next) => next({...input, inputText: 'there'})},
};
`)});
  try {
    const answer: any = await ga('prompt.edit', {core: {'prompt.edit': core()}})({...draftEvent(), inputText: ''});
    assert.equal(answer.text, 'hello there', "the second module's rewrite reached the core below it");
    assert.equal(answer.tag, 'tagged', 'the first module answered the same dispatch');
    // One hop covered both environments, and it named them in the order they were loaded.
    const settled = chainRecords()
      .filter((r) => r.kind === 'log' && (r as {message: string}).message.includes('settled in'))
      .map((r) => (r as {message: string}).message);
    assert.equal(settled.length, 1, `both modules answer one dispatch: ${JSON.stringify(settled)}`);
    assert.ok(
      settled[0].startsWith(`hooks module ${tagging.record.label}, ${rewriting.record.label} prompt.edit settled in`),
      settled[0],
    );
  } finally {
    tagging.unload();
    rewriting.unload();
  }
});

test('module loader: a loaded module hooks the composer relay', async () => {
  const run = createChainRun();
  // The module that answered has to be the file the loader read, so this one rewrites the raise the
  // way the relay suite's raiser does: it hands the core a replacement `inputText`. The committed
  // draft is then text no literal in this test holds, which is what makes the assertion evidence.
  const modulePath = moduleFile(`export default {
  name: 'fixture-hooks',
  tier: 'user',
  patterns: [{pattern: 'prompt.edit'}],
  handlers: {'prompt.edit': (input, handle) => handle({...input, inputText: 'there'})},
};
`);
  const loaded = await loadChainModuleFileInto(run, {pluginName: 'fixture-hooks', modulePath});
  clearChainRecords();
  let draft = {text: 'hello world', cursor: 11};
  const reports: string[] = [];
  const relay = composerEditRelay({
    read: () => ({...draft}),
    commit: (box) => { draft = {text: box.text, cursor: box.cursor}; },
    report: (message) => { reports.push(message); },
  });
  try {
    assert.equal(chainHooked('prompt.edit'), true, 'the loaded module hooks prompt.edit');
    // The person replaced the span [5,11) of 'hello world'. The composer records an edit that is
    // already in the draft, so the relay's `read()` answers with the person's own `after`.
    draft = {text: 'hello!', cursor: 6};
    relay.record({
      before: {text: 'hello world', cursor: 11},
      after: {text: 'hello!', cursor: 6},
      key: {key: '!', name: '!'},
    });
    await new Promise((resolve) => setImmediate(resolve));
    // The recorded edit alone leaves 'hello!': this draft is the loaded module's rewrite.
    assert.deepEqual(draft, {text: 'hellothere', cursor: 10}, `the loaded module's rewrite landed: ${JSON.stringify(reports)}`);
    const logged = chainRecords().filter((r) => r.kind === 'log').map((r) => (r as {message: string}).message);
    assert.ok(
      logged.some((m) => m.startsWith(`hooks module ${loaded.record.label} prompt.edit settled in`)),
      `the hop through the loaded module is reported: ${JSON.stringify(logged)}`,
    );
  } finally {
    relay.dispose();
    loaded.unload();
  }
  assert.equal(chainHooked('prompt.edit'), false, 'unloading the module unhooks the relay again');
});

test('module loader: the file reader names a module without a name after its file', async () => {
  const modulePath = moduleFile(`export default {handlers: {'ui.render': (input) => input}};\n`);
  const {module, hookEvents} = await loadChainModuleFile(modulePath);
  assert.equal(module.name, 'hooks');
  assert.equal(module.modulePath, modulePath);
  assert.deepEqual(hookEvents, ['ui.render']);
  assert.equal(module.hooks('ui.render'), true);
  assert.equal(module.hooks('prompt.edit'), false);
});
