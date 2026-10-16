// What the control-character test actually matches, and the last two message prefixes.
import { checkString, checkLabel, imageLeafProblem } from '../src/plugin-chain-raster-sites.js';
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
show('matches', [
  ['tab', checkString('key', 'a\tb')],
  ['newline', checkString('key', 'a\nb')],
  ['esc', checkString('key', 'a\x1bb')],
  ['nul', checkString('key', 'a\x00b')],
  ['del', checkString('key', 'a\x7fb')],
  ['lone high surrogate', checkString('key', 'a\ud800b')],
  ['lone low surrogate', checkString('key', 'a\udc00b')],
  ['paired surrogate', checkString('key', 'a😀b')],
  ['replacement', checkString('key', 'a�b')],
  ['object', checkString('key', 'a￼b')],
  ['label esc', checkLabel('alt', 'a\x1bb')],
]);
show('image stamp sentence', imageLeafProblem({ props: { source: { png }, alt: 'a', columns: 1, rows: 1 }, image: {} }));
show('image with key prefix', imageLeafProblem({ props: { source: { png }, alt: 'a', columns: 1, rows: 1, key: 'k' }, image: {} }));
show('image no prefix', imageLeafProblem({ props: { source: { png }, alt: 1, columns: 1, rows: 1 }, image: { plugin: 'p' } }));
