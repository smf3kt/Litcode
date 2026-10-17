import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { eE } from '../src/plugin-chain-markdown-host.js';
import { Zm } from '../src/plugin-chain-input-field-source.js';
import { Zy } from '../src/plugin-chain-press-button-source.js';
import {
  DiffDialog, DiffDialogDataContext, SOURCE_BODIES, type DiffDialogData,
} from '../src/diff-dialog-dialog.js';
import { K, Vt, le, oe, pee } from '../src/diff-dialog-dialog-source.js';
import { Na, sS } from '../src/diff-dialog-tabs-source.js';
import { _e } from '../src/diff-dialog-frame-source.js';
import { Tl } from '../src/diff-dialog-list-source.js';
import { Ib } from '../src/diff-dialog-primitives-source.js';
import { bindWheelSettingsHost } from '../src/plugin-chain-wheel-glue-host.js';
import type { GitDiffData } from '../src/git-diff-data.js';

interface SurfaceNode {
  type: unknown;
  props: Record<string, unknown>;
  children?: unknown[];
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

function surfaceText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(surfaceText).join('');
  if (!isNode(node)) return '';
  const title = typeof node.props.title === 'string' ? node.props.title : surfaceText(node.props.title);
  const message = typeof node.props.message === 'string' ? node.props.message : '';
  return title + message + surfaceText(node.props.children);
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

function diffData(overrides: Partial<GitDiffData> = {}): GitDiffData {
  return {
    stats: null,
    files: [],
    hunks: new Map(),
    loading: false,
    source: { kind: 'working-tree' },
    baseMode: 'auto',
    ...overrides,
  } as GitDiffData;
}

function contexts(view: DiffDialogData): Map<unknown, unknown> {
  return new Map<unknown, unknown>([
    [eE, { now: () => 1000, setTimeout: () => () => {} }],
    [Zm, { rows: 30, columns: 80 }],
    [Zy, { exit() {}, focusManager: null, rootNode: null }],
    [DiffDialogDataContext, view],
  ]);
}

function renderDialog(view: DiffDialogData, messages: unknown[] = []) {
  return runComponent(
    () => DiffDialog({ messages: messages as never, onDone: () => {} }),
    { contexts: contexts(view) },
  );
}

test('the dialog exposes the copied component', () => {
  assert.equal(SOURCE_BODIES.si.name, 'si');
  const run = renderDialog({ data: diffData(), notice: null });
  assert.equal((run.result as SurfaceNode).type, _e);
  run.unmount();
});

test('an empty settled diff renders the current source and its empty message', () => {
  const run = renderDialog({ data: diffData(), notice: null });
  const text = surfaceText(run.result);
  assert.ok(text.includes('Uncommitted changes'));
  assert.ok(text.includes('(git diff HEAD)'));
  assert.ok(text.includes('No changes yet'));
  assert.equal(findAll(run.result, Na).length, 1);
  assert.equal(findAll(run.result, Na)[0].props.title, 'Current');
  run.unmount();
});

test('loading diff data renders the spinner message', () => {
  const run = renderDialog({ data: diffData({ loading: true }), notice: null });
  assert.ok(surfaceText(run.result).includes('Loading diff…'));
  run.unmount();
});

test('a notice replaces the empty message', () => {
  const run = renderDialog({ data: diffData(), notice: 'workspace unavailable' });
  assert.ok(textOf(run.result).includes('workspace unavailable'));
  run.unmount();
});

test('the file list renders each path and its stat label', () => {
  const files = [
    { path: 'src/a.ts', linesAdded: 2, linesRemoved: 1, isBinary: false, isLargeFile: false, isTruncated: false, isNewFile: false, isUntracked: false },
    { path: 'src/b.ts', linesAdded: 1, linesRemoved: 0, isBinary: false, isLargeFile: false, isTruncated: false, isNewFile: false, isUntracked: false },
  ];
  const data = diffData({
    stats: { filesCount: 2, linesAdded: 3, linesRemoved: 1 },
    files,
    hunks: new Map([['src/a.ts', []], ['src/b.ts', []]]),
  });
  const run = renderDialog({ data, notice: null });
  assert.ok(surfaceText(run.result).includes('files changed'));
  const stat = findAll(run.result, Ib);
  assert.equal(stat.length, 1);
  assert.deepEqual(stat[0].props, { added: 3, removed: 1 });
  const list = findAll(run.result, K);
  assert.equal(list.length, 1);
  assert.deepEqual((list[0].props.files as Array<{ path: string }>).map((file) => file.path), ['src/a.ts', 'src/b.ts']);
  run.unmount();

  for (const file of files) {
    const row = runComponent(() => oe({ file }), { contexts: contexts({ data, notice: null }) });
    assert.ok(textOf(row.result).includes(file.path));
    row.unmount();
    const wrapped = Vt(file) as SurfaceNode;
    assert.equal(wrapped.type, (Tl as unknown as { Item: unknown }).Item);
    assert.equal((wrapped.props.children as SurfaceNode).type, oe);
  }
});

test('one completed turn adds the second source tab', () => {
  const messages = [
    { type: 'user', message: { content: 'change a file' }, timestamp: 1 },
    {
      type: 'user',
      timestamp: 2,
      toolUseResult: {
        filePath: 'a.ts',
        structuredPatch: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: ['-a', '+b', '+c'] }],
      },
    },
  ];
  const run = renderDialog({ data: diffData(), notice: null }, messages);
  const tabs = findAll(run.result, Na);
  assert.equal(tabs.length, 2);
  assert.equal(tabs[0].props.title, 'Current');
  assert.equal(tabs[1].props.title, 'T1');
  run.unmount();
});

