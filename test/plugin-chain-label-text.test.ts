// The plugin label sanitiser (W45-36) and the tab and ESC-sequence expander under it (W45-37). The
// copied bodies are src/plugin-chain-label-text-source.ts (16 blocks, 1,624 units,
// chunk-qq2mgstr.js), src/plugin-chain-normalize-source.ts (24 blocks, 3,115 units,
// chunk-bf3z2ftn.js) and src/plugin-chain-text-clamp-source.ts (9 blocks, 652 units, four modules)
// — ranges and per-block digests in research/ports/W45-{label-text,normalize,text-clamp}-blocks
// .plan.json. The expander drives the ESC state machine this product already carried
// (src/tui-ansi-tokenizer.ts), which W45-37 verified byte-identical to the source instead of
// copying it a second time.
//
// The expectations below are the source's own behaviour read off the copied bodies and measured in
// .audit/w45-36-probe.mts before any assertion was written: a plain name comes back unchanged, the
// invisible code points a plugin id can carry become replacement characters, a label that is
// already elided or has nothing visible is refused, and the answer is the first line clamped to 24
// columns.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pluginLabel } from '../src/plugin-chain-notify-stack.js';
import { Mde as labelMde } from '../src/plugin-chain-plugin-label.js';
import {
  Ae, L, Mde, O, R, V, Y, dn, g3, ke, mn, xg,
} from '../src/plugin-chain-label-text-source.js';
import {
  Epe, Et, Lr, Pr, Rt, Zs, _r, _t, gCo, gGn, ht, kt, mCo, mt, yt,
} from '../src/plugin-chain-normalize-source.js';
import { Ar, Qe, ae, ct, jo, z, $8 } from '../src/plugin-chain-text-clamp-source.js';

test('the sanitiser returns the plugin name as it stands', () => {
  assert.equal(Mde('engine'), 'engine');
  assert.equal(Mde('my plugin'), 'my plugin');
  assert.equal(Mde('café'), 'café', 'non-ASCII names pass through');
  assert.equal(Mde('  padded  '), '  padded  ', 'the cap does not trim');
  assert.equal(Mde('\u{1F469}‍\u{1F469}‍\u{1F467}'), '\u{1F469}‍\u{1F469}‍\u{1F467}',
    'a name of emoji and joiners is left alone');
  assert.equal(Mde('ḿ'.repeat(3)), 'ḿ'.repeat(3), 'marks under the budget are kept');
});

test('a label with nothing visible, or one already elided, is refused', () => {
  assert.equal(Mde(''), null);
  assert.equal(Mde('   '), null, 'a run of spaces measures as nothing: the visibility test trims what it measures');
  assert.equal(Mde('́'.repeat(9)), null, 'nothing but combining marks');
  assert.equal(Mde('end…'), null, 'a label that already ends in an ellipsis');
  assert.equal(Mde(null), null, 'a non-string');
  assert.equal(Mde(42), null);
  assert.equal(Mde(undefined), null);
  assert.equal(Mde({}), null);
  assert.equal(Mde(['a']), null, 'an array of one name is not a string');
});

test('what the code-point rules reject becomes the replacement character', () => {
  assert.equal(Mde('a​b'), 'a�b', 'a zero-width space between two letters');
  assert.equal(Mde('⠀'), '�', 'a braille blank alone still leaves something to draw');
  assert.equal(Mde('a⠀'), 'a�');
  assert.equal(Mde('  '), '��', 'the line and paragraph separators');
  assert.equal(Mde('\u001b[31mred'), '�[31mred', 'a control byte is folded before the boundary can see it');
});

test('a zero-width joiner survives only where the emoji context needs it', () => {
  assert.equal(Mde('‍'), '�', 'a joiner with no emoji on either side');
  assert.equal(Mde('\u{1F600}️'), '\u{1F600}',
    'the variation selector survives the sanitiser and the fold drops it');
  assert.equal(dn('a‍b', (character: string) => L(character, character.codePointAt(0) ?? 0)), 'a�b',
    'the predicate sees the code point, not the position');
});

