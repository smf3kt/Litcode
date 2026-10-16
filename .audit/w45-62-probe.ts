// Probe the W45-62 bodies through the seam before any assertion is written.
import {
  IMAGE_COLUMNS, IMAGE_ROWS, KEY_LABEL_LIMIT, RASTER_SITE_FIELDS, STRING_LIMIT,
  allowedKeys, checkLabel, checkString, firstFieldProblem, imageLeafProblem, imageSizeProblem,
  isChainStamped, labelOf, pickRasterProps, rasterLeafProblem,
} from '../src/plugin-chain-raster-sites.js';

const show = (name: string, value: unknown) => console.log(name, '=', JSON.stringify(value));

show('constants', { KEY_LABEL_LIMIT, STRING_LIMIT, IMAGE_COLUMNS, IMAGE_ROWS, RASTER_SITE_FIELDS });

show('labelOf short', labelOf('key'));
show('labelOf 40', labelOf('k'.repeat(40)));
show('labelOf 41', labelOf('k'.repeat(41)));
show('labelOf tab', labelOf('a\tb'));
show('labelOf newline', labelOf('a\nb'));
show('labelOf esc', labelOf('a\x1bb'));

show('allowedKeys good', allowedKeys({ key: 'k', columns: 1 }, ['key', 'columns']));
show('allowedKeys stray', allowedKeys({ key: 'k', hover: 1 }, ['key', 'columns']));

show('isChainStamped', [
  isChainStamped({ plugin: 'p' }),
  isChainStamped({ plugin: '' }),
  isChainStamped({}),
  isChainStamped(null),
]);

show('checkString', [
  checkString('key', undefined),
  checkString('key', 'ok'),
  checkString('key', 7),
  checkString('key', 'k'.repeat(STRING_LIMIT)),
  checkString('key', 'k'.repeat(STRING_LIMIT + 1)),
  checkString('key', 'a\tb'),
]);
show('checkLabel', [
  checkLabel('alt', 'ok'),
  checkLabel('alt', 'k'.repeat(STRING_LIMIT + 5)),
  checkLabel('alt', 'a\nb'),
]);
show('firstFieldProblem', [
  firstFieldProblem(['key'], { key: 'a\tb' }),
  firstFieldProblem(['key'], { key: 'ok' }),
  firstFieldProblem(['a', 'b'], { a: 1, b: 2 }),
]);
show('imageSizeProblem', [
  imageSizeProblem(255, 255),
  imageSizeProblem(256, 255),
  imageSizeProblem(0, 1),
  imageSizeProblem(1.5, 1),
]);
show('pickRasterProps', [
  pickRasterProps({ key: 'k', columns: 1, rows: 1, cells: 'x' }),
  pickRasterProps({ key: '', columns: 1 }),
  pickRasterProps({ key: 'k', hover: 1 }),
  pickRasterProps(null),
]);

const cellFrame = { columns: 1, rows: 1, cells: 'AAAA' };
show('rasterLeafProblem', [
  rasterLeafProblem({ props: { key: 'k', columns: 1, rows: 1, cells: cellFrame.cells }, raster: { plugin: 'p' } }),
  rasterLeafProblem({ props: { key: 'k', columns: 1 }, raster: { plugin: 'p' } }),
  rasterLeafProblem({ props: { key: 'k', columns: 1, rows: 1, cells: 'zz' }, raster: { plugin: 'p' } }),
  rasterLeafProblem({ props: { key: 'k', columns: 1, rows: 1, cells: cellFrame.cells }, raster: {} }),
  rasterLeafProblem({ props: { key: 'k', columns: 1, rows: 1, cells: cellFrame.cells }, children: 'x', raster: { plugin: 'p' } }),
  rasterLeafProblem({ props: { key: 'k', hover: 1 }, raster: { plugin: 'p' } }),
  rasterLeafProblem({ props: { key: 'a\tb', columns: 1, rows: 1, cells: cellFrame.cells }, raster: { plugin: 'p' } }),
  rasterLeafProblem({ props: { key: 'k', columns: 600, rows: 1, cells: cellFrame.cells }, raster: { plugin: 'p' } }),
]);

show('imageLeafProblem', [
  imageLeafProblem({ props: { source: { png: 'AAAA' }, alt: 'a' }, image: { plugin: 'p' } }),
  imageLeafProblem({ props: { source: { png: 'AAAA' }, alt: 'a', key: 'k' }, image: { plugin: 'p' } }),
  imageLeafProblem({ props: { source: { png: 'AAAA' }, alt: 'a', hover: 1 }, image: { plugin: 'p' } }),
  imageLeafProblem({ props: { source: { png: 'AAAA' }, alt: 1 }, image: { plugin: 'p' } }),
  imageLeafProblem({ props: { source: { png: 'AAAA' }, alt: 'a', key: '' }, image: { plugin: 'p' } }),
  imageLeafProblem({ props: { source: { png: 'AAAA' }, alt: 'a', columns: 256 }, image: { plugin: 'p' } }),
  imageLeafProblem({ props: { source: 1, alt: 'a' }, image: { plugin: 'p' } }),
  imageLeafProblem({ props: { source: { png: 'AAAA' }, alt: 'a' }, image: {} }),
  imageLeafProblem({ props: { source: { png: 'AAAA' }, alt: 'a' }, children: 'x', image: { plugin: 'p' } }),
  imageLeafProblem({ props: null }),
]);
