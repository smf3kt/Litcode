// How far the PNG check goes, so the admitted Image case uses a real header.
import { imageLeafProblem } from '../src/plugin-chain-raster-sites.js';
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const build = (extra: number[]) => Buffer.from([...sig, ...extra]).toString('base64');
const len = (n: number) => [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255];
const name = (s: string) => [...s].map((c) => c.charCodeAt(0));
const full = [...len(13), ...name('IHDR'), ...new Array(13).fill(0), 0, 0, 0, 0];
const cases: Array<[string, number[]]> = [
  ['signature only', []],
  ['IHDR name only', [...name('IHDR')]],
  ['length + IHDR', [...len(13), ...name('IHDR')]],
  ['IHDR + 13 bytes', [...len(13), ...name('IHDR'), ...new Array(13).fill(0)]],
  ['full with crc', full],
];
for (const [label, extra] of cases) {
  show(label, imageLeafProblem({ props: { source: { png: build(extra) }, alt: 'a', columns: 1, rows: 1 }, image: { plugin: 'p' } }));
}
