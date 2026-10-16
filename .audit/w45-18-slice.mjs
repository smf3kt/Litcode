import fs from 'node:fs';

const root = 'extracted-v2/modules/';
for (const spec of process.argv.slice(2)) {
  const [file, range] = spec.split(':');
  const [start, end] = range.split('-').map(Number);
  const text = fs.readFileSync(root + file, 'utf8');
  const body = text.slice(start, end);
  console.log(`${spec} ${end - start} units`);
  console.log(body);
  console.log('');
}