test('a run of combining marks past the budget collapses to one replacement character', () => {
  assert.equal(xg(`a${'́'.repeat(8)}`), `a${'́'.repeat(8)}`, 'eight marks are the budget');
  const collapsed = xg(`a${'́'.repeat(9)}`);
  assert.equal(collapsed.length, 10, 'nine marks become eight and one replacement');
  assert.equal(collapsed.endsWith('�'), true);
  assert.equal(Mde('́'.repeat(9)), null, 'the collapsed run is still nothing visible');
  assert.equal(Mde('x́'.repeat(40)).length, 47, 'the collapse shortens the label before the clamp');
});

test('a label is its first line, clamped to 24 columns', () => {
  assert.equal(Mde('a\nb'), 'a…', 'the first line, elided');
  assert.equal(Mde('word '.repeat(12)), 'word word word word wor…');
  assert.equal(Mde('a'.repeat(300)), `${'a'.repeat(23)}…`, 'an over-long single word is cut');
  assert.equal(Mde('… [+3 graphemes]'), '… [+3 graphemes]',
    'the preview marker is not a trailing ellipsis, so it is a label');
});

test('the clamp cuts by grapheme and by line', () => {
  assert.equal(ct('abcdef', 4), 'abc…', 'the ellipsis is inside the budget');
  assert.equal(ct('ab', 1), '…', 'one column has room for the ellipsis alone');
  assert.equal(ct('a', 1), 'a', 'a string that already fits is untouched');
  assert.equal(jo('a b c', 3, true), 'a …');
  assert.equal(jo('a\nb', 9, true), 'a…', 'the first line is cut, then elided');
  assert.equal(jo('engine', 24, true), 'engine');
  assert.equal(Ar('a\nb'), 'a');
  assert.equal(Qe('a/b', '/'), 'a');
  assert.equal($8('x'), 'x', 'the identity');
  assert.equal(ae('engine'), 6);
  assert.equal(ae('中文'), 4, 'wide characters are two columns each');
  assert.deepEqual(z, { ambiguousIsNarrow: true });
});

test('the fold replaces controls and surrogates and drops the variation selectors', () => {
  assert.equal(Et(7), true, 'a control');
  assert.equal(Et(9), false, 'a tab is left for the expander');
  assert.equal(Et(10), false, 'a line feed is kept');
  assert.equal(Rt(1564), true, 'an Arabic number sign');
  assert.equal(_r(65039), true, 'a variation selector');
  assert.equal(Pr(0xd800), true, 'a surrogate half');
  assert.equal(kt('a\uD800b', false), 'a�b');
  assert.equal(kt('a️b', false), 'ab');
  assert.equal(_t('\u0009'), 0, 'a control is zero columns wide');
  assert.equal(_t('٠'), 1, 'an Arabic number sign format character is one');
  assert.equal(Zs('plain'), 'plain');
});

test('the preview keeps a settled line and collapses one that is not', () => {
  assert.equal(Lr('short'), 'short');
  assert.equal(Lr('one\ntwo'), 'one\ntwo');
  assert.equal(Lr('one\n\ntwo'), 'one\n\ntwo', 'an empty line stays empty');
  assert.equal(Lr('… [+3 graphemes]'), '… [+3 graphemes]', 'a marker that is already there');
  assert.equal(Lr('x'.repeat(4097)).length, 4081, 'past the per-line ceiling the line collapses to a count');
});

test('the visibility tests answer for the code points the sanitiser weighs', () => {
  assert.equal(L('​', 0x200b), true, 'the predicate the sanitiser starts from');
  assert.equal(L('a', 0x61), false);
  assert.equal(R('a'), true);
  assert.equal(Ae('⠀'), true, 'a braille blank still measures wide enough for this test');
  assert.equal(g3('a​'), true, 'a trailing invisible is dropped before the answer');
  assert.equal(mn('​a​'), '​a​', 'a space-free invisible is not what the trim drops');
  assert.equal(V('a​', 'end'), '​', 'the last character of the trimmed text');
  assert.equal(ke('a…'), true);
  assert.equal(Y('á'), 'á');
  assert.equal(O('a​b'), 'a�b');
});

