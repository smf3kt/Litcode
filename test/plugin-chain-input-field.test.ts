// W45-82: the Input field site (`Vt`), the terminal-size hook (`ke`) with its context (`Zm`), the
// field minimum width (`Gt`) and the two contexts (`cdn`, `ddn`). Expected values were measured
// through the ported bodies (see .audit/w45-82-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../src/plugin-chain-registry.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { fdn, pdn, ldn } from '../src/plugin-chain-select-field-source.js';
import { Vt, Gt, cdn, ddn, ke, Zm } from '../src/plugin-chain-input-field-source.js';
import {
  InputField, InputFields, SiteColumns, FIELD_MIN_COLUMNS, useTerminalSize, TerminalSizeContext,
} from '../src/plugin-chain-input-field.js';

type Held = Record<string, unknown>;
type Rendered = { type: unknown; props: Held };
const field = Vt as unknown as (props: Record<string, unknown>) => unknown;
const near = { columns: 80, rows: 24 };

const renderField = (props: Record<string, unknown>, contexts = new Map<unknown, unknown>()): Held => {
  const merged = new Map<unknown, unknown>([[Zm, near]]);
  for (const [key, value] of contexts) merged.set(key, value);
  return runComponent(() => field(props), { contexts: merged }).result as unknown as Held;
};

const childrenOf = (element: Held): unknown[] => (element.props as Held).children as unknown[];
const renderedChildren = (element: Held): Rendered[] =>
  childrenOf(element).filter((child): child is Rendered =>
    typeof child === 'object' && child !== null && 'props' in (child as object));

// The editor is the only child with the host token as its type.
const editorOf = (element: Held): Rendered => {
  const editor = renderedChildren(element).find((child) => child.type === 'TextEditor');
  assert.ok(editor, 'the focused field draws the text editor');
  return editor;
};

const base = { plugin: 'p', handle: 1, element: 'i1' };

describe('the terminal-size hook', () => {
  it('throws the source message outside a size provider', () => {
    assert.throws(
      () => runComponent(() => ke(), { contexts: new Map() }),
      /useTerminalSize must be used within an Ink App component/,
    );
  });

  it('answers the mounted size', () => {
    const size = { columns: 72, rows: 20 };
    const value = runComponent(() => ke(), { contexts: new Map([[Zm, size]]) }).result;
    assert.equal(value, size);
  });
});

describe('the Input field when unfocused', () => {
  it('draws the label and the dim value, and no editor or hint', () => {
    const element = renderField({ ...base, value: 'abc', label: 'Name' });
    assert.equal(element.type, 'Box');
    const props = element.props as Held;
    assert.equal(props.flexDirection, 'row');
    assert.equal(props.flexShrink, 0);
    assert.equal(props.elementKey, 'i1');
    assert.equal(props.elementPlugin, 'p');
    assert.equal(props.onClick, undefined);
    const children = childrenOf(element);
    assert.deepEqual(children, [
      { type: 'Text', props: { bold: false, children: 'Name: ' }, children: ['Name: '], key: null },
      { type: 'Text', props: { dimColor: false, wrap: 'truncate-end', children: 'abc' }, children: ['abc'], key: null },
      false,
    ]);
  });

  it('draws the placeholder when empty, and nothing when there is none', () => {
    const withPlaceholder = renderedChildren(renderField({ ...base, value: '', label: 'Name', placeholder: 'Type here' }));
    assert.equal(withPlaceholder[1].props.children, 'Type here');
    assert.equal(withPlaceholder[1].props.dimColor, true);
    const empty = childrenOf(renderField({ ...base, value: '' }));
    assert.equal(empty[0], false);
    assert.deepEqual((empty[1] as Rendered).props, { dimColor: true, wrap: 'truncate-end', children: '' });
  });

  it('stays unfocused without the input-fields host even when the press holds focus', () => {
    const element = renderField({ ...base, value: 'prop', label: 'Name' }, new Map<unknown, unknown>([
      [fdn, { plugin: 'p', handle: 1 }],
    ]));
    assert.equal(renderedChildren(element).some((child) => child.type === 'TextEditor'), false);
    assert.equal(renderedChildren(element)[1].props.children, 'prop');
  });
});

