import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PassThrough, Writable} from 'node:stream';
import {composerEditRelay, chainHooked} from '../src/plugin-chain-relay.js';
import {TuiTerminal} from '../src/tui.js';
// The catalog: importing it is what registers the `prompt.edit` site and core, exactly as the
// product's startup does. The binding is read below so the transform keeps the import — an unread
// import is elided, and the chain would then have no site for the relay to raise into.
import {promptEditChain} from '../src/plugin-chain-registry.js';
import {chainRecords, clearChainRecords, installChainModule} from '../src/plugin-chain-host.js';
import type {ChainHandler, ChainModule, ChainRelayEdit} from '../src/plugin-chain-types.js';

void promptEditChain;

// The relay is copied from the recovered CLI (research/ports/W45-chain-runner.md#slice-3); these
// tests drive it the way the composer does: record edits, let a batch settle, and check what lands
// in the draft when a module raises through the prompt.edit chain.

/** A composer host: a draft, the two optional hooks, and whatever the relay reported. */
function composer(text = 'hello world') {
  let draft = {text, cursor: text.length};
  const reports: string[] = [];
  const painted: string[] = [];
  const relay = composerEditRelay({
    read: () => ({...draft}),
    commit: (box) => { draft = {text: box.text, cursor: box.cursor}; },
    paint: (_decorations, text) => { painted.push(text); },
    report: (message) => { reports.push(message); },
  });
  return {
    relay, reports, painted,
    draft: () => ({...draft}),
    move: (next: string, cursor = next.length) => { draft = {text: next, cursor}; },
    // The composer's key handler records an edit that is already in the draft, so the relay's
    // `read()` returns the person's `after` — which is what the core compares its own rebase against.
    record: (e: ChainRelayEdit) => { draft = {...e.after}; relay.record(e); },
  };
}

function moduleWith(handler: ChainHandler): ChainModule {
  return {
    name: handler.name,
    tier: handler.tier,
    hooks: (event: string) => event === 'prompt.edit',
    record: () => handler,
  };
}

/** One edit recorded the way the composer's key handler records it: the draft before and after, and
 *  the key event that made the change (`Xo` reads `.key`, `.name` and the modifier flags off it). */
const edit = (before: {text: string; cursor: number}, after: {text: string; cursor: number}) => ({
  before, after, key: {name: '', key: 'x', ctrl: false, shift: false, meta: false},
});

test('edit relay: a raising handler lands in the draft', async () => {
  const raiser: ChainHandler = {
    name: 'raiser',
    tier: 'user',
    // A plugin that rewrites: it hands the core an event whose `inputText` replaces the recorded
    // span, so the copied core splices it instead of answering the recorded draft.
    run: async (e: unknown, next: any) => next({...(e as object), inputText: 'there'}),
  };
  const remove = installChainModule(moduleWith(raiser));
  clearChainRecords();
  const host = composer();
  try {
    assert.equal(chainHooked('prompt.edit'), true, 'a loaded module hooks prompt.edit');
    assert.equal(host.relay.isRecording(), true, 'the relay is hooked');

    // The person's own edit: 'hello!' replaced the span [5,11) of 'hello world'.
    host.record(edit({text: 'hello world', cursor: 11}, {text: 'hello!', cursor: 6}));
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(host.draft(), {text: 'hellothere', cursor: 10}, 'the rewrite landed');
    const logged = chainRecords().map((r: any) => r.message).filter(Boolean);
    assert.ok(
      logged.some((m: string) => m.startsWith('hooks module raiser prompt.edit settled in')),
      `the hop is reported: ${JSON.stringify(logged)}`,
    );
  } finally {
    remove();
    host.relay.dispose();
  }
});

test('edit relay: a rewrite that no longer fits reports the reason and keeps the typing', async () => {
  const raiser: ChainHandler = {
    name: 'raiser',
    tier: 'user',
    run: async (e: unknown, next: any) => next({...(e as object), inputText: 'there'}),
  };
  const remove = installChainModule(moduleWith(raiser));
  clearChainRecords();
  const host = composer();
  try {
    // The person keeps typing after the edit was recorded, so the recorded span is no longer where
    // it was when the answer comes back.
    host.record(edit({text: 'hello world', cursor: 11}, {text: 'hello!', cursor: 6}));
    host.move('zzhello world');
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(host.draft(), {text: 'zzhello world', cursor: 13}, 'the typing stands');
    assert.ok(
      host.reports.some((m) => m === 'prompt.edit: a rewrite no longer fits the draft (it moved meanwhile); the person\'s typing stands'),
      `the recorded reason is reported: ${JSON.stringify(host.reports)}`,
    );
  } finally {
    remove();
    host.relay.dispose();
  }
});

test('edit relay: an unloaded prompt.edit relays nothing', async () => {
  clearChainRecords();
  const host = composer();
  try {
    assert.equal(chainHooked('prompt.edit'), false, 'no module hooks prompt.edit');
    assert.equal(host.relay.isRecording(), false, 'the relay is not hooked');
    const logged = chainRecords().map((r: any) => r.message).filter(Boolean);
    assert.ok(
      logged.includes('prompt.edit: unhooked; the composer relays nothing'),
      `the unhooked line is the source's: ${JSON.stringify(logged)}`,
    );
  } finally {
    host.relay.dispose();
  }
});

