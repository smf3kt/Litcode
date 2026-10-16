// The composer's painted decorations: the runs a `prompt.edit` answer leaves over the draft.
//
// The rules under test are the composer state class's own (chunk-24k7d6mw.js): `paint` bets the runs
// on the draft at that moment, the publish clause moves them to the carry slot when the draft moves,
// and `carryPaint` rebases them across the edit that follows. The geometry is the copied source
// (`Rke` in ./plugin-chain-decorations-source.ts); the row mapping is the product's own.
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { paintedDecorations, normalizedRuns, caretVisibleRuns, highlightRows, type DecorationRun, type PromptSegment } from '../src/tui-input-decorations.js';
import { composerBaseSpans, composerHighlights } from '../src/tui-input-highlights.js';
import { d3n, ewe, j5r } from '../src/tui-input-highlights-source.js';
import { layoutInput } from '../src/tui-input-navigation.js';
import { S9r, b9r, OOe } from '../src/plugin-chain-decorations-source.js';
import { _ns } from '../src/tui-sgr-tokens-source.js';
import { promptEditChain } from '../src/plugin-chain-registry.js';
import { installChainModule } from '../src/plugin-chain-host.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';
import { TuiTerminal } from '../src/tui.js';
import type { PromptLine } from '../src/tui-renderer.js';

void promptEditChain;

const WORLD: readonly DecorationRun[] = [{ start: 6, end: 11, color: 'red' }];

/** A composer store over a draft the test moves itself, the way the TUI's editor moves its own. */
function composer(start: string) {
  let draft = start;
  const store = paintedDecorations(() => draft, () => {});
  return {
    store,
    move: (text: string) => { store.publish(text); draft = text; },
    /** One key-driven edit: the draft is already the answered text when the composer relays it. */
    edit: (before: { text: string; cursor: number }, after: { text: string; cursor: number }) => {
      draft = after.text;
      store.publish(after.text);
      store.carry(before, after);
    },
  };
}

const rows = (line: PromptLine | undefined): readonly PromptSegment[] => {
  assert.ok(Array.isArray(line), `the row is painted: ${JSON.stringify(line)}`);
  return line;
};

const marked = (line: PromptLine | undefined, color: string): string =>
  rows(line).filter((segment) => segment.style.color === color).map((segment) => segment.text).join('');

test('decorations: a normalized paint answers for its own text and for nothing else', () => {
  const store = paintedDecorations(() => 'hello world', () => {});
  assert.deepEqual(store.runs('hello world'), [] as readonly DecorationRun[]);

  // The host binding is the source's: `fS=(fp,qN)=>M.paint(Rke(fp,qN))`.
  store.paint(normalizedRuns(WORLD, 'hello world'));
  const runs = store.runs('hello world');
  assert.equal(runs.length, 1);
  // `Rke` normalizes, and `Fht` resolves the named color through the source's own table.
  assert.deepEqual({ ...runs[0] }, { start: 6, end: 11, color: '#e5484d' });
  assert.deepEqual(store.runs('hello worl'), [], 'a draft that is not the painted one paints nothing');

  // `paint` clears as well: a run list of nothing is the answer "this draft paints nothing now".
  store.paint(normalizedRuns([], 'hello world'));
  assert.deepEqual(store.runs('hello world'), []);
});

test('decorations: an edit carries the paint across it, and a replacement drops it', () => {
  const typed = composer('hello world');
  typed.store.paint(normalizedRuns(WORLD, 'hello world'));
  typed.edit({ text: 'hello world', cursor: 11 }, { text: 'hi hello world', cursor: 14 });
  const carried = typed.store.runs('hi hello world');
  assert.equal(carried.length, 1, 'the paint followed the edit');
  assert.deepEqual({ start: carried[0]!.start, end: carried[0]!.end }, { start: 9, end: 14 });

  const replaced = composer('hello world');
  replaced.store.paint(normalizedRuns(WORLD, 'hello world'));
  replaced.edit({ text: 'hello world', cursor: 11 }, { text: 'bye', cursor: 3 });
  assert.deepEqual(replaced.store.runs('bye'), [], 'a replaced draft paints nothing');

  // A paint that no longer matches the text is not carried either: the draft moved without it.
  const stale = composer('hello world');
  stale.store.paint(normalizedRuns(WORLD, 'hello world'));
  stale.move('hello world!');
  stale.edit({ text: 'hello world!', cursor: 12 }, { text: 'hello world!?', cursor: 13 });
  assert.deepEqual(stale.store.runs('hello world!?'), [], 'a paint the draft already left is dropped');
});

