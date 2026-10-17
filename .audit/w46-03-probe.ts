// W46-03 probe: can a persistent document tree drive the recovered frame's own focus state, with
// the key handler captured from the search field and the focused row reported back through onFocus?
import { TuiDocumentRenderer } from '../src/tui-document-renderer.js';
import { jsx, jsxs } from '../src/tui-jsx.js';
import { s, n } from '../src/tui-base-components.js';
import { gLt } from '../src/tui-scope-picker-frame-tui-source.js';
import {
  setFrameSize, setSearchInputHook, dispatchFrameKey, z as KeyHint,
} from '../src/tui-scope-picker-frame-tui-host.js';

type Any = Record<string, any>;
const items = Array.from({ length: 10 }, (_, i) => ({ key: `k${i}`, text: `row ${i}` }));
const focused: string[] = [];
const focusIndex: number[] = [];
const frameProps = (): Any => ({
  title: jsx(n, { children: 'Search prompts · everywhere' }, undefined),
  placeholder: 'Filter history…', initialQuery: 'ab',
  items, getKey: (item: Any) => item.key,
  renderItem: (item: Any, isFocused: boolean) => jsxs(n, { children: [isFocused ? '> ' : '  ', item.text] }, undefined),
  onQueryChange: () => {}, onSelect: () => {}, onCancel: () => {},
  onFocus: (item: Any) => { if (!item) return; focused.push(item.key); focusIndex.push(items.indexOf(item)); },
  resetKey: 'everywhere', selectAction: 'select', direction: 'up', previewPosition: 'bottom',
  emptyMessage: () => 'No history yet',
  extraHints: [jsx(KeyHint, { chord: 'ctrl+s', action: 'scope' }, undefined)],
});
const Host = (props: Any) => gLt(props);
const render = (renderer: TuiDocumentRenderer, columns = 60, rows = 14): string[] => {
  setFrameSize({ columns, rows });
  const tree = jsx(s, { flexDirection: 'column', width: columns, minHeight: rows, children: jsx(Host, frameProps(), undefined) }, undefined);
  return renderer.renderElement(tree, columns, { theme: 'dark' }).map((row) => row.text);
};
const press = (name: string): void => {
  let prevented = 0, stopped = 0;
  const handled = dispatchFrameKey({
    key: name, ctrl: false, meta: false,
    preventDefault: () => prevented++, stopImmediatePropagation: () => stopped++,
  });
  console.log('press', name, 'handled', handled, 'prevented', prevented, 'stopped', stopped);
};
setSearchInputHook(() => ({ query: 'ab', cursorOffset: 2, handleKeyDown: () => {}, handlePaste: () => {} }));
const renderer = new TuiDocumentRenderer();
try {
  const first = render(renderer);
  console.log('first rows', JSON.stringify(first.filter((line) => line.includes('row '))));
  console.log('hints', JSON.stringify(first.filter((line) => line.includes('Enter') || line.includes('Esc') || line.includes('Ctrl+S'))));
  console.log('after mount focus', focused, focusIndex);
  press('up');
  const second = render(renderer);
  console.log('after up rows', JSON.stringify(second.filter((line) => line.includes('row '))));
  console.log('after up focus', focused, focusIndex);
  press('up');
  const third = render(renderer);
  console.log('after up 2 rows', JSON.stringify(third.filter((line) => line.includes('row '))));
  console.log('after up 2 focus', focused, focusIndex);
  press('down');
  const fourth = render(renderer);
  console.log('after down rows', JSON.stringify(fourth.filter((line) => line.includes('row '))));
  console.log('after down focus', focused, focusIndex);
  press('pagedown');
  const fifth = render(renderer);
  console.log('after pagedown rows', JSON.stringify(fifth.filter((line) => line.includes('row '))));
  console.log('after pagedown focus', focused, focusIndex);
  press('pagedown');
  press('pagedown');
  press('pagedown');
  press('pagedown');
  press('pagedown');
  const sixth = render(renderer);
  console.log('after 6 pagedown rows', JSON.stringify(sixth.filter((line) => line.includes('row '))));
  console.log('after 6 pagedown focus', focused, focusIndex);
} finally {
  renderer.close();
  setSearchInputHook(undefined);
}
// second phase: full layout, remount on query change, empty state
const renderKeyed = (renderer: TuiDocumentRenderer, key: string, props: Any, columns = 60, rows = 14): string[] => {
  setFrameSize({ columns, rows });
  const tree = jsx(s, { flexDirection: 'column', width: columns, minHeight: rows, children: jsx(Host, props, key) }, undefined);
  return renderer.renderElement(tree, columns, { theme: 'dark' }).map((row) => row.text);
};
const r2 = new TuiDocumentRenderer();
try {
  const lines = renderKeyed(r2, 'q:ab', frameProps());
  console.log('full layout', JSON.stringify(lines));
  const empty = renderKeyed(r2, 'q:zz', { ...frameProps(), items: [], initialQuery: 'zz' });
  console.log('empty layout', JSON.stringify(empty));
  // remount resets the frame focus: advance first, then change the key while keeping the same items
  renderKeyed(r2, 'q:ab', frameProps());
  dispatchFrameKey({ key: 'up', preventDefault() {}, stopImmediatePropagation() {} });
  renderKeyed(r2, 'q:ab', frameProps());
  console.log('focus before remount', focused.slice(-3), focusIndex.slice(-3));
  renderKeyed(r2, 'q:ac', { ...frameProps(), initialQuery: 'ac' });
  console.log('focus after remount', focused.slice(-3), focusIndex.slice(-3));
} finally { r2.close(); }
// preview placement in the text path
const previewProps = (rowsBudget: number): Any => ({
  ...frameProps(),
  renderPreview: (item: Any) => jsx(s, { flexDirection: 'column', borderStyle: 'round', borderDimColor: true, paddingX: 1,
    height: Math.max(2, Math.min(8, rowsBudget - 5)), children: jsx(n, { children: `preview ${item.text}` }, undefined) }, undefined),
});
const r3 = new TuiDocumentRenderer();
try {
  for (const rows of [14, 10]) {
    const lines = renderKeyed(r3, 'p', previewProps(rows), 60, rows);
    console.log('preview rows', rows, JSON.stringify(lines));
  }
} finally { r3.close(); }
