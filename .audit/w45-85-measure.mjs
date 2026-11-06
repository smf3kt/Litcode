import fs from 'node:fs';
const s = fs.readFileSync('extracted-v2/modules/chunk-kjfwbh4w.js', 'utf8');
const start = (needle) => s.indexOf(needle);
function endOf(from) {
  let i = from, depth = 0, quote = null;
  for (; i < s.length; i += 1) {
    const c = s[i];
    if (quote) {
      if (c === '\\') { i += 1; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) return i + 1; }
  }
  return -1;
}
const varEnd = (from) => { const i = s.indexOf(';', from); return i + 1; };
const marks = {
  XD: start('class XD extends'),
  wo: start('function wo(o)'),
  To: start('function To({host'),
  Ro: start('function Ro(o)'),
  bo: start('var bo=Object.freeze'),
  Co: start('var Co=Object.freeze'),
  So: start('function So(o)'),
  Io: start('function Io(o)'),
};
for (const [name, at] of Object.entries(marks)) {
  const end = name === 'bo' || name === 'Co' ? varEnd(at) : endOf(at);
  console.log(name, `[${at},${end})`, end - at, JSON.stringify(s.slice(end, end + 30)));
}
const amb = fs.readFileSync('extracted-v2/modules/chunk-am9mebpw.js', 'utf8');
const ey = amb.indexOf('function Ey(');
let depth = 0, quote = null, e = ey;
for (; e < amb.length; e += 1) { const c = amb[e]; if (quote) { if (c === '\\') { e += 1; continue; } if (c === quote) quote = null; continue; } if (c === '"' || c === "'" || c === '`') { quote = c; continue; } if (c === '{') depth += 1; else if (c === '}') { depth -= 1; if (depth === 0) { e += 1; break; } } }
console.log('Ey', `[${ey},${e})`, e - ey, JSON.stringify(amb.slice(e, e + 20)));
