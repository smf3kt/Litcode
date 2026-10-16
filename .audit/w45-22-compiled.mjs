// W45-22 against the built artifact: the streaming half of the module-to-host call path from dist —
// the floor a call no module hooks returns untouched, a native provider's relayed chunks and unwrapped
// value, the floor's `check` refusal, and the three withheld-result texts `tzt` picks.
import assert from 'node:assert/strict';
import { clearChainRecords, installChainModule } from '../dist/plugin-chain-host.js';
import '../dist/plugin-chain-registry.js';
import { raiseStreamingHostCall } from '../dist/plugin-chain-stream-call.js';
import { tzt } from '../dist/plugin-chain-stream-call-source.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const EVENT = 'model.complete';
const caller = () => ({ plugin: 'fixture-stream', origin: ORIGIN });

async function drain(stream) {
  const chunks = [];
  for (;;) {
    const step = await stream.next();
    if (step.done === true) return { chunks, returned: step.value };
    chunks.push(step.value);
  }
}

const floorStream = () => (async function* () {
  yield 'floor-1';
  yield 'floor-2';
  return { value: 'floor-done' };
})();

const provider = (run) => ({
  name: 'fixture-native',
  tier: 'user',
  hooks: (event) => event === EVENT,
  streamLinks: () => [{ name: 'fixture-native', tier: 'user', run }],
  record: () => {
    throw new Error('a provider is asked through streamLinks, not record');
  },
});

// 1. No handler: the floor's own stream, and its `check` never runs.
clearChainRecords();
const floorArgs = { prompt: 'hello' };
const seen = [];
const shortCircuited = await drain(await raiseStreamingHostCall({
  event: EVENT,
  args: floorArgs,
  caller: caller(),
  bottom: {
    check: () => 'takes a request object',
    stream: async function* (args) {
      seen.push(args);
      yield 'floor-1';
      yield 'floor-2';
      return { value: 'floor-done' };
    },
  },
}));
assert.deepEqual(shortCircuited.chunks, ['floor-1', 'floor-2']);
assert.deepEqual(shortCircuited.returned, { value: 'floor-done' });
assert.equal(seen[0], floorArgs, 'the floor is handed the caller\'s own argument');

// 2. A provider relays its chunks; `aGe` returns the answer's `value`.
const remove = installChainModule(provider(async function* () {
  yield 'hook-1';
  yield 'hook-2';
  return { value: 'hook-done' };
}));
try {
  const own = await drain(await raiseStreamingHostCall({ event: EVENT, args: {}, caller: caller(), bottom: { stream: () => floorStream() } }));
  assert.deepEqual(own.chunks, ['hook-1', 'hook-2']);
  assert.equal(own.returned, 'hook-done');
} finally {
  remove();
}

// 3. The floor's `check` refusal, reached only through a provider that opens the floor.
const removeRelay = installChainModule(provider(async function* (_args, _handle, context) {
  yield* context.open(_args);
  return { value: 'relayed' };
}));
try {
  const relayed = await drain(await raiseStreamingHostCall({ event: EVENT, args: {}, caller: caller(), bottom: { stream: () => floorStream() } }));
  assert.deepEqual(relayed.chunks, ['floor-1', 'floor-2']);
  assert.equal(relayed.returned, 'relayed');

  const stream = await raiseStreamingHostCall({
    event: EVENT,
    args: {},
    caller: caller(),
    bottom: { check: () => 'takes a request object', stream: () => floorStream() },
  });
  await assert.rejects(() => drain(stream), /HooksError: model\.complete: takes a request object \(host check\)/);
} finally {
  removeRelay();
}

// 4. The withheld-result texts, and the suffix each state produces.
assert.equal(tzt.nothing, '');
assert.equal(tzt.started, ' started, and a plugin withheld its result');
assert.equal(tzt.ran, ' ran, and a plugin withheld its result');

const denied = installChainModule(provider(async function* () {
  yield 'hook-1';
  return { deny: 'the plugin refused this stream' };
}));
try {
  const stream = await raiseStreamingHostCall({ event: EVENT, args: {}, caller: caller(), bottom: { stream: () => floorStream() } });
  await assert.rejects(() => drain(stream), /HooksError: fixture-stream: \$\.model\.complete: the plugin refused this stream/);
} finally {
  denied();
}

const started = installChainModule(provider(async function* (_args, _handle, context) {
  const below = context.open(_args);
  await below.next();
  return { deny: 'stopped mid-stream' };
}));
try {
  const stream = await raiseStreamingHostCall({ event: EVENT, args: {}, caller: caller(), bottom: { stream: () => floorStream() } });
  await assert.rejects(() => drain(stream), /model\.complete started, and a plugin withheld its result: stopped mid-stream/);
} finally {
  started();
}

const drained = installChainModule(provider(async function* (_args, _handle, context) {
  const below = context.open(_args);
  for (;;) {
    const step = await below.next();
    if (step.done === true) break;
  }
  return { deny: 'drained the floor' };
}));
try {
  const stream = await raiseStreamingHostCall({ event: EVENT, args: {}, caller: caller(), bottom: { stream: () => floorStream() } });
  await assert.rejects(() => drain(stream), /model\.complete ran, and a plugin withheld its result: drained the floor/);
} finally {
  drained();
}

console.log('W45StreamCallCompiled.v1');
