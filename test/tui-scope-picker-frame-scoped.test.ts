// The recovered frame in the owned text picker (W46-03). The picker drives the frame's own focus
// through the captured search-field key handler, and the frame reports the focused row back through
// onFocus, so the cursor and the drawn selection stay one state.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ScopedPicker } from '../src/tui-scope-picker.js';
import type { InputHistoryTimestampedEntry } from '../src/tui-input-history.js';

const entries: InputHistoryTimestampedEntry[] = ['row 0', 'row 1', 'row 2', 'row 3', 'row 4'].map((display, index) => ({
  display, timestamp: 1_700_000_000_000 + index, textLength: display.length,
  resolve: async () => ({ display, pastedContents: {} }),
}));
const open = (): { picker: ScopedPicker; rendered: () => string; wait: () => Promise<void> } => {
  let lines: string[] = [];
  let picker: ScopedPicker;
  picker = new ScopedPicker({
    read: async function* () { for (const entry of entries) yield entry; },
    changed: () => { lines = picker.frame(60, 12); },
    report: (error) => { throw error; },
  });
  picker.begin('');
  const rendered = (): string => lines.join('\n');
  const wait = async (): Promise<void> => {
    const end = Date.now() + 2000;
    while (!rendered().includes('row 0') && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.ok(rendered().includes('row 0'), 'the scan reached the frame');
  };
  return { picker, rendered, wait };
};
/** The row list draws the focus marker as the first cell of the focused line. */
const focused = (frame: string, text: string): boolean =>
  frame.split('\n').some((line) => line.startsWith('>') && line.includes(text));

describe('the scoped picker frame', () => {
  it('draws the recovered layout with the newest row at the bottom and the hint row', async () => {
    const { picker, rendered, wait } = open();
    try {
      await wait();
      const frame = rendered();
      assert.ok(frame.includes('Search prompts · everywhere'));
      assert.ok(frame.includes('Filter history…'), 'the empty query keeps the placeholder');
      assert.ok(focused(frame, 'row 0'), 'the focused row is the newest item');
      assert.ok(frame.includes('row 1'), 'the next older row is in the window');
      const lines = frame.split('\n');
      assert.ok(lines.findIndex((line) => line.includes('row 1')) < lines.findIndex((line) => line.includes('row 0')),
        'direction up stacks the older row above the focus');
      assert.ok(!frame.includes('row 2'), 'the window is the frame budget, not the whole list');
      assert.match(frame, /Enter select/);
      assert.match(frame, /Ctrl\+S scope/);
      assert.match(frame, /Esc cancel/);
    } finally { picker.close(); }
  });

  it('filters by the query, resets the focus and reports the focused row back', async () => {
    const { picker, rendered, wait } = open();
    try {
      await wait();
      picker.move(2);
      assert.ok(focused(rendered(), 'row 2'), 'move drives the frame focus and onFocus moves the cursor');
      assert.equal(picker.selection?.display, 'row 2');
      picker.query('row 3');
      assert.ok(focused(rendered(), 'row 3'), 'a query change resets the frame focus to the first match');
      assert.equal(picker.snapshot.cursor, 0);
      assert.ok(!rendered().includes('row 0'), 'the query hides the non-matching rows');
    } finally { picker.close(); }
  });

  it('clamps movement at both ends and pages by the visible count', async () => {
    const { picker, rendered, wait } = open();
    try {
      await wait();
      picker.move(-1);
      assert.ok(focused(rendered(), 'row 0'), `the focus does not wrap past the first row\n${rendered()}`);
      picker.page(1);
      assert.ok(focused(rendered(), 'row 2'), `pagedown moves by the frame visible count (2)\n${rendered()}`);
      picker.page(1);
      assert.ok(focused(rendered(), 'row 4'), 'the last page lands on the final row');
      picker.page(1);
      assert.ok(focused(rendered(), 'row 4'), 'the focus clamps at the last row');
      assert.equal(picker.snapshot.cursor, 4);
    } finally { picker.close(); }
  });

  it('reports the empty state for a query with no match', async () => {
    const { picker, rendered, wait } = open();
    try {
      await wait();
      picker.query('zzzz');
      assert.ok(rendered().includes('No matching prompts'));
      picker.query('');
      assert.ok(focused(rendered(), 'row 0'), `the empty query restores the list\n${rendered()}`);
    } finally { picker.close(); }
  });

  it('accepts the row under the frame focus', async () => {
    const { picker, rendered, wait } = open();
    try {
      await wait();
      picker.move(1);
      const chosen = picker.accept();
      assert.equal(chosen?.display, 'row 1');
      assert.equal((await picker.chosenEntry())?.display, 'row 1');
      assert.equal(picker.snapshot.searching, false);
    } finally { picker.close(); }
  });
});
