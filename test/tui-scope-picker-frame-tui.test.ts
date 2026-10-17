// The TUI-bound scope-picker frame (W46-02). The frame body is the W46-01 copy; this suite runs it
// inside the product document renderer and pins the layout and the host seams.
import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';

import { TuiDocumentRenderer } from '../src/tui-document-renderer.js';
import { jsx, jsxs } from '../src/tui-jsx.js';
import { s, n } from '../src/tui-base-components.js';
import { gLt } from '../src/tui-scope-picker-frame-tui-source.js';
import {
  setFrameSize, setSearchInputHook, z as KeyHint,
} from '../src/tui-scope-picker-frame-tui-host.js';

type Any = Record<string, any>;
const items = Array.from({ length: 6 }, (_, i) => ({ key: `k${i}`, text: `row ${i}` }));
const props = (over: Any = {}): Any => ({
  title: 'Search prompts · everywhere',
  placeholder: 'Filter history…', initialQuery: '',
  items, getKey: (item: Any) => item.key,
  renderItem: (item: Any, focused: boolean) => jsxs(n, { children: [focused ? '> ' : '  ', item.text] }, undefined),
  onQueryChange: () => {}, onSelect: () => {}, onCancel: () => {},
  resetKey: 'everywhere', selectAction: 'select', direction: 'up',
  previewPosition: 'bottom', emptyMessage: () => 'No matching prompts',
  extraHints: [jsx(KeyHint, { chord: 'ctrl+s', action: 'scope' }, undefined)],
  ...over,
});
const render = (frameProps: Any, columns = 60, rows = 12): string[] => {
  setFrameSize({ columns, rows });
  const Host = () => gLt(frameProps);
  const renderer = new TuiDocumentRenderer();
  try {
    const tree = jsx(s, { flexDirection: 'column', width: columns, minHeight: rows, children: jsx(Host, {}, undefined) }, undefined);
    return renderer.renderElement(tree, columns, { theme: 'dark' }).map((row) => row.text);
  } finally {
    renderer.close();
  }
};

afterEach(() => { setSearchInputHook(undefined); });

describe('the TUI-bound frame', () => {
  it('draws the title, the windowed rows and the hint row', () => {
    const lines = render(props());
    assert.equal(lines[0], 'Search prompts · everywhere');
    assert.ok(lines.includes(' ^   row 1'), 'direction up shows the second row first');
    assert.ok(lines.includes('>> row 0'), 'the focused row keeps its marker and the source row prefix');
    assert.ok(lines.some((line) => line.includes('Enter select')), 'the enter hint is drawn');
    assert.ok(lines.some((line) => line.includes('Ctrl+S scope')), 'the extra hint is drawn');
  });

  it('draws the first rows in source order for a down direction', () => {
    const lines = render(props({ direction: 'down' }));
    const rows = lines.filter((line) => line.includes('row '));
    assert.deepEqual(rows.map((line) => line.trim()), ['>> row 0', 'row 1 v']);
  });

  it('draws the empty state when no row is visible', () => {
    const lines = render(props({ items: [], emptyMessage: (query: string) => query ? 'No matching prompts' : 'No history yet' }));
    assert.ok(lines.some((line) => line.includes('No history yet')));
    const filtered = render(props({ items: [], initialQuery: 'zz', emptyMessage: () => 'No matching prompts' }));
    assert.ok(filtered.some((line) => line.includes('No matching prompts')));
  });

  it('reads the query and cursor from the host search seam', () => {
    setSearchInputHook(() => ({ query: 'row 3', cursorOffset: 5, handleKeyDown: () => {}, handlePaste: () => {} }));
    const lines = render(props());
    assert.ok(lines.includes('row 3'), 'the injected query is the search line');
  });

  it('keeps the frame height inside the supplied terminal rows', () => {
    const lines = render(props(), 40, 10);
    assert.equal(lines.length, 10);
    assert.ok(lines.some((line) => line.includes('Ctrl+S scope')), 'the hint row stays visible at ten rows');
  });
});
