import fs from 'node:fs';

const current = `W273 the effort slider gains ultracode (2026-10-22), verified locally. The recovered \`A\`/\`k\`/\`P\` (chunk-0q6c90q6.js 5896/5283/6037) add the \`ultracode [on|off]\` argument: on reports \`Ultracode on (this session only): dynamic workflows on every task. Effort stays <level>.\` and refuses without dynamic workflows, off always applies, and the flag rides the session, never the settings. \`yhn\`/\`Mjt\`/\`g\` grow the ultracode paragraph, hint and option list only when \`features.workflow\` is on. The slider gains \`tab\` (\`effortSlider:toggleUltracode\`, chunk-76jkr621.js 22794): \`TerminalPromptAdjust.toggle\` flips the row without closing, the answer carries \`toggled\`, and \`Ce\`'s accept joins the two messages with \` · \`. The recovered select page (\`Ut\`) has no local counterpart, so its sentinel row is not ported. Unit 17/17 + 4/4, focused 47/47, compiled 12/12 at identity \`6ab5dabb…\`; full suite 3151/3152 with the known CLI-effort failure. See [W273](ports/W273-ultracode.md). Local only.

`;
const status = `2026-10-22 W273 the effort slider gains ultracode, verified. \`A\`/\`k\`/\`P\` (chunk-0q6c90q6.js 5896/5283/6037) add \`ultracode [on|off]\`: on reports \`Ultracode on (this session only): dynamic workflows on every task. Effort stays <level>.\` and refuses without \`features.workflow\`, off always applies, and the flag stays on the session. The slider gains \`tab\` (chunk-76jkr621.js 22794) through the new \`TerminalPromptAdjust.toggle\`, and \`Ce\` joins both changes with \` · \`. The select page \`Ut\` is not ported. Unit 17/17 + 4/4, focused 47/47, compiled 12/12 at identity \`6ab5dabb…\`; full suite 3151/3152 with the CLI-effort failure at HEAD. [Record](ports/W273-ultracode.md). Local only.
`;

for (const [file, entry, marker] of [['research/CURRENT.md', current, 'W273'],
  ['research/STATUS.md', status, '2026-10-22 W273']]) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.startsWith(marker)) throw new Error(`${file} already updated`);
  fs.writeFileSync(file, entry + text);
}
console.log('CURRENT and STATUS updated');
