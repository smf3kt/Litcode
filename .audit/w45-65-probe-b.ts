// Second round: the list check on its own, and the two order-dependent sentences.
import { Mto, sno, Vto, zto, Nrt, Lrt, pur } from '../src/plugin-chain-leaves-source.js';
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
const PRESS = { plugin: 'p', handle: 1 };
show('list check alone', [
  zto(undefined), zto('x'), zto([]), zto(new Array(pur).fill('a')), zto([1]), zto(['a', 2]),
  zto(['x'.repeat(Lrt)]), zto(['x'.repeat(Lrt + 1)]), zto(['é'.repeat(1024)]), zto(['a\x1bb']), zto([null]),
]);
show('markdown press without key', [
  Vto({ props: { text: 't' }, press: PRESS }),
  Vto({ props: { text: 't', key: 'k' }, press: PRESS }),
  Vto({ props: { text: 't', pressableLinks: ['https://a'] }, press: PRESS }),
  Vto({ props: { key: 'k', text: 't', pressableLinks: ['https://a'] }, press: PRESS }),
]);
show('order: props before links before press', [
  Vto({ props: { key: 'k', text: 1, pressableLinks: 'x' }, press: PRESS }),
  Vto({ props: { key: 'k', text: 't', dimColor: 1, pressableLinks: 'x' }, press: PRESS }),
  Vto({ props: { key: 'k', text: 't', pressableLinks: 'x' } }),
]);
show('client order: stamp before children, sizes before stamp', [
  Mto({ props: { key: 'k', module: 'm' }, children: 'x' }),
  Mto({ props: { key: 'k', module: 'm', width: 'x' }, client: PRESS, children: 'x' }),
  Mto({ props: { key: 'k', module: 'm', props: { a: 1 } }, client: PRESS, children: 'x' }),
]);
show('link order: stray prop before href', [
  sno({ props: { href: 'x'.repeat(Lrt + 1), extra: 1 } }),
  sno({ props: { href: [], label: 1 } }),
  Nrt(''),
]);
