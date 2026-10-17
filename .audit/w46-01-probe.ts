// W46-01 probe: measures the frame and row list through the copied bodies before any test asserts them.
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { Tc, n } from '../src/plugin-chain-react-hooks.js';
import { Zm } from '../src/plugin-chain-input-field-source.js';
import {
  gLt, Vse, pHe, ad, FLt, TBe, MBe, DBe,
} from '../src/tui-scope-picker-frame-source.js';
import { _C, declareCursor } from '../src/tui-scope-picker-frame-host.js';

type Any = Record<string, any>;
const items = Array.from({ length: 30 }, (_, i) => ({ key: `k${i}`, label: `item ${i}` }));
const kids = (node: any): any[] => {
  if (Array.isArray(node.children) && node.children.length > 0) return node.children;
  const held = node.props?.children;
  if (held === undefined || held === null) return Array.isArray(node.children) ? node.children : [];
  return Array.isArray(held) ? held : [held];
};
const findType = (node: any, type: unknown): Any | undefined => {
  if (node === null || typeof node !== 'object') return undefined;
  if (node.type === type) return node;
  for (const child of kids(node)) {
    const hit = findType(child, type);
    if (hit !== undefined) return hit;
  }
  return undefined;
};
const walk = (node: any, visit: (node: Any) => void): void => {
  if (node === null || typeof node !== 'object') return;
  visit(node);
  for (const child of kids(node)) walk(child, visit);
};
const key = (name: string): Any => {
  const calls: string[] = [];
  return {
    key: name, calls,
    preventDefault: () => calls.push('prevent'),
    stopImmediatePropagation: () => calls.push('stop'),
  };
};
const wheel = (deltaY: number): Any => {
  const calls: string[] = [];
  return { deltaY, calls, stopImmediatePropagation: () => calls.push('stop') };
};
const show = (value: any): any => {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(show);
  if ('type' in value) {
    return {
      type: typeof value.type === 'string' ? value.type : value.type?.name ?? 'fn',
      props: Object.fromEntries(Object.entries(value.props ?? {})
        .filter(([k]) => k !== 'children')
        .map(([k, v]) => [k, show(v)])),
      children: (value.children ?? []).map(show),
    };
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, show(v)]));
};

const out: Any = {};
out.constants = { TBe, MBe, DBe, FLt: FLt() === undefined };
out.chord = { spaced: pHe('select item'), plain: pHe('select'), empty: pHe('') };
out.clamp = { under: ad(-3, 0, 5), over: ad(9, 0, 5), inside: ad(2, 0, 5), free: ad(42) };

// The frame, driven one action per render pass.
const focused: any[] = [];
const selected: any[] = [];
const tabbed: any[] = [];
const queried: string[] = [];
const previews: any[] = [];
const passes: Any[] = [];
const wheelCalls: string[][] = [];
let step = 0;
const press = (pass: number, action: any) => {
  const element = gLt({
    title: 'Pick a scope', placeholder: 'search', initialQuery: '',
    items, getKey: (item: Any) => item.key,
    renderItem: (item: Any, isFocused: boolean) => Tc(n, { dimColor: !isFocused }, item.label),
    renderPreview: (item: Any) => Tc(n, null, `preview ${item.key}`),
    previewPosition: 'right',
    visibleCount: 8, direction: 'down',
    onQueryChange: (query: string) => queried.push(query),
    onSelect: (item: Any) => selected.push(item.key),
    onTab: { action: 'switch', handler: (item: Any) => tabbed.push(item.key) },
    onFocus: (item: Any) => focused.push(item?.key),
    onCancel: () => {},
    resetKey: undefined,
    emptyMessage: 'nothing', matchLabel: 'match', selectAction: 'select item', cancelAction: 'cancel',
    extraHints: null,
  }) as Any;
  const rows = findType(element, Vse);
  const search = findType(element, 'SearchInput');
  if (rows !== undefined) {
    passes.push({
      pass,
      focus: rows.props.focusedIndex,
      windowStart: rows.props.windowStart,
      visible: (rows.props.visible ?? []).map((item: Any) => item.key),
      visibleCount: rows.props.visibleCount,
      total: rows.props.total,
    });
  }
  const actions: Record<number, () => void> = {
    0: () => { previews.push(findType(element, 'PermissionColor')); },
    1: () => search?.props.onKeyDown(key('down')),
    2: () => search?.props.onKeyDown(key('down')),
    3: () => search?.props.onKeyDown(key('down')),
    4: () => search?.props.onKeyDown(key('pageup')),
    5: () => search?.props.onKeyDown(key('pagedown')),
    6: () => { search?.props.onKeyDown(key('tab')); search?.props.onKeyDown(key('down')); },
    7: () => {
      const down = wheel(1);
      findType(element, 'Box')?.props.onWheel?.(down);
      wheelCalls.push(down.calls);
      const up = wheel(-1);
      findType(element, 'Box')?.props.onWheel?.(up);
      wheelCalls.push(up.calls);
    },
    8: () => { search?.props.onKeyDown(key('return')); search?.props.onKeyDown(key('down')); },
    9: () => search?.props.onKeyDown(key('x')),
  };
  actions[step]?.();
  step += 1;
  return element;
};
const frameRun = runComponent(() => press(step, undefined), {
  contexts: new Map([[Zm, { columns: 200, rows: 30 }]]),
});
out.frame = {
  passes,
  selected, tabbed, queried, wheelCalls,
  lastQueryHandled: step,
  tree: show(frameRun.result),
  hints: (() => {
    const hints: Any[] = [];
    walk(frameRun.result, (node) => { if (node.type === 'KeyHint') hints.push(node.props); });
    return hints;
  })(),
};

