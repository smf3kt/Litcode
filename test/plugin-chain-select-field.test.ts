// W45-81: the Select site component (`sr`) with the option window (`S3n`), the site-focus reader
// (`xe`) and the click adapter (`udn`). Expected values were measured through the ported bodies
// (see .audit/w45-81-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../src/plugin-chain-registry.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { gdn, fdn, pdn, ldn, ht, S3n, udn, xe, sr } from '../src/plugin-chain-select-field-source.js';
import {
  SelectField, useSiteFocus, listWindow, focusClick, VISIBLE_OPTIONS,
  SelectFields, FocusedPress, FocusedNode, ClickedPress,
} from '../src/plugin-chain-select-field.js';

type Held = Record<string, unknown>;

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b' },
  { value: 'c', label: 'Charlie' },
];

// `sr` draws a header Text row and then one Text per visible option; the window may append a
// "more" row. Children arrive in props (the jsx factory), with false/arrays in between.
function textsOf(element: Held): string[] {
  const out: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (typeof value !== 'object' || value === null || !('props' in (value as object))) return;
    const props = (value as Held).props as Held;
    if (typeof props.children === 'string') out.push(props.children);
    else if (Array.isArray(props.children)) (props.children as unknown[]).forEach(visit);
  };
  visit((element.props as Held).children);
  return out;
}

const headerTexts = (element: Held): string[] => {
  const header = ((element.props as Held).children as unknown[])[0] as Held;
  return ((header.props as Held).children as Held[]).map((part) => (part.props as Held).children as string);
};

const renderSelect = (props: Record<string, unknown>, contexts = new Map<unknown, unknown>()) =>
  runComponent(() => sr(props), { contexts }).result as unknown as Held;

const fakeEvent = (overrides: Record<string, unknown> = {}) => {
  const calls: string[] = [];
  return {
    calls,
    value: {
      hyperlinkUrl: undefined,
      isWindowActivation: false,
      droppedAsStray: false,
      allowDefault: () => calls.push('allowDefault'),
      ...overrides,
    },
  };
};

describe('the option window', () => {
  it('keeps the highlight in an eight-option window', () => {
    assert.equal(ht, 8);
    assert.equal(VISIBLE_OPTIONS, 8);
    assert.deepEqual(S3n(0, 0), { first: 0, size: 0, hidden: 0, rows: 0 });
    assert.deepEqual(S3n(3, 2), { first: 0, size: 3, hidden: 0, rows: 3 });
    assert.deepEqual(S3n(10, 0), { first: 0, size: 8, hidden: 2, rows: 9 });
    assert.deepEqual(S3n(10, 5), { first: 0, size: 8, hidden: 2, rows: 9 });
    assert.deepEqual(S3n(10, 9), { first: 2, size: 8, hidden: 0, rows: 8 });
    assert.deepEqual(listWindow(10, 9), S3n(10, 9));
  });
});

describe('the click adapter', () => {
  it('runs a plain click and leaves a hyperlink to the terminal', () => {
    let ran = 0;
    const click = udn(() => { ran += 1; });
    click(fakeEvent().value);
    assert.equal(ran, 1);
    const linked = fakeEvent({ hyperlinkUrl: 'https://x' });
    click(linked.value);
    assert.equal(ran, 2);
    assert.deepEqual(linked.calls, ['allowDefault']);
  });

  it('does not run for a window activation or a dropped stray', () => {
    let ran = 0;
    const click = udn(() => { ran += 1; });
    click(fakeEvent({ isWindowActivation: true }).value);
    click(fakeEvent({ droppedAsStray: true }).value);
    assert.equal(ran, 0);
  });

  it('still allows the hyperlink default on a window activation', () => {
    let ran = 0;
    const activation = fakeEvent({ hyperlinkUrl: 'https://x', isWindowActivation: true });
    udn(() => { ran += 1; })(activation.value);
    assert.equal(ran, 0);
    assert.deepEqual(activation.calls, ['allowDefault']);
  });
});

