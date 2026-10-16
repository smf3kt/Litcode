// W45-37 reuses the ESC tokenizer this product already carries instead of copying the same body a
// second time, so the reuse has to be a measured fact. This recomputes both comparisons from the
// extracted module and the product file, and exits non-zero if either differs.
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const module = fs.readFileSync('extracted-v2/modules/chunk-yn0pfn70.js', 'utf8');
const product = fs.readFileSync('src/tui-ansi-tokenizer.ts', 'utf8');
const digest = (text) => createHash('sha256').update(text).digest('hex');

const slice = (source, start, end) => source.slice(start, end);
/** The carried body: from the marker that opens it to the marker that follows it, with the
 *  following marker's own length accounted for. */
const between = (text, start, end, endOffset) => text.slice(text.indexOf(start), text.indexOf(end) + endOffset);

const pairs = [
  { name: 'twe', range: [3260, 3602], start: 'function twe(e){', end: 'function CGn(e){', endOffset: 0 },
  { name: 'L', range: [3672, 6275], start: 'function L(e,t,r,n,s,o,c){', end: 'export {', endOffset: -1 },
];

let failed = false;
for (const { name, range, start, end, endOffset } of pairs) {
  const source = slice(module, range[0], range[1]);
  const carried = between(product, start, end, endOffset);
  const same = source === carried;
  if (!same) failed = true;
  console.log(JSON.stringify({
    name,
    module: 'chunk-yn0pfn70.js',
    range,
    units: source.length,
    product: `src/tui-ansi-tokenizer.ts ${name}`,
    identical: same,
    moduleSha256: digest(source).slice(0, 24),
    productSha256: digest(carried).slice(0, 24),
  }));
}
if (failed) throw new Error('the carried tokenizer is not the source body');
console.log('the ESC tokenizer this product carries is byte-identical to the source module: reuse is measured');
