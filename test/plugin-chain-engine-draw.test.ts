import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  borderStyleIntoHover,
  measureCodeRows,
  removeDrawnKey,
  validateLinks,
  type DrawNode,
} from '../src/plugin-chain-engine-draw.js';

test('a borderStyle outside the table leaves props and hover and is dispatched', () => {
  const seen: string[] = [];
  const tree: DrawNode = {
    type: 'Box',
    props: { borderStyle: 'bogus', color: 'red' },
    hover: { borderStyle: 'single', backgroundColor: 'blue' },
    children: [{ type: 'Text', children: ['x'] }],
  };
  const out = borderStyleIntoHover(tree, style => seen.push(style));
  assert.deepEqual(seen, ['bogus']);
  assert.deepEqual(out.props, { color: 'red' });
  assert.deepEqual(out.hover, { backgroundColor: 'blue' });
  assert.deepEqual(out.children, tree.children);
});

test('a table border name is left where it is', () => {
  const tree: DrawNode = { type: 'Box', props: { borderStyle: 'round' } };
  const seen: string[] = [];
  assert.equal(borderStyleIntoHover(tree, style => seen.push(style)), tree);
  assert.deepEqual(seen, []);
});

test('a rejected Box key is removed; a usable one stays', () => {
  const box: DrawNode = { type: 'Box', props: { key: 'k', color: 'red' } };
  assert.equal(removeDrawnKey(box), box);
  const bad: DrawNode = { type: 'Box', props: { key: '\u0007' } };
  assert.deepEqual(removeDrawnKey(bad).props, {});
});

test('a refused Link becomes the Text it would have drawn', () => {
  const tree: DrawNode = {
    type: 'Box',
    children: [{ type: 'Link', props: { href: 'http://example.com', label: 'site' } }],
  };
  let problems: unknown;
  const out = validateLinks(tree, 'web', list => { problems = list; });
  assert.deepEqual(out.children, [{ type: 'Text', children: ['site'] }]);
  assert.deepEqual(problems, [{
    ordinal: 1,
    problem: 'is not https: (or http://localhost), and the web surface is sent no other link',
  }]);
});

test('a terminal surface keeps a Link whose href is merely a path', () => {
  const link: DrawNode = { type: 'Link', props: { href: 'docs/x' } };
  let called = false;
  const out = validateLinks(link, 'terminal', () => { called = true; });
  assert.equal(out, link);
  assert.equal(called, false);
});

test('a refused diff loses its format and start line and is reported by ordinal', () => {
  const tree: DrawNode = {
    type: 'Box',
    children: [{ type: 'Code', props: { source: 'not a diff', format: 'diff', startLine: 4, path: 'a.ts' } }],
  };
  const problems: unknown[] = [];
  const out = measureCodeRows(tree, problem => problems.push(problem));
  assert.deepEqual((out.children as DrawNode[])[0]!.props, { source: 'not a diff', path: 'a.ts' });
  assert.deepEqual(problems, [{ ordinal: 1, path: 'a.ts', problem: 'no @@ hunk header found' }]);
});
