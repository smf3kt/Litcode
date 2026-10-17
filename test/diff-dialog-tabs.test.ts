import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ScrollBox, SOURCE_BODIES, TabContent, TabHeader, TabStateContext, Tabs,
  nextHeaderIndex, nextTabIndex, previousHeaderIndex, tabKey, tabLabelWidth,
  useOptInCounter, useStrayClickFilter,
} from '../src/diff-dialog-tabs.js';
import { Xe, runComponent } from '../src/plugin-chain-react-hooks.js';
import { Zm } from '../src/plugin-chain-input-field-source.js';
import { Zy } from '../src/plugin-chain-press-button-source.js';
import { eE } from '../src/plugin-chain-markdown-host.js';

interface SurfaceNode {
  type: unknown;
  props: Record<string, unknown>;
  children: unknown[];
  key?: string | null;
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

function contexts(): Map<unknown, unknown> {
  return new Map<unknown, unknown>([
    [Zm, { columns: 80, rows: 24 }],
    [Zy, { focusManager: null, rootNode: null }],
  ]);
}

const headerState = {
  selectedTab: 'one',
  width: 40,
  headerFocused: false,
  focusHeader() {},
  blurHeader() {},
  registerOptIn: () => () => {},
  registerNavigationOwner: () => () => {},
};

test('the tab helpers read the key, advance the index, and add the padded label width', () => {
  assert.deepEqual(tabKey({ props: { title: 'One' } }), ['One', 'One']);
  assert.deepEqual(tabKey({ props: { id: 'one', title: 'One' } }), ['one', 'One']);
  assert.equal(nextTabIndex(2), 3);
  assert.equal(tabLabelWidth(0, ['one', 'One']), 3 + 2 + 1);
  assert.equal(tabLabelWidth(5, ['x', '']), 5 + 2 + 1);
  assert.equal(nextHeaderIndex(3), 4);
  assert.equal(previousHeaderIndex(3), 2);
});

test('the strip renders the title, one header per child, and the first tab selected', () => {
  const children = [
    Xe(SOURCE_BODIES.Na, { title: 'One', id: 'one', children: 'first' }),
    Xe(SOURCE_BODIES.Na, { title: 'Two', children: 'second' }),
  ];
  const run = runComponent(
    () => Tabs({ title: 'Files', children: children as never }),
    { contexts: contexts() },
  );
  const root = run.result;
  assert.equal(root.type, TabStateContext);
  const state = root.props.value as typeof headerState;
  assert.equal(state.selectedTab, 'one');
  assert.equal(state.headerFocused, true);
  assert.equal(state.width, undefined);
  const text = textOf(root);
  assert.ok(text.includes('Files'));
  const headers = findAll(root, SOURCE_BODIES.je);
  assert.deepEqual(headers.map((header) => header.props.title), ['One', 'Two']);
  assert.equal(headers[0].props.isCurrent, true);
  assert.equal(headers[1].props.isCurrent, false);
  assert.equal(findAll(root, SOURCE_BODIES.Na).length, 2);
  run.unmount();
});

test('a controlled selectedTab wins, and an unknown title falls back to the first tab', () => {
  const children = [
    Xe(SOURCE_BODIES.Na, { title: 'One', id: 'one', children: 'first' }),
    Xe(SOURCE_BODIES.Na, { title: 'Two', id: 'two', children: 'second' }),
  ];
  const known = runComponent(
    () => Tabs({ children: children as never, selectedTab: 'two' }),
    { contexts: contexts() },
  );
  assert.equal((known.result.props.value as typeof headerState).selectedTab, 'two');
  known.unmount();

  const unknown = runComponent(
    () => Tabs({ children: children as never, selectedTab: 'missing' }),
    { contexts: contexts() },
  );
  assert.equal((unknown.result.props.value as typeof headerState).selectedTab, 'one');
  unknown.unmount();
});

test('the hidden strip omits the title and header row but keeps the content area', () => {
  const children = [Xe(SOURCE_BODIES.Na, { title: 'One', children: 'first' })];
  const run = runComponent(
    () => Tabs({ title: 'Files', children: children as never, hidden: true }),
    { contexts: contexts() },
  );
  const text = textOf(run.result);
  assert.ok(!text.includes('Files'));
  assert.equal(findAll(run.result, SOURCE_BODIES.Na).length, 1);
  run.unmount();
});

test('the banner renders above the content area', () => {
  const children = [Xe(SOURCE_BODIES.Na, { title: 'One', children: 'first' })];
  const run = runComponent(
    () => Tabs({ children: children as never, banner: 'banner text' }),
    { contexts: contexts() },
  );
  assert.ok(textOf(run.result).includes('banner text'));
  run.unmount();
});

test('tab content renders only under its own selected tab and takes the context width', () => {
  const selected = runComponent(
    () => TabContent({ id: 'one', title: 'One', children: 'body' }),
    { contexts: new Map<unknown, unknown>([[TabStateContext, headerState]]) },
  );
  assert.equal(selected.result?.type, 'Box');
  assert.equal(selected.result?.props.width, 40);
  selected.unmount();

  const other = runComponent(
    () => TabContent({ title: 'Two', children: 'body' }),
    { contexts: new Map<unknown, unknown>([[TabStateContext, headerState]]) },
  );
  assert.equal(other.result, null);
  other.unmount();
});

test('a current tab header renders inverse with its padded label and leaves when not current', () => {
  const clock = { now: () => 0 };
  const tabContexts = () => new Map<unknown, unknown>([[eE, clock]]);
  const current = runComponent(() => TabHeader({ title: 'One', isCurrent: true }), { contexts: tabContexts() });
  assert.equal(current.result.type, 'Box');
  assert.equal(textOf(current.result), ' One ');
  const label = findAll(current.result, 'Text')[0];
  assert.equal(label.props.inverse, true);
  assert.equal(label.props.bold, true);
  current.unmount();

  const active = runComponent(
    () => TabHeader({ title: 'One', isCurrent: true, headerFocused: true }),
    { contexts: tabContexts() },
  );
  assert.equal(textOf(active.result), ' One ');
  assert.equal(active.result.props.onMouseEnter !== undefined, true);
  active.unmount();
});

test('the scroll box paints a scrolling ink box and publishes its handle to the ref', () => {
  const ref: { current: unknown } = { current: null };
  const run = runComponent(
    () => ScrollBox({ ref, children: 'body' }),
    { contexts: contexts() },
  );
  const root = run.result;
  assert.equal(root.type, 'ink-box');
  const style = root.props.style as Record<string, unknown>;
  assert.equal(style.overflowX, 'scroll');
  assert.equal(style.overflowY, 'scroll');
  const handle = ref.current as Record<string, unknown>;
  assert.equal(typeof handle.scrollToBottom, 'function');
  assert.equal(typeof handle.getScrollTop, 'function');
  assert.equal((handle.getScrollTop as () => number)(), 0);
  run.unmount();
  assert.equal(ref.current, null);
});

test('the opt-in counter starts at zero and returns a setter', () => {
  const run = runComponent(() => useOptInCounter());
  assert.equal(run.result[0], false);
  assert.equal(typeof run.result[1], 'function');
  run.unmount();
});

test('the stray click filter drops window activations and clicks inside the mount window', () => {
  const clock = { now: () => 1000 };
  const run = runComponent(() => useStrayClickFilter(), {
    contexts: new Map<unknown, unknown>([[eE, clock]]),
  });
  const filter = run.result;
  let dropped = 0;
  const event = () => ({ isWindowActivation: false, dropAsStray: () => { dropped += 1; } });
  assert.equal(filter(event()), true);
  clock.now = () => 1100;
  assert.equal(filter(event()), true);
  assert.equal(dropped, 2);
  clock.now = () => 1400;
  assert.equal(filter(event()), false);
  assert.equal(filter({ isWindowActivation: true, dropAsStray: () => { dropped += 1; } }), true);
  assert.equal(dropped, 3);
  run.unmount();
});

test('the copied bodies stay addressable under their source names', () => {
  assert.equal(SOURCE_BODIES.g, TabStateContext);
  assert.equal(typeof SOURCE_BODIES.sS, 'function');
  assert.equal(typeof SOURCE_BODIES.Na, 'function');
  assert.equal(typeof SOURCE_BODIES.OT, 'function');
  assert.equal(typeof SOURCE_BODIES.aS, 'function');
});