describe('the Input field when focused', () => {
  const focusRef = { id: 'ref' };
  const focusedContexts = (fields: Record<string, unknown>, columns?: number) => {
    const contexts = new Map<unknown, unknown>([
      [cdn, fields], [fdn, { plugin: 'p', handle: 1 }], [pdn, focusRef], [ldn, () => {}],
    ]);
    if (columns !== undefined) contexts.set(ddn, columns);
    return contexts;
  };

  it('draws the bold label, the host editor and the submit hint', () => {
    const element = renderField(
      { ...base, value: 'prop', label: 'Name', placeholder: 'Type here' },
      focusedContexts({ textOf: () => 'fromhost', edit: () => {} }, 40),
    );
    const children = renderedChildren(element);
    assert.deepEqual(children[0].props, { bold: true, children: 'Name: ' });
    const editor = editorOf(element);
    assert.deepEqual(
      { ...editor.props, onChange: typeof editor.props.onChange, onChangeCursorOffset: typeof editor.props.onChangeCursorOffset },
      {
        value: 'fromhost',
        onChange: 'function',
        placeholder: 'Type here',
        columns: 25,
        cursorOffset: 8,
        onChangeCursorOffset: 'function',
        focus: true,
        showCursor: true,
        multiline: false,
        disableEscapeDoublePress: true,
      },
    );
    assert.deepEqual((children.at(-1) as Rendered).props, { dimColor: true, children: ' ⏎ submit' });
    assert.equal((element.props as Held).ref, focusRef);
    assert.equal(typeof (element.props as Held).onClick, 'function');
  });

  it('sends the edited value to the input-fields host', () => {
    const edited: unknown[] = [];
    const element = renderField({ ...base, value: 'v' }, focusedContexts({
      textOf: () => 'v',
      edit: (site: unknown, value: string) => edited.push([site, value]),
    }));
    (editorOf(element).props.onChange as (value: string) => void)('next');
    assert.deepEqual(edited, [[{ plugin: 'p', handle: 1, element: 'i1' }, 'next']]);
  });

  it('prefers the host text, then the drawn value', () => {
    const seen: unknown[] = [];
    const fromHost = renderField({ ...base, value: 'prop' }, focusedContexts({
      textOf: (plugin: string, element: string) => { seen.push([plugin, element]); return undefined; },
      edit: () => {},
    }));
    assert.equal(editorOf(fromHost).props.value, 'prop');
    assert.deepEqual(seen[0], ['p', 'i1']);
    const neither = renderField({ ...base }, focusedContexts({ textOf: () => undefined, edit: () => {} }));
    assert.equal(editorOf(neither).props.value, '');
    assert.equal(editorOf(neither).props.cursorOffset, 0);
  });

  it('uses the site columns when mounted and the terminal width otherwise', () => {
    const narrow = renderField({ ...base, value: 'v', label: 'L' }, focusedContexts({ textOf: () => 'v', edit: () => {} }, 10));
    assert.equal(editorOf(narrow).props.columns, 12);
    const site = renderField({ ...base, value: 'v', label: 'L' }, focusedContexts({ textOf: () => 'v', edit: () => {} }, 40));
    assert.equal(editorOf(site).props.columns, 28);
    const terminal = renderField({ ...base, value: 'v', label: 'L' }, focusedContexts({ textOf: () => 'v', edit: () => {} }));
    assert.equal(editorOf(terminal).props.columns, 68);
  });

  it('draws the configured submit label and clamps the caret to the value', () => {
    const element = renderField(
      { ...base, value: 'abcdef', submitLabel: 'go' },
      focusedContexts({ textOf: () => 'abcdef', edit: () => {} }),
    );
    assert.equal(renderedChildren(element).at(-1)?.props.children, ' ⏎ go');
    assert.equal(editorOf(element).props.cursorOffset, 6);
  });
});

describe('the seam names', () => {
  it('declares the component and the contexts under their source names', () => {
    assert.equal(InputField, Vt);
    assert.equal(InputFields, cdn);
    assert.equal(SiteColumns, ddn);
    assert.equal(useTerminalSize, ke);
    assert.equal(TerminalSizeContext, Zm);
    assert.equal(FIELD_MIN_COLUMNS, 12);
    assert.equal(Gt, 12);
  });
});