test('decorations: a row is split into its runs by the source mapping, across wrapped rows too', () => {
  const state = { text: 'hello world', cursor: 5 };
  const body = layoutInput(state, 8, 4);
  assert.deepEqual(body.lines, ['hello', 'world'], 'the wrapping is the input renderer own');
  assert.deepEqual(body.rowStartOffsets, [0, 6], 'rows report the draft offset they start at');

  const runs = normalizedRuns([{ start: 4, end: 11, bold: true }], state.text);
  const rows = highlightRows(runs, body.lines.join('\n'), body.rowStartOffsets);
  assert.deepEqual(rows.map(row => row.map(segment => [segment.text, segment.style.bold ?? null])),
    [[['hell', null], ['o', true]], [['world', true]]],
    'the same run continues on the next row, and the rows are the rendered value split on its newlines');

  // A draft with nothing painted is the rendered value itself, one row per newline.
  const plain = highlightRows([], body.lines.join('\n'), body.rowStartOffsets);
  assert.deepEqual(plain.map(row => row.map(segment => segment.text)), [['hello'], ['world']]);
  assert.deepEqual(layoutInput({ text: 'one\ntwo', cursor: 3 }, 8, 4).rowStartOffsets, [0, 4],
    'a newline row starts after the newline, as the rendered value counts it');
});

test('decorations: a run holding the caret is dropped so the caret cell stays unpainted', () => {
  const state = { text: 'hello world', cursor: 5 };
  const vim = { mode: 'NORMAL', anchor: null };
  const body = layoutInput(state, 8, 4, vim);
  const runs = normalizedRuns([{ start: 6, end: 11, color: 'red' }], state.text);

  // The source's `UFt` filter: `span.dimColor || cursorOffset < span.start || cursorOffset >= span.end`.
  assert.deepEqual(caretVisibleRuns(runs, 5).map(run => [run.start, run.end]), [[6, 11]],
    'the caret is outside the run, so the run is painted');
  assert.deepEqual(caretVisibleRuns(runs, 8), [], 'the caret inside the run drops it');
  const grey = normalizedRuns([{ start: 6, end: 11, dimColor: true }], state.text);
  assert.deepEqual(caretVisibleRuns(grey, 8).map(run => [run.start, run.end]), [[6, 11]],
    'a dim run (the placeholder grey) is kept even under the caret');

  const rows = highlightRows(runs, body.lines.join('\n'), body.rowStartOffsets, 8);
  assert.deepEqual(rows.map(row => row.map(segment => segment.text)),
    [['hello\u001b[7m \u001b[27m'], ['world']],
    'the rendered value is what is segmented, escapes and all; only the style is withheld');
  assert.equal(rows.flat().some(segment => segment.style.color !== undefined), false,
    'nothing is painted while the caret is inside the run');
  const painted = highlightRows(runs, body.lines.join('\n'), body.rowStartOffsets, 5);
  assert.equal(marked(painted.flat() as readonly PromptSegment[], '#e5484d'), 'world');

  // The segmenter keeps the escapes that are open where a run starts, which is why the row text is a
  // slice of the rendered value rather than of the draft: `Hht` walks both and re-opens the codes.
  const overCaret = highlightRows(normalizedRuns([{ start: 0, end: 11, bold: true }], state.text),
    body.lines.join('\n'), body.rowStartOffsets, 0);
  assert.equal(overCaret[0]!.map(segment => segment.text).join(''), 'hello\u001b[7m \u001b[27m',
    'a run over the row keeps the caret escapes it contains');
});

