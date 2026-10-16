import fs from 'node:fs';

const text = fs.readFileSync('extracted-v2/modules/chunk-sfn1dbxq.js', 'utf8');
const re = /import\{([^}]*)\}from"([^"]+)"/g;
const wanted = ['TDe', 'YPn', 'Ooe', 'Z$n', '$2e', 'has', 'He', 'aP'];
const sources = new Map();
let match;
while ((match = re.exec(text))) {
  const names = match[1].split(',').map((n) => n.trim());
  for (const name of wanted) if (names.includes(name)) sources.set(name, match[2]);
}
for (const name of wanted) console.log(`${name} <- ${sources.get(name) ?? 'NOT IMPORTED'}`);
console.log('import statements:', [...text.matchAll(re)].length);
