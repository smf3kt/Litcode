import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AbovePromptContent,
  COLLAPSE_ICON_FLAG,
  CollapseHandle,
  ExpandedHeader,
  MoreIndicator,
  elementKeyBounds,
  floorClamp,
  heldEdgeTop,
  listRowsOf,
  mergeProps,
  moreIndicatorText,
  nextFocusIndex,
  raisedScrollProps,
  selectByDigit,
  toggleLabel,
  wheelPointFromLayout,
  type LaidNode,
} from '../src/plugin-chain-above-prompt-parts.js';
import { runComponent, type SurfaceElement } from '../src/plugin-chain-react-hooks.js';
import { listWindow } from '../src/plugin-chain-select-field.js';

function node(top: number, height = 1, parentNode?: LaidNode): LaidNode {
  return { parentNode, yogaNode: { getComputedTop: () => top, getComputedHeight: () => height } };
}

test('the wheel point is relative to the cached layout and absent without one', () => {
  const map = wheelPointFromLayout({ current: { cachedLayout: { x: 10, y: 4 } } });
  assert.deepEqual(map({ col: 13, row: 6 }), { column: 3, row: 2 });
  assert.equal(map({ col: 13 }), undefined);
  assert.equal(wheelPointFromLayout({ current: null })({ col: 1, row: 1 }), undefined);
});

test('the held edge is the top, the bottom, or -1 when the node is not held', () => {
  const root = node(0, 20);
  const held = node(3, 2, root);
  const source = { index: 1, node: held };
  assert.equal(heldEdgeTop(source, root, 'top', 1), 3);
  assert.equal(heldEdgeTop(source, root, 'bottom', 1), 5);
  assert.equal(heldEdgeTop(source, root, 'top', 2), -1);
  assert.equal(heldEdgeTop(null, root, 'top', 1), -1);
  assert.equal(heldEdgeTop(source, null, 'top', 1), -1);
  assert.equal(heldEdgeTop({ index: 1, node: node(3, 2) }, root, 'top', 1), -1);
});

test('the element key walk skips the root and matches the plugin when given', () => {
  const root: LaidNode = { attributes: { elementKey: 'root' }, childNodes: [], yogaNode: { getComputedTop: () => 0, getComputedHeight: () => 10 } };
  const first: LaidNode = { attributes: { elementKey: 'option', elementPlugin: 'a' }, childNodes: [], parentNode: root, yogaNode: { getComputedTop: () => 2, getComputedHeight: () => 1 } };
  const second: LaidNode = { attributes: { elementKey: 'option', elementPlugin: 'b' }, childNodes: [], parentNode: root, yogaNode: { getComputedTop: () => 5, getComputedHeight: () => 2 } };
  const third: LaidNode = { attributes: { elementKey: 'option' }, childNodes: [], parentNode: root, yogaNode: { getComputedTop: () => 8, getComputedHeight: () => 1 } };
  root.childNodes = [first, second, third];
  assert.deepEqual(elementKeyBounds(root, 'option', 'b'), { top: 5, bottom: 7 });
  assert.deepEqual(elementKeyBounds(root, 'option'), { top: 8, bottom: 9 });
  assert.equal(elementKeyBounds(root, 'root'), undefined);
  assert.equal(elementKeyBounds(root, 'missing'), undefined);
});

test('the content wrapper applies the negative offset and the kept columns', () => {
  const columns = { token: true };
  const element = AbovePromptContent({ content: {}, offset: 3, keptColumns: 5, columns, children: 'body' });
  assert.equal(element.type, 'Box');
  assert.equal(element.props.marginTop, -3);
  assert.equal(element.props.marginRight, 5);
  assert.equal(element.props.flexDirection, 'column');
  const provider = element.children[0] as SurfaceElement;
  assert.equal(provider.props.value, columns);
  assert.equal(provider.children[0], 'body');
});

