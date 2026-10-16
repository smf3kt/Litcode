// Which Image sentences carry the site's key and which are bare.
import { imageLeafProblem } from '../src/plugin-chain-raster-sites.js';
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
const be = (v: number) => [v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255];
const nm = [...'IHDR'].map((c) => c.charCodeAt(0));
const png = (w: number, h: number) => Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,...be(13),...nm,...be(w),...be(h),8,6,0,0,0,0,0,0,0]).toString('base64');
const P = { source: { png: png(1,1) }, alt: 'a', columns: 1, rows: 1 };
for (const [label, p] of [
  ['bare props', null],
  ['bare children', { ...P, children: 'x' }],
  ['bare alt type', { ...P, alt: 1 }],
  ['bare key empty', { ...P, key: '' }],
  ['stray', { ...P, hover: 1 }],
  ['z size', { ...P, columns: 300 }],
  ['z alt control', { ...P, alt: 'a\x1bb' }],
  ['z stamp', { ...P }],
] as Array<[string, unknown]>) {
  show(label + ' no key', imageLeafProblem({ props: p, image: { plugin: 'p' } }));
  show(label + ' with key', imageLeafProblem({ props: { ...(p as object ?? {}), key: 'k' }, image: { plugin: 'p' } }));
}
