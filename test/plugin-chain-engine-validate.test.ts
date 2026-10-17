import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEPTH_LIMIT,
  DIALOG_COMPONENT,
  DIALOG_ROW_LIMIT,
  ELEMENT_TYPES,
  HOVER_SCOPE_LIMIT,
  IMAGE_BYTE_LIMIT,
  NODE_LIMIT,
  RASTER_CELL_LIMIT,
  SURFACE_ELEMENTS,
  validateDrawnTree,
} from '../src/plugin-chain-engine-validate.js';

const press = { plugin: 'p', handle: 1 };

test('the walk rejects roots, text and non-nodes before any element rule', () => {
  assert.equal(validateDrawnTree('hi', 'C'), 'the root must be an element');
  assert.equal(validateDrawnTree({ type: 'Box', children: ['a\u0007'] }, 'C'), 'a text child holds a control character (an escape sequence)');
  assert.equal(validateDrawnTree(7, 'C'), 'node is a number');
  assert.equal(
    validateDrawnTree({ type: 'Nope' }, 'C'),
    `"Nope" is not an element (the elements are ${ELEMENT_TYPES.join(', ')}, from $.ui.resolve(e))`,
  );
});

test('an engine node needs a whole-number ref and may not sit inline or in a Button', () => {
  assert.equal(validateDrawnTree({ type: 'engine' }, 'C'), 'engine node without a ref');
  assert.equal(validateDrawnTree({ type: 'engine', ref: 0 }, 'C'), undefined);
  assert.equal(validateDrawnTree({ type: 'Text', children: [{ type: 'engine', ref: 0 }] }, 'C'), 'engine node inside an inline element');
  assert.equal(
    validateDrawnTree({ type: 'Button', props: { key: 'b', label: 'L' }, press, children: [{ type: 'engine', ref: 0 }] }, 'C'),
    'engine node inside Button "b" (a Button holds strings and Text)',
  );
});

test('a surface admits only its own elements', () => {
  assert.equal(validateDrawnTree({ type: 'Svg' }, 'C', { surface: 'terminal' }), 'Svg is not an element of the terminal surface');
  assert.equal(validateDrawnTree({ type: 'Input' }, 'C', { surface: 'mobile' }), 'Input is not an element of the mobile surface');
  assert.equal(validateDrawnTree({ type: 'Input', props: { key: 'i' }, press }, 'C', { surface: 'vscode' }), undefined);
  assert.deepEqual(SURFACE_ELEMENTS.terminal, ['Box', 'Text', 'Button', 'Input', 'Select', 'Link', 'Code', 'Markdown', 'Client', 'Raster', 'Image']);
});

test('props are checked for name, scalar kind and the value rules', () => {
  assert.equal(validateDrawnTree({ type: 'Box', props: { bogus: 1 } }, 'C'), 'Box prop "bogus" is not allowed');
  assert.equal(validateDrawnTree({ type: 'Box', props: { backgroundColor: {} } }, 'C'), 'Box prop "backgroundColor" is an object');
  assert.equal(validateDrawnTree({ type: 'Box', props: { width: -1 } }, 'C'), 'Box prop "width" must be a finite number between 0 and 10000');
  assert.equal(validateDrawnTree({ type: 'Box', props: { borderStyle: 'bogus' } }, 'C'), undefined);
});

test('a block element may not sit inside an inline one', () => {
  assert.equal(validateDrawnTree({ type: 'Text', children: [{ type: 'Box' }] }, 'C'), 'Box inside an inline element');
  assert.equal(validateDrawnTree({ type: 'Text', children: [{ type: 'Text', children: ['x'] }] }, 'C'), undefined);
});

