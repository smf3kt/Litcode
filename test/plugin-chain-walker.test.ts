// W45-86: the site-tree walker `je`, the display href encoder `Mrt`, the Box-key scope check `X4t`
// and the control/bidi patterns they use. Expected values were measured through the ported bodies
// (see .audit/w45-86-probe.txt).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../src/plugin-chain-registry.js';
import { Zt } from '../src/plugin-chain-press-button-source.js';
import { Vt } from '../src/plugin-chain-input-field-source.js';
import { sr } from '../src/plugin-chain-select-field-source.js';
import { lt } from '../src/plugin-chain-code-source.js';
import { Xt } from '../src/plugin-chain-markdown-source.js';
import { Io } from '../src/plugin-chain-client-host-source.js';
import { No } from '../src/plugin-chain-image-component-source.js';
import { jo } from '../src/plugin-chain-react-surface-source.js';
import { $t, Ut } from '../src/plugin-chain-hover-source.js';
import { je, Mrt, y$, zDe, zpr, pot, X4t } from '../src/plugin-chain-walker-host-source.js';
import { Wt } from '../src/plugin-chain-walker-host.js';
import { renderSiteTree, encodeDisplayHref, hoverScopeProblem } from '../src/plugin-chain-walker.js';

type Any = Record<string, any>;
const walk = (tree: Any | string, draw: (ref: unknown) => unknown = () => 'DRAWN'): Any => (je as (tree: unknown, draw: unknown) => Any)(tree, draw);
const text = (children: unknown[]) => ({ type: 'Text', props: {}, children });

