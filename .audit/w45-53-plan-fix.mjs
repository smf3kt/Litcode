// Convert the settings-read plan's four needle blocks to the explicit ranges measured from the module:
// chunk-sfn1dbxq.js is a 60k-line chunk whose top-level map cannot be walked reliably, which is the
// same reason W45-51 took five of its blocks as ranges.
import fs from 'node:fs';

const path = 'research/ports/W45-settings-read-blocks.plan.json';
const plan = JSON.parse(fs.readFileSync(path, 'utf8'));
const ranges = { ZH: [492416, 492454], J9: [2328610, 2328746], hGo: [2328746, 2328835], yGo: [2328835, 2329021] };
for (const block of plan.blocks) {
  const match = block.needle.match(/^var (\w+)=|^function (\w+)\(/);
  const name = match[1] ?? match[2];
  delete block.needle;
  delete block.k;
  block.range = ranges[name];
  block.note += " — an explicit range, because this module's top-level map cannot be walked reliably (a 60k-line chunk)";
}
fs.writeFileSync(path, JSON.stringify(plan, null, 2) + '\n');
console.log(plan.blocks.map((block) => `${block.range.join('-')} ${block.units ?? ''}`).join('\n'));