// A narrow frame: the hints collapse the select chord to its first word.
const narrow = runComponent(() => {
  const element = gLt({
    title: 'T', items: items.slice(0, 2), getKey: (item: Any) => item.key,
    renderItem: (item: Any) => item.label, visibleCount: 4, direction: 'down',
    onQueryChange: () => {}, onSelect: () => {}, onCancel: () => {}, selectAction: 'select item', cancelAction: 'cancel',
  }) as Any;
  const chords: Any[] = [];
  walk(element, (node) => { if (node.type === 'KeyHint') chords.push(node.props); });
  return chords;
}, { contexts: new Map([[Zm, { columns: 100, rows: 30 }]]) });
out.narrowChords = narrow.result;

// The row list: empty state, rows, scroll markers, click guard, hover and direction.
const listProps = (over: Any = {}) => ({
  visible: items.slice(0, 4), windowStart: 2, visibleCount: 4, total: 30, focusedIndex: 3,
  direction: 'down', getKey: (item: Any) => item.key,
  renderItem: (item: Any, isFocused: boolean) => `${item.key}:${isFocused}`,
  emptyText: 'nothing here', onItemClick: () => {}, onItemHover: () => {}, ...over,
});
const emptyRun = runComponent(() => Vse(listProps({ visible: [] })), {
  contexts: new Map(),
});
out.empty = show(emptyRun.result);

const clicks: string[] = [];
const hovers: any[] = [];
const guardedRun = runComponent(() => Vse(listProps({
  onItemClick: (item: Any) => clicks.push(item.key),
  onItemHover: (item: Any) => hovers.push(item?.key),
})), { contexts: new Map() });
const rowNodes: Any[] = [];
walk(guardedRun.result, (node) => { if (node.type === _C) rowNodes.push(node); });
out.rows = {
  count: rowNodes.length,
  rowProps: rowNodes.map((node) => ({
    key: node.props.children, isFocused: node.props.isFocused, declareCursor: node.props.declareCursor,
    showScrollUp: node.props.showScrollUp, showScrollDown: node.props.showScrollDown,
    styled: node.props.styled,
  })),
  container: {
    height: guardedRun.result.props.height,
    flexDirection: guardedRun.result.props.flexDirection,
    hasLeave: typeof guardedRun.result.props.onMouseLeave === 'function',
  },
};
const strayEvent = { dropAsStray: () => clicks.push('stray') };
rowNodes[0]?.props.onClick?.(strayEvent);
rowNodes[0]?.props.onHoverChange?.(true);
rowNodes[0]?.props.onHoverChange?.(false);
guardedRun.result.props.onMouseLeave?.();

await new Promise((resolve) => setTimeout(resolve, 320));
rowNodes[1]?.props.onClick?.({});
out.clickAfterGuard = clicks.slice();
out.hovers = hovers.slice();

const upRun = runComponent(() => Vse(listProps({ direction: 'up', windowStart: 0 })), { contexts: new Map() });
const upRows: Any[] = [];
walk(upRun.result, (node) => { if (node.type === _C) upRows.push(node.props); });
out.up = {
  flexDirection: upRun.result.props.flexDirection,
  markers: upRows.map((props) => [props.showScrollUp, props.showScrollDown]),
};

const declaredRun = runComponent(() => Vse(listProps()), {
  contexts: new Map([[declareCursor, true]]),
});
const declaredRows: Any[] = [];
walk(declaredRun.result, (node) => { if (node.type === _C) declaredRows.push(node.props); });
out.declaredCursor = declaredRows.map((props) => props.declareCursor);

console.log(JSON.stringify(out, null, 1));
