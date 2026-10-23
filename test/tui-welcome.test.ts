import assert from 'node:assert/strict';
import test from 'node:test';
import { jsx } from '../src/tui-jsx.js';
import { TuiDocumentRenderer } from '../src/tui-document-renderer.js';
import { Welcome, welcomeDensity, WELCOME_ART_WIDTH, WELCOME_ART_ROWS } from '../src/tui-welcome.js';
import { owlPixels, OWL_WIDTH, OWL_HEIGHT, type OwlPose } from '../src/tui-owl.js';
import { S1 } from '../src/tui-theme-colors.js';
import { ge } from '../src/tui-color.js';
import { cellWidth } from '../src/terminal.js';

function render(theme: string, pose: OwlPose = 'rest', columns = 100, density: 'art' | 'line' = 'art') {
  const renderer = new TuiDocumentRenderer();
  try {
    return renderer.renderElement(jsx(Welcome, { theme, version: '9.9.9', density, pose, columns }, undefined), columns, { theme });
  } finally { renderer.close(); }
}

test('the reference owl keeps white plumage, golden eyes, dark beak and feet with transparent surroundings', () => {
  const colors = ge as unknown as { level: number }, before = colors.level; colors.level = 3;
  try {
    const pixels = owlPixels('rest');
    assert.equal(pixels.length, OWL_HEIGHT); assert.ok(pixels.every(row => row.length === OWL_WIDTH));
    assert.deepEqual(pixels[1]!.slice(5, 15), Array(10).fill('w'));
    assert.equal(pixels[0]!.join(''), ' '.repeat(20));
    assert.deepEqual(pixels[5]!.slice(5, 8), ['y', 'k', 'y']);
    assert.deepEqual(pixels[7]!.slice(9, 11), ['k', 'k']);
    assert.deepEqual(pixels[15]!.slice(4, 9), ['k', 'k', ' ', 'k', 'k']);
    assert.equal(pixels[3]![6], 'g'); assert.equal(pixels[11]![15], 'g');
    for (const theme of ['dark', 'light']) {
      const rows = render(theme), ansi = rows.map(row => row.ansi).join('\n');
      assert.equal(rows.length, 9); assert.equal(rows[0]!.text, 'Welcome to LiTcode v9.9.9');
      assert.match(ansi, /38;2;255;209;45|48;2;255;209;45/);
      assert.match(ansi, /38;2;246;247;250|48;2;246;247;250/);
      assert.match(ansi, /38;2;48;50;60|48;2;48;50;60/);
      assert.ok(rows.slice(1).some(row => row.text.includes('█')));
      assert.ok(rows[1]!.ansi.startsWith('     '), 'transparent margins have no painted panel');
      assert.doesNotMatch(ansi, /48;2;0;0;0/);
    }
    const ansiLight = render('light-ansi').map(row => row.ansi).join('');
    assert.match(ansiLight, /\x1b\[97m/); assert.match(ansiLight, /\x1b\[90m/);
    assert.match(ansiLight, /\x1b\[30m|\x1b\[40m/); assert.match(ansiLight, /\x1b\[33m|\x1b\[43m/);
    const rest = render('dark').map(row => row.ansi).join('');
    for (const pose of ['breathe', 'blink', 'look-left', 'look-right', 'wings'] as const) {
      const rows = render('dark', pose);
      assert.equal(rows.length, WELCOME_ART_ROWS); assert.notEqual(rows.map(row => row.ansi).join(''), rest, pose);
    }
    assert.equal(owlPixels('blink')[5]!.includes('y'), false);
    assert.equal(owlPixels('look-left')[5]![5], 'k'); assert.equal(owlPixels('look-right')[5]![7], 'k');
  } finally { colors.level = before; }
});

test('all poses retain fixed geometry on narrow terminals and use one line when height is limited', () => {
  assert.equal(welcomeDensity(WELCOME_ART_ROWS + 4), 'art');
  assert.equal(welcomeDensity(WELCOME_ART_ROWS + 3), 'line');
  for (const theme of ['dark', 'light', 'dark-ansi', 'light-ansi']) {
    for (const columns of [20, 36, 100]) {
      for (const pose of ['rest', 'breathe', 'blink', 'look-left', 'look-right', 'wings'] as const) {
        const rows = render(theme, pose, columns);
        assert.equal(rows.length, WELCOME_ART_ROWS);
        assert.ok(rows.every(row => cellWidth(row.text) <= Math.min(columns, WELCOME_ART_WIDTH)));
        assert.equal(rows[0]!.text, columns === 20 ? 'LiTcode v9.9.9' : 'Welcome to LiTcode v9.9.9');
      }
      const rows = render(theme, 'blink', columns, 'line');
      assert.equal(rows.length, 1); assert.match(rows[0]!.text, /LiTcode v9\.9\.9/);
    }
  }
});

test('the existing mascot palette remains grey-white in every built-in theme', () => {
  const seen = new Set<string>();
  for (const theme of ['dark', 'light', 'dark-ansi', 'light-ansi', 'dark-daltonized', 'light-daltonized']) {
    const palette = S1(theme) as Record<string, string>;
    seen.add(`${palette.clawd_body}|${palette.clawd_background}`);
    assert.doesNotMatch(palette.clawd_body!, /215,\s*119,\s*87|redBright/);
    assert.doesNotMatch(palette.clawd_background!, /215,\s*119,\s*87/);
  }
  assert.equal(seen.size, 4);
});

test('the working and thinking accent stays grey-white', () => {
  for (const theme of ['dark', 'light', 'dark-ansi', 'light-ansi', 'dark-daltonized', 'light-daltonized']) {
    const palette = S1(theme) as Record<string, string>;
    for (const slot of ['claude', 'claudeShimmer'] as const)
      assert.doesNotMatch(palette[slot]!, /215,\s*119,\s*87|255,\s*153,\s*51|redBright|yellowBright/, `${theme} ${slot}`);
  }
});
