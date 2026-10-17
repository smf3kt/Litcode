// W45-77: the Code leaf (`lt`), the code block renderer (`Ob`/`B`/`nt`) and the unified-diff
// renderer (`tq`/`H4`) with the diff package and the truncation helpers they read. Expected values
// were measured through the ported bodies with the host seam configured (see
// .audit/w45-77-probe.txt and .audit/w45-77-measure.ts).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lt, Oe, Te, et, tt, adn, rt, st } from '../src/plugin-chain-code-source.js';
import { Ob, B, nt } from '../src/plugin-chain-code-block-source.js';
import { tq, H4, uu, DIe, DXe, dje, ydn } from '../src/plugin-chain-code-diff-source.js';
import { Zoo } from '../src/plugin-chain-diff-source.js';
import { n, s, runComponent } from '../src/plugin-chain-react-surface.js';
import { vVe } from '../src/plugin-chain-leaf-walkers.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';

type Element = { type: unknown; props: Record<string, unknown>; children: unknown[]; key?: string | null };

const element = (value: unknown): Element => value as Element;

const SOURCE = 'const a = 1;\nconst b = 2;\n';
const DIFF = '--- a.txt\n+++ b.txt\n@@ -1,2 +1,2 @@\n-const a = 1;\n+const a = 2;\n const b = 3;\n';

const hunksOf = (source: string): Array<Record<string, unknown>> => {
  const parsed = vVe(source, 'diff') as { kind: string; hunks: Array<Record<string, unknown>> };
  return parsed.kind === 'hunks' ? parsed.hunks : [];
};

describe('the Code leaf', () => {
  it('draws a source as a growing column holding the code block at the default width', () => {
    const run = runComponent(() => lt({ source: SOURCE, format: 'source' }));
    const root = element(run.root);
    assert.equal(root.type, s);
    assert.equal(root.props.flexDirection, 'column');
    assert.equal(root.props.flexGrow, 1);
    assert.equal(root.props.flexShrink, 1);
    assert.ok((root.props.ref as { current?: unknown }).current);
    assert.equal(root.children.length, 1);
    const block = element(root.children[0]);
    assert.equal(block.type, Ob);
    assert.equal(block.props.code, SOURCE);
    assert.equal(block.props.filePath, '');
    assert.equal(block.props.width, 80);
    assert.equal(block.props.lineNumbers, false);
    run.unmount();
  });

  it('takes the width override from the context when one is mounted', () => {
    const run = runComponent(
      () => lt({ source: SOURCE, format: 'source' }),
      { contexts: new Map([[adn, 33]]) },
    );
    const block = element(element(run.root).children[0]);
    assert.equal(block.props.width, 33);
    run.unmount();
  });

  it('labels a language source as source.<language>', () => {
    const run = runComponent(() => lt({ source: SOURCE, format: 'source', language: 'ts' }));
    const block = element(element(run.root).children[0]);
    assert.equal(block.props.filePath, 'source.ts');
    run.unmount();
  });

  it('draws a diff through the hunk renderer with the parsed hunks', () => {
    const run = runComponent(() => lt({ source: DIFF, format: 'diff' }));
    const diff = element(element(run.root).children[0]);
    assert.equal(diff.type, tq);
    assert.deepEqual(diff.props.hunks, hunksOf(DIFF));
    assert.equal(diff.props.dim, false);
    assert.equal(diff.props.width, 80);
    assert.equal(diff.props.filePath, '');
    assert.equal(diff.props.firstLine, null);
    run.unmount();
  });

  it('truncates each diff line to the width when the wrap mode is truncate-end', () => {
    const run = runComponent(
      () => lt({ source: DIFF, format: 'diff', wrap: 'truncate-end' }),
      { contexts: new Map([[adn, 4]]) },
    );
    const diff = element(element(run.root).children[0]);
    assert.deepEqual((diff.props.hunks as Array<{ lines: string[] }>)[0].lines, ['-…', '+…', ' …']);
    run.unmount();
  });
});