test('decorations: the source row mapping shifts a run onto the rendered value and segments it there', () => {
  // The copied bodies are untyped source text, so the segment shape is stated here.
  const segments = (text: string, runs: readonly DecorationRun[]) =>
    b9r(text, runs) as readonly { text: string; start: number; highlight?: { color?: string } }[];
  // A soft-wrapped draft: the rows start at 0 and 4, and the rendered value joins them with one newline.
  assert.deepEqual((S9r([{ start: 4, end: 8, color: '#e5484d', priority: 0 }], 'aaaa\nbbbb', [0, 4]) as readonly DecorationRun[])
    .map(run => [run.start, run.end]), [[5, 9]]);
  assert.deepEqual(segments('aaaa\nbbbb', S9r([{ start: 4, end: 8, color: '#e5484d', priority: 0 }], 'aaaa\nbbbb', [0, 4]))
    .map(segment => [segment.text, segment.start, segment.highlight?.color]),
  [['aaaa\n', 0, undefined], ['bbbb', 5, '#e5484d']]);

  // A run inside coloured text comes back as segments that re-open the codes open at their start.
  const coloured = segments('\u001b[31mabcd\u001b[39m', [{ start: 2, end: 3, color: '#3e63dd' }]);
  assert.deepEqual(coloured.map(segment => [segment.text, segment.highlight?.color]),
    [['\u001b[31mab\u001b[39m', undefined], ['\u001b[31mc\u001b[39m', '#3e63dd'], ['\u001b[31md\u001b[39m', undefined]]);
  // Overlapping runs are resolved before segmentation: the first run wins where they meet.
  assert.deepEqual((OOe([{ start: 0, end: 4 }, { start: 2, end: 6 }]) as readonly DecorationRun[])
    .map(run => [run.start, run.end]), [[0, 4]]);
  // The tokenizer the segmenter walks: escapes are ansi tokens with their close code, the rest characters.
  assert.deepEqual(_ns('\u001b[31ma').map(token => [token.type, token.code ?? token.value]),
    [['ansi', '\u001b[31m'], ['char', 'a']]);
});

test('decorations: a module that paints the draft leaves its runs on the composer rows', async () => {
  // A highlighter: it answers the recorded box unchanged, with a run over the word it recognizes,
  // and it only answers late once asked to, so the edits typed meanwhile are the composer's to carry.
  let slow = 0;
  const painter: ChainHandler = {
    name: 'painter',
    tier: 'user',
    run: async (e: unknown, next: any) => {
      const answer = await next(e);
      if (slow > 0) await delay(slow);
      const at = typeof answer?.text === 'string' ? answer.text.indexOf('world') : -1;
      return at < 0 ? answer : { ...answer, decorations: [{ start: at, end: at + 5, color: 'red' }] };
    },
  };
  const module: ChainModule = {
    name: painter.name,
    tier: painter.tier,
    hooks: (event: string) => event === 'prompt.edit',
    record: () => painter,
  };
  const remove = installChainModule(module);
  const input = new PassThrough() as PassThrough & { isTTY: boolean; isRaw: boolean; setRawMode: (value: boolean) => void };
  input.isTTY = true; input.isRaw = false; input.setRawMode = value => { input.isRaw = value; };
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(output, { isTTY: true, columns: 40, rows: 12 });
  const terminal = new TuiTerminal({ input, output }).start();
  const prompt = (): readonly PromptLine[] =>
    (terminal as unknown as { inputLayout(columns: number, rows: number): { lines: readonly PromptLine[] } })
      .inputLayout(40, 12).lines;
  const type = async (keys: string, wait = 4) => {
    for (const key of keys) { input.emit('data', key); await delay(2); }
    await delay(wait);
  };
  try {
    await type('hello world', 20);
    assert.equal(terminal.state.text, 'hello world');
    assert.equal(marked(prompt()[0], '#e5484d'), 'world', `the answer's run is on the row: ${JSON.stringify(prompt()[0])}`);

    // The caret back to the start, then a word typed in front of the paint. The module answers that
    // batch late, so what the rows show meanwhile is the composer's carry rule, not a fresh answer.
    slow = 60;
    input.emit('data', '\x01');
    await type('hi ');
    assert.equal(terminal.state.text, 'hi hello world');
    assert.equal(marked(prompt()[0], '#e5484d'), 'world', 'the run was carried across those edits');

    // Once the delayed answers land, the module's own runs are the ones on the rows.
    await delay(200);
    assert.equal(terminal.state.text, 'hi hello world', 'the delayed answers left the draft alone');
    assert.equal(marked(prompt()[0], '#e5484d'), 'world', 'and the answer that follows agrees');

    // An answer with no runs clears the paint: this answer no longer recognizes its word.
    slow = 0;
    await delay(150);
    input.emit('data', '\x05');            // the caret to the end of the row, where the word is
    await type('\x7f'.repeat(5), 60);
    assert.equal(terminal.state.text, 'hi hello ');
    assert.deepEqual(prompt()[0], 'hi hello ', 'the run went with the word it marked');
  } finally {
    terminal.close();
    remove();
  }
});

