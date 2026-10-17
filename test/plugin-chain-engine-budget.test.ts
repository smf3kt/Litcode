import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  charactersUnder,
  clipDrawnProps,
  clipDrawnTree,
  clipPropValue,
  clipTreeToBudget,
  clientPropsCost,
  DRAWN_LIMIT,
  drawnBudget,
  moduleDescriptor,
  noteBorderStyle,
  noteOwnProps,
  notePlainCode,
  notePlainLinks,
  noteTextCut,
  notedKey,
  borderProblem,
  plainCodeProblem,
  plainLinkLead,
  plainLinkProblem,
  propCost,
  stringsUnder,
  textCutLine,
  VALUE_LIMIT,
  type BudgetInput,
} from '../src/plugin-chain-engine-budget.js';
import { s5t } from '../src/plugin-chain-terminal.js';

const input = (component: string): BudgetInput => ({
  component,
  requestId: 'r',
  surface: 'terminal',
});

test('the drawn budget holds what fits and cuts the rest once with its tail', () => {
  const budget = drawnBudget();
  assert.equal(budget.isHeld(3), true);
  assert.equal(budget.written(), 3);
  assert.equal(budget.drawn(), 3);
  assert.equal(budget.isCut(), false);
  assert.equal(budget.field('abc'), 'abc');
  assert.equal(budget.isHeld(DRAWN_LIMIT), false);
  assert.equal(budget.isCut(), true);
  assert.equal(budget.shown('abc', '\n'), '\n… 3 more characters, not drawn');
  assert.equal(budget.markOf(5), '');
  assert.equal(budget.written(), DRAWN_LIMIT + 9);
  assert.equal(budget.drawn(), 6);

  const marks = drawnBudget();
  assert.equal(marks.markOf(5), '… 5 more characters, not drawn');
  assert.equal(marks.markOf(5), '');
});

test('a Code leaf past the budget keeps its source head, drops format/start line, and reports', () => {
  let counts: { written: number; drawn: number } | undefined;
  const source = 'x'.repeat(DRAWN_LIMIT + 1);
  const tree = { type: 'Code', props: { source, format: 'text', startLine: 2, path: 'a.ts' } };
  const out = clipDrawnTree(tree, report => { counts = report; });
  assert.deepEqual(counts, { written: DRAWN_LIMIT + 1, drawn: DRAWN_LIMIT });
  assert.deepEqual(Object.keys(out.props as object), ['source', 'path']);
  assert.equal((out.props as { source: string }).source.slice(-31), '\n… 1 more characters, not drawn');
});

test('Markdown text cuts and loses its pressable links, and a Link that does not fit becomes empty Text', () => {
  const markdown = { type: 'Markdown', props: { text: 'y'.repeat(DRAWN_LIMIT + 1), pressableLinks: [['a']], key: 'k' } };
  const out = clipTreeToBudget(markdown, drawnBudget());
  assert.equal(typeof (out.props as { text: string }).text, 'string');
  assert.deepEqual((out.props as { pressableLinks: unknown }).pressableLinks, []);

  const spent = drawnBudget();
  spent.isHeld(DRAWN_LIMIT);
  assert.deepEqual(clipTreeToBudget({ type: 'Link', props: { href: 'a', label: 'x' } }, spent), { type: 'Text', children: [] });
});

test('a Box key and a Client that do not fit are removed; a fitting tree keeps its identity', () => {
  const spent = drawnBudget();
  spent.isHeld(DRAWN_LIMIT);
  const box = clipTreeToBudget({ type: 'Box', props: { key: 'k', color: 'red' } }, spent);
  assert.deepEqual(box.props, { color: 'red' });
  assert.deepEqual(
    clipTreeToBudget({ type: 'Client', props: { key: 'k', module: 'm', props: {} } }, drawnBudgetWith(1)),
    { type: 'Text', children: [] },
  );
  const tree = { type: 'Box', props: { color: 'red' }, children: [{ type: 'Text', children: ['hi'] }] };
  assert.equal(clipTreeToBudget(tree, drawnBudget()), tree);
});

function drawnBudgetWith(remaining: number) {
  const budget = drawnBudget();
  budget.isHeld(DRAWN_LIMIT - remaining);
  return budget;
}