test('the tab and ESC-sequence expander is the source\'s, over the tokenizer this product carried', () => {
  // A tab becomes the spaces up to the next eight-column stop, and the column is tracked per line
  // (.audit/w45-37-probe.mts measured each of these before they were asserted). The machine the
  // pass tokenizes with is src/tui-ansi-tokenizer.ts, whose `twe` and `L` are byte-identical to
  // chunk-yn0pfn70.js [3260,3602) and [3672,6275) — .audit/w45-37-tokenizer-identity.mjs
  // recomputes that comparison, and the token assertions below pin its behaviour.
  assert.equal(Epe('engine'), 'engine', 'text without a tab or an ESC-class byte is handed straight back');
  assert.equal(Epe('a\tb'), 'a       b');
  assert.equal(mCo(['abcdefg\th']).join(''), 'abcdefg h', 'the stop is measured from the running column');
  assert.equal(mCo(['a\tb\nc\td']).join(''), 'a       b\nc       d', 'a line feed resets the column');
  assert.equal(mCo(['\u001b[31ma\tb']).join(''), '\u001b[31ma       b', 'a sequence is kept while its tab is expanded');
  assert.equal(Epe('a\u0090b'), 'a�b', 'a C1 control is rewritten');
  assert.equal(Epe('\u001b[31mred'), '\u001b[31mred', 'an escape that tokenizing would leave alone is not a reason to touch the text');
});

test('the reachability test and the token readers answer as the bodies read', () => {
  assert.equal(gGn('plain'), false);
  assert.equal(gGn('\u001b[31m'), true, 'an ESC-class byte');
  assert.equal(gCo(['plain']), false);
  assert.equal(gCo(['\u001b[31m']), false, 'tokenizing leaves a bare escape unchanged');
  assert.equal(gCo(['a\u0090b']), true, 'a C1 control is what makes the pass worth running');
  assert.equal(gCo(['a\u009bb']), true, 'so is an 8-bit sequence introducer');
  assert.deepEqual(ht('plain', true), [{ type: 'text', value: 'plain' }]);
  assert.deepEqual(ht('\u001b[31mred', true),
    [{ type: 'sequence', value: '\u001b[31m' }, { type: 'text', value: 'red' }]);
  assert.deepEqual(ht('\u001b[31', true), [{ type: 'sequence', value: '\u001b[31' }],
    'an unterminated tail is a sequence');
  assert.equal(yt({ type: 'sequence', value: '\u001b[31m' }), undefined, 'a sequence token has no text');
  assert.equal(yt({ type: 'text', value: 'a\u0090b' }), 'a�b');
  assert.equal(yt({ type: 'text', value: 'a\u009bb' }), 'a\u0018b', 'the 8-bit introducer becomes the sentinel');
  assert.equal(mt('a\u0090b'), 'a�b');
});

test('a label carrying a tab is drawn, not refused', () => {
  assert.equal(Mde('a\tb'), 'a       b');
  assert.equal(Mde('a\tb\tc'), 'a       b       c');
  assert.equal(Mde('a\t'), 'a       ', 'trailing spaces are kept: the cap does not trim');
  assert.equal(Mde('\t\t'), null, 'a label that is nothing but tabs has nothing to draw');
  assert.equal(Mde('\u001b[31mred'), '�[31mred', 'the fold eats the escape before the pass sees it');
  assert.equal(Mde('a\t' + 'b'.repeat(30)), 'a       bbbbbbbbbbbbbbb…', 'and the clamp still applies');
  assert.equal(pluginLabel('a\tb'), 'a       b');
});

test('the typed shim hands back the copy\'s answer, and the label policy reads it', () => {
  assert.equal(labelMde('engine'), Mde('engine'));
  assert.equal(labelMde('a\tb'), 'a       b', 'the shim is a re-export: the expander comes through it');
  assert.equal(pluginLabel('engine'), 'engine');
  assert.equal(pluginLabel(42 as unknown as string), 'unnamed');
});
