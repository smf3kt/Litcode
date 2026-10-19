import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptEmojiQuery, emojiGlyph, emojiSuggestions, inlineEmojiCompletion,
  EMOJI_SUGGESTION_LIMIT } from '../src/tui-emoji.js';
import { EMOJI, EMOJI_ALIASES } from '../src/tui-emoji-data.js';

test('the shortcode table resolves names and the aliases that do not shadow one', () => {
  assert.equal(emojiGlyph('rocket'), '🚀');
  assert.equal(emojiGlyph('+1'), '👍');
  assert.equal(emojiGlyph('100'), '💯');
  assert.equal(emojiGlyph('not_an_emoji_name'), undefined);
  // Source `zre`: an alias only joins the map when its target exists and the alias is
  // not itself a short name.
  const alias = Object.entries(EMOJI_ALIASES).find(([name]) => EMOJI[name] === undefined)!;
  assert.ok(alias, 'the alias table has a non-shadowing entry');
  assert.equal(emojiGlyph(alias[0]), EMOJI[alias[1]]);
  for (const [name, canonical] of Object.entries(EMOJI_ALIASES)) {
    if (EMOJI[name] !== undefined) assert.equal(emojiGlyph(name), EMOJI[name], `${name} keeps its own glyph`);
    else assert.equal(emojiGlyph(name), EMOJI[canonical], `${name} resolves through ${canonical}`);
  }
});

test('a query ranks prefix matches first and then the shortest name', () => {
  const rows = emojiSuggestions('roc');
  assert.ok(rows.length > 0);
  assert.equal(rows[0]!.name, 'rocket');
  assert.equal(rows[0]!.displayText, '🚀');
  assert.equal(rows[0]!.description, ':rocket:');
  assert.equal(rows[0]!.id, 'emoji:rocket');
  const prefix = rows.filter(row => row.name.startsWith('roc'));
  const rest = rows.filter(row => !row.name.startsWith('roc'));
  assert.equal(rows.indexOf(prefix.at(-1)!), prefix.length - 1, 'every prefix match comes first');
  assert.ok(rows.indexOf(rest[0]!) === prefix.length, 'a non-prefix match follows them');
  for (let index = 1; index < prefix.length; index++) {
    assert.ok(prefix[index - 1]!.name.length <= prefix[index]!.name.length, 'prefix matches are shortest first');
  }
});

test('the popup shows at most twenty rows, the source cap', () => {
  assert.equal(EMOJI_SUGGESTION_LIMIT, 20);
  const rows = emojiSuggestions('a');
  assert.equal(rows.length, 20);
  assert.ok(emojiSuggestions('a', 5).length === 5);
  assert.deepEqual(emojiSuggestions('zzzzzz'), []);
});

test('the accept replaces the shortcode under the cursor with the glyph and a space', () => {
  const replaced = acceptEmojiQuery('ship it :roc', 12, '🚀');
  assert.deepEqual(replaced, { text: 'ship it 🚀 ', cursor: 11 });
  // The source matches on the text before the cursor, so a partial with the cursor
  // elsewhere in the draft does not accept.
  assert.equal(acceptEmojiQuery('ship it :roc and more', 20, '🚀'), undefined);
  // One character is below the trigger's two-character minimum.
  assert.equal(acceptEmojiQuery(':r', 2, '🚀'), undefined);
});

test('the inline replacement swaps a completed shortcode for its glyph on that keystroke', () => {
  // `:rocket` plus the closing colon.
  const replaced = inlineEmojiCompletion(':rocket:', ':rocket', 8);
  assert.deepEqual(replaced, { text: '🚀', cursor: 2 });
  const mid = inlineEmojiCompletion('ship :rocket: it', 'ship :rocket it', 13);
  assert.deepEqual(mid, { text: 'ship 🚀 it', cursor: 7 });
  // Source `GDt`: only the edit that completed the shortcode replaces, and only when the
  // removed span is the shortcode itself.
  assert.equal(inlineEmojiCompletion(':rocket:', undefined, 8), undefined, 'no previous draft');
  assert.equal(inlineEmojiCompletion(':rocketx:', ':rocket', 9), undefined, 'the removed span is not a shortcode');
  assert.equal(inlineEmojiCompletion(':nope:', ':nope', 6), undefined, 'an unknown name is left alone');
  assert.equal(inlineEmojiCompletion(':rocket:', ':rocket', 7), undefined, 'an edit that removes nothing');
});