describe('the site-focus reader', () => {
  it('answers no focus, no ref and no click without a provider', () => {
    const focus = runComponent(() => xe({ plugin: 'p', handle: 1 }), { contexts: new Map() }).result;
    assert.equal(focus.hasKeyboardFocus, false);
    assert.equal(focus.ref, undefined);
    assert.equal(focus.onClick, undefined);
  });

  it('takes the focus, the ref and the click only for the focused press', () => {
    const ref = { id: 'ref' };
    const clicked: unknown[] = [];
    const contexts = new Map<unknown, unknown>([
      [fdn, { plugin: 'p', handle: 1 }],
      [pdn, ref],
      [ldn, (press: unknown) => clicked.push(press)],
    ]);
    const focus = runComponent(() => xe({ plugin: 'p', handle: 1 }), { contexts }).result;
    assert.equal(focus.hasKeyboardFocus, true);
    assert.equal(focus.ref, ref);
    assert.equal(typeof focus.onClick, 'function');
    focus.onClick?.(fakeEvent().value);
    assert.deepEqual(clicked, [{ plugin: 'p', handle: 1 }]);
    const other = runComponent(() => xe({ plugin: 'p', handle: 2 }), { contexts }).result;
    assert.equal(other.hasKeyboardFocus, false);
    assert.equal(other.ref, undefined);
    assert.equal(typeof other.onClick, 'function');
    other.onClick?.(fakeEvent().value);
    assert.deepEqual(clicked.at(-1), { plugin: 'p', handle: 2 });
    assert.equal(useSiteFocus, xe);
  });
});

describe('the Select component', () => {
  it('draws the label, the picked value and the closed marker', () => {
    const element = renderSelect({ plugin: 'p', handle: 1, element: 's1', options, label: 'Pick' });
    assert.equal(element.type, 'Box');
    const props = element.props as Held;
    assert.equal(props.flexDirection, 'column');
    assert.equal(props.elementKey, 's1');
    assert.equal(props.elementPlugin, 'p');
    assert.deepEqual(headerTexts(element), ['Pick: ', 'none', ' ▾']);
    assert.deepEqual(textsOf(element), ['Pick: ', 'none', ' ▾']);
    assert.equal(SelectField, sr);
  });

  it('draws the picked option by its label, or its value when it has no label', () => {
    const labelled = renderSelect({ plugin: 'p', handle: 1, element: 's1', options, value: 'a' });
    assert.deepEqual(headerTexts(labelled)[1], 'Alpha');
    const bare = renderSelect({ plugin: 'p', handle: 1, element: 's1', options, value: 'b' });
    assert.deepEqual(headerTexts(bare)[1], 'b');
  });

  it('draws the open window with the highlight marker and the visible options', () => {
    const contexts = new Map<unknown, unknown>([
      [gdn, { pickedOf: () => undefined, open: { plugin: 'p', handle: 1, highlight: 1 } }],
      [fdn, { plugin: 'p', handle: 1 }],
    ]);
    const element = renderSelect({ plugin: 'p', handle: 1, element: 's1', options }, contexts);
    assert.deepEqual(headerTexts(element), ['', 'none', ' ▴']);
    assert.deepEqual(textsOf(element), ['', 'none', ' ▴', '  Alpha', '  b', '  Charlie']);
  });

  it('windows a long list and adds the hidden-count row', () => {
    const many = Array.from({ length: 10 }, (_, index) => ({ value: `v${index}`, label: `L${index}` }));
    const contexts = new Map<unknown, unknown>([
      [gdn, { pickedOf: () => 'v9', open: { plugin: 'p', handle: 1, highlight: 0 } }],
    ]);
    const element = renderSelect({ plugin: 'p', handle: 1, element: 's1', options: many }, contexts);
    const texts = textsOf(element);
    assert.deepEqual(texts, ['', 'L9', ' ▴', '  L0', '  L1', '  L2', '  L3', '  L4', '  L5', '  L6', '  L7', '  … 2 more']);
    const tail = renderSelect({ plugin: 'p', handle: 1, element: 's1', options: many }, new Map<unknown, unknown>([
      [gdn, { pickedOf: () => 'v9', open: { plugin: 'p', handle: 1, highlight: 9 } }],
    ]));
    const tailTexts = textsOf(tail);
    assert.equal(tailTexts.at(-1), '  L9');
    assert.equal(tailTexts.includes('  L0'), false);
  });

  it('stays closed when the open state names another press', () => {
    const contexts = new Map<unknown, unknown>([
      [gdn, { pickedOf: () => undefined, open: { plugin: 'q', handle: 1, highlight: 1 } }],
    ]);
    const element = renderSelect({ plugin: 'p', handle: 1, element: 's1', options }, contexts);
    assert.deepEqual(textsOf(element), ['', 'none', ' ▾']);
  });

  it('declares the four contexts under their source names', () => {
    assert.equal(SelectFields, gdn);
    assert.equal(FocusedPress, fdn);
    assert.equal(FocusedNode, pdn);
    assert.equal(ClickedPress, ldn);
    assert.equal(focusClick, udn);
  });
});
