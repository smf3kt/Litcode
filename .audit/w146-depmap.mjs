// Maps the NFe unresolved names to their declaration sites in the extracted modules.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'extracted-v2/modules';
const names = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
const texts = files.map((f) => [f, readFileSync(join(dir, f), 'utf8')]);

for (const name of names) {
  const pattern = new RegExp(`\\b(?:function|var|const|let|class)\\s+${name}\\b`, 'g');
  const hits = [];
  for (const [file, text] of texts) {
    let match;
    while ((match = pattern.exec(text)) !== null && hits.length < 4) {
      hits.push(`${file}@${match.index}`);
    }
  }
  console.log(`${name}\t${hits.length ? hits.join(' ') : 'MISSING'}`);
}
