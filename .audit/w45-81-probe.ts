// W45-81 probe: the Select site component `sr`, the option window `S3n`, the site-focus reader `xe`
// and the click adapter `udn`. Values printed here belong in test/plugin-chain-select-field.test.ts.
import '../src/plugin-chain-registry.js';
import { runComponent } from '../src/plugin-chain-react-hooks.js';
import { gdn, fdn, pdn, ldn, ht, S3n, udn, xe, sr } from '../src/plugin-chain-select-field-source.js';

type Held = Record<string, unknown>;
console.log('ht', ht);
console.log('window empty', JSON.stringify(S3n(0, 0)));
console.log('window three', JSON.stringify(S3n(3, 2)));
console.log('window ten at 0', JSON.stringify(S3n(10, 0)));
console.log('window ten at 9', JSON.stringify(S3n(10, 9)));
console.log('window ten at 5', JSON.stringify(S3n(10, 5)));

const event = (overrides: Record<string, unknown> = {}) => {
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
let ran = 0;
const adapter = udn(() => { ran += 1; });
ran = 0;
adapter(event().value);
console.log('udn plain', ran);
ran = 0;
let e = event({ hyperlinkUrl: 'https://x' });
adapter(e.value);
console.log('udn link', ran, e.calls.join(','));
ran = 0;
e = event({ isWindowActivation: true });
adapter(e.value);
console.log('udn window', ran);
ran = 0;
e = event({ droppedAsStray: true });
adapter(e.value);
console.log('udn stray', ran);

const emptyFocus = runComponent(() => xe({ plugin: 'p', handle: 1 }), { contexts: new Map() }).result;
console.log('xe empty', JSON.stringify(emptyFocus));

const ref = { id: 'ref' };
let clicked: unknown;
const clickedPress = (press: unknown) => { clicked = press; };
const contexts = new Map<unknown, unknown>([
  [fdn, { plugin: 'p', handle: 1 }],
  [pdn, ref],
  [ldn, clickedPress],
  [gdn, {
    pickedOf: (plugin: string, element: string) => (plugin === 'p' && element === 's1' ? 'b' : undefined),
    open: null,
  }],
]);
const focused = runComponent(() => xe({ plugin: 'p', handle: 1 }), { contexts }).result;
console.log('xe focused', JSON.stringify({ focus: focused.hasKeyboardFocus, ref: focused.ref === ref, click: typeof focused.onClick }));
focused.onClick?.(event({}).value);
console.log('xe click', JSON.stringify(clicked));
const other = runComponent(() => xe({ plugin: 'p', handle: 2 }), { contexts }).result;
console.log('xe other', JSON.stringify({ focus: other.hasKeyboardFocus, ref: other.ref }));

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b' },
  { value: 'c', label: 'Charlie' },
];
const render = (props: Record<string, unknown>, ctx = new Map<unknown, unknown>()) =>
  runComponent(() => sr(props), { contexts: ctx }).result as Held;
const rows = (element: Held) => {
  const out: unknown[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (typeof value === 'object' && value !== null && 'props' in (value as object)) {
      out.push((value as Held).props);
    }
  };
  ((element.props as Held).children as unknown[]).forEach(visit);
  return out.map((props) => (props as Held).children);
};
const closed = render({ plugin: 'p', handle: 1, element: 's1', options, label: 'Pick' });
console.log('closed type', closed.type, 'props', JSON.stringify({ ...(closed.props as Held), children: undefined }));
console.log('closed rows', JSON.stringify(rows(closed)));
const none = render({ plugin: 'p', handle: 1, element: 's1', options });
console.log('none head', JSON.stringify(rows(none)[0]));
const picked = render({ plugin: 'p', handle: 1, element: 's1', options, value: 'b' });
console.log('picked head', JSON.stringify(rows(picked)[0]));

const openStore = {
  pickedOf: () => undefined,
  open: { plugin: 'p', handle: 1, highlight: 1 },
};
const openCtx = new Map<unknown, unknown>([[gdn, openStore], [fdn, { plugin: 'p', handle: 1 }]]);
const open = render({ plugin: 'p', handle: 1, element: 's1', options }, openCtx);
console.log('open rows', JSON.stringify(rows(open)));

const many = Array.from({ length: 10 }, (_, index) => ({ value: `v${index}`, label: `L${index}` }));
const scrolledStore = {
  pickedOf: () => 'v9',
  open: { plugin: 'p', handle: 1, highlight: 9 },
};
const scrolled = render({ plugin: 'p', handle: 1, element: 's1', options: many }, new Map<unknown, unknown>([[gdn, scrolledStore], [fdn, { plugin: 'p', handle: 1 }]]));
const scrolledRows = rows(scrolled);
console.log('scrolled count', scrolledRows.length, 'first', JSON.stringify(scrolledRows[0]), 'last', JSON.stringify(scrolledRows.at(-1)));

const otherOpen = { pickedOf: () => undefined, open: { plugin: 'q', handle: 1, highlight: 1 } };
const notOpen = render({ plugin: 'p', handle: 1, element: 's1', options }, new Map<unknown, unknown>([[gdn, otherOpen]]));
console.log('other open rows', JSON.stringify(rows(notOpen)));

// The click the component receives comes from xe through ldn, not from props.
console.log('closed click', typeof (closed.props as Held).onClick);
