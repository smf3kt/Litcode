import fs from 'node:fs';
import crypto from 'node:crypto';
const root = 'extracted-v2/modules/';
const records = [];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const take = (module, start, end, note) => {
  const bytes = fs.readFileSync(root + module), text = bytes.toString('utf8').slice(start, end);
  records.push({ module, sha256: hash(bytes), range: [start, end], units: end - start, bodySha256: hash(text), note });
  return `// ${module} [${start},${end}) UTF-16.\n${text}`;
};
const header = '// @ts-nocheck\n// Exact source regions with local owner and message adapters. See ./diff-selection-source-blocks.json.\n';
const owner = take('chunk-24k7d6mw.js', 1486702, 1487552, 'A4 ideSelection ownership, dismissal, consumption and conditional restoration');
const identity = take('chunk-24k7d6mw.js', 1488693, 1488828, 'Hlt selection identity');
const sanitize = take('chunk-gyf58rwf.js', 8843, 9022, 'Md/cj/su path sanitation');
const truncate = take('chunk-sfn1dbxq.js', 4454587, 4454667, 'TDn/EDn attachment text bound');
const wrapper = take('chunk-sfn1dbxq.js', 4438375, 4438416, 'Xl attachment data wrapper');
const message = take('chunk-sfn1dbxq.js', 4460985, 4461259, 'selected_lines_in_diff attachment message');
const text = `${header}import { ne } from './plugin-chain-source.js';
export class SourceDiffSelection {
  #a = null;
  #c;
  #n = { ideSelection: undefined };
  constructor(changed) { this.changed = changed; }
  getSnapshot = () => this.#n;
  #i(value) { this.#n = value; this.changed(); }
${owner}
}
${identity}
var hr=/[\\x00-\\x1f\\x7f-\\x9f\\u2028\\u2029]/g;
${sanitize}
${truncate}
var NO='<system-reminder>',_1e='</system-reminder>';
${wrapper}
const xe = value => value;
const yl = values => values.map(value => Xl(value.content));
const messages = {
${message}
};
export function diffSelectionMessage(selection) {
  return messages.selected_lines_in_diff({lineCount: selection.lineCount, content: selection.text, filePath: selection.filePath})[0];
}
export { Hlt };
`;
fs.writeFileSync('src/diff-selection-source.ts', text);
fs.writeFileSync('src/diff-selection-source-blocks.json', JSON.stringify({ schema: 'SourceRegions.v1', coordinates: 'zero-based UTF-16 [start,end)', blocks: records }, null, 2) + '\n');
console.log(JSON.stringify({ blocks: records.length, units: records.reduce((n, r) => n + r.units, 0) }));
