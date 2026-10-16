// The W45-38/W45-39 record writers emitted a literal backslash before every inline code span, because
// their template literals were built through a shell heredoc and the escape survived into the output.
// This scan counts the artifact per document, so the cleanup and its guard read the same numbers.
import fs from 'node:fs';

const docs = process.argv.slice(2);
const roots = docs.length ? docs : [
  'research/CURRENT.md', 'research/STATUS.md', 'research/coding-standard.md',
  'research/ports/W45-chain-runner.md', '.audit/w45-runtime.todo.md',
  '.audit/w45-runtime.tsv', ...fs.readdirSync('research/ports').filter((n) => n.endsWith('.json')).map((n) => `research/ports/${n}`),
];
const bad = /\\`/g;
const rows = [];
for (const path of roots) {
  if (!fs.existsSync(path)) continue;
  const text = fs.readFileSync(path, 'utf8');
  const lines = text.split('\n');
  const hits = [...text.matchAll(bad)].length;
  if (hits) rows.push({ path, hits, lines: lines.filter((line) => bad.test(line)).length });
}
console.log(JSON.stringify({ schema: 'W45DocSpanScan.v1', scanned: roots.length, files: rows,
  total: rows.reduce((sum, row) => sum + row.hits, 0) }, null, 1));
