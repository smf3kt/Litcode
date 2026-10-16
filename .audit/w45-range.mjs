// Print a UTF-16 range of one extracted module: `node .audit/w45-range.mjs MODULE START END`.
import fs from 'node:fs';
const [file, start, end] = process.argv.slice(2);
const text = fs.readFileSync('extracted-v2/modules/' + file, 'utf8');
process.stdout.write(text.slice(Number(start), Number(end)) + '\n');