// The composer's own highlight producers (W45-10). The adapter under test is ./tui-input-highlights.ts,
// the composer's span assembly and overlay call; the producers are copied bodies, so each case here
// asserts the value the source's own body computes.
test('the caret highlight is one grapheme wide', () => {
  assert.equal(ewe('ab'), 'a');
  assert.equal(ewe('éx'), 'é', 'a combining mark rides with its base');
  assert.equal(ewe(''), '');
});

test('the `/btw` notice is the copied start-anchored pattern', () => {
  assert.deepEqual(d3n('/btw why'), [{ word: '/btw', start: 0, end: 4 }]);
  assert.deepEqual(d3n(' /btw why'), [], 'only at the start of the draft');
  assert.deepEqual(composerBaseSpans({ value: '/btw why', caret: 8, storeValue: '/btw why' }),
    [{ start: 0, end: 4, color: 'warning', priority: 15 }]);
});

test('the ultrathink rainbow walks its palette and wraps', () => {
  const spans = composerBaseSpans({ value: 'ultrathink', caret: 0, storeValue: 'ultrathink' });
  assert.equal(spans.length, 10);
  assert.deepEqual(spans[0], { start: 0, end: 1, color: 'rainbow_red', shimmerColor: 'rainbow_red_shimmer', priority: 10 });
  assert.deepEqual(spans[6], { start: 6, end: 7, color: 'rainbow_violet', shimmerColor: 'rainbow_violet_shimmer', priority: 10 });
  assert.deepEqual(spans[7], { start: 7, end: 8, color: 'rainbow_red', shimmerColor: 'rainbow_red_shimmer', priority: 10 },
    'the seventh span starts the palette again');
  assert.deepEqual(composerBaseSpans({ value: 'ultrathink', caret: 0, storeValue: 'ultrathink', ultrathink: false }), [],
    'the gate the source leaves on by default turns the rainbow off');
  assert.deepEqual(composerBaseSpans({ value: 'ultrathinking', caret: 0, storeValue: 'ultrathinking' }), [],
    'the word boundary is the source pattern\'s, so a longer word does not match');
});

test('slash-command runs are suggestions only for names the host knows', () => {
  const knownCommand = (name: string) => name === 'help';
  assert.deepEqual(composerBaseSpans({ value: '/help me', caret: 8, storeValue: '/help me', knownCommand }),
    [{ start: 0, end: 5, color: 'suggestion', priority: 5 }]);
  assert.deepEqual(composerBaseSpans({ value: '/nope me', caret: 8, storeValue: '/nope me', knownCommand }), []);
  assert.deepEqual(composerBaseSpans({ value: '/help. done', caret: 11, storeValue: '/help. done', knownCommand }),
    [{ start: 0, end: 5, color: 'suggestion', priority: 5 }], 'the trailing dot is not part of the name');
  assert.deepEqual(composerBaseSpans({ value: '/help me', caret: 8, storeValue: '/help me' }), [],
    'a host with no known commands marks nothing');
});

