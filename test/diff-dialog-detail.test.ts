import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  DiffDivider, DiffFileDetail, SOURCE_BODIES, detailHeading, sanitizeText,
} from '../src/diff-dialog-detail.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { Zm } from '../src/plugin-chain-input-field-source.js';
import { projectContext } from '../src/plugin-chain-session-context.js';
import { H4 } from '../src/plugin-chain-code-diff-source.js';
import { fo } from '../src/diff-dialog-chrome-source.js';

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

function contexts(cwd: string): Map<unknown, unknown> {
  const project = {
    get: () => ({ cwd }),
    subscribe: () => () => {},
  };
  return new Map<unknown, unknown>([
    [Zm, { columns: 120, rows: 40 }],
    [projectContext, project],
  ]);
}

test('the text sanitizer removes control and bidi characters and reports their classes', () => {
  const removed = sanitizeText('a\u0001b‮c');
  assert.equal(removed.text, 'abc');
  assert.equal(removed.removedTotal, 2);
  assert.equal(removed.removedByClass.other, 1);
  assert.equal(removed.removedByClass.bidi, 1);
  assert.equal(removed.removedByClass.zeroWidth, 0);

  const clean = sanitizeText('plain text');
  assert.equal(clean.text, 'plain text');
  assert.equal(clean.removedTotal, 0);
});

test('the detail heading sanitizes a path and collapses whitespace runs', () => {
  assert.equal(detailHeading('dir/\u0001file\tname'), 'dir/file name');
  assert.equal(detailHeading('a\t\tb\n\nc'), 'a b c');
});

test('a restricted file renders the header, divider and restriction note', () => {
  const run = runComponent(
    () => DiffFileDetail({ filePath: 'src/x.ts', hunks: [], isRestricted: true }),
    { contexts: contexts('/work') },
  );
  const tree = run.result;
  const text = textOf(tree);
  assert.ok(text.includes('src/x.ts'));
  assert.ok(text.includes('Content restricted by read-permission rules'));
  assert.equal(findAll(tree, SOURCE_BODIES.Ol).length, 1);
  assert.equal(findAll(tree, H4).length, 0);
  run.unmount();
});

test('an untracked file names the badge and the local git add hint', () => {
  const run = runComponent(
    () => DiffFileDetail({ filePath: 'src/new.ts', hunks: [], isUntracked: true }),
    { contexts: contexts('/work') },
  );
  const tree = run.result;
  const text = textOf(tree);
  assert.equal(findAll(tree, SOURCE_BODIES.Sj).length, 1);
  assert.ok(text.includes('untracked'));
  assert.ok(text.includes('New file not yet staged.'));
  assert.ok(text.includes('Run `git add :/src/new.ts` to see line counts.'));
  run.unmount();
});

test('a binary file renders the binary note instead of hunks', () => {
  const run = runComponent(
    () => DiffFileDetail({ filePath: 'logo.png', hunks: [], isBinary: true }),
    { contexts: contexts('/work') },
  );
  const tree = run.result;
  assert.ok(textOf(tree).includes('Binary file - cannot display diff'));
  assert.equal(findAll(tree, H4).length, 0);
  run.unmount();
});

test('a large file uses the local wording, not the remote one', () => {
  const run = runComponent(
    () => DiffFileDetail({ filePath: 'huge.ts', hunks: [], isLargeFile: true }),
    { contexts: contexts('/work') },
  );
  const text = textOf(run.result);
  assert.ok(text.includes('Large file - diff exceeds 1 MB limit'));
  assert.ok(!text.includes('Diff too large to display.'));
  run.unmount();
});

test('a readable file renders one structured hunk with its first line and content', () => {
  const dir = mkdtempSync(join(tmpdir(), 'w168-detail-'));
  const file = join(dir, 'sample.ts');
  const content = 'first line\nsecond line\n';
  writeFileSync(file, content);
  const patch = '@@ -1 +1 @@\n-old\n+new';
  const run = runComponent(
    () => DiffFileDetail({ filePath: file, hunks: [patch] }),
    { contexts: contexts(dir) },
  );
  const hunks = findAll(run.result, H4);
  assert.equal(hunks.length, 1);
  assert.deepEqual(hunks[0].props, {
    patch,
    filePath: file,
    firstLine: 'first line',
    fileContent: content,
    dim: false,
    width: 116,
  });
  run.unmount();
});

test('an existing file with no hunks renders the empty content note', () => {
  const dir = mkdtempSync(join(tmpdir(), 'w168-empty-'));
  const file = join(dir, 'empty.ts');
  writeFileSync(file, 'still here\n');
  const run = runComponent(
    () => DiffFileDetail({ filePath: file, hunks: [] }),
    { contexts: contexts(dir) },
  );
  const tree = run.result;
  assert.ok(textOf(tree).includes('No diff content'));
  assert.equal(findAll(tree, fo).length, 1);
  run.unmount();
});

test('a truncated file shows the badge and the truncation footer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'w168-trunc-'));
  const file = join(dir, 'long.ts');
  writeFileSync(file, 'line\n');
  const run = runComponent(
    () => DiffFileDetail({ filePath: file, hunks: ['@@ -1 +1 @@\n-a\n+b'], isTruncated: true }),
    { contexts: contexts(dir) },
  );
  const tree = run.result;
  const text = textOf(tree);
  assert.equal(findAll(tree, SOURCE_BODIES.Sj).length, 1);
  assert.ok(text.includes('truncated'));
  assert.ok(text.includes('… diff truncated (exceeded 400 line limit)'));
  run.unmount();
});

test('an unreadable file still renders its hunk with no first line or content', () => {
  const run = runComponent(
    () => DiffFileDetail({ filePath: '/definitely/missing/w168.ts', hunks: ['@@ -1 +1 @@\n-a\n+b'] }),
    { contexts: contexts('/work') },
  );
  const hunks = findAll(run.result, H4);
  assert.equal(hunks.length, 1);
  assert.equal(hunks[0].props.firstLine, null);
  assert.equal(hunks[0].props.fileContent, undefined);
  run.unmount();
});

test('the divider repeats the box character and centers a title', () => {
  const bare = runComponent(() => DiffDivider({ width: 10 }), { contexts: contexts('/work') });
  assert.equal(SOURCE_BODIES.yV, '─');
  assert.equal(textOf(bare.result), '─'.repeat(10));
  bare.unmount();

  const titled = runComponent(
    () => DiffDivider({ width: 10, title: 'ab' }),
    { contexts: contexts('/work') },
  );
  assert.equal(textOf(titled.result), '─── ab ───');
  titled.unmount();
});

test('the badge component renders a dim parenthesized label or nothing', () => {
  const hidden = runComponent(() => SOURCE_BODIES.Sj({ when: false, children: 'x' }));
  assert.equal(hidden.result, null);
  hidden.unmount();

  const badge = runComponent(() => SOURCE_BODIES.Sj({ children: 'truncated' }));
  assert.equal(textOf(badge.result), ' (truncated)');
  badge.unmount();
});
