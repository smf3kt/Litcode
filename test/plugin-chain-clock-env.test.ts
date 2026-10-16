// The `$` call table's clock and env floors (W45-45). The ported bodies are
// src/plugin-chain-clock-env-source.ts, the six entries sit verbatim in src/plugin-chain-clock-env.ts
// (chunk-sfn1dbxq.js [2354369,2354390), [2354391,2354444), [2354606,2354635) and [2354636,2354665)),
// and the wait they run is `Q`, already ported with its clock in W45-22. These tests bind the
// behaviour those bodies produce to the source's own texts: the process clock the now floor answers
// with, the shared wait behind three names, the abort reason, the ms and env refusals, and the two
// env runs including the `USER_TYPE` override.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import '../src/plugin-chain-registry.js';
import { clearChainRecords, installChainModule } from '../src/plugin-chain-host.js';
import { nS } from '../src/plugin-chain-stream-source.js';
import {
  argumentName,
  clockMsRefusal,
  clockNow,
  envArgumentRefusal,
  raiseClockCall,
  raiseEnvCall,
  readProcessEnv,
  sleep,
  writeProcessEnv,
} from '../src/plugin-chain-clock-env.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const caller = (plugin = 'fixture-clock') => ({ plugin, origin: ORIGIN });

function moduleWith(event: string, handler: ChainHandler): ChainModule {
  return { name: handler.name, tier: handler.tier, hooks: (e: string) => e === event, record: () => handler };
}

/** A handler whose `next` hands the call to the floor, which is where an entry's `check` runs. */
function passthrough(name: string, event: string): ChainModule {
  return moduleWith(event, {
    name,
    tier: 'user',
    run: async (args: unknown, next: (value: unknown) => Promise<unknown>) => await next(args),
  } as unknown as ChainHandler);
}

test('clock.now answers the process clock, not the pluggable one', async () => {
  const before = Date.now();
  const answer = await raiseClockCall({ event: 'clock.now', args: {}, caller: caller() }) as number;
  const after = Date.now();
  assert.equal(typeof answer, 'number');
  assert.ok(answer >= before && answer <= after, 'the answer is the process clock');

  // The wait helper takes a clock; `clock.now` does not, so a moved clock cannot move its answer.
  const real = nS.now;
  nS.now = () => 12345;
  try {
    const moved = await clockNow();
    assert.ok(moved >= before, 'the source clock, not the injected one');
  } finally {
    nS.now = real;
  }
});

test('clock.sleep, clock.after and clock.every are the same wait, and an abort rejects with its reason', async () => {
  const started = Date.now();
  await sleep(5);
  assert.ok(Date.now() - started >= 4, 'the wait lasted about as long as it was asked for');

  const aborted = new AbortController();
  aborted.abort(new Error('the caller changed its mind'));
  await assert.rejects(() => sleep(1000, aborted.signal), /the caller changed its mind/);

  const plain = new AbortController();
  plain.abort('a string reason');
  await assert.rejects(() => sleep(1000, plain.signal), /a string reason/);

  // A bare abort carries Node's own DOMException as the reason, so that reason is the rejection.
  const silent = new AbortController();
  silent.abort();
  await assert.rejects(() => sleep(1000, silent.signal), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal((error as Error).name, 'AbortError');
    return true;
  });

  const mid = new AbortController();
  const waiting = sleep(5000, mid.signal);
  mid.abort(new Error('stopped'));
  await assert.rejects(() => waiting, /stopped/);

  // A signal that never aborts lets the wait finish.
  const quiet = new AbortController();
  await sleep(5, quiet.signal);

  // All three names reach the same run, and the wait runs on the caller's own signal.
  for (const event of ['clock.sleep', 'clock.after', 'clock.every'] as const) {
    const controller = new AbortController();
    controller.abort(new Error(`aborted via ${event}`));
    await assert.rejects(
      () => raiseClockCall({ event, args: { ms: 1000 }, caller: { ...caller(), signal: controller.signal } }),
      new RegExp(`aborted via ${event}`),
    );
  }
});

test('the ms check refuses a non-finite value with the source\'s own text', async () => {
  assert.equal(clockMsRefusal({ ms: 10 }), undefined);
  assert.equal(clockMsRefusal({ ms: -1 }), undefined, 'a negative number is still a finite one');
  assert.equal(clockMsRefusal({ ms: 1.5 }), undefined, 'so is a fraction');
  assert.equal(clockMsRefusal({ ms: Number.POSITIVE_INFINITY }),
    'takes { ms }, a non-negative number of milliseconds (got Infinity)');
  assert.equal(clockMsRefusal({}), 'takes { ms }, a non-negative number of milliseconds (got undefined)');

  clearChainRecords();
  const gate = installChainModule(passthrough('fixture-clock-check', 'clock.sleep'));
  try {
    await assert.rejects(
      () => raiseClockCall({ event: 'clock.sleep', args: { ms: 'soon' }, caller: caller() }),
      /HooksError: clock\.sleep: takes \{ ms \}, a non-negative number of milliseconds \(got soon\) \(host check\)/,
    );
    // The floor is not reached with a refused argument, so nothing waits.
    const started = Date.now();
    await assert.rejects(() => raiseClockCall({ event: 'clock.sleep', args: { ms: Number.NaN }, caller: caller() }));
    assert.ok(Date.now() - started < 50, 'a refused sleep does not wait');
  } finally {
    gate();
  }
});

