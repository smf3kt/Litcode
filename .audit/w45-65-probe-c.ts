import { Mto, Vto, sno, Nrt } from '../src/plugin-chain-leaves-source.js';
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
const STAMP = { plugin: 'p', handle: 1 };
show('stamps', [
  Mto({ props: { key: 'k', module: 'm' } , client: STAMP}),
  Mto({ props: { key: 'k', module: 'm' } , client: { plugin: 'p' }}),
  Mto({ props: { key: 'k', module: 'm' } , client: { plugin: '' }}),
  Mto({ props: { key: 'k', module: 'm' } , client: {}}),
  Mto({ props: { key: 'k', module: 'm' } , client: 'p'}),
]);
show('encoder', [Nrt('a b'), Nrt('a\nb'), Nrt('a\tb'), Nrt('~'), Nrt('\u007f'), Nrt('aé')]);
show('markdown shapes', [
  Vto({ props: { key: 'k' } }), Vto({ props: {} }), Vto({ props: { key: 1, text: 't' } }),
  Vto({ props: { key: 'k', text: 't', pressableLinks: ['https://a'] }, press: STAMP }),
  Vto({ props: { key: 'k', text: 't' }, press: STAMP }),
  Vto({ props: { text: 't' }, press: STAMP }),
  Vto({ props: { key: 'k', text: 't' }, press: { plugin: 'p', handle: 1.5 } }),
]);
