// A complete 1x1 PNG header, so the admitted Image case is real.
import { imageLeafProblem } from '../src/plugin-chain-raster-sites.js';
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const be = (n: number) => [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255];
const name = (s: string) => [...s].map((c) => c.charCodeAt(0));
const png = (w: number, h: number, depth = 8, colour = 6, interlace = 0) =>
  Buffer.from([...sig, ...be(13), ...name('IHDR'), ...be(w), ...be(h), depth, colour, 0, 0, interlace, 0, 0, 0, 0]).toString('base64');
show('1x1 rgba', imageLeafProblem({ props: { source: { png: png(1, 1) }, alt: 'a', columns: 1, rows: 1 }, image: { plugin: 'p' } }));
show('size elsewhere', imageLeafProblem({ props: { source: { png: png(4, 3) }, alt: 'a', columns: 1, rows: 1 }, image: { plugin: 'p' } }));
show('depth 16', imageLeafProblem({ props: { source: { png: png(1, 1, 16) }, alt: 'a', columns: 1, rows: 1 }, image: { plugin: 'p' } }));
show('interlaced', imageLeafProblem({ props: { source: { png: png(1, 1, 8, 6, 1) }, alt: 'a', columns: 1, rows: 1 }, image: { plugin: 'p' } }));
show('too wide', imageLeafProblem({ props: { source: { png: png(4097, 1) }, alt: 'a', columns: 1, rows: 1 }, image: { plugin: 'p' } }));
show('alt empty', imageLeafProblem({ props: { source: { png: png(1, 1) }, alt: '', columns: 1, rows: 1 }, image: { plugin: 'p' } }));
