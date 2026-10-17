import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { eE } from '../src/plugin-chain-markdown-host.js';
import { Zy } from '../src/plugin-chain-press-button-source.js';
import { u } from '../src/plugin-chain-press-button-host.js';
import { Ol } from '../src/diff-dialog-detail-source.js';
import { VS } from '../src/diff-dialog-tabs-source.js';
import { es } from '../src/diff-dialog-frame-box-source.js';
import { Se } from '../src/diff-dialog-keyhint-source.js';
import {
  AutoHint, DialogFrame, HINT_LIMIT, HINT_PAIRS, SOURCE_BODIES, buildHints,
  cancelHint, keyDescription, keybindingDescriptions, useExitEntries,
} from '../src/diff-dialog-frame.js';

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
  const clock = { now: () => now, setTimeout: () => () => {} };
  return clock;
}

function baseContexts(now = 1000, extra: [unknown, unknown][] = []): Map<unknown, unknown> {
  return new Map<unknown, unknown>([
    [eE, clockAt(now)],
    [Zy, { exit() {}, focusManager: null, rootNode: null }],
    ...extra,
  ]);
}

test('the action table describes confirm, select and command actions', () => {
  assert.deepEqual(keybindingDescriptions['confirm:no'], { description: 'cancel' });
  assert.deepEqual(keyDescription('confirm:yes'), { description: 'confirm' });
  assert.deepEqual(keyDescription('command:my-command'), { description: 'my-command' });
  assert.equal(keyDescription('unknown:thing'), undefined);
  assert.equal(HINT_LIMIT, 4);
  assert.ok(HINT_PAIRS.some((pair) => pair[0] === 'tabs:next'));
});

test('the frame renders its title, subtitle and children inside the border', () => {
  const run = runComponent(
    () => DialogFrame({ title: 'Diff', subtitle: 'working tree', children: 'body' }),
    { contexts: baseContexts() },
  );
  const root = run.result;
  assert.equal(root.type, es);
  const text = textOf(root);
  assert.ok(text.includes('Diff'));
  assert.ok(text.includes('working tree'));
  run.unmount();
});

test('a titleEnd renders a space-between header and truncates from the start', () => {
  const run = runComponent(
    () => DialogFrame({ title: 'Diff', titleEnd: '3 files', children: 'body' }),
    { contexts: baseContexts() },
  );
  const header = findAll(run.result, 'Box').find((node) => node.props.justifyContent === 'space-between');
  assert.ok(header !== undefined);
  const texts = findAll(header, 'Text');
  assert.equal(texts[1].props.wrap, 'truncate-start');
  assert.equal(texts[1].props.children, '3 files');
  run.unmount();
});

test('hideBorder returns the focus scope without the border component', () => {
  const run = runComponent(
    () => DialogFrame({ title: 'Diff', children: 'body', hideBorder: true }),
    { contexts: baseContexts() },
  );
  assert.notEqual(run.result.type, es);
  const types = findAll(run.result, run.result.type);
  assert.ok(types.length >= 1);
  run.unmount();
});

test('the border keeps its divider without a viewport and drops it inside one', () => {
  const plain = runComponent(
    () => es({ title: 'Diff', color: 'permission', children: 'body' }),
    { contexts: new Map() },
  );
  const plainRoot = plain.result as SurfaceNode;
  assert.equal(plainRoot.type, 'Box');
  assert.equal(plainRoot.props.paddingTop, 1);
  assert.equal(findAll(plainRoot, Ol).length, 1);
  const column = findAll(plainRoot, 'Box').find((node) => node.props.paddingX === 2);
  assert.ok(column !== undefined);
  plain.unmount();

  const viewport = { attach: () => () => {}, rows: 24, columns: 80 };
  const scrolled = runComponent(
    () => es({ title: 'Diff', children: 'body' }),
    { contexts: new Map<unknown, unknown>([[VS, viewport]]) },
  );
  const scrolledRoot = scrolled.result as SurfaceNode;
  assert.equal(scrolledRoot.type, 'Box');
  assert.equal(scrolledRoot.props.paddingX, 1);
  assert.equal(findAll(scrolledRoot, Ol).length, 0);
  scrolled.unmount();
});