test('the remaining producers keep the composer\'s order and shapes', () => {
  const value = 'ultracode';
  assert.deepEqual(j5r(value), [], 'the spread producer of this build spreads nothing');
  assert.deepEqual(composerBaseSpans({ value, caret: 0, storeValue: value, workflowKeyword: true }),
    Array.from({ length: 9 }, (_unused, at) => ({ start: at, end: at + 1, color: 'autoAccept', priority: 10 })));
  assert.deepEqual(composerBaseSpans({ value, caret: 0, storeValue: value, workflowKeyword: true, ultraplan: [{ start: 0, end: 2 }] }).slice(0, 2),
    [{ start: 0, end: 1, color: 'rainbow_red', shimmerColor: 'rainbow_red_shimmer', priority: 10 },
      { start: 1, end: 2, color: 'rainbow_orange', shimmerColor: 'rainbow_orange_shimmer', priority: 10 }],
    'the ultraplan rainbow is pushed before the workflow keyword');
  assert.deepEqual(composerBaseSpans({ value: 'abc', caret: 0, storeValue: 'abc', ghost: { start: 3, end: 8 } }),
    [{ start: 3, end: 8, color: undefined, dimColor: true, priority: 1 }]);
  assert.deepEqual(composerBaseSpans({ value: 'abc', caret: 0, storeValue: 'abc', marks: [{ start: 9, end: 11, color: 'ide' }] }).at(-1),
    { start: 9, end: 11, color: 'ide' }, 'a mark with room lands');
  assert.equal(composerBaseSpans({ value: 'ultrathink', caret: 0, storeValue: 'ultrathink', marks: [{ start: 2, end: 4, color: 'ide' }] }).length, 10,
    'a mark over a rainbow cell is dropped');
});

test('the overlay paints a chain run over the composer spans and leaves the caret cell bare', () => {
  const value = 'ultrathink';
  const runs = normalizedRuns([{ start: 2, end: 5, color: 'red' }], value);
  const overlay = composerHighlights({ value, caret: 6, storeValue: value }, runs);
  assert.deepEqual(overlay.find(span => span.start === 2), { start: 2, end: 3, color: '#e5484d', shimmerColor: undefined, priority: 10 },
    'a repainted cell keeps the run color and loses the palette shimmer');
  assert.equal(overlay.some(span => span.start === 6), false, 'the base span holding the caret is dropped');
  assert.equal(overlay.find(span => span.start === 5)?.shimmerColor, 'rainbow_indigo_shimmer',
    'a span the run does not cover keeps its palette color');
  assert.equal(composerHighlights({ value, caret: 6, storeValue: value, isModalOverlayActive: true }, runs)
    .find(span => span.start === 6)?.color, 'rainbow_violet', 'a modal overlay leaves the caret cell painted');
  assert.equal(composerHighlights({ value, caret: 0, storeValue: value }, []).length, 10,
    'no chain runs leaves the composer spans as they were built');
  assert.deepEqual(composerHighlights({ value: '/btw q', caret: 2, storeValue: '/btw q', isSearchingHistory: true, historyQuery: '/btw', historyMatch: true }, runs),
    [{ start: 2, end: 6, color: 'warning', priority: 20 }, { start: 0, end: 4, color: 'warning', priority: 15 }],
    'a history search hands the base spans over un-overlaid, and its own query notice leads them');
});

test('the rows carry the composer highlights and leave the caret cell unstyled', () => {
  const value = 'ultrathink';
  const runs = normalizedRuns([{ start: 2, end: 5, color: 'red' }], value);
  const rows = highlightRows(composerHighlights({ value, caret: 6, storeValue: value }, runs), value, [0], 6);
  assert.deepEqual(rows, [[
    { text: 'u', style: { color: 'rainbow_red' } },
    { text: 'l', style: { color: 'rainbow_orange' } },
    { text: 't', style: { color: '#e5484d' } },
    { text: 'r', style: { color: '#e5484d' } },
    { text: 'a', style: { color: '#e5484d' } },
    { text: 't', style: { color: 'rainbow_indigo' } },
    { text: 'h', style: {} },
    { text: 'i', style: { color: 'rainbow_red' } },
    { text: 'n', style: { color: 'rainbow_orange' } },
    { text: 'k', style: { color: 'rainbow_yellow' } },
  ]]);
});
