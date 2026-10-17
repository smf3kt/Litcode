// W45-86 probe: the site-tree walker `je`, the display href encoder `Mrt`, the Box-key scope check
// `X4t` and the two pattern tables they use. Values printed here belong in
// test/plugin-chain-walker.test.ts.
import '../src/plugin-chain-registry.js';
import { Zt } from '../src/plugin-chain-press-button-source.js';
import { Vt } from '../src/plugin-chain-input-field-source.js';
import { sr } from '../src/plugin-chain-select-field-source.js';
import { lt } from '../src/plugin-chain-code-source.js';
import { Xt } from '../src/plugin-chain-markdown-source.js';
import { Io } from '../src/plugin-chain-client-host-source.js';
import { No } from '../src/plugin-chain-image-component-source.js';
import { jo } from '../src/plugin-chain-react-surface-source.js';
import { $t, Ut, Bt } from '../src/plugin-chain-hover-source.js';
import { je, Mrt, y$, zDe, zpr, pot, X4t } from '../src/plugin-chain-walker-host-source.js';
import { Wt } from '../src/plugin-chain-walker-host.js';

type Any = Record<string, any>;
const walk = (tree: Any, draw: (ref: unknown) => unknown = () => 'DRAWN') => je(tree, draw) as Any;
const show = (element: Any) => ({
  type: typeof element.type === 'string' ? element.type : element.type === Zt ? 'Zt' : element.type === Vt ? 'Vt' : element.type === sr ? 'sr' : element.type === lt ? 'lt' : element.type === Xt ? 'Xt' : element.type === Io ? 'Io' : element.type === No ? 'No' : element.type === jo ? 'jo' : element.type === $t ? '$t' : element.type === Ut ? 'Ut' : element.type === Wt ? 'Wt' : String(element.type),
  props: element.props,
  children: element.children,
});

console.log('string', JSON.stringify(show(walk('hello'))));
console.log('engine', JSON.stringify(walk({ type: 'engine', ref: 'REF' }, (ref) => `DRAWN:${ref}`)));
const buttonTree = { type: 'Button', press: { plugin: 'p', handle: 3 }, props: { key: 'b', label: 'Go', hotkey: 'g', action: 'act', plain: true, dimColor: false, variant: 'primary', role: 'primary' }, hover: { color: 'red' }, children: ['A', { type: 'Text', props: {}, children: ['B'] }] };
const button = walk(buttonTree);
console.log('button', button.type === Zt, JSON.stringify(button.props), JSON.stringify(button.children));
console.log('input', JSON.stringify(show(walk({ type: 'Input', press: { plugin: 'p', handle: 4 }, props: { key: 'i', label: 'L', placeholder: 'P', value: 'V', submitLabel: 'S' }, children: [] }))));
console.log('select', JSON.stringify(show(walk({ type: 'Select', press: { plugin: 'p', handle: 5 }, props: { key: 's', label: 'L', options: [{ value: 'a', label: 'A' }], value: 'a' }, children: [] }))));
console.log('code', show(walk({ type: 'Code', props: { source: 'x', language: 'ts' } })).type);
console.log('markdown', JSON.stringify(show(walk({ type: 'Markdown', press: { kind: 'press' }, props: { text: 'm', dimColor: true, key: 'k', pressableLinks: ['u'] } }))));
console.log('client', JSON.stringify(show(walk({ type: 'Client', client: { plugin: 'cp' }, props: { key: 'ck', module: 'mod', props: { a: 1 }, drawn: 'D', width: 9, height: 2, flexGrow: 3 } }))));
console.log('svg', JSON.stringify(show(walk({ type: 'Svg', props: { alt: 'ALT' } }))));
console.log('image', JSON.stringify(show(walk({ type: 'Image', image: { plugin: 'ip' }, props: { key: 'ik', source: 'src', columns: 2, rows: 3, alt: 'alt' } }))));
console.log('raster', JSON.stringify(show(walk({ type: 'Raster', raster: { plugin: 'rp' }, props: { key: 'rk', columns: 2, rows: 1, cells: [1] } }))));
const link = walk({ type: 'Link', props: { href: 'https://e.test/a b', label: 'label' }, children: [] });
console.log('link', JSON.stringify(show(link)));
const bareLink = walk({ type: 'Link', props: { href: 'https://e.test/a b' }, children: [] });
console.log('link bare', JSON.stringify({ type: show(bareLink).type, url: bareLink.props.url, fallback: bareLink.props.fallback === undefined ? 'none' : 'some', children: bareLink.children }));
console.log('box keyed', JSON.stringify(show(walk({ type: 'Box', props: { key: 'k1', flexDirection: 'row' }, group: { plugin: 'gp' }, hover: { scope: 'h1', color: 'red' }, children: ['x'] }))));
console.log('box plain', JSON.stringify(show(walk({ type: 'Box', props: { flexDirection: 'row' }, children: ['x'] }))));
console.log('text hover', JSON.stringify(show(walk({ type: 'Text', props: { color: 'red' }, hover: { scope: 'h2' }, group: { plugin: 'gp' }, children: ['t'] }))));
const inline = walk({ type: 'Box', props: {}, children: ['a', { type: 'Text', props: {}, children: ['b'] }] });
console.log('inline children', JSON.stringify(inline.children.map((child: Any) => typeof child === 'string' ? child : show(child).type)));
const mixed = walk({ type: 'Text', props: {}, children: ['a', { type: 'Text', props: {}, children: ['b'] }] });
console.log('text children', JSON.stringify(mixed.children));
const dup = walk({ type: 'Box', props: {}, children: [{ type: 'Box', props: { key: 'd' } }, { type: 'Box', props: { key: 'd' } }] });
console.log('dup keys', JSON.stringify(dup.children.map((child: Any) => ({ type: show(child).type, live: child.props.isLive, key: child.props.key, elementKey: child.props.elementKey }))));

console.log('X4t valid', X4t('k', new Set()));
const seen = new Set();
console.log('X4t first', X4t('k', seen), 'second', X4t('k', seen));
console.log('X4t empty', X4t('', new Set()));
console.log('X4t long', X4t('x'.repeat(10001), new Set())?.slice(0, 40));
console.log('X4t nonstring', X4t(3, new Set())?.slice(0, 40));

console.log('Mrt space', Mrt('a b'));
console.log('Mrt tab', Mrt('a\tb'), 'newline', Mrt('a\nb'), 'control', Mrt('a\u0001b'));
console.log('Mrt bidi', Mrt('a‮b'), 'placeholder', Mrt('a￼b'));
console.log('Mrt unicode', Mrt('é'));
console.log('patterns', y$ instanceof RegExp, pot instanceof RegExp, JSON.stringify(zDe), zpr.slice(0, 40));
console.log('Bt', JSON.stringify(Bt(undefined, undefined)), JSON.stringify(Bt('gp', { scope: 'h1' })));
console.log('X4t control', JSON.stringify(X4t('a\u0001', new Set())));
console.log('X4t long head', JSON.stringify(X4t('x'.repeat(10001), new Set()).slice(0, 80)));
console.log('X4t nonstring full', JSON.stringify(X4t(3, new Set())));
console.log('X4t empty full', JSON.stringify(X4t('', new Set())));
