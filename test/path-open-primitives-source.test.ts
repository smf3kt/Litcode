import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPathOpenCapability, createPathOpenPrimitives } from '../src/path-open-primitives-source.js';

const flags = { O_NOFOLLOW: 0x100, O_RDONLY: 0x2, O_DIRECTORY: 0x4, O_NONBLOCK: 0x8 };
const ai = 0x10000, zut = 0x20000;

test('source directory open caches its capability probe and selects the correct flag set', async () => {
  for (const rejected of [false, true]) {
    const probes: { path: string; flags: number }[] = [];
    const attempts: { path: string; flags: number }[] = [];
    let closed = 0;
    const state = { noFollowAny: 'untried' };
    const capability = createPathOpenCapability({ m: flags, ai, zut, f: state,
      E: (error: unknown) => error instanceof Error && 'code' in error ? error.code : undefined,
      X: async (file: string, openFlags: number) => {
        probes.push({ path: file, flags: openFlags });
        if (rejected) throw Object.assign(new Error('unsupported'), { code: 'EINVAL' });
        return { async close() { closed += 1; } };
      } });
    const primitive = createPathOpenPrimitives({ T: flags, ai, zut, wGn: capability.wGn,
      Pe: async (file: string, openFlags: number) => { attempts.push({ path: file, flags: openFlags }); return {}; } });
    const requested = flags.O_RDONLY | flags.O_NOFOLLOW;
    await primitive.Z3('/fixture', requested, 'macos');
    await primitive.Z3('/fixture', requested, 'macos');
    await primitive.Z3('/linux', requested, 'linux');
    assert.deepEqual(probes, [{ path: '/', flags: flags.O_RDONLY | flags.O_DIRECTORY | flags.O_NONBLOCK | ai | zut }]);
    assert.equal(closed, rejected ? 0 : 1);
    assert.equal(state.noFollowAny, rejected ? 'rejected' : 'works');
    const macFlags = rejected ? requested | ai : (requested & ~flags.O_NOFOLLOW) | ai | zut;
    assert.deepEqual(attempts, [
      { path: '/fixture', flags: macFlags }, { path: '/fixture', flags: macFlags },
      { path: '/linux', flags: requested | ai },
    ]);
  }
});

test('source open cancellation closes a handle that arrives after abort', async () => {
  let finish!: (value: { close(): Promise<void> }) => void;
  let closed = 0;
  const pending = new Promise<{ close(): Promise<void> }>(resolve => { finish = resolve; });
  const primitive = createPathOpenPrimitives({ T: flags, ai, zut, wGn: async () => false,
    Pe: () => pending });
  const controller = new AbortController();
  const reason = new Error('fixture cancelled');
  const opened = primitive.QHt('/fixture', flags.O_RDONLY, 'linux', false, controller.signal);
  controller.abort(reason);
  await assert.rejects(opened, error => error === reason);
  finish({ async close() { closed += 1; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, 1);

  let calls = 0;
  const neverOpened = createPathOpenPrimitives({ T: flags, ai, zut, wGn: async () => false,
    Pe: async () => { calls += 1; return {}; } });
  await assert.rejects(neverOpened.QHt('/fixture', flags.O_RDONLY, 'linux', false, controller.signal), error => error === reason);
  assert.equal(calls, 0);
});