test('a handler in the chain answers a clock call first', async () => {
  const gate = installChainModule(moduleWith('clock.now', {
    name: 'fixture-clock-answer',
    tier: 'user',
    run: async () => ({ value: 42 }),
  } as unknown as ChainHandler));
  try {
    assert.equal(await raiseClockCall({ event: 'clock.now', args: {}, caller: caller() }), 42);
  } finally {
    gate();
  }
});

test('env.get reads the process environment, and answers USER_TYPE as external', async () => {
  process.env.CC_REVERSE_FIXTURE_ENV = 'from the process';
  process.env.USER_TYPE = 'a real value the source hides';
  try {
    assert.equal(await readProcessEnv('CC_REVERSE_FIXTURE_ENV'), 'from the process');
    assert.equal(await raiseEnvCall({ event: 'env.get', args: { name: 'CC_REVERSE_FIXTURE_ENV' }, caller: caller() }), 'from the process');
    assert.equal(await readProcessEnv('CC_REVERSE_FIXTURE_ABSENT'), undefined);
    assert.equal(await readProcessEnv('USER_TYPE'), 'external', 'the source never hands over this one');
  } finally {
    delete process.env.CC_REVERSE_FIXTURE_ENV;
    delete process.env.USER_TYPE;
  }
});

test('env.set writes a value and unsets on none', async () => {
  try {
    await writeProcessEnv('CC_REVERSE_FIXTURE_SET', 'written');
    assert.equal(process.env.CC_REVERSE_FIXTURE_SET, 'written');
    await writeProcessEnv('CC_REVERSE_FIXTURE_SET', 'rewritten');
    assert.equal(process.env.CC_REVERSE_FIXTURE_SET, 'rewritten');
    await writeProcessEnv('CC_REVERSE_FIXTURE_SET', undefined);
    assert.equal(Object.hasOwn(process.env, 'CC_REVERSE_FIXTURE_SET'), false, 'no value unsets the variable');

    await raiseEnvCall({ event: 'env.set', args: { name: 'CC_REVERSE_FIXTURE_SET', value: 'via the table' }, caller: caller() });
    assert.equal(process.env.CC_REVERSE_FIXTURE_SET, 'via the table');
    assert.equal(await raiseEnvCall({ event: 'env.get', args: { name: 'CC_REVERSE_FIXTURE_SET' }, caller: caller() }), 'via the table');
  } finally {
    delete process.env.CC_REVERSE_FIXTURE_SET;
  }
});

test('the env check refuses a bad name or value with the source\'s own texts', () => {
  assert.equal(envArgumentRefusal({ name: 'GOOD_NAME' }), undefined);
  assert.equal(envArgumentRefusal({ name: 'GOOD_NAME', value: 'a string' }), undefined);
  assert.equal(envArgumentRefusal({ name: 'GOOD_NAME', value: undefined }), undefined);
  assert.equal(envArgumentRefusal({}), 'takes a variable name on a plain object (got undefined)');
  assert.equal(envArgumentRefusal({ name: '' }), 'takes a variable name on a plain object (got "")');
  assert.equal(envArgumentRefusal({ name: 'A=B' }), 'takes a variable name on a plain object (got "A=B")');
  assert.equal(envArgumentRefusal({ name: 'A\u0000B' }), 'takes a variable name on a plain object (got "A\\u0000B")');
  assert.equal(envArgumentRefusal({ name: 7 }), 'takes a variable name on a plain object (got number)');
  assert.equal(envArgumentRefusal({ name: 'GOOD_NAME', value: 7 }), 'takes a string value, or undefined to unset (got number)');
  assert.equal(envArgumentRefusal({ name: 'GOOD_NAME', value: 'a\u0000b' }), 'takes a value with no NUL byte in it');
  assert.equal(argumentName({ name: 'GOOD_NAME' }), 'GOOD_NAME');
  assert.equal(argumentName('GOOD_NAME'), undefined, 'a bare string is not a plain object with a name');
});

test('the env entries run their check only behind a handler, as the table floors do', async () => {
  const gate = installChainModule(passthrough('fixture-env-check', 'env.set'));
  try {
    await assert.rejects(
      () => raiseEnvCall({ event: 'env.set', args: { name: 'A=B', value: 'x' }, caller: caller() }),
      /HooksError: env\.set: takes a variable name on a plain object \(got "A=B"\) \(host check\)/,
    );
    assert.equal(Object.hasOwn(process.env, 'A=B'), false, 'a refused name writes nothing');
  } finally {
    gate();
  }
});
