// What the Client, the Markdown and the Link answer, measured rather than read.
import { Mto, sno, Vto, zto, Nrt, Lrt, pur } from '../src/plugin-chain-leaves-source.js';
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
const STAMP = { plugin: 'p', handle: 1 };
const PRESS = { plugin: 'p', handle: 1 };
const client = (props: unknown, extra: Record<string, unknown> = {}) => Mto({ props, client: STAMP, ...extra });
const markdown = (props: unknown, extra: Record<string, unknown> = {}) => Vto({ props, ...extra });
const link = (props: unknown, extra: Record<string, unknown> = {}) => sno({ props, ...extra });

show('constants', [Lrt, pur]);
show('client admitted', [
  client({ key: 'k', module: 'm' }),
  client({ key: 'k', module: 'm', props: { a: 1 } }),
  client({ key: 'k', module: 'm', width: 10, height: '50%', flexGrow: 1 }),
]);
show('client props sentence', [
  client(undefined), client('x'), client({ key: 'k' }), client({ module: 'm' }), client({ key: '', module: 'm' }),
  client({ key: 'k', module: 'm', extra: 1 }),
]);
show('client field + props + sizes', [
  client({ key: 'k', module: 'm', width: { a: 1 } }),
  client({ key: 'k', module: 'm', width: 10, height: 'x' }),
  client({ key: 'k', module: 'm', props: { a: undefined } }),
  client({ key: 'k', module: 'm', props: { a: new Date(0) } }),
]);
show('client stamp and children', [
  Mto({ props: { key: 'k', module: 'm' } }),
  Mto({ props: { key: 'k', module: 'm' }, client: { plugin: 'p' } }),
  client({ key: 'k', module: 'm' }, { children: 'x' }),
  client({ key: 'k', module: 'm', width: 0 }, { children: 'x' }),
]);
show('link admitted', [link({ href: 'https://a' }), link({ href: 'https://a', label: 'L' })]);
show('link href shapes', [
  link(undefined), link({}), link({ href: 1 }), link({ href: '' }), link({ href: 'x'.repeat(2048) }),
  link({ href: 'x'.repeat(2049) }), link({ href: 'é'.repeat(1024) }), link({ href: 'é'.repeat(1025) }),
  link({ href: 'a\x1bb' }),
]);
show('link label', [
  link({ href: 'https://a', label: 1 }), link({ href: 'https://a', label: '  ' }), link({ href: 'https://a', label: '' }),
  link({ href: 'https://a', label: 'a\x1bb' }), link({ href: 'https://a', extra: 1 }),
]);
show('encoder', [Nrt('a'), Nrt('café'), Nrt('é'), Nrt('\uD800'), Nrt('\uD800x'), Nrt('\uDC00'), Nrt('x😀')]);
show('markdown admitted', [
  markdown({ text: 't' }), markdown({ key: 'k', text: 't' }),
  markdown({ key: 'k', text: 't', dimColor: true, pressableLinks: ['https://a'] }, { press: PRESS }),
]);
show('markdown sentences', [
  markdown(undefined), markdown({ key: 'k' }), markdown({ text: 't', extra: 1 }), markdown({ text: 1 }),
  markdown({ key: '', text: 't' }), markdown({ key: 'k', text: 'a\x1bb' }), markdown({ key: 'k', text: 't', dimColor: 1 }),
  markdown({ text: 't' }, { children: 'x' }), markdown({ key: 'k', text: 't' }, { children: 'x' }),
]);
show('markdown links and press', [
  markdown({ text: 't', pressableLinks: ['https://a'] }),
  markdown({ text: 't', pressableLinks: 'x' }, { press: PRESS }),
  markdown({ text: 't', pressableLinks: ['a'], extra: 1 }, { press: PRESS }),
  markdown({ key: 'k', text: 't', pressableLinks: [1] }, { press: PRESS }),
  markdown({ key: 'k', text: 't', pressableLinks: ['a\x1bb'] }, { press: PRESS }),
  markdown({ key: 'k', text: 't', pressableLinks: new Array(pur + 1).fill('a') }, { press: PRESS }),
  markdown({ key: 'k', text: 't', pressableLinks: ['x'.repeat(Lrt + 1)] }, { press: PRESS }),
  markdown({ text: 't' }, { press: { plugin: 'p', handle: 1.5 } }),
  markdown({ key: 'k', text: 't' }, { press: {} }),
]);
show('list check alone', [
  zto(undefined), zto('x'), zto([]), zto(new Array(pur).fill('a')).length, zto([1]), zto(['a', 2]), zto(['x'.repeat(Lrt)]),
]);