describe('the code block renderer', () => {
  it('draws the source inside a column through the source line renderer', () => {
    const run = runComponent(() => Ob({ code: SOURCE, width: 40 }));
    const root = element(run.root);
    assert.equal(root.type, s);
    assert.ok((root.props.ref as { current?: unknown }).current);
    const column = element(root.children[0]);
    assert.equal(column.type, s);
    assert.equal(column.props.flexDirection, 'column');
    const line = element(column.children[0]);
    assert.equal(line.type, B);
    assert.equal(line.props.code, SOURCE);
    assert.equal(line.props.dim, false);
    assert.equal(line.props.skipColoring, false);
    run.unmount();
  });

  it('marks where the drawing starts when the start line is beyond the first', () => {
    const run = runComponent(() => Ob({ code: 'a\nb\nc', width: 40, startLine: 5 }));
    const column = element(element(run.root).children[0]);
    assert.equal(column.children.length, 2);
    const marker = element(column.children[0]);
    assert.equal(marker.type, n);
    assert.equal(marker.props.dimColor, true);
    assert.deepEqual(marker.children, ['… from line ', '5']);
    assert.equal(element(column.children[1]).type, B);
    run.unmount();
  });

  it('starts at the first line without a marker', () => {
    const run = runComponent(() => Ob({ code: 'a\nb\nc', width: 40, startLine: 1 }));
    const column = element(element(run.root).children[0]);
    assert.equal(column.children.length, 1);
    assert.equal(element(column.children[0]).type, B);
    run.unmount();
  });
});

describe('the source line renderer', () => {
  it('highlights a source under its file extension', () => {
    const run = runComponent(() => B({ code: SOURCE, filePath: '/a.js' }));
    const root = element(run.root);
    assert.equal(root.type, n);
    assert.equal(root.props.dimColor, false);
    const highlighted = element(root.children[0]);
    assert.equal(highlighted.type, nt);
    assert.equal(highlighted.props.codeWithSpaces, SOURCE);
    assert.equal(highlighted.props.language, 'js');
    run.unmount();
  });

  it('draws the uncoloured text when colour is skipped', () => {
    const run = runComponent(() => B({ code: SOURCE, skipColoring: true }));
    const root = element(run.root);
    assert.equal(root.type, n);
    const text = element(root.children[0]);
    assert.equal(text.type, n);
    assert.deepEqual(text.children, [SOURCE]);
    run.unmount();
  });

  it('truncates a very long line and marks the characters it dropped', () => {
    const run = runComponent(() => B({ code: 'x'.repeat(2005), skipColoring: true }));
    const text = String(element(element(run.root).children[0]).children[0]);
    assert.equal(text.length, 2013);
    assert.equal(text.slice(-13), ' … [+5 chars]');
    run.unmount();
  });

  it('falls back to markdown and says so when the language is not supported', () => {
    clearChainRecords();
    const run = runComponent(() => nt({ codeWithSpaces: 'let x = 1;', language: 'zzz' }));
    const root = element(run.root);
    assert.equal(root.type, n);
    assert.deepEqual(root.children, ['let x = 1;']);
    const messages = chainRecords().map((record) => String((record as { message?: unknown }).message ?? ''));
    assert.equal(messages.includes('Language not supported while highlighting code, falling back to markdown: zzz'), true);
    run.unmount();
  });
});

describe('the diff renderer', () => {
  it('draws one column per hunk and an ellipsis between hunks', () => {
    const hunks = hunksOf(DIFF);
    const run = runComponent(() => tq({
      hunks, dim: false, width: 40, filePath: '', firstLine: undefined, fileContent: undefined,
    }));
    const parts = run.result as unknown[];
    assert.equal(parts.length, 1);
    const box = element(parts[0]);
    assert.equal(box.type, s);
    assert.equal(box.props.flexDirection, 'column');
    const hunk = element(box.children[0]);
    assert.equal(hunk.type, H4);
    assert.deepEqual(hunk.props.patch, hunks[0]);
    assert.equal(hunk.props.dim, false);
    assert.equal(hunk.props.width, 40);
    run.unmount();
  });

  it('separates two hunks with a left-edge ellipsis', () => {
    const hunks = hunksOf('--- a\n+++ b\n@@ -1 +1 @@\n-a\n+b\n@@ -5 +5 @@\n-c\n+d\n');
    assert.equal(hunks.length, 2);
    const run = runComponent(() => tq({
      hunks, dim: false, width: 20, filePath: '', firstLine: undefined, fileContent: undefined,
    }));
    const parts = run.result as unknown[];
    assert.equal(parts.length, 3);
    assert.equal(element(parts[0]).key, 'hunk-0');
    const ellipsis = element(parts[1]);
    assert.equal(ellipsis.type, uu);
    assert.equal(ellipsis.key, 'ellipsis-1');
    assert.equal(ellipsis.props.fromLeftEdge, true);
    assert.deepEqual(element(ellipsis.children[0]).children, ['...']);
    assert.equal(element(parts[2]).key, 'hunk-1');
    run.unmount();
  });

  it('lays out a hunk without the structured diff when none is available', () => {
    const patch = { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['+a'] };
    const run = runComponent(() => H4({ patch, dim: true, width: 10 }));
    const root = element(run.root);
    assert.equal(root.type, s);
    const plain = element(root.children[0]);
    assert.equal(typeof plain.type, 'function');
    assert.deepEqual(plain.props.patch, patch);
    assert.equal(plain.props.dim, true);
    assert.equal(plain.props.width, 10);
    run.unmount();
  });
});

