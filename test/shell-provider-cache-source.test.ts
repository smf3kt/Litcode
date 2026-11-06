import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createShellProviderCacheFixture } from '../src/shell-provider-cache-source.js';

const sourcePath = new URL('../extracted-v2/modules/chunk-sfn1dbxq.js', import.meta.url);
const fixturePath = new URL('../src/shell-provider-cache-source.ts', import.meta.url);
const digest = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');

test('fixture preserves the actual recovered UTF-16 source ranges', () => {
  const bytes = readFileSync(sourcePath);
  assert.equal(digest(bytes), '4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da');
  const source = bytes.toString('utf8');
  const fixture = readFileSync(fixturePath, 'utf8');
  for (const [start, end] of [[3505033, 3505154], [3505154, 3505304], [3505304, 3505340],
    [3505340, 3505402], [3505503, 3505542], [3505542, 3506206], [3506206, 3506277]]) {
    assert.ok(fixture.includes(source.slice(start, end)), `source range ${start}-${end}`);
  }
});

test('first use, reuse and refresh rebuild share the cached promise', async () => {
  const state: { shellConfig: Promise<any> | null } = { shellConfig: null };
  let shells = 0;
  let paths = ['one'];
  const calls: unknown[] = [];
  const cache = createShellProviderCacheFixture({
    mPe: () => state,
    eLs: async () => { shells++; return '/fixture/shell'; },
    W7r: async (input: unknown) => { calls.push(input); return paths.slice(); },
    zgn: async (shell: string, options: unknown) => ({ shell, options, isSnapshotUsable: async () => true }),
    t: () => {}, l: String, c: () => {},
  });
  const first = cache.ohn(state, 'first');
  assert.equal(cache.ohn(state, 'ignored'), first);
  assert.equal(cache.tLs('also ignored'), first);
  const value = await first;
  assert.deepEqual(value.pluginBinPaths, ['one']);
  assert.deepEqual(value.provider.options, { pluginBinPaths: ['one'] });
  assert.equal(shells, 1);
  assert.equal(await cache.W8r('same'), false);
  assert.equal(cache.ohn(state, 'still ignored'), first);
  paths = ['two'];
  assert.equal(await cache.W8r('changed'), true);
  assert.equal(state.shellConfig, null);
  const second = cache.ohn(state, 'second');
  assert.notEqual(second, first);
  assert.deepEqual((await second).pluginBinPaths, ['two']);
  assert.equal(shells, 2);
  assert.deepEqual(calls, ['first', 'same', 'changed', 'second']);
});

test('pending refresh and overlapping refresh do not discard a newer cache', async () => {
  const state: { shellConfig: Promise<any> | null } = { shellConfig: null };
  let release!: (value: string) => void;
  const gate = new Promise<string>(resolve => { release = resolve; });
  let shells = 0;
  const cache = createShellProviderCacheFixture({
    mPe: () => state,
    eLs: () => ++shells === 1 ? gate : Promise.resolve('/fixture/new'),
    W7r: async () => [],
    zgn: async (shell: string) => ({ shell, isSnapshotUsable: async () => true }),
    t: () => {}, l: String, c: () => {},
  });
  const old = cache.ohn(state, 'old');
  let fresh: Promise<any>;
  try {
    assert.equal(cache.ohn(state, 'concurrent'), old);
    assert.equal(await cache.W8r('refresh'), true);
    fresh = cache.ohn(state, 'new');
  } finally {
    release('/fixture/old');
  }
  assert.equal((await old).provider.shell, '/fixture/old');
  assert.equal((await fresh).provider.shell, '/fixture/new');
  assert.equal(state.shellConfig, fresh);

  let releaseCheck!: (value: boolean) => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const check = new Promise<boolean>(resolve => { releaseCheck = resolve; });
  const oldConfig = Promise.resolve({ provider: { isSnapshotUsable: () => { entered(); return check; } }, pluginBinPaths: [] });
  state.shellConfig = oldConfig;
  const refresh = cache.W8r('overlap');
  try {
    await started;
    state.shellConfig = fresh;
  } finally {
    releaseCheck(false);
  }
  assert.equal(await refresh, false);
  assert.equal(state.shellConfig, fresh);
});