test('one source hides the tab strip', () => {
  const run = renderDialog({ data: diffData(), notice: null });
  const strip = findAll(run.result, sS)[0];
  assert.equal(strip.props.hidden, true);
  run.unmount();
});

test('the file list reports its empty hint', () => {
  const run = runComponent(
    () => K({ files: [], defaultFocusIndex: 0, resetKey: 0, onFocus: () => {}, onSelect: () => {} }),
    { contexts: contexts({ data: diffData(), notice: null }) },
  );
  assert.ok(textOf(run.result).includes('No changed files'));
  run.unmount();
});

test('the stat cell marks untracked, binary and large files', () => {
  const base = { path: 'x', linesAdded: 0, linesRemoved: 0, isBinary: false, isLargeFile: false, isTruncated: false, isNewFile: false, isUntracked: false };
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ ...base, isUntracked: true }, 'untracked'],
    [{ ...base, isBinary: true }, 'Binary file'],
    [{ ...base, isLargeFile: true }, 'Large file modified'],
    [{ ...base, linesAdded: 2, isTruncated: true }, '(truncated)'],
  ];
  for (const [file, expected] of cases) {
    const run = runComponent(() => le({ file, isSelected: false }), { contexts: contexts({ data: diffData(), notice: null }) });
    assert.ok(textOf(run.result).includes(expected), expected);
    run.unmount();
  }
});

test('pee scrolls by the delta or jumps to the bottom', () => {
  bindWheelSettingsHost({
    sourceOrder: () => [],
    projectSharesUserSettings: () => false,
    legacyConfig: () => ({}),
    legacyDefaults: () => ({}),
    parseLegacySetting: () => undefined,
  });
  const calls: string[] = [];
  const handle = {
    height: 10,
    top: 2,
    pending: 0,
    getScrollHeight: () => 30,
    getViewportHeight: () => 10,
    getScrollTop: () => handle.top,
    getPendingDelta: () => handle.pending,
    scrollTo: (value: number) => { calls.push(`to:${value}`); handle.top = value; },
    scrollToBottom: () => { calls.push('bottom'); },
  };
  assert.equal(pee(handle as never, 3), false);
  assert.deepEqual(calls, ['to:5']);
  assert.equal(pee(handle as never, 100), true);
  assert.deepEqual(calls, ['to:5', 'bottom']);
  assert.equal(pee(handle as never, -100), false);
  assert.deepEqual(calls, ['to:5', 'bottom', 'to:0']);
  bindWheelSettingsHost(undefined);
});

test('the frame cancel dismisses the dialog from the list mode', () => {
  const seen: unknown[] = [];
  const run = runComponent(
    () => DiffDialog({ messages: [], onDone: (message, options) => { seen.push([message, options]); } }),
    { contexts: contexts({ data: diffData(), notice: null }) },
  );
  const frame = findAll(run.result, (run.result as SurfaceNode).type)[0];
  (frame.props.onCancel as () => void)();
  assert.deepEqual(seen, [['Diff dialog dismissed', { display: 'system' }]]);
  run.unmount();
});
