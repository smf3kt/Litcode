import fs from 'node:fs';

const current = `W274 \`?\` opens the help panel (2026-10-22), verified locally. The recovered input handler's own branch (chunk-24k7d6mw.js 880989) turns \`?\` on an empty draft into the help panel before \`typeText\` runs; a non-empty draft still types it, and \`QE\` (815713) closes the panel on escape or backspace. \`LVe\`'s idle indicator (762242/765495/766656 through \`s2\` 789074) is \`? for shortcuts\`. The host had the panel from W219 and no key for it: \`app:toggleHelp\` now emits from the decoded insert action and the interactive loop routes it to the same \`browseHelp\` builder, while the footer row leads the local hints and drops below a 23-cell half-row. Not ported: the \`tengu_help_toggled\` event, the help store, the \`inputOwnsEscape\` handshake. Unit 82/82 + 2 new, focused 37/37, compiled 10/10 at identity \`14301c55…\`; full suite 3153/3154 with the known CLI-effort failure. See [W274](ports/W274-help-key.md). Local only.

`;
const status = `2026-10-22 W274 \`?\` opens the help panel, verified. The input handler's own branch (chunk-24k7d6mw.js 880989) turns \`?\` on an empty draft into the help panel before \`typeText\`; \`QE\` 815713 closes it, and \`LVe\` 766656 renders \`? for shortcuts\` as the idle indicator through \`s2\` 789074. \`app:toggleHelp\` carries the gesture to the existing W219 panel; the footer row is additive over the local hints and drops below a 23-cell half-row. Unit 82/82 with two new tests, focused 37/37, compiled 10/10 at identity \`14301c55…\`; full suite 3153/3154 with the known CLI-effort failure. [Record](ports/W274-help-key.md). Local only.
`;

for (const [file, entry, marker] of [['research/CURRENT.md', current, 'W274'],
  ['research/STATUS.md', status, '2026-10-22 W274']]) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.startsWith(marker)) throw new Error(`${file} already updated`);
  fs.writeFileSync(file, entry + text);
}
console.log('CURRENT and STATUS updated');
