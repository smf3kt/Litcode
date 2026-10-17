import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pluralize, DiffStatLabel, SOURCE_BODIES } from '../src/diff-dialog-primitives.js';
import { runComponent } from '../src/plugin-chain-react-surface.js';

interface SurfaceNode {
  type: unknown;
  props: Record<string, unknown>;
  children: unknown[];
}

test('the plural helper selects one word and defaults the plural suffix', () => {
  assert.equal(pluralize(0, 'file'), 'files');
  assert.equal(pluralize(1, 'file'), 'file');
  assert.equal(pluralize(2, 'file'), 'files');
  assert.equal(pluralize(1, 'entry', 'entries'), 'entry');
  assert.equal(pluralize(5, 'entry', 'entries'), 'entries');
});

test('the stat label renders plus and minus words with the theme colors', () => {
  const run = runComponent(() => DiffStatLabel({ added: 2, removed: 1, bold: true }));
  const root = run.root as unknown as SurfaceNode;
  assert.equal(root.type, 'Text');
  assert.equal(root.children.length, 3);
  const added = root.children[0] as SurfaceNode;
  assert.deepEqual(added.props, { color: 'diffAddedWord', bold: true, children: ['+', 2] });
  assert.equal(root.children[1], ' ');
  const removed = root.children[2] as SurfaceNode;
  assert.deepEqual(removed.props, { color: 'diffRemovedWord', bold: true, children: ['-', 1] });
  run.unmount();
});

test('a one-sided stat label drops the empty side and the separator', () => {
  const addedRun = runComponent(() => DiffStatLabel({ added: 2, removed: 0 }));
  const addedRoot = addedRun.root as unknown as SurfaceNode;
  assert.deepEqual(addedRoot.props.children, [
    { type: 'Text', props: { color: 'diffAddedWord', bold: undefined, children: ['+', 2] }, children: ['+', '2'], key: null },
    false, false,
  ]);
  assert.equal(addedRoot.children.length, 1);
  addedRun.unmount();

  const removedRun = runComponent(() => DiffStatLabel({ added: 0, removed: 3 }));
  const removedRoot = removedRun.root as unknown as SurfaceNode;
  assert.equal(removedRoot.children.length, 1);
  assert.deepEqual((removedRoot.children[0] as SurfaceNode).props, {
    color: 'diffRemovedWord', bold: undefined, children: ['-', 3],
  });
  removedRun.unmount();
});

test('an all-zero stat label renders nothing', () => {
  const run = runComponent(() => DiffStatLabel({ added: 0, removed: 0 }));
  assert.equal(run.result, null);
  assert.equal(run.root, undefined);
  run.unmount();
});

test('the copied bodies are exposed under their source names', () => {
  assert.equal(SOURCE_BODIES.I(1, 'file'), 'file');
  assert.equal(SOURCE_BODIES.I(2, 'file'), 'files');
  const run = runComponent(() => SOURCE_BODIES.Ib({ added: 1, removed: 0 }));
  assert.notEqual(run.result, null);
  run.unmount();
});
