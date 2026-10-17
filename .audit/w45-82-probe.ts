// W45-82 probe: the Input field site `Vt`, the terminal-size hook `ke` and its context `Zm`, the
// field width `Gt` and the two contexts `cdn`/`ddn`. Values printed here belong in
// test/plugin-chain-input-field.test.ts.
import '../src/plugin-chain-registry.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { fdn, pdn, ldn } from '../src/plugin-chain-select-field-source.js';
import { Vt, Gt, cdn, ddn, ke, Zm } from '../src/plugin-chain-input-field-source.js';

type Held = Record<string, unknown>;
const defaults = new Map<unknown, unknown>([[Zm, { columns: 80, rows: 24 }]]);
const render = (props: Record<string, unknown>, contexts = new Map<unknown, unknown>()) => {
  const merged = new Map(defaults);
  for (const [key, value] of contexts) merged.set(key, value);
  return runComponent(() => Vt(props), { contexts: merged }).result as unknown as Held;
};
const childProps = (element: Held) => ((element.props as Held).children as unknown[]).map((child) => {
  if (typeof child !== 'object' || child === null || !('props' in (child as object))) return child;
  const held = child as Held;
  return { type: held.type, props: held.props };
});

console.log('Gt', Gt);
console.log('ke no provider', (() => {
  try { runComponent(() => ke(), { contexts: new Map() }); return 'no-throw'; } catch (error) { return String(error); }
})());
const size = { columns: 72, rows: 20 };
console.log('ke provider', JSON.stringify(runComponent(() => ke(), { contexts: new Map([[Zm, size]]) }).result));

const base = { plugin: 'p', handle: 1, element: 'i1' };
const plain = render({ ...base, value: 'abc', label: 'Name' });
console.log('plain root', JSON.stringify({ type: plain.type, flexDirection: (plain.props as Held).flexDirection, flexShrink: (plain.props as Held).flexShrink, elementKey: (plain.props as Held).elementKey, elementPlugin: (plain.props as Held).elementPlugin, click: typeof (plain.props as Held).onClick }));
console.log('plain children', JSON.stringify(childProps(plain)));

const placeholder = render({ ...base, value: '', label: 'Name', placeholder: 'Type here' });
console.log('placeholder children', JSON.stringify(childProps(placeholder)));
const empty = render({ ...base, value: '' });
console.log('empty children', JSON.stringify(childProps(empty)));

let edited: unknown[] = [];
const fields = {
  textOf: (plugin: string, element: string) => { edited.push(['textOf', plugin, element]); return 'fromhost'; },
  edit: (site: unknown, value: string) => { edited.push(['edit', site, value]); },
};
const focusRef = { id: 'ref' };
const focusedCtx = new Map<unknown, unknown>([
  [cdn, fields], [ddn, 40], [Zm, { columns: 80, rows: 24 }],
  [fdn, { plugin: 'p', handle: 1 }], [pdn, focusRef], [ldn, () => {}],
]);
const focused = render({ ...base, value: 'prop', label: 'Name', placeholder: 'Type here' }, focusedCtx);
const focusedChildren = childProps(focused) as { type: unknown; props: Held }[];
console.log('focused root click', typeof (focused.props as Held).onClick, 'ref', (focused.props as Held).ref === focusRef);
console.log('focused children', JSON.stringify(focusedChildren.map((child) => ({ type: child.type, props: { ...child.props, onChange: typeof child.props.onChange, onChangeCursorOffset: typeof child.props.onChangeCursorOffset } }))));
const editor = focusedChildren.find((child) => child.type === 'TextEditor')!;
(editor.props.onChange as (value: string) => void)('next');
console.log('edit calls', JSON.stringify(edited));

const fallback = render({ ...base, value: 'prop' }, new Map<unknown, unknown>([
  [cdn, { textOf: () => undefined, edit: () => {} }], [Zm, { columns: 80, rows: 24 }], [fdn, { plugin: 'p', handle: 1 }],
]));
console.log('value fallback', JSON.stringify(((childProps(fallback) as { props: Held }[])[1].props)));

const focusedNarrow = render({ ...base, value: 'v', label: 'L' }, new Map<unknown, unknown>([
  [cdn, { textOf: () => 'v', edit: () => {} }], [ddn, 10], [Zm, { columns: 80, rows: 24 }], [fdn, { plugin: 'p', handle: 1 }],
]));
console.log('narrow width', (childProps(focusedNarrow) as { props: Held }[]).find((child) => (child as { type?: unknown }).type === 'TextEditor')?.props.columns);

const terminalWidth = render({ ...base, value: 'v', label: 'L' }, new Map<unknown, unknown>([
  [cdn, { textOf: () => 'v', edit: () => {} }], [Zm, { columns: 50, rows: 24 }], [fdn, { plugin: 'p', handle: 1 }],
]));
console.log('terminal width', (childProps(terminalWidth) as { props: Held }[]).find((child) => (child as { type?: unknown }).type === 'TextEditor')?.props.columns);

const submitLabel = render({ ...base, value: 'v', label: 'L', submitLabel: 'go' }, focusedCtx);
console.log('submit hint', JSON.stringify((childProps(submitLabel) as { props: Held }[]).at(-1)!.props.children));

const unfocusedNoHost = render({ ...base, value: 'prop', label: 'Name' }, new Map<unknown, unknown>([
  [fdn, { plugin: 'p', handle: 1 }], [Zm, { columns: 80, rows: 24 }],
]));
console.log('unfocused no host', JSON.stringify(childProps(unfocusedNoHost)));

const cursor = render({ ...base, value: 'abcdef', label: '' }, focusedCtx);
console.log('cursor props', JSON.stringify(((childProps(cursor) as { props: Held }[])[0].props)));
