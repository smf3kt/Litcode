// Declaration finder for the W45-29 names: prints the shortest declaration site of each requested
// minified name across the extracted chunks, so each binding can cite the body that defines it.
import fs from 'node:fs';
import path from 'node:path';

const dir = 'extracted-v2/modules';
const names = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
const texts = files.map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]);
for (const name of names) {
  const patterns = [
    new RegExp(`function ${name}\\(`, 'g'),
    new RegExp(`(?:var|let|const) ${name}=`, 'g'),
    new RegExp(`(?:^|[;,])\\s*${name}=(?:\\(|function|x=>|e=>|r=>)`, 'g'),
  ];
  const hits = [];
  for (const [file, text] of texts) {
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        hits.push({ file, at: match.index, text: text.slice(match.index, match.index + 220).replace(/\s+/g, ' ') });
      }
    }
  }
  console.log(`\n=== ${name} (${hits.length} sites)`);
  for (const hit of hits.slice(0, 3)) console.log(`  ${hit.file}@${hit.at}: ${hit.text}`);
}
