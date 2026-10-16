// Runtime probe for the streaming raise: the floor short circuit, a hooked streaming handler, and the
// three withheld states. Reports what the copied bodies actually do before the test asserts it.
import '../src/plugin-chain-registry.js';
import { clearChainRecords, installChainModule } from '../src/plugin-chain-host.js';
import { raiseStreamingHostCall } from '../src/plugin-chain-stream-call.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const caller = () => ({ plugin: 'fixture-stream', origin: ORIGIN });
const EVENT = 'session.receive';

async function drain(stream: AsyncGenerator<unknown, unknown>) {
  const chunks: unknown[] = [];
  for (;;) {
    const step = await stream.next();
    if (step.done === true) return { chunks, returned: step.value };
    chunks.push(step.value);
  }
}

function moduleWith(events: string[], handler: ChainHandler): ChainModule {
  return {
    name: handler.name,
    tier: handler.tier,
    hooks: (event: string) => events.includes(event),
    record: () => handler,
  };
}

// 1. No handler: the floor is the whole call.
clearChainRecords();
const floor = {
  stream: async function* () {
    yield 'floor-1';
    yield 'floor-2';
    return { value: 'floor-done' };
  },
};
console.log('floor:', JSON.stringify(await drain(await raiseStreamingHostCall({ event: EVENT, args: { a: 1 }, caller: caller(), bottom: floor }))));

// 2. A hooked streaming handler that relays its own chunks and returns a value.
const remove = installChainModule(moduleWith([EVENT], {
  name: 'fixture-stream-hook',
  tier: 'user',
  async *run() {
    yield 'hook-1';
    yield 'hook-2';
    return { value: 'hook-done' };
  },
}));
try {
  console.log('hooked:', JSON.stringify(await drain(await raiseStreamingHostCall({ event: EVENT, args: { a: 1 }, caller: caller(), bottom: floor }))));
} catch (error) {
  console.log('hooked threw:', String(error));
}
remove();

// 3. A handler that denies without reaching the floor.
const removeNothing = installChainModule(moduleWith([EVENT], {
  name: 'fixture-stream-deny',
  tier: 'user',
  async *run() {
    return { deny: 'the plugin refused this stream' };
  },
}));
try {
  await drain(await raiseStreamingHostCall({ event: EVENT, args: {}, caller: caller(), bottom: floor }));
  console.log('deny: no throw');
} catch (error) {
  console.log('deny nothing:', String(error));
}
removeNothing();

// 4. A handler that reads one floor chunk (so the floor started) and then denies.
const removeStarted = installChainModule(moduleWith([EVENT], {
  name: 'fixture-stream-deny-started',
  tier: 'user',
  async *run(_input: unknown, next: (value?: unknown) => AsyncGenerator<unknown, unknown>) {
    const below = next(undefined);
    await below.next();
    return { deny: 'stopped mid-stream' };
  },
}));
try {
  await drain(await raiseStreamingHostCall({ event: EVENT, args: {}, caller: caller(), bottom: floor }));
  console.log('deny started: no throw');
} catch (error) {
  console.log('deny started:', String(error));
}
removeStarted();

// 5. The floor's check refusal, reachable only through a handler that calls next.
const removeCheck = installChainModule(moduleWith([EVENT], {
  name: 'fixture-stream-next',
  tier: 'user',
  async *run(_input: unknown, next: (value?: unknown) => AsyncGenerator<unknown, unknown>) {
    yield* next(undefined);
    return { value: 'relayed' };
  },
}));
try {
  await drain(await raiseStreamingHostCall({
    event: EVENT,
    args: {},
    caller: caller(),
    bottom: { check: () => 'takes an object with a session id', stream: floor.stream },
  }));
  console.log('check: no throw');
} catch (error) {
  console.log('check:', String(error));
}
removeCheck();