test('the merge lets the second object win and the clamp floors at zero', () => {
  assert.deepEqual(mergeProps({ a: 1, b: 2 }, { b: 3 }), { a: 1, b: 3 });
  assert.equal(floorClamp(2.9), 2);
  assert.equal(floorClamp(-1), 0);
});

test('the raised wrapper replaces the scroll offset and keeps the other props', () => {
  const input = { props: { scroll: { offset: 0, bodyRows: 4 }, color: 'x' } };
  const { result } = runComponent(() => raisedScrollProps(input, 7, 0));
  assert.equal((result.props.scroll as { offset: number }).offset, 7);
  assert.equal((result.props.scroll as { bodyRows: number }).bodyRows, 4);
  assert.equal(result.props.color, 'x');
});

test('the toggle label draws the dim or inverse text inside the action box', () => {
  const { result } = runComponent(() => toggleLabel({ label: '[-]', onAction: () => {}, isHeld: true }));
  assert.equal(result.type, 'Box');
  const actionBox = result.children[0] as SurfaceElement;
  assert.equal(actionBox.props.tabIndex, -1);
  const render = actionBox.children[0] as (hover: { hovered: boolean }) => SurfaceElement;
  const label = render({ hovered: false });
  assert.equal(label.type, 'Text');
  assert.equal(label.props.inverse, true);
  assert.equal(label.props.dimColor, false);
  assert.equal(label.props.children, '[-]');
});

test('the collapse handle is an absolute [-] and the header names the hidden panel', () => {
  assert.equal(COLLAPSE_ICON_FLAG, 1);
  const handle = runComponent(() => CollapseHandle({ onCollapse: () => {} })).result;
  assert.equal(handle.props.position, 'absolute');
  assert.equal(handle.props.top, 0);
  assert.equal(handle.props.right, 1);
  const toggle = handle.children[0] as SurfaceElement;
  assert.equal(typeof toggle.type, 'function');

  const header = runComponent(() => ExpandedHeader({ shortcut: 'ctrl+x ctrl+a', onExpand: () => {} })).result;
  assert.equal(header.type, 'ActionBox');
  const render = header.children[0] as (hover: { hovered: boolean }) => SurfaceElement;
  assert.equal(typeof render, 'function');
  const text = render({ hovered: false });
  assert.equal(text.type, 'Text');
  assert.equal(text.props.children, '▸ plugin panel hidden \xB7 ctrl+x ctrl+a or click to show');
});

test('the focus index advances, wraps to zero, and reports the band', () => {
  assert.equal(nextFocusIndex({ focus: 0, count: 3 }), 1);
  assert.equal(nextFocusIndex({ focus: 2, count: 3 }), null);
  assert.equal(nextFocusIndex({ focus: null, count: 3 }), 0);
  assert.equal(nextFocusIndex({ focus: null, count: 0 }), 'band');
  assert.equal(nextFocusIndex({ focus: undefined, count: 0 }), null);
});

test('the list rows follow the select window and the indicator text joins by a middot', () => {
  const options = [{ label: 'a' }, { label: 'b' }, { label: 'c' }];
  assert.equal(listRowsOf(null, options), 0);
  assert.equal(listRowsOf({ highlight: 1 }, options), listWindow(options, 1).rows);
  assert.equal(moreIndicatorText(2, 3), '↑ 2 more \xB7 ↓ 3 more');
  assert.equal(moreIndicatorText(0, 1), '↓ 1 more');
  assert.equal(moreIndicatorText(0, 0), '');
  const indicator = runComponent(() => MoreIndicator({ above: 2, below: 0 })).result;
  assert.equal(indicator.type, 'Text');
  assert.equal(indicator.props.dimColor, true);
  assert.equal(indicator.props.children, '↑ 2 more');
});

test('the digit select is a no-op when the node is absent or its check fails', () => {
  let calls = 0;
  selectByDigit(undefined, () => true, () => { calls += 1; });
  selectByDigit({ plugin: 'p', handle: 'h' }, () => false, () => { calls += 1; });
  assert.equal(calls, 0);
});
