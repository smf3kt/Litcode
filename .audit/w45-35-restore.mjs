// Recover src/plugin-chain-registry.ts, which W45-35 overwrote by writing a new seam to the same
// path. The path was untracked, so git has no copy; the transcript holds the original Write and every
// Edit that followed it, in order. Replaying them rebuilds the file exactly, and every step is
// asserted, so a mismatch stops instead of writing a half-recovered file.
//   node .audit/w45-35-restore.mjs          (writes the file)
//   node .audit/w45-35-restore.mjs --check  (prints the result without writing)
import fs from 'node:fs';

const transcript = '/Users/mant1ssa/.claude/projects/-Users-mant1ssa-Projects-cc-reverse/befe7767-b3f9-43e9-9143-1ec7774e291b.jsonl';
const target = 'src/plugin-chain-registry.ts';
const lines = fs.readFileSync(transcript, 'utf8').split('\n').filter((line) => line !== '');

const calls = [];
lines.forEach((line) => {
  if (!line.includes(target)) return;
  let entry;
  try { entry = JSON.parse(line); } catch { return; }
  const content = entry.message?.content;
  if (!Array.isArray(content)) return;
  for (const part of content) {
    if (part.type !== 'tool_use') continue;
    if (!String(part.input?.file_path ?? '').endsWith(target)) continue;
    if (part.name !== 'Write' && part.name !== 'Edit') continue;
    calls.push({ name: part.name, input: part.input });
  }
});
// The last two calls are this ticket's own (the clobbering Write and the edit that followed it).
const original = calls.slice(0, -2);
if (original[0]?.name !== 'Write') throw new Error('the transcript does not start with a Write');
let text = original[0].input.content;
for (const [index, call] of original.slice(1).entries()) {
  if (call.name !== 'Edit') throw new Error(`step ${index + 1} is a ${call.name}`);
  const { old_string: oldText, new_string: newText, replace_all: all } = call.input;
  const first = text.indexOf(oldText);
  if (first < 0) throw new Error(`step ${index + 1}: the old text is absent`);
  if (all !== true && text.indexOf(oldText, first + 1) >= 0) throw new Error(`step ${index + 1}: the old text is not unique`);
  text = all === true ? text.split(oldText).join(newText) : text.slice(0, first) + newText + text.slice(first + oldText.length);
}
console.log(`replayed ${original.length} calls; ${text.length} units, ${text.split('\n').length} lines`);
console.log(text.slice(0, 400));
if (process.argv.includes('--check')) process.exit(0);
fs.writeFileSync(target, text);
console.log('written', target);