test('a Button takes strings and Text only, and its press must be held by a plugin', () => {
  assert.equal(
    validateDrawnTree({ type: 'Button', props: { key: 'b', label: 'L' } }, 'C'),
    'Button "b" is not held by a plugin of this chain',
  );
  assert.equal(validateDrawnTree({ type: 'Button', props: { key: 'b', label: 'L' }, press }, 'C'), undefined);
  assert.equal(
    validateDrawnTree({ type: 'Button', props: { key: 'b', label: 'L' }, press, children: [{ type: 'Box' }] }, 'C'),
    'Box inside Button "b" (a Button holds strings and Text)',
  );
  assert.equal(
    validateDrawnTree({ type: 'Button', props: { key: 'b', label: 'L' }, press, children: [{ type: 'Text', children: ['x'] }] }, 'C'),
    undefined,
  );
});

test('a Link uses the leaf validator and invalid keys are noted without failing the tree', () => {
  assert.equal(validateDrawnTree({ type: 'Link' }, 'C'), 'Link props must be { href }');
  assert.equal(validateDrawnTree({ type: 'Link', props: { href: 'x', extra: 1 } }, 'C'), 'Link prop "extra" is not allowed');
  assert.equal(validateDrawnTree({ type: 'Link', props: { href: 'not a url' } }, 'C', { surface: 'desktop' }), undefined);

  const notes: string[] = [];
  validateDrawnTree({ type: 'Box', props: { key: 'a\u0007' } }, 'C', { note: problem => notes.push(problem) });
  assert.deepEqual(notes, ['Box "a?" key holds a control character; it is dropped and names no hover scope']);

  const duplicates: string[] = [];
  validateDrawnTree({
    type: 'Box',
    children: [{ type: 'Box', props: { key: 'k' } }, { type: 'Box', props: { key: 'k' } }],
  }, 'C', { note: problem => duplicates.push(problem) });
  assert.deepEqual(duplicates, ['Box "k" is drawn twice under one parent; only the first is a hover scope']);
});

test('the dialog component needs exactly one engine node and a bounded tree', () => {
  assert.equal(
    validateDrawnTree({ type: 'Box' }, DIALOG_COMPONENT),
    `${0} engine nodes; ${DIALOG_COMPONENT} is drawn by exactly one`,
  );
  let rows: number | undefined;
  assert.equal(
    validateDrawnTree({ type: 'Box', children: [{ type: 'engine', ref: 0 }] }, DIALOG_COMPONENT, { measured: value => { rows = value; } }),
    undefined,
  );
  assert.equal(rows, 0);
  assert.equal(
    validateDrawnTree({ type: 'Box', props: { position: 'relative' } }, DIALOG_COMPONENT),
    'Box prop "position" around the dialog',
  );
  assert.equal(
    validateDrawnTree({ type: 'Box', children: [{ type: 'engine', ref: 0 }, { type: 'Markdown', props: { text: 'x' } }] }, DIALOG_COMPONENT),
    'Markdown around the dialog (its rows are not bounded there)',
  );
  assert.equal(
    validateDrawnTree({ type: 'Box', props: { padding: 7 }, children: [{ type: 'engine', ref: 0 }] }, DIALOG_COMPONENT),
    `more than ${DIALOG_ROW_LIMIT} rows around the dialog`,
  );
});

test('measured rows count spacing and text, and the limits are the source constants', () => {
  let rows: number | undefined;
  assert.equal(validateDrawnTree({ type: 'Box', props: { padding: 2 } }, 'C', { measured: value => { rows = value; } }), undefined);
  assert.equal(rows, 4);
  assert.equal(NODE_LIMIT, 20000);
  assert.equal(DEPTH_LIMIT, 32);
  assert.equal(DIALOG_ROW_LIMIT, 12);
  assert.equal(RASTER_CELL_LIMIT, 262144);
  assert.equal(IMAGE_BYTE_LIMIT, 2097152);
  assert.equal(HOVER_SCOPE_LIMIT, 64);
});

test('the depth limit stops a chain past it', () => {
  let tree: Record<string, unknown> = { type: 'Text', children: ['leaf'] };
  for (let i = 0; i <= DEPTH_LIMIT; i++) tree = { type: 'Box', children: [tree] };
  assert.equal(validateDrawnTree(tree, 'C'), `deeper than ${DEPTH_LIMIT}`);
});
