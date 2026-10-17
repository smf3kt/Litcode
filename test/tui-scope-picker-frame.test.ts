// The scope-picker frame (W46-01). Expected values were measured through the copied bodies (see
// .audit/w46-01-probe.txt): the frame limits, focus and window movement, the search hook, the hint
// row, the preview layout, and the row list with its markers, click guard and hover.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runComponent, y, n } from '../src/plugin-chain-react-hooks.js';
import { Zm } from '../src/plugin-chain-input-field-source.js';
import {
  gLt, Vse, pHe, ad, FLt, TBe, MBe, DBe, fo,
} from '../src/tui-scope-picker-frame-source.js';
import {
  declareCursor, scopePickerFrame, scopePickerRows, chordLabel, clampIndex, emptyReset,
  emptyState, DEFAULT_VISIBLE_COUNT, FRAME_CHROME_ROWS, MIN_VISIBLE_COUNT,
  keyHint, inlineRow, permissionColor, searchInputField, clickableRow,
} from '../src/tui-scope-picker-frame.js';

type Any = Record<string, any>;
const items = Array.from({ length: 30 }, (_, i) => ({ key: `k${i}`, label: `item ${i}` }));
const contexts = (rows = 30, columns = 200): ReadonlyMap<unknown, unknown> =>
  new Map([[Zm, { rows, columns }]]);