test('edit relay: a hook installed later hooks the relay, and removing it unhooks again', async () => {
  const quiet: ChainHandler = {
    name: 'quiet',
    tier: 'user',
    run: async (e: unknown, next: any) => next(e),
  };
  clearChainRecords();
  const host = composer();
  try {
    assert.equal(host.relay.isRecording(), false);
    const remove = installChainModule(moduleWith(quiet));
    assert.equal(host.relay.isRecording(), true, 'the source effect re-ran when the module landed');
    remove();
    assert.equal(host.relay.isRecording(), false, 'and again when it left');
  } finally {
    host.relay.dispose();
  }
});

test('edit relay: edits recorded in one batch raise once', async () => {
  const seen: number[] = [];
  const counter: ChainHandler = {
    name: 'counter',
    tier: 'user',
    run: async (e: unknown, next: any) => {
      seen.push(1);
      return next(e);
    },
  };
  const remove = installChainModule(moduleWith(counter));
  clearChainRecords();
  const host = composer();
  try {
    host.record(edit({text: 'a', cursor: 1}, {text: 'ab', cursor: 2}));
    host.record(edit({text: 'ab', cursor: 2}, {text: 'abc', cursor: 3}));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(seen.length, 1, 'the batch settles once');
  } finally {
    remove();
    host.relay.dispose();
  }
});

test('edit relay: dispose in the same tick drops the batch before it raises', async () => {
  let calls = 0;
  const waiter: ChainHandler = {
    name: 'waiter',
    tier: 'user',
    run: async (e: unknown, next: any) => {
      calls += 1;
      return next(e);
    },
  };
  const remove = installChainModule(moduleWith(waiter));
  clearChainRecords();
  const host = composer();
  try {
    host.record(edit({text: 'hello world', cursor: 11}, {text: 'hello!', cursor: 6}));
    host.relay.dispose();
    await new Promise((resolve) => setImmediate(resolve));
    // `record` schedules the settle; `dispose` clears the batch before that microtask runs, so the
    // chain is never asked and nothing lands.
    assert.equal(calls, 0, 'the batch never raised');
    assert.deepEqual(host.draft(), {text: 'hello!', cursor: 6}, 'nothing landed');
  } finally {
    remove();
  }
});

test('edit relay: dispose drops an answer that is still in flight', async () => {  let calls = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const waiter: ChainHandler = {
    name: 'waiter',
    tier: 'user',
    run: async (e: unknown, next: any) => {
      calls += 1;
      await gate;
      return next(e);
    },
  };
  const remove = installChainModule(moduleWith(waiter));
  clearChainRecords();
  const host = composer();
  try {
    host.record(edit({text: 'hello world', cursor: 11}, {text: 'hello!', cursor: 6}));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1, 'the raise started');
    host.relay.dispose();
    release?.();
    await new Promise((resolve) => setImmediate(resolve));
    // The answer arrives after the abort, and the relay drops it rather than committing.
    assert.deepEqual(host.draft(), {text: 'hello!', cursor: 6}, 'the answer was dropped');
  } finally {
    remove();
  }
});

/** The product's composer, driven the way a person drives it: keystrokes into the terminal. */
function terminal() {
  const input = new PassThrough() as PassThrough & {isTTY: boolean; setRawMode: (raw: boolean) => void};
  input.isTTY = true;
  input.setRawMode = () => {};
  const output = new Writable({write(_chunk, _encoding, done) { done(); }});
  Object.assign(output, {isTTY: true, columns: 40, rows: 10});
  const tui = new TuiTerminal({input, output}).start();
  return {tui, key: (text: string) => input.emit('data', text)};
}

test('composer wiring: a key-driven edit reaches the chain and its rewrite lands in the draft', async () => {
  const keys: unknown[] = [];
  const raiser: ChainHandler = {
    name: 'raiser',
    tier: 'user',
    run: async (e: any, next: any) => {
      keys.push(e.key);
      return next({...(e as object), inputText: 'there'});
    },
  };
  const remove = installChainModule(moduleWith(raiser));
  clearChainRecords();
  const {tui, key} = terminal();
  try {
    key('h');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(tui.state.text, 'there');
    // One key is one record, and a single record is the only batch shape that carries the key; `Xo`
    // reads a printable character as `key`, so that is what the chain sees.
    assert.deepEqual(keys, [{key: 'h'}]);
  } finally {
    tui.close();
    remove();
  }
});

test('composer wiring: a run of typing is one batch, and a batch carries no single key', async () => {
  const keys: unknown[] = [];
  const counter: ChainHandler = {
    name: 'counter',
    tier: 'user',
    run: async (e: any, next: any) => {
      keys.push(e.key);
      return next(e);
    },
  };
  const remove = installChainModule(moduleWith(counter));
  clearChainRecords();
  const {tui, key} = terminal();
  try {
    for (const character of 'hello') key(character);
    await new Promise((resolve) => setImmediate(resolve));
    // `hello` typed as five keys settles once, with the whole run as the recorded span.
    assert.equal(tui.state.text, 'hello');
    assert.equal(keys.length, 1, 'one hop for the batch');
    assert.equal(keys[0], undefined, 'the source drops the key when a batch merges several edits');
  } finally {
    tui.close();
    remove();
  }
});

test('composer wiring: an unloaded prompt.edit leaves the typing alone', async () => {
  clearChainRecords();
  const {tui, key} = terminal();
  try {
    for (const character of 'hello') key(character);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(tui.state.text, 'hello');
  } finally {
    tui.close();
  }
});
