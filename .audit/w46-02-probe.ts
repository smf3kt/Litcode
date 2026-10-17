// W46-02 probe: runs the TUI-bound recovered frame inside the document renderer.
import { TuiDocumentRenderer } from '../src/tui-document-renderer.js';
import { jsx, jsxs } from '../src/tui-jsx.js';
import { s, n } from '../src/tui-base-components.js';
import { gLt, Vse } from '../src/tui-scope-picker-frame-tui-source.js';
import { setFrameSize, z as KeyHint } from '../src/tui-scope-picker-frame-tui-host.js';

const items = Array.from({ length: 6 }, (_, i) => ({ key: `k${i}`, text: `row ${i}` }));
const Host = () => {
  setFrameSize({ columns: 60, rows: 12 });
  return gLt({
    title: 'Search prompts · everywhere',
    placeholder: 'Filter history…', initialQuery: 'ro',
    items, getKey: (item: any) => item.key,
    renderItem: (item: any, focused: boolean) => jsxs(n, { children: [focused ? '> ' : '  ', item.text] }),
    onQueryChange: () => {}, onSelect: () => {}, onCancel: () => {},
    resetKey: 'everywhere', selectAction: 'use', direction: 'up',
    previewPosition: 'bottom', emptyMessage: 'No matching prompts', extraHints:[jsx(KeyHint,{chord:'ctrl+s',action:'scope'})],
  });
};
const renderer = new TuiDocumentRenderer();
try {
  const tree = jsx(s, { flexDirection: 'column', width: 60, minHeight: 12, children: jsx(Host, {}) });
  const rows = renderer.renderElement(tree, 60, { theme: 'dark' });
  console.log(JSON.stringify(rows.map((row: any) => row.text), null, 1));
} finally {
  renderer.close();
}