test('clipped props report their cut counters and own values over the limit', () => {
  const reports: unknown[] = [];
  const tree = { type: 'Box', props: { a: 'x'.repeat(90000), b: 'y'.repeat(90000) } };
  const out = clipDrawnProps(tree, { ...input('Clip'), props: { a: 'a', b: 'b' } }, {
    cut: report => reports.push(['cut', report]),
    own: names => reports.push(['own', names]),
  });
  assert.deepEqual(reports, [['cut', { written: 180000, drawn: 100000 }]]);
  assert.equal((out.props as { b: string }).b.length, 10035);
  assert.equal((out.props as { b: string }).b.slice(-45), 'yyyyyyyyyy … 80000 more characters, not drawn');

  const big = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`k${i}`, 'x'.repeat(250)]));
  const ownReports: unknown[] = [];
  const own = clipDrawnProps({ type: 'Box', props: { big } }, { ...input('Own'), props: {} }, {
    cut: report => ownReports.push(['cut', report]),
    own: names => ownReports.push(['own', names]),
  });
  assert.deepEqual(ownReports, [['own', ['big']]]);
  assert.equal((own.props as { big: unknown }).big, undefined);
});

test('warning handlers note their dedupe key once', () => {
  const problem = { ordinal: 1, path: 'a.ts', problem: 'no @@ hunk' };
  const linkProblems = [{ ordinal: 1, problem: 'is blank' }];

  const border = input('NoteBorder');
  const borderKey = notedKey(border, 'borderStyle');
  assert.equal(s5t(borderKey), false);
  noteBorderStyle(border, 'bogus');
  assert.equal(s5t(borderKey), true);

  const code = input('NoteCode');
  const codeKey = notedKey(code, 'Code 1 drawn plain');
  assert.equal(s5t(codeKey), false);
  notePlainCode(code, problem);
  assert.equal(s5t(codeKey), true);

  const link = input('NoteLink');
  const linkKey = notedKey(link, `terminal ${plainLinkLead(linkProblems)}`);
  assert.equal(s5t(linkKey), false);
  notePlainLinks(link, linkProblems);
  assert.equal(s5t(linkKey), true);

  const own = input('NoteOwn');
  const ownKey = [moduleDescriptor(own).load, own.component, 'own props'].join(' ');
  assert.equal(s5t(ownKey), false);
  noteOwnProps(own, ['k']);
  assert.equal(s5t(ownKey), true);

  const cut = input('NoteCut');
  const cutKey = [moduleDescriptor(cut).load, cut.component, 'text cut'].join(' ');
  assert.equal(s5t(cutKey), false);
  noteTextCut(cut, { written: 10, drawn: 4 });
  assert.equal(s5t(cutKey), true);
});

test('the engine problem lines keep the source wording', () => {
  assert.equal(
    borderProblem('bogus'),
    'Box borderStyle "bogus" is not a border style (the styles are single, double, round, bold, singleDouble, doubleSingle, classic, arrow, dashed, quote); the Box is drawn with no border',
  );
  assert.equal(
    plainCodeProblem({ ordinal: 1, path: 'a.ts', problem: 'x'.repeat(250) }),
    `Code 1 (path "a.ts") is drawn as plain code, its source not a unified diff: ${'x'.repeat(200)}...`,
  );
  assert.equal(plainLinkLead([{ ordinal: 1, problem: 'is blank' }]), 'Link 1 drawn plain');
  assert.equal(
    plainLinkProblem([{ ordinal: 1, problem: 'is blank' }, { ordinal: 2, problem: 'x' }]),
    'Link 1 is drawn as plain text, no link made of it: its href is blank; 1 more of its tree as well',
  );
  assert.equal(textCutLine('C', { written: 10, drawn: 4 }), 'ui.render (C): 10 characters of text are drawn up to the first 4');
});

test('prop costs and clipped values follow the source limits', () => {
  assert.equal(VALUE_LIMIT, 256);
  assert.equal(charactersUnder({ a: 'xy' }), 3);
  assert.equal(propCost('abcd', 0), 4);
  assert.equal(propCost({ a: 'xy' }, 0), 3);
  assert.equal(propCost('x'.repeat(VALUE_LIMIT + 1), 0), 0);
  assert.deepEqual(stringsUnder({ a: 'b' }), ['a', 'b']);
  assert.deepEqual(stringsUnder(['x', { a: 'y' }]), ['x', 'a', 'y']);
  assert.equal(clientPropsCost({}), 2);
  assert.equal(clientPropsCost({ a: 'b' }), 10);

  const spent = drawnBudget();
  spent.isHeld(DRAWN_LIMIT);
  assert.deepEqual(clipPropValue({ a: 'x'.repeat(300) }, spent), { a: ' … 300 more characters, not drawn' });
  assert.deepEqual(moduleDescriptor(input('Desc')), { load: '', lead: 'hooks' });
});