const kids = (node: Any): Any[] => {
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
const findAll = (node: any, type: unknown): Any[] => {
  if (node === null || typeof node !== 'object') return [];
  const here = node.type === type ? [node] : [];
  return here.concat(...kids(node).map((child: any) => findAll(child, type)));
};
const key = (name: string): Any => ({
  key: name, prevented: 0, stopped: 0,
  preventDefault() { this.prevented += 1; },
  stopImmediatePropagation() { this.stopped += 1; },
});
const wheel = (deltaY: number): Any => ({
  deltaY, stopped: 0, stopImmediatePropagation() { this.stopped += 1; },
});

const frameProps = (over: Any = {}): Any => ({
  title: 'Pick a scope', placeholder: 'search', initialQuery: '',
  items, getKey: (item: Any) => item.key,
  renderItem: (item: Any, isFocused: boolean) => `${item.key}:${isFocused}`,
  renderPreview: (item: Any) => ({ type: 'Text', props: {}, children: [`preview ${item.key}`] }),
  previewPosition: 'right',
  visibleCount: 8, direction: 'down',
  onQueryChange: () => {}, onSelect: () => {}, onCancel: () => {},
  emptyMessage: 'nothing', ...over,
});

/** Render the frame, capturing the row props and any scripted action for that pass. */
const drive = (
  props: Any,
  actions: Record<number, (element: Any, search: Any) => void>,
  rows = 30,
  columns = 200,
) => {
  const passes: Any[] = [];
  let step = 0;
  const run = runComponent(() => {
    const element = gLt(props) as Any;
    const list = findType(element, Vse);
    const search = findType(element, searchInputField);
    passes.push({
      focus: list?.props.focusedIndex,
      windowStart: list?.props.windowStart,
      visible: (list?.props.visible ?? []).map((item: Any) => item.key),
      visibleCount: list?.props.visibleCount,
      total: list?.props.total,
      query: search?.props.query,
      cursorOffset: search?.props.cursorOffset,
    });
    actions[step]?.(element, search as Any);
    step += 1;
    return element;
  }, { contexts: contexts(rows, columns) });
  return { element: run.result as Any, passes, run };
};

/** Render the row list and answer its elements. */
const renderRows = (over: Any = {}, context: ReadonlyMap<unknown, unknown> = new Map()) => {
  const run = runComponent(() => Vse({
    visible: items.slice(0, 4), windowStart: 2, visibleCount: 4, total: 30, focusedIndex: 3,
    direction: 'down', getKey: (item: Any) => item.key,
    renderItem: (item: Any, isFocused: boolean) => `${item.key}:${isFocused}`,
    emptyText: 'nothing here', onItemClick: () => {}, onItemHover: () => {}, ...over,
  }), { contexts: context });
  return { element: run.result as Any, rows: findAll(run.result, clickableRow) as Any[] };
};

describe('the frame limits and labels', () => {
  it('carries the source defaults', () => {
    assert.deepEqual([TBe, MBe, DBe], [8, 10, 2]);
    assert.equal(FLt(), undefined);
    assert.equal(DEFAULT_VISIBLE_COUNT, TBe);
    assert.equal(FRAME_CHROME_ROWS, MBe);
    assert.equal(MIN_VISIBLE_COUNT, DBe);
    assert.equal(emptyReset, FLt);
  });

  it('clamps an index into an optional range', () => {
    assert.equal(ad(-3, 0, 5), 0);
    assert.equal(ad(9, 0, 5), 5);
    assert.equal(ad(2, 0, 5), 2);
    assert.equal((ad as unknown as (n: number) => number)(42), 42);
    assert.equal(clampIndex, ad);
  });

  it('labels a chord with the first word of its action', () => {
    assert.equal(pHe('select item'), 'select');
    assert.equal(pHe('select'), 'select');
    assert.equal(pHe(''), '');
    assert.equal(chordLabel, pHe);
  });
});

describe('the frame layout', () => {
  it('draws the title, search, rows, match label, preview and hints', () => {
    const { element } = drive(frameProps({ matchLabel: 'match', selectAction: 'select item', cancelAction: 'cancel', onTab: { action: 'switch', handler: () => {} } }), {});
    assert.equal(element.type, permissionColor);
    assert.equal(element.props.color, 'permission');
    const box = element.props.children;
    assert.equal(box.type, 'Box');
    assert.equal(box.props.flexDirection, 'column');
    assert.equal(box.props.tabIndex, -1);
    assert.equal(typeof box.props.onWheel, 'function');
    const title = box.children[0];
    assert.equal(title.type, n);
    assert.deepEqual(title.props, { bold: true, color: 'permission', children: 'Pick a scope' });
    assert.deepEqual(title.children, ['Pick a scope']);
    const search = box.children[1];
    assert.equal(search.type, searchInputField);
    assert.equal(search.props.query, '');
    assert.equal(search.props.placeholder, 'search');
    assert.equal(search.props.isFocused, true);
    assert.equal(search.props.autoFocus, true);
    assert.equal(search.props.isTerminalFocused, true);
    assert.equal(typeof search.props.onKeyDown, 'function');
    assert.equal(typeof search.props.onPaste, 'function');
    const layout = box.children[2];
    assert.equal(layout.type, 'Box');
    assert.equal(layout.props.flexDirection, 'row');
    assert.equal(layout.props.gap, 2);
    assert.equal(layout.props.height, 9);
    assert.deepEqual(layout.children[0].children.map((node: Any) => node.type), [Vse, n]);
    assert.equal(layout.children[0].children[1].children[0], 'match');
    assert.equal(layout.children[1].props.flexDirection, 'column');
    assert.equal(layout.children[1].props.flexGrow, 1);
    assert.deepEqual(layout.children[1].children[0].children, ['preview k0']);
    const hints = findAll(box.children[3], keyHint).map((node) => node.props);
    assert.deepEqual(hints, [
      { chord: ['up', 'down'], action: 'navigate' },
      { chord: 'enter', action: 'select item' },
      { chord: 'tab', action: 'switch' },
      { chord: 'escape', action: 'cancel' },
    ]);
    assert.equal(box.children[3].type, n);
    assert.equal(box.children[3].props.dimColor, true);
    assert.equal(findType(box.children[3], inlineRow)!.type, inlineRow);
  });

  it('stacks the preview under the rows by default', () => {
    const { element } = drive(frameProps({ renderPreview: undefined }), {});
    const layout = element.props.children.children[2];
    assert.equal(layout.props.flexDirection, 'column');
    assert.deepEqual(layout.children.map((node: Any) => node.type), [Vse]);
    const preview = drive(frameProps({ previewPosition: 'bottom' }), {});
    const stacked = preview.element.props.children.children[2];
    assert.deepEqual(stacked.children.map((node: Any) => node.type), [Vse, 'Box']);
    assert.deepEqual(stacked.children[1].children[0].children, ['preview k0']);
  });

  it('clamps the visible count to the terminal and the frame chrome', () => {
    const narrow = drive(frameProps({ matchLabel: undefined }), {}, 12);
    const list = findType(narrow.element, Vse);
    assert.equal(list!.props.visibleCount, MIN_VISIBLE_COUNT);
    assert.equal(narrow.element.props.children.children[2].props.height, 2);
    const tight = drive(frameProps({ matchLabel: 'match' }), {}, 10);
    assert.equal(findType(tight.element, Vse)!.props.visibleCount, MIN_VISIBLE_COUNT);
  });

  it('collapses the select hint to one word on a narrow terminal', () => {
    const { element } = drive(frameProps({ selectAction: 'select item', onTab: undefined }), {}, 30, 100);
    const hints = findAll(element, keyHint).map((node) => node.props);
    assert.deepEqual(hints, [
      { chord: ['up', 'down'], action: 'nav' },
      { chord: 'enter', action: 'select' },
      { chord: 'escape', action: 'cancel' },
    ]);
  });

  it('drops the tab hint when the frame has no tab action', () => {
    const { element } = drive(frameProps({}), {});
    const hints = findAll(element, keyHint).map((node) => node.props);
    assert.deepEqual(hints.map((hint) => hint.chord), [['up', 'down'], 'enter', 'escape']);
  });
});

describe('the frame movement', () => {
  it('moves the focus, the window, the selection and the tab action', () => {
    const selected: string[] = [];
    const tabbed: string[] = [];
    const events: Any[] = [];
    const press = (element: Any, search: Any, name: string) => {
      const event = key(name);
      search.props.onKeyDown(event);
      events.push(event);
    };
    const { passes } = drive(frameProps({
      onSelect: (item: Any) => selected.push(item.key),
      onTab: { action: 'switch', handler: (item: Any) => tabbed.push(item.key) },
    }), {
      1: (element, search) => press(element, search, 'down'),
      2: (element, search) => press(element, search, 'down'),
      3: (element, search) => press(element, search, 'down'),
      4: (element, search) => press(element, search, 'pageup'),
      5: (element, search) => press(element, search, 'pagedown'),
      6: (element, search) => { press(element, search, 'return'); press(element, search, 'down'); },
      7: (element, search) => press(element, search, 'tab'),
    });
    assert.deepEqual(passes.map((pass) => [pass.focus, pass.windowStart]), [
      [0, 0], [0, 0], [1, 0], [2, 0], [3, 0], [0, 0], [8, 1], [9, 2],
    ]);
    assert.deepEqual(selected, ['k8']);
    assert.deepEqual(tabbed, ['k9']);
    for (const event of events) {
      assert.equal(event.prevented, 1);
      assert.equal(event.stopped, 1);
    }
  });

  it('selects the focused row when tab has no action', () => {
    const selected: string[] = [];
    drive(frameProps({ onSelect: (item: Any) => selected.push(item.key) }), {
      1: (element, search) => search.props.onKeyDown(key('tab')),
    });
    assert.deepEqual(selected, ['k0']);
  });

  it('moves the window with the wheel and stops the event', () => {
    const wheels: Any[] = [];
    const { passes } = drive(frameProps({}), {
      1: (element) => {
        const event = wheel(1);
        findType(element, 'Box')!.props.onWheel(event);
        wheels.push(event);
      },
      2: (element) => {
        const event = wheel(-1);
        findType(element, 'Box')!.props.onWheel(event);
        wheels.push(event);
      },
      3: (element) => findType(element, 'Box')!.props.onWheel(wheel(0)),
    });
    assert.deepEqual(passes.map((pass) => pass.windowStart), [0, 0, 1, 0]);
    assert.deepEqual(wheels.map((event) => [event.stopped]), [[1], [1]]);
  });

  it('reverses the wheel for an up direction', () => {
    const { passes } = drive(frameProps({ direction: 'up' }), {
      1: (element) => findType(element, 'Box')!.props.onWheel(wheel(-1)),
    });
    assert.equal(passes[2].windowStart, 1);
  });
});

describe('the search input', () => {
  it('types into the query and reports it', () => {
    const queried: string[] = [];
    const { passes } = drive(frameProps({ onQueryChange: (query: string) => queried.push(query) }), {
      1: (element, search) => search.props.onKeyDown(key('a')),
    });
    assert.equal(passes[1].query, '');
    assert.equal(passes[2].query, 'a');
    assert.deepEqual(queried, ['', 'a']);
  });

  it('edits with backspace, delete, home, end and paste', () => {
    const typed = drive(frameProps({ initialQuery: 'abc' }), {
      1: (element, search) => search.props.onKeyDown(key('backspace')),
    });
    assert.deepEqual(typed.passes[2].query, 'ab');
    assert.equal(typed.passes[2].cursorOffset, 2);

    const deleted = drive(frameProps({ initialQuery: 'abc' }), {
      1: (element, search) => search.props.onKeyDown(key('home')),
      2: (element, search) => search.props.onKeyDown(key('delete')),
    });
    assert.equal(deleted.passes[3].query, 'bc');
    assert.equal(deleted.passes[3].cursorOffset, 0);

    const moved = drive(frameProps({ initialQuery: 'abc' }), {
      1: (element, search) => search.props.onKeyDown(key('left')),
      2: (element, search) => search.props.onKeyDown(key('backspace')),
    });
    assert.equal(moved.passes[3].query, 'ac');
    assert.equal(moved.passes[3].cursorOffset, 1);

    const ended = drive(frameProps({ initialQuery: 'abc' }), {
      1: (element, search) => search.props.onKeyDown(key('home')),
      2: (element, search) => search.props.onKeyDown(key('end')),
      3: (element, search) => search.props.onKeyDown(key('X')),
    });
    assert.equal(ended.passes[4].query, 'abcX');

    const pasted = drive(frameProps({ initialQuery: 'ab' }), {
      1: (element, search) => search.props.onPaste('XY'),
    });
    assert.equal(pasted.passes[2].query, 'abXY');
    assert.equal(pasted.passes[2].cursorOffset, 4);
  });

  it('resets the focus and window when the query changes', () => {
    const { passes } = drive(frameProps({}), {
      1: (element, search) => search.props.onKeyDown(key('down')),
      2: (element, search) => search.props.onKeyDown(key('down')),
      3: (element, search) => search.props.onKeyDown(key('down')),
      4: (element, search) => search.props.onKeyDown(key('a')),
    });
    assert.deepEqual(passes.map((pass) => pass.focus).slice(0, 6), [0, 0, 1, 2, 3, 3]);
    assert.equal(passes[passes.length - 1].focus, 0);
    assert.equal(passes[passes.length - 1].windowStart, 0);
  });

  it('ignores control chords and non-edit keys', () => {
    const { passes } = drive(frameProps({ initialQuery: 'ab' }), {
      1: (element, search) => search.props.onKeyDown({ ...key('c'), ctrl: true }),
      2: (element, search) => search.props.onKeyDown(key('f1')),
    });
    assert.equal(passes.length, 2);
    assert.equal(passes[0].query, 'ab');
    assert.equal(passes[1].query, 'ab');
  });
});

describe('the row list', () => {
  it('draws the empty state as the empty-state block', () => {
    const { element } = renderRows({ visible: [] });
    assert.equal(element.type, 'Box');
    assert.equal(element.props.height, 4);
    assert.equal(element.props.flexShrink, 0);
    const state = element.children[0];
    assert.equal(state.type, fo);
    assert.equal(state.props.children, 'nothing here');
    assert.deepEqual(state.children, ['nothing here']);
  });

  it('renders the empty-state block with an optional hint', () => {
    const plain = runComponent(() => fo({ children: 'nothing' })).result as Any;
    assert.equal(plain.type, n);
    assert.deepEqual(plain.props, { dimColor: true, children: 'nothing' });
    assert.deepEqual(plain.children, ['nothing']);
    const hinted = runComponent(() => fo({ children: 'nothing', hint: 'hint' })).result as Any;
    assert.equal(hinted.type, 'Box');
    assert.equal(hinted.props.flexDirection, 'column');
    assert.deepEqual(hinted.children.map((node: Any) => node.children), [['nothing'], ['hint']]);
  });

  it('draws the visible rows with focus and scroll markers', () => {
    const { element, rows } = renderRows();
    assert.equal(element.props.height, 4);
    assert.equal(element.props.flexShrink, 0);
    assert.equal(element.props.flexDirection, 'column');
    assert.equal(typeof element.props.onMouseLeave, 'function');
    assert.equal(rows.length, 4);
    assert.deepEqual(rows.map((node) => node.props.children), ['k0:false', 'k1:true', 'k2:false', 'k3:false']);
    assert.deepEqual(rows.map((node) => [node.props.isFocused, node.props.showScrollUp, node.props.showScrollDown]), [
      [false, true, false], [true, false, false], [false, false, false], [false, false, true],
    ]);
    for (const node of rows) {
      assert.equal(node.type, clickableRow);
      assert.equal(node.props.declareCursor, false);
      assert.equal(node.props.styled, false);
      assert.equal(typeof node.props.onClick, 'function');
      assert.equal(typeof node.props.onHoverChange, 'function');
    }
  });

  it('reverses the list and the markers for an up direction', () => {
    const { element, rows } = renderRows({ direction: 'up', windowStart: 0 });
    assert.equal(element.props.flexDirection, 'column-reverse');
    assert.deepEqual(rows.map((node) => [node.props.showScrollUp, node.props.showScrollDown]), [
      [false, false], [false, false], [false, false], [true, false],
    ]);
  });

  it('declares the cursor only when the host context asks', () => {
    const off = renderRows();
    assert.deepEqual(off.rows.map((node) => node.props.declareCursor), [false, false, false, false]);
    const on = renderRows({}, new Map([[declareCursor, true]]));
    assert.deepEqual(on.rows.map((node) => node.props.declareCursor), [true, true, true, true]);
  });

  it('guards the first click and then reports the row', async () => {
    const clicks: string[] = [];
    const { element, rows } = renderRows({ onItemClick: (item: Any) => clicks.push(item.key) });
    const stray = { dropAsStray: () => clicks.push('stray') };
    rows[0].props.onClick(stray);
    assert.deepEqual(clicks, ['stray']);
    await new Promise((resolve) => setTimeout(resolve, 320));
    rows[1].props.onClick({});
    assert.deepEqual(clicks, ['stray', 'k1']);
  });

  it('reports hover changes and clears the hover on leave', () => {
    const hovers: (string | undefined)[] = [];
    const { element, rows } = renderRows({ onItemHover: (item: Any) => hovers.push(item?.key) });
    rows[0].props.onHoverChange(true);
    rows[0].props.onHoverChange(false);
    element.props.onMouseLeave();
    assert.deepEqual(hovers, ['k0', undefined]);
  });
});

describe('the hook seam and the public names', () => {
  it('supports the functional state update form', () => {
    const Counter = () => {
      const [count, setCount] = y(0);
      if (count < 3) setCount((previous: number) => previous + 1);
      return count;
    };
    assert.equal(runComponent(Counter).result, 3);
  });

  it('keeps the aliases on the source names', () => {
    assert.equal(scopePickerFrame, gLt);
    assert.equal(scopePickerRows, Vse);
    assert.equal(emptyState, fo);
    assert.equal(keyHint, 'KeyHint');
    assert.equal(inlineRow, 'InlineRow');
    assert.equal(permissionColor, 'PermissionColor');
  });
});
