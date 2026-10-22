import fs from 'node:fs';

const current = `W276 \`/fork\` both registrations (2026-10-22), verified locally. The selector \`Ujt\` (chunk-sfn1dbxq.js 1663949) keys on \`gw()&&!Ne(IS_DEMO)\`: open selects \`njt\` (1638551, copy into a background session and keep working here), closed selects \`tjt\` (1638340, spawn a background agent with the full conversation) whose body \`m\` is chunk-0krtqd6x.js 15000. The gate \`Tkt\`/\`r\`/\`gw\` is chunk-wtdka69b.js 854/887/1096; the open body \`Ue\` is chunk-zsg1bb14.js 19311 and its row builders \`Ucn\`/\`rFt\`/\`_e\`/\`TMr\`/\`UKn\` are chunk-t721xmjm.js 46831/46881/46909/46946/47819. Open: \`Nothing to fork yet. Send a message first.\`, then \`session waiting for a prompt · <8 hex>\` for a bare fork and \`session running · <8 hex>\` with a prompt, over the host's existing \`startBackgroundSession\`. Closed: \`Usage: /fork \\<directive\\>\`, the coordinator row, \`Cannot fork before the first conversation turn\`, and \`${'⑂'} forked <name> (<last4>)\` over W275's \`Runtime.launchSubtask\`. \`settings.disableAgentView\` is new and rides the same three mapping points as the other display settings. Not ported: the fork briefing, the remote path, the relocation chips, the telemetry, the row reader, the launch-flag refusal. Unit 14/14, focused 72/72, compiled 17/17 at identity \`7222caea…\`; full suite 3176/3177 with the known CLI-effort failure. See [W276](ports/W276-fork.md). Local only.

`;
const status = `2026-10-22 W276 \`/fork\` both registrations, verified. Selector \`Ujt\` (chunk-sfn1dbxq.js 1663949), open registration \`njt\` 1638551, closed \`tjt\` 1638340 with body \`m\` (chunk-0krtqd6x.js 15000), gate \`Tkt\`/\`r\`/\`gw\` (chunk-wtdka69b.js 854/887/1096), open body \`Ue\` (chunk-zsg1bb14.js 19311), row builders \`UKn\`/\`TMr\`/\`Ucn\`/\`rFt\`/\`_e\` (chunk-t721xmjm.js 47819/46946/46831/46881/46909). An open fleet fork copies into a detached background session and keeps this one, reporting the waiting or running row with the short id; a closed one prints the directive usage, the first-turn and coordinator rows, and \`${'⑂'} forked <name> (<last4>)\`. New \`settings.disableAgentView\`. Unit 14/14, focused 72/72, compiled 17/17 at identity \`7222caea…\`; full suite 3176/3177 with the known CLI-effort failure. [Record](ports/W276-fork.md). Local only.
`;

for (const [file, entry, marker] of [['research/CURRENT.md', current, 'W276'],
  ['research/STATUS.md', status, '2026-10-22 W276']]) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.startsWith(marker)) throw new Error(`${file} already updated`);
  fs.writeFileSync(file, entry + text);
}
console.log('CURRENT and STATUS updated');
