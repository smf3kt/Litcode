// Second probe round: the admitted cases. A leaf that passes answers nothing, so each check has to be
// driven to the far side of every one of its conditions.
import { imageLeafProblem, rasterLeafProblem, firstFieldProblem, checkString } from '../src/plugin-chain-raster-sites.js';

const show = (name: string, value: unknown) => console.log(name, '=', JSON.stringify(value));

const cells = (columns: number, rows: number) => Buffer.alloc(columns * rows * 12, 1).toString('base64');
show('encoded 1x1', cells(1, 1));

show('raster admitted', [
  rasterLeafProblem({ props: { key: 'k', columns: 1, rows: 1, cells: cells(1, 1) }, raster: { plugin: 'p' } }),
  rasterLeafProblem({ props: { key: 'k', columns: 3, rows: 2, cells: cells(3, 2) }, raster: { plugin: 'p' } }),
  rasterLeafProblem({ props: { key: 'k'.repeat(300), columns: 1, rows: 1, cells: cells(1, 1) }, raster: { plugin: 'p' } }),
]);
show('raster missing key', rasterLeafProblem({ props: { columns: 1, rows: 1, cells: cells(1, 1) }, raster: { plugin: 'p' } }));
show('raster class name only', rasterLeafProblem({}));

show('image admitted', [
  imageLeafProblem({ props: { source: { png: 'AAAA' }, alt: 'a', columns: 1, rows: 1 }, image: { plugin: 'p' } }),
  imageLeafProblem({ props: { source: { png: 'AAAA' }, alt: 'a', columns: 255, rows: 255, key: 'k' }, image: { plugin: 'p' } }),
  imageLeafProblem({ props: { source: { rgba: 'AAAA', width: 1, height: 1 }, alt: 'a', columns: 1, rows: 1 }, image: { plugin: 'p' } }),
  imageLeafProblem({ props: { source: { file: '/tmp/x.png' }, alt: 'a', columns: 1, rows: 1 }, image: { plugin: 'p' } }),
]);
show('image long key', imageLeafProblem({ props: { source: { png: 'AAAA' }, alt: 'a', columns: 1, rows: 1, key: 'k'.repeat(50) }, image: { plugin: 'p' } }));
show('image alt control', imageLeafProblem({ props: { source: { png: 'AAAA' }, alt: 'a\nb', columns: 1, rows: 1 }, image: { plugin: 'p' } }));
show('image not stamped', imageLeafProblem({ props: { source: { png: 'AAAA' }, alt: 'a', columns: 1, rows: 1 }, image: {} }));
show('image alt at the cap', checkString('alt', 'a'.repeat(10000)) === undefined ? 'not this check' : 'this check caps');
show('firstFieldProblem both bad', firstFieldProblem(['a', 'b'], { a: 1, b: 2 }));
