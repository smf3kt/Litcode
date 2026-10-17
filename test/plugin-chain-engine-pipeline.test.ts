import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  READER_LIMIT,
  RENDER_SITE,
  REQUEST_ENTRY_LIMIT,
  chainRegistry,
  clientRowKey,
  coreHandler,
  createRowMetrics,
  dispatchLifecycle,
  drawingInstance,
  engineRenderHost,
  forgetVersionReads,
  invalidTreeText,
  runEnginePipeline,
  unwrapDispatchAnswer,
} from '../src/plugin-chain-engine-pipeline.js';
import { che } from '../src/plugin-chain-terminal-host.js';
import { descriptorInput } from '../src/plugin-chain-terminal.js';

const renderInput = { component: 'Probe', requestId: '', surface: 'terminal', props: {} };

test('the pipeline draws the engine node and keeps the dispatch input', async () => {
  const input = { ...renderInput, props: {} };
  const drawn = (await runEnginePipeline(input)) as { type: string; ref: number };
  assert.equal(drawn.type, 'engine');
  assert.equal(typeof drawn.ref, 'number');
  assert.equal(descriptorInput(drawn, drawn.ref), input);
  assert.equal((RENDER_SITE as { event?: string }).event, 'ui.render');
  assert.equal(REQUEST_ENTRY_LIMIT, 64);
  assert.equal(READER_LIMIT, 4000);
});

test('importing the seam installs the render answer host', async () => {
  const drawn = (await engineRenderHost.uiRender(renderInput, {})) as { type: string };
  assert.equal(drawn.type, 'engine');
  const viaClient = (await che().ui.render({ ...renderInput })) as { type: string };
  assert.equal(viaClient.type, 'engine');
});

test('the core handler keeps the drawn tree and answers the engine node', async () => {
  const kept: Array<[unknown, unknown]> = [];
  const handler = coreHandler({ keep: (value, made) => (kept.push([value, made]), kept.length) }, (input) => input);
  assert.equal(handler.name, 'core');
  assert.equal(handler.isCore, true);
  assert.equal(handler.budgetMs, 0);
  const answer = await handler.run({ tree: 1 });
  assert.deepEqual(answer, { type: 'engine', ref: 1 });
  assert.deepEqual(kept, [[{ tree: 1 }, undefined]]);
});

test('a drawing instance and a dispatch lifecycle carry the render fields', () => {
  const instance = drawingInstance('k', renderInput, () => ['p']);
  assert.equal(instance.instanceKey, 'k');
  assert.deepEqual(instance.instance, { surface: 'terminal', component: 'Probe', requestId: '' });
  assert.deepEqual(instance.pluginsOf(), ['p']);
  assert.equal(instance.isInFlight, true);
  assert.ok(instance.versionsRead instanceof Map);
  assert.deepEqual(dispatchLifecycle({ drawing: instance }), { drawing: instance, isEnded: false });
});

test('the row key and the refusal sentence are the source sentences', () => {
  assert.equal(clientRowKey({ plugin: 'p', key: 'k' }), 'p k');
  assert.equal(invalidTreeText('C', 'a bad tree'), 'ui.render (C) refused: a bad tree; the engine drew its own');
});

test('the dispatch answer copy repairs lone surrogates and keeps clean answers', () => {
  const clean = { type: 'Text', children: ['ok'] };
  assert.equal(unwrapDispatchAnswer(clean), clean);
  const broken = { type: 'Text', children: ['a\ud800b'] };
  const copied = unwrapDispatchAnswer(broken) as { children: string[] };
  assert.equal(copied.children[0], 'a�b');
  assert.equal(broken.children[0], 'a\ud800b');
  assert.equal(unwrapDispatchAnswer('a\udfffb'), 'a�b');
});

test('forgetting an instance drops its render-version reads', () => {
  const store = chainRegistry().renderVersions;
  assert.ok(store !== null);
  const before = new Map(store.getState());
  store.setState(() => new Map([['one\u0000state', 1], ['two\u0000state', 2]]));
  try {
    forgetVersionReads(['one']);
    assert.equal(store.getState().has('one\u0000state'), false);
    assert.equal(store.getState().has('two\u0000state'), true);
  } finally {
    store.setState(() => before);
  }
});

test('the row metrics close at the line cap and report freed rows', () => {
  const metrics = createRowMetrics();
  const freed: string[] = [];
  const stop = metrics.onFreed((requestId) => freed.push(requestId));
  const c1 = { requestId: 'r', plugin: 'p', key: 'k1' };
  const c2 = { requestId: 'r', plugin: 'p', key: 'k2' };
  assert.equal(metrics.clientRows(c1), 1);
  metrics.recordOwn('r', 5);
  metrics.recordClient(c1, 3);
  assert.equal(metrics.clientRows(c1), 3);
  assert.equal(metrics.fits(c1, 7), true);
  assert.equal(metrics.fits(c1, 8), false);
  metrics.recordClient(c2, 4);
  assert.equal(metrics.fits(c1, 3), true);
  assert.equal(metrics.fits(c1, 4), false);
  metrics.recordOwn('r', 2);
  metrics.dropClient(c2);
  assert.deepEqual(freed, ['r', 'r']);
  stop();
  metrics.clear();
  assert.equal(metrics.clientRows(c1), 1);
});
