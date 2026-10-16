// The module-to-host call path, streaming half (W45-22): the raise a plugin's streaming method call
// funnels into. The raise machinery is this package's copy (src/plugin-chain-stream-call-source.ts,
// `aGe` chunk-sfn1dbxq.js [1843388,1844317); the stage is chunk-nyce03br.js; the record family is the
// records copy). This test binds its observable rules to the source's own bodies: a chain with no
// handler returns the floor's stream untouched, a native provider's chunks are relayed and its
// `{value}` unwrapped, the floor's `check` refusal reads `(host check)`, and a `deny` throws with the
// withheld-result suffix `tzt` picks by whether the floor ran.

import assert from 'node:assert/strict';
import { test } from 'node:test';

// The registry import installs the environment host factory and registers every chain site.
import '../src/plugin-chain-registry.js';
import { clearChainRecords, installChainModule } from '../src/plugin-chain-host.js';
import { raiseStreamingHostCall } from '../src/plugin-chain-stream-call.js';
import { tzt } from '../src/plugin-chain-stream-call-source.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const EVENT = 'model.complete';
const caller = (plugin = 'fixture-stream') => ({ plugin, origin: ORIGIN });

type StreamContext = { open: (args: unknown) => AsyncGenerator<unknown, unknown> };
type StreamBody = (args: unknown, handle: unknown, context: StreamContext) => AsyncGenerator<unknown, unknown>;

/** A native streaming provider: the module carries `streamLinks`, which the copied `_o` reads and
 *  folds into the streaming chain (a module without it is collected as a hop instead). */
function providerModule(run: StreamBody): ChainModule {
  return {
    name: 'fixture-native',
    tier: 'user',
    hooks: (event: string) => event === EVENT,
    streamLinks: () => [{ name: 'fixture-native', tier: 'user', run } as unknown as ChainHandler],
    record: () => {
      throw new Error('a provider is asked through streamLinks, not record');
    },
  };
}

/** The floor: the `streamOps` entry's own stream, which the chain reaches when its handlers run out. */
function floorStream(seen: unknown[] = []) {
  return {
    stream: async function* (args: unknown) {
      seen.push(args);
      yield 'floor-1';
      yield 'floor-2';
      return { value: 'floor-done' };
    },
  };
}

async function drain(stream: AsyncGenerator<unknown, unknown>) {
  const chunks: unknown[] = [];
  for (;;) {
    const step = await stream.next();
    if (step.done === true) return { chunks, returned: step.value };
    chunks.push(step.value);
  }
}

test('streaming call: a name no module hooks is the floor\'s own stream', async () => {
  clearChainRecords();
  const seen: unknown[] = [];
  const args = { prompt: 'hello' };
  const floor = {
    check: () => 'takes a request object',
    stream: floorStream(seen).stream,
  };

  const result = await drain(await raiseStreamingHostCall({ event: EVENT, args, caller: caller(), bottom: floor }));
  assert.deepEqual(result.chunks, ['floor-1', 'floor-2']);
  assert.deepEqual(result.returned, { value: 'floor-done' });
  // The short circuit hands the caller the floor's stream itself: the argument is the caller's own
  // object and the table entry's `check` never runs (it belongs to the dispatch path).
  assert.equal(seen.length, 1);
  assert.equal(seen[0], args);
});

test('streaming call: a native provider relays its chunks and folds into the floor', async () => {
  clearChainRecords();
  const remove = installChainModule(providerModule(async function* () {
    yield 'hook-1';
    yield 'hook-2';
    return { value: 'hook-done' };
  }));
  try {
    const own = await drain(await raiseStreamingHostCall({ event: EVENT, args: { prompt: 'hi' }, caller: caller(), bottom: floorStream() }));
    assert.deepEqual(own.chunks, ['hook-1', 'hook-2']);
    // The answer is the source's `{ value }`: `aGe` returns `he.value`, not the envelope.
    assert.equal(own.returned, 'hook-done');
  } finally {
    remove();
  }

  // A provider that opens the floor reads the floor's stream through `next`'s context, and its own
  // answer still wins; the floor's chunks are the ones it passed on.
  const removeRelay = installChainModule(providerModule(async function* (_args, _handle, context) {
    yield* context.open(_args);
    return { value: 'relayed' };
  }));
  try {
    const relayed = await drain(await raiseStreamingHostCall({ event: EVENT, args: { prompt: 'hi' }, caller: caller(), bottom: floorStream() }));
    assert.deepEqual(relayed.chunks, ['floor-1', 'floor-2']);
    assert.equal(relayed.returned, 'relayed');
  } finally {
    removeRelay();
  }

  // The floor's `check` runs where the floor is reached, and its refusal is the source's own text.
  const removeCheck = installChainModule(providerModule(async function* (_args, _handle, context) {
    yield* context.open(_args);
    return { value: 'unreachable' };
  }));
  try {
    const stream = await raiseStreamingHostCall({
      event: EVENT,
      args: { prompt: 'hi' },
      caller: caller(),
      bottom: { check: () => 'takes a request object', stream: floorStream().stream },
    });
    await assert.rejects(() => drain(stream), /HooksError: model\.complete: takes a request object \(host check\)/);
  } finally {
    removeCheck();
  }
});

test('streaming call: a withheld result says whether the floor ran', async () => {
  // The source's own texts: `tzt.nothing` is empty, and the other two say what the floor did.
  assert.equal(tzt.nothing, '');
  assert.equal(tzt.started, ' started, and a plugin withheld its result');
  assert.equal(tzt.ran, ' ran, and a plugin withheld its result');

  clearChainRecords();
  const denying = () => providerModule(async function* () {
    yield 'hook-1';
    return { deny: 'the plugin refused this stream' };
  });

  // Nothing below ran: the provider answered on its own.
  const remove = installChainModule(denying());
  try {
    const stream = await raiseStreamingHostCall({ event: EVENT, args: {}, caller: caller(), bottom: floorStream() });
    await assert.rejects(
      () => drain(stream),
      // `${plugin}: $.${event}${tzt.nothing}: ${deny}`.
      /HooksError: fixture-stream: \$\.model\.complete: the plugin refused this stream/,
    );
  } finally {
    remove();
  }

  // Started: the provider opened the floor and stopped mid-stream.
  const removeStarted = installChainModule(providerModule(async function* (_args, _handle, context) {
    const below = context.open(_args);
    await below.next();
    return { deny: 'stopped mid-stream' };
  }));
  try {
    const stream = await raiseStreamingHostCall({ event: EVENT, args: {}, caller: caller(), bottom: floorStream() });
    await assert.rejects(
      () => drain(stream),
      /HooksError: fixture-stream: \$\.model\.complete started, and a plugin withheld its result: stopped mid-stream/,
    );
  } finally {
    removeStarted();
  }

  // Ran: the provider read the floor's stream to its end and then withheld.
  const removeRan = installChainModule(providerModule(async function* (_args, _handle, context) {
    const below = context.open(_args);
    for (;;) {
      const step = await below.next();
      if (step.done === true) break;
    }
    return { deny: 'drained the floor' };
  }));
  try {
    const stream = await raiseStreamingHostCall({ event: EVENT, args: {}, caller: caller(), bottom: floorStream() });
    await assert.rejects(
      () => drain(stream),
      /HooksError: fixture-stream: \$\.model\.complete ran, and a plugin withheld its result: drained the floor/,
    );
  } finally {
    removeRan();
  }
});
