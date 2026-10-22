import fs from 'node:fs';

const current = `W275 \`/subtask <task>\` (2026-10-22), verified locally. The registration \`ojt\` (chunk-sfn1dbxq.js 1638723) and body \`m\` (chunk-57v1bkyr.js 15000) give the composer a fork command: an empty argument prints \`Usage: /subtask \\<task\\>\`, otherwise \`Zjt\` (chunk-940nvk4p.js 1241) spawns an async child seeded with \`e.messages\` and the parent system prompt, running the parent's exact tools, and the row is \`${'⑂'} forked <name> (<last4>)\` with \`OR\` from chunk-3cynezh1.js 65963. Names come from \`_\` 4214 over \`allocateName\`; the coordinator gate is \`xa\` (chunk-vj0cwgx.js 758). The host adds \`Runtime.launchSubtask\` and a per-owner registry seam so the spawn works with or without the messaging tool set; the result returns on the existing child-agent event stream. Not ported: the launch telemetry, \`endedByModel\`, the worktree hook, the coordinator surface. Unit 9/9, focused 112/112, compiled 12/12 at identity \`5b5e9e2e…\`; full suite 3162/3163 with the known CLI-effort failure. See [W275](ports/W275-subtask.md). Local only.

`;
const status = `2026-10-22 W275 \`/subtask <task>\`, verified. Registration \`ojt\` (chunk-sfn1dbxq.js 1638723), body \`m\` (chunk-57v1bkyr.js 15000), fork spawn \`Zjt\` (chunk-940nvk4p.js 1241), name hint \`_\` 4214, coordinator gate \`xa\` (chunk-vj0cwgx.js 758), glyph \`OR\` (chunk-3cynezh1.js 65963). A bare \`/subtask\` prints the usage row, a spawn before any turn prints the first-turn row, and after a turn the row reads \`${'⑂'} forked <name> (<last4>)\` while the child runs asynchronously with the whole conversation and the parent's tools. Unit 9/9, focused 112/112, compiled 12/12 at identity \`5b5e9e2e…\`; full suite 3162/3163 with the known CLI-effort failure. [Record](ports/W275-subtask.md). Local only.
`;

for (const [file, entry, marker] of [['research/CURRENT.md', current, 'W275'],
  ['research/STATUS.md', status, '2026-10-22 W275']]) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.startsWith(marker)) throw new Error(`${file} already updated`);
  fs.writeFileSync(file, entry + text);
}
console.log('CURRENT and STATUS updated');
