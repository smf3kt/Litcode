// The Raster leaf admitted: one cell holding a printable width-1 code point.
import { rasterLeafProblem } from '../src/plugin-chain-raster-sites.js';
const show = (n: string, v: unknown) => console.log(n, '=', JSON.stringify(v));
const cell = (cp: number, fg = 32768, bg = 32768) => {
  const b = Buffer.alloc(12);
  b.writeUInt32LE(cp, 0); b.writeUInt32LE(fg, 4); b.writeUInt32LE(bg, 8);
  return b.toString('base64');
};
show('one A', cell(0x41));
show('raster admitted', [
  rasterLeafProblem({ props: { key: 'k', columns: 1, rows: 1, cells: cell(0x41) }, raster: { plugin: 'p' } }),
  rasterLeafProblem({ props: { key: 'k', columns: 1, rows: 1, cells: cell(0x41, 0, 0) }, raster: { plugin: 'p' } }),
  rasterLeafProblem({ props: { key: 'k', columns: 2, rows: 1, cells: Buffer.concat([Buffer.from(cell(0x41), 'base64'), Buffer.from(cell(0x42), 'base64')]).toString('base64') }, raster: { plugin: 'p' } }),
]);
show('raster missing key with a good frame', rasterLeafProblem({ props: { columns: 1, rows: 1, cells: cell(0x41) }, raster: { plugin: 'p' } }));
show('raster not stamped', rasterLeafProblem({ props: { key: 'k', columns: 1, rows: 1, cells: cell(0x41) }, raster: {} }));
show('raster no children', rasterLeafProblem({ props: { key: 'k', columns: 1, rows: 1, cells: cell(0x41) }, children: 0, raster: { plugin: 'p' } }));