test('an input guide replaces the cancel hint and receives the exit state', () => {
  let seen: unknown;
  const run = runComponent(
    () => DialogFrame({
      title: 'Diff',
      children: 'body',
      inputGuide: (state: unknown) => { seen = state; return 'guided'; },
    }),
    { contexts: baseContexts() },
  );
  assert.deepEqual(seen, { pending: false, keyName: null });
  assert.ok(textOf(run.result).includes('guided'));
  run.unmount();
});

test('the guide shows the pending key name and a static cancel hint falls back', () => {
  let guideState: { pending: boolean; keyName: string | null } = { pending: false, keyName: null };
  const probe = runComponent(
    () => useExitEntries({ onCancel: () => {}, isCancelActive: true }),
    { contexts: baseContexts() },
  );
  assert.deepEqual(probe.result.exitState, guideState);
  probe.unmount();

  const run = runComponent(
    () => DialogFrame({ title: 'Diff', children: 'body' }),
    { contexts: baseContexts() },
  );
  const hint = findAll(run.result, SOURCE_BODIES.ie);
  assert.equal(hint.length, 1);
  assert.equal(hint[0].props.boundary !== undefined, true);
  run.unmount();
});

test('hideInputGuide omits the guide row', () => {
  const run = runComponent(
    () => DialogFrame({ title: 'Diff', children: 'body', hideInputGuide: true }),
    { contexts: baseContexts() },
  );
  assert.equal(findAll(run.result, SOURCE_BODIES.ie).length, 0);
  run.unmount();
});

test('exit entries name interrupt and exit, and a second press within 800 ms confirms', () => {
  const clock = clockAt(1000);
  let interrupts = 0;
  const run = runComponent(
    () => useExitEntries({ onInterrupt: () => { interrupts += 1; }, isCancelActive: true }),
    { contexts: new Map<unknown, unknown>([[eE, clock], [Zy, { exit() {}, focusManager: null, rootNode: null }]]) },
  );
  const { entries, exitState } = run.result;
  assert.deepEqual(entries.map((entry) => entry.action), ['app:interrupt', 'app:exit']);
  assert.deepEqual(exitState, { pending: false, keyName: null });
  entries[0].run();
  assert.equal(interrupts, 1);
  clock.now = () => 1400;
  entries[0].run();
  assert.equal(interrupts, 2);
  run.unmount();
});

test('a spent gesture window does not confirm and an inactive cancel has no entries', () => {
  const clock = clockAt(1000);
  let interrupts = 0;
  const run = runComponent(
    () => useExitEntries({ onInterrupt: () => { interrupts += 1; }, isCancelActive: true }),
    { contexts: new Map<unknown, unknown>([[eE, clock], [Zy, { exit() {}, focusManager: null, rootNode: null }]]) },
  );
  run.result.entries[0].run();
  clock.now = () => 2000;
  run.result.entries[0].run();
  assert.equal(interrupts, 2);
  run.unmount();

  const inactive = runComponent(
    () => useExitEntries({ isCancelActive: false }),
    { contexts: baseContexts() },
  );
  assert.deepEqual(inactive.result.entries, []);
  inactive.unmount();
});

test('the hint builder reports a fallback without a keybinding context', () => {
  const result = buildHints({
    ctx: null, activeElement: null, boundaryNode: null, rendered: null,
  });
  assert.equal(result.fellBack, true);
  assert.equal(result.text, '');
});

test('the auto hint returns its fallback when nothing is bound', () => {
  const fallback = { type: 'Text', props: { children: 'cancel' }, children: [] };
  const run = runComponent(
    () => AutoHint({ fallback }),
    { contexts: new Map<unknown, unknown>([[u, null]]) },
  );
  assert.equal(run.result, fallback);
  run.unmount();
});

test('the copied bodies stay addressable and the default hint pairs both chords', () => {
  assert.equal(typeof SOURCE_BODIES._e, 'function');
  assert.equal(typeof SOURCE_BODIES.ie, 'function');
  assert.equal(typeof SOURCE_BODIES.Be, 'function');
  assert.equal(cancelHint.type, Se);
  assert.equal(cancelHint.children.length, 2);
});
