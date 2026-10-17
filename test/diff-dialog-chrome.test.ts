import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ChordHint, HintText, formatActionHint, formatChord, formatChordTokens,
} from '../src/diff-dialog-chrome.js';
import { runComponent } from '../src/plugin-chain-react-surface.js';
import { h9 } from '../src/plugin-chain-keys-editor.js';

interface SurfaceNode {
  type: unknown;
  props: Record<string, unknown>;
  children: unknown[];
}

test('chords format with the default style and known key names', () => {
  assert.equal(formatChord('ctrl+a'), 'ctrl+a');
  assert.equal(formatChord('escape'), 'Esc');
  assert.equal(formatChord('up'), '↑');
  assert.equal(formatChord('ctrl+up'), 'ctrl+↑');
  assert.equal(formatChord('shift+tab'), 'shift+Tab');
  assert.equal(formatChord('alt+enter'), 'alt+Enter');
  assert.equal(formatChord('meta+k'), 'alt+k');
  assert.equal(formatChord(''), '');
});

test('multiple chords join with the chord separator and multi-key chords with a slash', () => {
  assert.equal(formatChord(['ctrl+a', 'ctrl+b']), 'ctrl+a/b');
});

test('the symbol and compact styles change casing and separators', () => {
  assert.equal(formatChord('ctrl+a', { style: 'symbol' }), '⌃A');
  assert.equal(formatChord('ctrl+shift+a', { style: 'compact' }), 'ctrl+shift+a');
});

test('the token formatter consumes parsed key records', () => {
  assert.equal(formatChordTokens([h9('ctrl+a')], { style: 'symbol' }), '⌃A');
  assert.equal(formatChordTokens([h9('escape')]), 'Esc');
});

test('an action hint joins the chord and action with the source wording', () => {
  assert.equal(formatActionHint({ chord: 'escape', action: 'close' }), 'Esc to close');
  assert.equal(formatActionHint({ chord: 'escape', action: 'close', parens: true }), '(Esc to close)');
  assert.equal(formatActionHint({ chord: 'escape', action: 'close', terse: true }), 'Esc close');
});

test('the chord hint component renders the formatted chord and action', () => {
  const run = runComponent(() => ChordHint({ chord: 'escape', action: 'close' }));
  const root = run.root as unknown as SurfaceNode;
  assert.deepEqual(root.props, { children: ['Esc', ' to ', 'close'] });
  assert.deepEqual(root.children, ['Esc', ' to ', 'close']);
  run.unmount();

  const empty = runComponent(() => ChordHint({ chord: '', action: 'close' }));
  assert.equal(empty.result, null);
  empty.unmount();
});

test('hint text renders one dim line, or a column when a hint is present', () => {
  const single = runComponent(() => HintText({ children: 'none' }));
  const singleRoot = single.root as unknown as SurfaceNode;
  assert.equal(singleRoot.type, 'Text');
  assert.deepEqual(singleRoot.props, { dimColor: true, children: 'none' });
  single.unmount();

  const double = runComponent(() => HintText({ children: 'none', hint: 'try again' }));
  const doubleRoot = double.root as unknown as SurfaceNode;
  assert.equal(doubleRoot.type, 'Box');
  assert.equal(doubleRoot.props.flexDirection, 'column');
  assert.deepEqual(doubleRoot.children.map((child) => (child as SurfaceNode).props), [
    { dimColor: true, children: 'none' },
    { dimColor: true, children: 'try again' },
  ]);
  double.unmount();
});
