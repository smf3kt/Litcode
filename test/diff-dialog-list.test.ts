import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { eE } from '../src/plugin-chain-markdown-host.js';
import { Zm } from '../src/plugin-chain-input-field-source.js';
import {
  List, ListContainer, ListHeading, ListItem, ListSelectionContext, SOURCE_BODIES,
  useListNavigation, useListSelection,
} from '../src/diff-dialog-list.js';
import { Qe, _C } from '../src/diff-dialog-list-source.js';

interface SurfaceNode {
  type: unknown;
  props: Record<string, unknown>;
  children: unknown[];
}

function isNode(value: unknown): value is SurfaceNode {
  return typeof value === 'object' && value !== null && 'type' in value && 'props' in value;
}

function textOf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isNode(node)) return textOf(node.props.children);
  return '';
}

function findAll(node: unknown, type: unknown, out: SurfaceNode[] = []): SurfaceNode[] {
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, type, out);
    return out;
  }
  if (!isNode(node)) return out;
  if (node.type === type) out.push(node);
  findAll(node.props.children, type, out);
  return out;
}

function clockAt(now: number) {
  return { now: () => now, setTimeout: () => () => {} };
}

function listContexts(extra: [unknown, unknown][] = []): Map<unknown, unknown> {
  return new Map<unknown, unknown>([
    [eE, clockAt(1000)],
    [Zm, { rows: 24, columns: 40 }],
    ...extra,
  ]);
}

test('the list carries its item and heading statics', () => {
  const statics = List as unknown as { Item: unknown; Heading: unknown };
  assert.equal(statics.Item, SOURCE_BODIES.Po);
  assert.equal(statics.Heading, SOURCE_BODIES.Bo);
  assert.equal(SOURCE_BODIES.Tl, List);
});

test('the list dispatches a visible count to the windowed body', () => {
  const run = runComponent(
    () => List({ children: ['alpha', 'beta'], visibleCount: 10 }),
    { contexts: listContexts() },
  );
  assert.equal((run.result as SurfaceNode).type, Qe);
  run.unmount();
});

test('the windowed body renders its rows', () => {
  const run = runComponent(
    () => Qe({ props: { children: ['alpha', 'beta', 'gamma'] } as never, visibleCount: 10 }),
    { contexts: listContexts() },
  );
  const text = textOf(run.result);
  assert.ok(text.includes('alpha'));
  assert.ok(text.includes('beta'));
  assert.ok(text.includes('gamma'));
  run.unmount();
});

test('an empty list renders its empty message', () => {
  const run = runComponent(
    () => Qe({ props: { children: [], emptyMessage: 'nothing here' } as never, visibleCount: 10 }),
    { contexts: listContexts() },
  );
  assert.ok(textOf(run.result).includes('nothing here'));
  run.unmount();
});

test('an item and a heading wrap their children in a fragment', () => {
  const item = runComponent(() => ListItem({ children: 'row' }), { contexts: new Map() });
  assert.equal(textOf(item.result), 'row');
  item.unmount();
  const heading = runComponent(() => ListHeading({ children: 'group' }), { contexts: new Map() });
  assert.equal(textOf(heading.result), 'group');
  heading.unmount();
});

test('a measured list container provides its context to the list', () => {
  const run = runComponent(
    () => ListContainer({ reserve: 2, children: 'body' }),
    { contexts: listContexts() },
  );
  assert.ok(textOf(run.result).includes('body'));
  run.unmount();
});

test('the selection reader follows its context', () => {
  const inside = runComponent(
    () => useListSelection(),
    { contexts: new Map<unknown, unknown>([[ListSelectionContext, true]]) },
  );
  assert.equal(inside.result, true);
  inside.unmount();
  const outside = runComponent(() => useListSelection(), { contexts: new Map() });
  assert.equal(outside.result, false);
  outside.unmount();
});

test('list navigation reports the initial cursor and window', () => {
  const run = runComponent(
    () => useListNavigation({ count: 3, visibleCount: 2, rowHeights: [1, 1, 1] }),
    { contexts: listContexts() },
  );
  const state = run.result as Record<string, unknown>;
  assert.equal(state.cursor, 0);
  assert.equal((state.isCursor as (index: number) => boolean)(0), true);
  assert.equal((state.isCursor as (index: number) => boolean)(1), false);
  assert.equal(typeof state.windowStart, 'number');
  assert.equal(typeof state.windowEnd, 'number');
  const bind = state.bind as Record<string, unknown>;
  assert.equal(typeof bind.onKeyDown, 'function');
  assert.equal(typeof state.setCursor, 'function');
  assert.equal(typeof state.scrollToEdge, 'function');
  run.unmount();
});

test('navigation clamps its cursor to the row count', () => {
  const run = runComponent(
    () => useListNavigation({ count: 0, visibleCount: 1 }),
    { contexts: listContexts() },
  );
  const state = run.result as Record<string, unknown>;
  assert.equal(state.cursor, 0);
  assert.equal((state.isCursor as (index: number) => boolean)(0), false);
  run.unmount();
});

test('the list tree keeps headings out of the selectable rows', () => {
  const headingRun = runComponent(() => ListHeading({ children: 'H' }), { contexts: listContexts() });
  const heading = headingRun.result;
  const run = runComponent(
    () => Qe({ props: { children: [heading, 'row'] } as never, visibleCount: 10 }),
    { contexts: listContexts() },
  );
  const rows = findAll(run.result, _C);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].props.styled, false);
  assert.ok(textOf(run.result).includes('H'));
  assert.ok(textOf(run.result).includes('row'));
  run.unmount();
  headingRun.unmount();
});
