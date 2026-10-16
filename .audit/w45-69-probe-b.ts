// W45-69 probe b: the table's dispatch and the seam wrappers, measured through the seam.
import { LEAF_TABLE, leafHeight, leafText, flattenLeafText, duplicateLeafKey, emittedLines, textWidthWithin, diffHunks, diffReadFor, sanitizeLeafText, expandLeadingTabs, countOccurrences, hunkGutterWidth, LEAF_LINE_CAP, LEAF_WRAP_WIDTH, SOURCE_BODIES } from '../src/plugin-chain-leaf-walkers.js';

for (const type of Object.keys(LEAF_TABLE)) {
  const answer = LEAF_TABLE[type]({ type, props: {} } as never);
  console.log('table', type, JSON.stringify(answer));
}
console.log('caps', LEAF_WRAP_WIDTH, LEAF_LINE_CAP);
console.log('leafText svg', JSON.stringify(leafText({ type: 'Svg', props: { alt: 'A' } })));
console.log('leafHeight raster', leafHeight({ type: 'Raster', props: { rows: 7 } }));
console.log('flatten', JSON.stringify(flattenLeafText(['a', { children: ['b'] }])));
console.log('dup', duplicateLeafKey({ type: 'Input', props: { key: 'k' } }, new Set()), duplicateLeafKey({ type: 'Input', props: { key: 'k' } }, new Set(['Input\u0000k'])));
console.log('emitted', emittedLines('a\nb\nc', 40));
console.log('width', textWidthWithin('ab\tcd\nef', 2));
console.log('hunks', diffHunks('@@ -1,1 +1,1 @@\n a').kind);
console.log('for', diffReadFor('src', 'diff')?.kind, diffReadFor('src', 'source'));
console.log('sanitize', JSON.stringify(sanitizeLeafText('a‮b')));
console.log('tabs', JSON.stringify(expandLeadingTabs('\tb')));
console.log('count', countOccurrences('a\nb\nc', '\n'), hunkGutterWidth({ oldStart: 1, oldLines: 3, newStart: 1, newLines: 4, lines: [] }));
console.log('bodies', Object.keys(SOURCE_BODIES).length);
