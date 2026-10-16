// The cleanup for the W45-38/W45-39 documentation artifact: those two record writers built their
// template literals through a shell heredoc, so the `\`` escape reached the output and every inline
// code span in their paragraphs carries a literal backslash. This removes exactly that backslash, in
// the four documents that have it, and refuses to write unless the only difference is those removals.
import fs from 'node:fs';

const files = process.argv.slice(2);
const targets = files.length ? files : [
  'research/CURRENT.md', 'research/STATUS.md', 'research/ports/W45-chain-runner.md',
  '.audit/w45-runtime.todo.md',
];

/** True when `fixed` is `original` with a backslash deleted immediately before each backtick and
 *  nothing else: the transform's inverse, checked position by position rather than by inspection. */
const onlyEscapesRemoved = (original, fixed) => {
  let i = 0;
  let j = 0;
  let removed = 0;
  while (i < original.length) {
    if (j < fixed.length && original[i] === fixed[j]) { i += 1; j += 1; continue; }
    const escaped = original[i] === '\\' && original[i + 1] === '`' && fixed[j] === '`';
    if (!escaped) return { ok: false, at: i, original: original.slice(i, i + 20), fixed: fixed.slice(j, j + 20) };
    i += 1;
    removed += 1;
  }
  return { ok: j === fixed.length, removed };
};

const rows = [];
for (const path of targets) {
  const original = fs.readFileSync(path, 'utf8');
  const fixed = original.replace(/\\`/g, '`');
  const hits = (original.match(/\\`/g) ?? []).length;
  if (hits === 0) { rows.push({ path, hits, changed: false }); continue; }
  const check = onlyEscapesRemoved(original, fixed);
  if (!check.ok) throw new Error(`${path}: the rewrite is not escape-only (at ${check.at}: ${JSON.stringify(check.original)} -> ${JSON.stringify(check.fixed)})`);
  if (check.removed !== hits) throw new Error(`${path}: removed ${check.removed} of ${hits} escapes`);
  fs.writeFileSync(path, fixed);
  rows.push({ path, hits, changed: true, bytesRemoved: original.length - fixed.length });
}
console.log(JSON.stringify({ schema: 'W45DocSpanFix.v1', files: rows,
  changed: rows.filter((row) => row.changed).length,
  escapesRemoved: rows.reduce((sum, row) => sum + row.hits, 0) }, null, 1));
