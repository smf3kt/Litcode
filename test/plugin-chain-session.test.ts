// The `$` call table's session read floor (W45-44). The ported bodies are
// src/plugin-chain-session-source.ts, the entries sit verbatim in src/plugin-chain-session.ts
// (chunk-sfn1dbxq.js [2347677,2347961) and [2348063,2348153)), and the drawing registry behind
// `session.surface`/`session.surfaces` is the source's own `ie`/`gE`. These tests bind the
// behaviour those bodies produce to the source's own texts: the two no-session log lines and the
// process fallbacks, the bound session's model, the turn count's four exclusions, the surface list
// with and without a terminal, and the registry's attach-merge, detach report and silence marks.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import '../src/plugin-chain-registry.js';
import { bindPluginProcessIdentity, chainRecords, clearChainRecords, installChainModule } from '../src/plugin-chain-host.js';
import {
  attachPluginDrawingClient,
  bindPluginSessionRecord,
  contentIsToolResults,
  countMatching,
  detachPluginDrawingClient,
  drawingSurfaces,
  hasPluginDrawingSurface,
  isPluginDrawingSilent,
  markPluginDrawingHeard,
  markPluginDrawingMissed,
  onPluginDrawingDetach,
  pluginDrawingClients,
  pluginDrawingSurfaceNames,
  raiseSessionCall,
  sessionRecord,
  sessionUserTurns,
} from '../src/plugin-chain-session.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const caller = (plugin = 'fixture-session', cwd?: string) => ({ plugin, origin: ORIGIN, cwd });
const logs = (): string[] => chainRecords().filter((r) => r.kind === 'log').map((r) => r.message);

function moduleWith(event: string, handler: ChainHandler): ChainModule {
  return { name: handler.name, tier: handler.tier, hooks: (e: string) => e === event, record: () => handler };
}

/** A handler whose `next` hands the call to the floor, which is where the entry's `run` sits. */
function passthrough(name: string, event: string): ChainModule {
  return moduleWith(event, {
    name,
    tier: 'user',
    run: async (args: unknown, next: (value: unknown) => Promise<unknown>) => await next(args),
  } as unknown as ChainHandler);
}

const userMessage = (content: unknown, extra: Record<string, unknown> = {}) => ({
  type: 'user',
  message: { content },
  ...extra,
});

test('the session floor answers from the process when no session is bound, and says so', async () => {
  clearChainRecords();
  const unbind = bindPluginProcessIdentity({ id: 'pid-1', cwd: '/proc/cwd', root: '/proc/root', model: 'proc-model' });
  try {
    const record = await sessionRecord('fixture-session');
    assert.deepEqual(record, { id: 'pid-1', cwd: '/proc/cwd', root: '/proc/root', model: 'proc-model' });
    assert.ok(logs().some((line) => line.includes('$.session (fixture-session): no session bound; id, cwd and model answered from the process')));
  } finally {
    unbind();
  }
});

test('a caller cwd wins over the process cwd, and a bound session names the model', async () => {
  const unbindProcess = bindPluginProcessIdentity({ cwd: '/proc/cwd', model: 'proc-model' });
  const unbindSession = bindPluginSessionRecord({
    status: () => undefined,
    toast: () => undefined,
    model: () => 'bound-model',
    messages: () => [],
  });
  try {
    assert.equal(await raiseSessionCall({ event: 'session.cwd', args: {}, caller: caller('fixture-session', '/caller/cwd') }), '/caller/cwd');
    assert.equal(await raiseSessionCall({ event: 'session.cwd', args: {}, caller: caller() }), '/proc/cwd');
    assert.equal(await raiseSessionCall({ event: 'session.model', args: {}, caller: caller() }), 'bound-model');
    assert.equal(await raiseSessionCall({ event: 'session.id', args: {}, caller: caller() }), '');
  } finally {
    unbindSession();
    unbindProcess();
  }
});

test('a handler in the chain answers first, and next() reaches the floor', async () => {
  const unbindProcess = bindPluginProcessIdentity({ cwd: '/proc/cwd' });
  const unbindAnswer = installChainModule(moduleWith('session.cwd', {
    name: 'fixture-session-answer',
    tier: 'user',
    run: async () => ({ value: '/from-the-handler' }),
  } as unknown as ChainHandler));
  try {
    assert.equal(await raiseSessionCall({ event: 'session.cwd', args: {}, caller: caller() }), '/from-the-handler');
  } finally {
    unbindAnswer();
  }

  // The same call with a handler that hands it on reaches the floor's own answer.
  const unbindNext = installChainModule(passthrough('fixture-session-next', 'session.cwd'));
  try {
    assert.equal(await raiseSessionCall({ event: 'session.cwd', args: {}, caller: caller() }), '/proc/cwd');
  } finally {
    unbindNext();
    unbindProcess();
  }
  // With nothing bound the identity is the module's own default: this process's cwd, no session id.
  assert.equal(await raiseSessionCall({ event: 'session.cwd', args: {}, caller: caller() }), process.cwd());
  assert.equal(await raiseSessionCall({ event: 'session.id', args: {}, caller: caller() }), '');
});