test('unchanged paths retain the externally replaced cache and emit the kept log', async () => {
  const state: { shellConfig: Promise<any> | null } = { shellConfig: null };
  let enterPaths!: () => void;
  let releasePaths!: (paths: string[]) => void;
  const entered = new Promise<void>(resolve => { enterPaths = resolve; });
  const paths = new Promise<string[]>(resolve => { releasePaths = resolve; });
  const logs: string[] = [];
  const cache = createShellProviderCacheFixture({
    mPe: () => state,
    eLs: async () => '/fixture/shell',
    W7r: () => { enterPaths(); return paths; },
    zgn: async () => ({}),
    t: (message: string) => logs.push(message), l: String, c: () => {},
  });
  const old = Promise.resolve({ provider: { isSnapshotUsable: async () => true }, pluginBinPaths: ['one'] });
  const replacement = Promise.resolve({ provider: {}, pluginBinPaths: ['replacement'] });
  state.shellConfig = old;
  const refresh = cache.W8r('refresh');
  try {
    await entered;
    assert.equal(state.shellConfig, old);
    assert.deepEqual(logs, []);
    // The replacement is injected by the fixture while the path callback is pending.
    state.shellConfig = replacement;
  } finally {
    releasePaths(['one']);
  }
  assert.equal(await refresh, false);
  assert.equal(state.shellConfig, replacement);
  assert.equal(cache.ohn(state, 'ignored'), replacement);
  assert.deepEqual(logs, ['Shell snapshot kept across plugin refresh: plugin bin/ PATH entries unchanged']);
});

test('separate factories use their injected callbacks against explicitly shared state', async () => {
  const state: { shellConfig: Promise<any> | null } = { shellConfig: null };
  const calls: string[] = [];
  const logs: string[] = [];
  const make = (name: string, path: string) => createShellProviderCacheFixture({
    mPe: () => state,
    eLs: async () => { calls.push(`${name}:shell`); return name; },
    W7r: async (input: string) => { calls.push(`${name}:paths:${input}`); return [path]; },
    zgn: async (shell: string) => ({ shell, isSnapshotUsable: async () => true }),
    t: (message: string) => logs.push(`${name}:${message}`), l: String, c: () => {},
  });
  const firstFactory = make('first', 'one');
  const secondFactory = make('second', 'two');
  const first = firstFactory.tLs('build-first');
  assert.equal(secondFactory.tLs('ignored'), first);
  assert.equal((await first).provider.shell, 'first');
  assert.equal(await secondFactory.W8r('refresh-second'), true);
  assert.equal(state.shellConfig, null);
  assert.deepEqual(logs, ['second:Shell snapshot dropped on plugin refresh (plugin bin/ PATH entries changed); the next Bash exec rebuilds it']);
  const second = secondFactory.tLs('build-second');
  assert.notEqual(second, first);
  assert.equal(firstFactory.tLs('ignored-again'), second);
  assert.equal((await second).provider.shell, 'second');
  assert.equal(state.shellConfig, second);
  assert.deepEqual(calls, ['first:shell', 'first:paths:build-first', 'second:paths:refresh-second', 'second:shell', 'second:paths:build-second']);
});

test('failed construction is cached and snapshot and path failures drive refresh', async () => {
  const state: { shellConfig: Promise<any> | null } = { shellConfig: null };
  let builds = 0;
  let failBuild = true;
  let failPaths = false;
  let usable = false;
  const reported: unknown[] = [];
  const cache = createShellProviderCacheFixture({
    mPe: () => state,
    eLs: async () => { builds++; if (failBuild) throw new Error('shell'); return '/fixture/shell'; },
    W7r: async () => { if (failPaths) throw new Error('paths'); return []; },
    zgn: async () => ({ isSnapshotUsable: async () => usable }),
    t: () => {}, l: String, c: (error: unknown) => reported.push(error),
  });
  const failed = cache.ohn(state, undefined);
  await assert.rejects(failed, /shell/);
  assert.equal(cache.ohn(state, undefined), failed);
  assert.equal(await cache.W8r(undefined), true);
  failBuild = false;
  failPaths = true;
  const fallback = await cache.ohn(state, undefined);
  assert.deepEqual(fallback.pluginBinPaths, []);
  assert.equal(reported.length, 1);
  assert.equal(await cache.W8r(undefined), true);
  usable = true;
  failPaths = false;
  await cache.ohn(state, undefined);
  failPaths = true;
  assert.equal(await cache.W8r(undefined), true);
  assert.equal(builds, 3);
});
