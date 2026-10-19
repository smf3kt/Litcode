import assert from 'node:assert/strict';
import test from 'node:test';
import { jsx } from '../src/tui-jsx.js';
import { TuiDocumentRenderer } from '../src/tui-document-renderer.js';
import { Welcome, welcomeDensity, WELCOME_ART_WIDTH, WELCOME_ART_ROWS,
  type WelcomeDensity } from '../src/tui-welcome.js';
import { S1 } from '../src/tui-theme-colors.js';
import { ge } from '../src/tui-color.js';
import { cellWidth } from '../src/terminal.js';

function renderRows(theme: string, version: string, density: WelcomeDensity) {
  const renderer = new TuiDocumentRenderer();
  try {
    return renderer.renderElement(jsx(Welcome, { theme, version, density }, undefined), 100, { theme });
  } finally { renderer.close(); }
}

function render(theme: string, version: string, density: WelcomeDensity): string[] {
  return renderRows(theme, version, density).map(row => row.ansi);
}

function plain(theme: string, version: string): string[] {
  return renderRows(theme, version, 'art').map(row => row.text);
}

test('the lockup is a four-row owl beside the title and version', () => {
  const rows = render('dark', '9.9.9', 'art');
  assert.equal(rows.length, WELCOME_ART_ROWS);
  assert.equal(WELCOME_ART_ROWS, 4);
  const text = plain('dark', '9.9.9');
  assert.match(text[0]!, /Welcome to LiTcode v9\.9\.9/);
  assert.equal(text[0]!.indexOf('Welcome'), 11);
  assert.deepEqual(text.slice(1), ['█◉██▽██◉█', '█████████', ' ██   ██']);
});

test('the density falls back to a bare line only when the mark cannot fit', () => {
  assert.equal(welcomeDensity(WELCOME_ART_ROWS + 4), 'art');
  assert.equal(welcomeDensity(WELCOME_ART_ROWS + 3), 'line');
  const rows = render('dark', '9.9.9', 'line');
  assert.equal(rows.length, 1);
  assert.match(rows[0]!, /Welcome to LiTcode/);
  assert.match(rows[0]!, /v9\.9\.9/);
});

test('the mark is the white owl in both theme families', () => {
  for (const theme of ['dark', 'light']) {
    const text = plain(theme, '9.9.9');
    assert.ok(text.some(row => row.includes('▟█▙ ▟█▙')), theme);
    assert.ok(text.some(row => row.includes('█◉██▽██◉█')), theme);
    assert.ok(text.some(row => row.includes('█████████')), theme);
    assert.ok(text.some(row => row.includes(' ██   ██')), theme);
  }
});

test('the owl paints no panel, so no grey box shows against the terminal', () => {
  // An explicit backdrop would render as a rectangle wherever the terminal's own
  // background is not exactly that colour, so only the eye and beak cells may set
  // one, and only to punch a hole in the plumage.
  const colors = ge as unknown as { level: number };
  const previous = colors.level;
  colors.level = 3;
  try {
    for (const theme of ['dark', 'light']) {
      const bodyRgb = /rgb\((\d+),(\d+),(\d+)\)/.exec((S1(theme) as Record<string, string>).clawd_body!);
      assert.ok(bodyRgb, theme);
      const hole = `${bodyRgb[1]};${bodyRgb[2]};${bodyRgb[3]}`;
      const rows = renderRows(theme, '9.9.9', 'art');
      assert.equal(rows.length, WELCOME_ART_ROWS, theme);
      for (const row of rows) {
        for (const match of row.ansi.matchAll(/\x1b\[48;2;([0-9;]+)m/g)) {
          assert.equal(match[1], hole, `${theme} ${JSON.stringify(row.text)}`);
        }
      }
    }
  } finally { colors.level = previous; }
});

test('no art row exceeds the lockup width, so nothing wraps', () => {
  for (const theme of ['dark', 'light', 'dark-ansi', 'light-ansi']) {
    for (const density of ['art', 'line'] as const) {
      const rows = renderRows(theme, '9.9.9', density);
      for (const row of rows) assert.ok(cellWidth(row.text) <= WELCOME_ART_WIDTH, `${theme} ${JSON.stringify(row.text)}`);
    }
  }
});

test('the mascot palette is grey-white in every built-in theme', () => {
  const seen = new Set<string>();
  for (const theme of ['dark', 'light', 'dark-ansi', 'light-ansi', 'dark-daltonized', 'light-daltonized']) {
    const palette = S1(theme) as Record<string, string>;
    seen.add(`${palette.clawd_body}|${palette.clawd_background}`);
    assert.doesNotMatch(palette.clawd_body!, /215,\s*119,\s*87|redBright/);
    assert.doesNotMatch(palette.clawd_background!, /215,\s*119,\s*87/);
  }
  assert.equal(seen.size, 4);
});

test('the working and thinking accent is grey-white too, not the source orange', () => {
  // `claude`/`claudeShimmer` colour the thinking label and the in-progress task
  // marker; both were the recovered orange until the mascot went grey-white.
  for (const theme of ['dark', 'light', 'dark-ansi', 'light-ansi', 'dark-daltonized', 'light-daltonized']) {
    const palette = S1(theme) as Record<string, string>;
    for (const slot of ['claude', 'claudeShimmer'] as const) {
      assert.doesNotMatch(palette[slot]!, /215,\s*119,\s*87|255,\s*153,\s*51|redBright|yellowBright/, `${theme} ${slot}`);
    }
  }
});