test('session.turns counts a person\'s turns and drops meta, virtual and tool-result messages', async () => {
  clearChainRecords();
  const messages = [
    userMessage('first'),
    userMessage([{ type: 'tool_result', content: 'x' }]),
    userMessage('meta', { isMeta: true }),
    userMessage('virtual', { isVirtual: true }),
    userMessage([{ type: 'text', text: 'second' }]),
    { type: 'assistant', message: { content: 'not a user turn' } },
  ];
  const unbind = bindPluginSessionRecord({
    status: () => undefined,
    toast: () => undefined,
    model: () => 'm',
    messages: () => messages,
  });
  try {
    assert.equal(await sessionUserTurns('fixture-session'), 2);
    assert.equal(await raiseSessionCall({ event: 'session.turns', args: {}, caller: caller() }), 2);
  } finally {
    unbind();
  }

  clearChainRecords();
  assert.equal(await sessionUserTurns('fixture-session'), 0);
  assert.ok(logs().some((line) => line.includes('$.session.turns (fixture-session): no session bound; 0')));
});

test('session.surface and session.surfaces read the drawing registry, terminal first', async () => {
  clearChainRecords();
  assert.deepEqual(drawingSurfaces(), []);
  assert.equal(await raiseSessionCall({ event: 'session.surface', args: {}, caller: caller() }), null);
  assert.deepEqual(await raiseSessionCall({ event: 'session.surfaces', args: {}, caller: caller() }), []);
  assert.ok(logs().some((line) => line.includes('$.session.surface (fixture-session): no drawing session bound; null')));
  assert.ok(logs().some((line) => line.includes('$.session.surfaces (fixture-session): nothing attached draws; []')));

  const unbindSession = bindPluginSessionRecord({
    status: () => undefined,
    toast: () => undefined,
    model: () => 'm',
    messages: () => [],
    surface: 'terminal',
  });
  const attached = attachPluginDrawingClient({ clientId: 'c1', surface: 'sidebar' });
  try {
    assert.equal(attached, true);
    assert.deepEqual(drawingSurfaces(), ['terminal', 'sidebar']);
    assert.equal(await raiseSessionCall({ event: 'session.surface', args: {}, caller: caller() }), 'terminal');
    assert.deepEqual(await raiseSessionCall({ event: 'session.surfaces', args: {}, caller: caller() }), ['terminal', 'sidebar']);
  } finally {
    detachPluginDrawingClient('c1');
    unbindSession();
  }
  assert.deepEqual(drawingSurfaces(), []);
});

test('the drawing registry merges a re-attach, reports a detach, and keeps the silence marks', () => {
  assert.equal(attachPluginDrawingClient({ clientId: 'r1', surface: 'sidebar', viewport: { width: 10 } }), true);
  assert.equal(attachPluginDrawingClient({ clientId: 'r1', surface: 'sidebar', viewport: { height: 4 } }), false);
  assert.deepEqual(pluginDrawingClients(), [{ clientId: 'r1', surface: 'sidebar', viewport: { width: 10, height: 4 } }]);
  assert.equal(attachPluginDrawingClient({ clientId: 'r1', surface: 'sidebar' }), false);
  assert.equal(hasPluginDrawingSurface('sidebar'), true);
  assert.deepEqual(pluginDrawingSurfaceNames(), ['sidebar']);

  const reports: string[] = [];
  const unbind = onPluginDrawingDetach((clientId: string) => reports.push(clientId));
  markPluginDrawingMissed('r1');
  assert.equal(isPluginDrawingSilent('r1'), true);
  markPluginDrawingHeard('r1');
  assert.equal(isPluginDrawingSilent('r1'), false);

  const dropped = detachPluginDrawingClient('r1');
  assert.equal(dropped?.clientId, 'r1');
  assert.deepEqual(reports, ['r1']);
  assert.deepEqual(pluginDrawingClients(), []);
  assert.equal(detachPluginDrawingClient('r1'), undefined);
  unbind();
});

test('the two copied helpers answer the source\'s own way', () => {
  assert.equal(countMatching([1, 2, 3, 4], (n) => n % 2 === 0), 2);
  assert.equal(countMatching([], () => true), 0);
  assert.equal(contentIsToolResults([{ type: 'tool_result' }]), true);
  assert.equal(contentIsToolResults([{ type: 'text' }]), false);
  assert.equal(contentIsToolResults('a string is never tool results'), false);
});
