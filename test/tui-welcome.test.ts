import assert from 'node:assert/strict';
import test from 'node:test';
import { jsx } from '../src/tui-jsx.js';
import { TuiDocumentRenderer } from '../src/tui-document-renderer.js';
import { Welcome, WELCOME_ART_WIDTH, WELCOME_MIN_ROWS } from '../src/tui-welcome.js';

function render(theme: string, version: string, compact: boolean, appleTerminal = false): string[] {
  const renderer = new TuiDocumentRenderer();
  try {
    return renderer.renderElement(jsx(Welcome, { theme, version, compact, appleTerminal }, undefined), 120,
      { theme }).map(row => row.ansi);
  } finally { renderer.close(); }
}

test('startup header draws the dark art with the supplied version', () => {
  const rows = render('dark', '9.9.9', false);
  assert.equal(rows.length, 16);
  assert.match(rows[0]!, /Welcome to LiTcode v9\.9\.9/);
  assert.ok(rows.some(row => row.includes('██▄█████▄██')));
  assert.ok(rows.some(row => row.includes('*')));
  assert.equal(WELCOME_ART_WIDTH, 58);
  assert.equal(WELCOME_MIN_ROWS, 30);
});

test('light themes use the starless light art', () => {
  const rows = render('light', '9.9.9', false);
  assert.equal(rows.length, 16);
  assert.match(rows[0]!, /Welcome to LiTcode v9\.9\.9/);
  assert.equal(rows.some(row => row.includes('*')), false);
});

test('Apple Terminal uses the V art in both themes', () => {
  for (const theme of ['dark', 'light']) {
    const rows = render(theme, '9.9.9', false, true);
    assert.equal(rows.length, 16);
    assert.ok(rows.some(row => row.includes('▗')));
    assert.equal(rows.some(row => row.includes('██▄█████▄██')), false);
  }
});

test('the compact branch is a single line', () => {
  const rows = render('dark', '9.9.9', true);
  assert.equal(rows.length, 1);
  assert.match(rows[0]!, /Welcome to LiTcode/);
  assert.match(rows[0]!, /v9\.9\.9/);
});