describe('the node types', () => {
  it('turns strings into text and lets an engine node draw itself', () => {
    assert.deepEqual(walk('hello'), text(['hello']));
    assert.equal(walk({ type: 'engine', ref: 'REF' }, () => null), null);
    assert.equal(walk({ type: 'engine', ref: 'REF' }, (ref) => `DRAWN:${ref}`), 'DRAWN:REF');
  });

  it('passes the press handle and props to each site component', () => {
    const button = walk({
      type: 'Button',
      press: { plugin: 'p', handle: 3 },
      props: { key: 'b', label: 'Go', hotkey: 'g', action: 'act', plain: true, dimColor: false, variant: 'primary', role: 'primary' },
      hover: { color: 'red' },
      children: ['A', { type: 'Text', props: {}, children: ['B'] }],
    });
    assert.equal(button.type, Zt);
    assert.deepEqual(button.props, {
      plugin: 'p', handle: 3, element: 'b', label: 'Go', hotkey: 'g', action: 'act', plain: true,
      dimColor: false, variant: 'primary', role: 'primary', hover: { color: 'red' },
      held: ['A', text(['B'])],
    });
    assert.deepEqual(button.children, []);
    const input = walk({ type: 'Input', press: { plugin: 'p', handle: 4 }, props: { key: 'i', label: 'L', placeholder: 'P', value: 'V', submitLabel: 'S' }, children: [] });
    assert.equal(input.type, Vt);
    assert.deepEqual(input.props, { plugin: 'p', handle: 4, element: 'i', label: 'L', placeholder: 'P', value: 'V', submitLabel: 'S' });
    const select = walk({ type: 'Select', press: { plugin: 'p', handle: 5 }, props: { key: 's', label: 'L', options: [{ value: 'a', label: 'A' }], value: 'a' }, children: [] });
    assert.equal(select.type, sr);
    assert.deepEqual(select.props, { plugin: 'p', handle: 5, element: 's', label: 'L', options: [{ value: 'a', label: 'A' }], value: 'a' });
  });

  it('draws Code, Markdown, Client, Svg, Image and Raster', () => {
    assert.deepEqual(walk({ type: 'Code', props: { source: 'x', language: 'ts' } }).props, { source: 'x', language: 'ts' });
    assert.equal(walk({ type: 'Code', props: { source: 'x' } }).type, lt);
    const markdown = walk({ type: 'Markdown', press: { kind: 'press' }, props: { text: 'm', dimColor: true, key: 'k', pressableLinks: ['u'] } });
    assert.equal(markdown.type, Xt);
    assert.deepEqual(markdown.props, { text: 'm', dimColor: true, press: { kind: 'press' }, elementKey: 'k', pressableLinks: ['u'] });
    assert.equal(walk({ type: 'Markdown', props: { text: 'm' } }).props.press, undefined);
    const client = walk({ type: 'Client', client: { plugin: 'cp' }, props: { key: 'ck', module: 'mod', props: { a: 1 }, drawn: 'D', width: 9, height: 2, flexGrow: 3 } });
    assert.equal(client.type, Io);
    assert.deepEqual({
      key: client.props.key, plugin: client.props.plugin, module: client.props.module,
      elementKey: client.props.elementKey, props: client.props.props, drawn: client.props.drawn,
      width: client.props.width, height: client.props.height, flexGrow: client.props.flexGrow,
      rebuild: typeof client.props.rebuild,
    }, {
      key: 'client:cp:ck', plugin: 'cp', module: 'mod', elementKey: 'ck', props: { a: 1 },
      drawn: { key: 'ck', module: 'mod', props: { a: 1 }, drawn: 'D', width: 9, height: 2, flexGrow: 3 },
      width: 9, height: 2, flexGrow: 3, rebuild: 'function',
    });
    assert.deepEqual(client.props.rebuild({ type: 'engine', ref: 'R' }), null);
    assert.deepEqual(client.props.rebuild('x'), text(['x']));
    const svg = walk({ type: 'Svg', props: { alt: 'ALT' } });
    assert.deepEqual(svg, { type: 'Text', props: { dimColor: true }, children: ['ALT'] });
    const image = walk({ type: 'Image', image: { plugin: 'ip' }, props: { key: 'ik', source: 'src', columns: 2, rows: 3, alt: 'alt' } });
    assert.equal(image.type, No);
    assert.deepEqual(image.props, { key: 'image:ip:ik', plugin: 'ip', elementKey: 'ik', source: 'src', columns: 2, rows: 3, alt: 'alt' });
    assert.equal('key' in walk({ type: 'Image', image: { plugin: 'ip' }, props: { source: 'src' } }).props, false);
    const raster = walk({ type: 'Raster', raster: { plugin: 'rp' }, props: { key: 'rk', columns: 2, rows: 1, cells: [1] } });
    assert.equal(raster.type, jo);
    assert.deepEqual(raster.props, { key: 'raster:rp:rk', plugin: 'rp', elementKey: 'rk', columns: 2, rows: 1, cells: [1] });
  });

  it('draws a link with its display href, its URL and the host link component', () => {
    const link = walk({ type: 'Link', props: { href: 'https://e.test/a b', label: 'label' }, children: [] });
    assert.equal(link.type, Wt);
    assert.deepEqual(link.props, {
      url: 'https://e.test/a b',
      fallback: { type: 'Text', props: {}, children: ['label', ' ', { type: 'Text', props: { dimColor: true }, children: ['https://e.test/a b'] }] },
    });
    assert.deepEqual(link.children, ['label']);
    const bare = walk({ type: 'Link', props: { href: 'https://e.test/a b' }, children: [] });
    assert.equal(bare.props.fallback, undefined);
    assert.deepEqual(bare.children, ['https://e.test/a b']);
  });
});