describe('the truncation helpers', () => {
  it('clamps one line to a width with an ellipsis', () => {
    assert.equal(Oe('abcdefghij', 5), 'abcd…');
    assert.equal(Oe('abcdef', 2), 'a…');
    assert.equal(Oe('abc', 5), 'abc');
    assert.equal(Oe('', 4), '');
  });

  it('clamps every line of a source, allowing for the line-number gutter', () => {
    assert.equal(tt('abcdefghij\nklmnop', 5, undefined), 'abcd…\nklmn…');
    assert.equal(tt('abcdef\nghij', 5, undefined), 'abcd…\nghij');
    assert.equal(tt('abcdef\nghij', 5, 9), '…\n…');
  });

  it('re-highlights each hunk line after its marker', () => {
    const hunks = [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-a', '+b'] }];
    assert.deepEqual(Te(hunks), hunks);
    assert.deepEqual(Te(hunks)[0].lines, ['-a', '+b']);
  });

  it('truncates hunk lines after their marker to the width the gutter leaves', () => {
    const hunks = [{ oldStart: 1, oldLines: 2, newStart: 1, newLines: 2, lines: ['-abcdef', '+ghijkl', ' mnopqr'] }];
    assert.deepEqual(et(hunks, 4)[0].lines, ['-…', '+…', ' …']);
    assert.deepEqual(et(hunks, 5)[0].lines, ['-…', '+…', ' …']);
  });

  it('drops a long line to the limit and reports how many characters were cut', () => {
    assert.equal(ydn, 2000);
    const cut = DXe('x'.repeat(2100), 0);
    assert.equal(cut.code.length, 2000);
    assert.equal(cut.truncatedChars, 100);
    assert.deepEqual(DXe('abcdef', 1), { code: 'bcdef', truncatedChars: 0 });
    assert.deepEqual(DXe('abc', 0), { code: 'abc', truncatedChars: 0 });
    assert.equal(dje(37), ' … [+37 chars]');
    assert.equal(dje(5), ' … [+5 chars]');
  });

  it('pairs removed and added lines by word', () => {
    assert.deepEqual(Zoo('abc', 'abd', { ignoreCase: false }), [
      { count: 1, added: false, removed: true, value: 'abc' },
      { count: 1, added: true, removed: false, value: 'abd' },
    ]);
    assert.deepEqual(Zoo('abc', 'abc', { ignoreCase: false }), [
      { count: 1, added: false, removed: false, value: 'abc' },
    ]);
  });

  it('labels a source by its path or its language', () => {
    assert.equal(st({ path: '/a/b.ts', language: undefined }), '/a/b.ts');
    assert.equal(st({ path: undefined, language: 'ts' }), 'source.ts');
    assert.equal(st({ path: undefined, language: undefined }), '');
    assert.equal(rt, 80);
  });
});

describe('the raw shell helpers', () => {
  it('lets a column reach the left edge only when asked', () => {
    const plain = runComponent(() => uu({ children: 'X' }));
    assert.equal(element(plain.root).props.noSelect, true);
    plain.unmount();
    const edge = runComponent(() => uu({ children: 'X', fromLeftEdge: true }));
    assert.equal(element(edge.root).props.alignSelf, 'stretch');
    assert.equal(element(edge.root).props.noSelect, 'from-left-edge');
    edge.unmount();
  });

  it('draws pre-rendered lines as one raw ANSI element', () => {
    const run = runComponent(() => DIe({ lines: ['a', 'b'], width: 3 }));
    const root = element(run.root);
    assert.equal(root.type, 'ink-raw-ansi');
    assert.equal(root.props.rawText, 'a\nb');
    assert.equal(root.props.rawWidth, 3);
    assert.equal(root.props.rawHeight, 2);
    run.unmount();
    const one = runComponent(() => DIe({ lines: ['abc'] }));
    assert.equal(element(one.root).props.rawWidth, undefined);
    assert.equal(element(one.root).props.rawHeight, 1);
    one.unmount();
    const empty = runComponent(() => DIe({ lines: [] }));
    assert.equal(empty.result, null);
    empty.unmount();
  });
});
