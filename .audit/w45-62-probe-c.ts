// Third round: real content, so both leaves reach the admitted side.
import { imageLeafProblem, rasterLeafProblem } from '../src/plugin-chain-raster-sites.js';
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
const blank = Buffer.alloc(12).toString('base64');
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
show('blank cell', blank);
show('raster admitted', [
  rasterLeafProblem({ props: { key: 'k', columns: 1, rows: 1, cells: blank }, raster: { plugin: 'p' } }),
  rasterLeafProblem({ props: { key: 'k', columns: 2, rows: 2, cells: Buffer.alloc(48).toString('base64') }, raster: { plugin: 'p' } }),
  rasterLeafProblem({ props: { key: 'k', columns: 1, rows: 1, cells: blank }, raster: { plugin: 'p' }, children: undefined }),
]);
show('image admitted', [
  imageLeafProblem({ props: { source: { png }, alt: 'a', columns: 1, rows: 1 }, image: { plugin: 'p' } }),
  imageLeafProblem({ props: { source: { png }, alt: '', columns: 1, rows: 1 }, image: { plugin: 'p' } }),
]);
show('image rgba admitted', imageLeafProblem({ props: { source: { rgba: Buffer.alloc(4).toString('base64'), width: 1, height: 1 }, alt: 'a', columns: 1, rows: 1 }, image: { plugin: 'p' } }));
