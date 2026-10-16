// Instrumented: which handler does `has` collect, is the floor's stream function called, and what does
// the stage settle on.
import '../src/plugin-chain-registry.js';
import { clearChainRecords, installChainModule } from '../src/plugin-chain-host.js';
import { has } from '../src/plugin-chain-records.js';
import { raiseStreamingHostCall } from '../src/plugin-chain-stream-call.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const EVENT = 'session.receive';
const caller = () => ({ plugin: 'fixture-stream', origin: ORIGIN });
const trace: string[] = [];

async function drain(stream: AsyncGenerator<unknown, unknown>) {
  const chunks: unknown[] = [];
  for (;;) {
    const step = await stream.next();
    if (step.done === true) return { chunks, returned: step.value, trace };
    chunks.push(step.value);
  }
}

const floor = {
  stream: async function* () {
    trace.push('floor.stream opened');
    yield 'floor-1';
    return { value: 'floor-done' };
  },
};

clearChainRecords();
const module = {
  name: 'fixture-native',
  tier: 'user',
  hooks: (event: string) => event === EVENT,
  streamLinks: (input: unknown) => {
    trace.push(`streamLinks(${JSON.stringify(input).slice(0, 80)})`);
    return [{
      name: 'fixture-native',
      tier: 'user',
      run: async function* (...args: unknown[]) {
        trace.push(`handler called with ${args.length} args: ${args.map((a) => (a === undefined ? 'undef' : typeof a)).join(',')}`);
        yield 'hook-1';
        return { value: 'hook-done' };
      },
    }];
  },
};
const remove = installChainModule(module as never);
try {
  const collected = has(EVENT, ORIGIN);
  console.log('has →', collected.length, collected.map((h: { name?: string }) => h.name).join(','));
  const result = await drain(await raiseStreamingHostCall({ event: EVENT, args: { a: 1 }, caller: caller(), bottom: floor }));
  console.log('result:', JSON.stringify({ chunks: result.chunks, returned: result.returned }));
  console.log('trace:\n  ' + result.trace.join('\n  '));
} catch (error) {
  console.log('threw:', String(error), 'trace:\n  ' + trace.join('\n  '));
} finally {
  remove();
}