describe('the containers', () => {
  it('gives a keyed Box its hover scope and group', () => {
    const box = walk({ type: 'Box', props: { key: 'k1', flexDirection: 'row' }, group: { plugin: 'gp' }, hover: { scope: 'h1', color: 'red' }, children: ['x'] });
    assert.equal(box.type, $t);
    assert.deepEqual(box.props, {
      key: 'k1', isLive: true, elementKey: 'k1', layout: { flexDirection: 'row' },
      hover: { scope: 'h1', color: 'red' }, group: { plugin: 'gp', scope: 'h1' },
      children: [text(['x'])],
    });
    assert.deepEqual(box.children, [text(['x'])]);
  });

  it('draws a plain Box and a hovered Text', () => {
    const plain = walk({ type: 'Box', props: { flexDirection: 'row' }, children: ['x'] });
    assert.deepEqual(plain, { type: 'Box', props: { flexDirection: 'row' }, children: [text(['x'])] });
    const hovered = walk({ type: 'Text', props: { color: 'red' }, hover: { scope: 'h2' }, group: { plugin: 'gp' }, children: ['t'] });
    assert.equal(hovered.type, Ut);
    assert.deepEqual(hovered.props, {
      isInline: true, props: { color: 'red' }, hover: { scope: 'h2' },
      group: { plugin: 'gp', scope: 'h2' }, children: ['t'],
    });
    assert.equal(walk({ type: 'Box', props: {}, hover: { scope: 'h' }, children: [] }).props.isInline, false);
  });

  it('marks only the first drawn key of one parent live', () => {
    const box = walk({ type: 'Box', props: {}, children: [{ type: 'Box', props: { key: 'd' } }, { type: 'Box', props: { key: 'd' } }] });
    assert.deepEqual(box.children.map((child: Any) => ({ type: child.type === $t ? '$t' : child.type, live: child.props.isLive, key: child.props.key, elementKey: child.props.elementKey })), [
      { type: '$t', live: true, key: 'd', elementKey: 'd' },
      { type: '$t', live: false, key: undefined, elementKey: 'd' },
    ]);
  });

  it('keeps inline text and walks block text', () => {
    const block = walk({ type: 'Box', props: {}, children: ['a', { type: 'Text', props: {}, children: ['b'] }] });
    assert.deepEqual(block.children.map((child: Any) => typeof child === 'string' ? child : child.type), ['Text', 'Text']);
    const inline = walk({ type: 'Text', props: {}, children: ['a', { type: 'Text', props: {}, children: ['b'] }] });
    assert.deepEqual(inline.children, ['a', text(['b'])]);
    const linkInline = walk({ type: 'Link', props: { href: 'u', label: 'L' }, children: ['x'] });
    assert.deepEqual(linkInline.children, ['x']);
  });
});

describe('the Box-key scope check', () => {
  it('admits one usable key per parent and reports a repeat once', () => {
    const seen = new Set();
    assert.equal(X4t('k', seen), undefined);
    assert.equal(X4t('k', seen), 'Box "k" is drawn twice under one parent; only the first is a hover scope');
  });

  it('refuses a key that is not a usable address', () => {
    assert.equal(X4t('', new Set()), 'Box key "" is not a string of 1 to 10000 characters; it is dropped and names no hover scope');
    assert.match(X4t('x'.repeat(10001), new Set()) as string, /^Box key "x+\.\.\." is not a string of 1 to 10000 characters/);
    assert.match(X4t(3, new Set()) as string, /^Box key "3" is not a string of 1 to 10000 characters/);
    assert.equal(X4t('a\u0001', new Set()), 'Box "a?" key holds a control character; it is dropped and names no hover scope');
  });
});

describe('the display href encoder', () => {
  it('percent-encodes controls and bidi marks and leaves printable text alone', () => {
    assert.equal(Mrt('a b'), 'a b');
    assert.equal(Mrt('a\tb'), 'a%09b');
    assert.equal(Mrt('a\nb'), 'a%0Ab');
    assert.equal(Mrt('a\u0001b'), 'a%01b');
    assert.equal(Mrt('a‮b'), 'a%E2%80%AEb');
    assert.equal(Mrt('é'), 'é');
  });

  it('carries the source patterns', () => {
    assert.equal(y$ instanceof RegExp, true);
    assert.equal(pot instanceof RegExp, true);
    assert.equal(y$.test('\t'), true);
    assert.equal(pot.test('‮'), true);
    assert.deepEqual(zDe, [[1564, 1564], [8234, 8238], [8294, 8297]]);
    assert.equal(zpr, '\\u{61c}\\u{202a}-\\u{202e}\\u{2066}-\\u{2069}');
  });
});

describe('the seam names', () => {
  it('declares the walker, the encoder and the scope check under their source aliases', () => {
    assert.equal(renderSiteTree, je);
    assert.equal(encodeDisplayHref, Mrt);
    assert.equal(hoverScopeProblem, X4t);
  });
});
