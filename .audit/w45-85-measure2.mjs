import fs from 'node:fs';
function measure(file, needle) {
  const s = fs.readFileSync(file, 'utf8');
  const at = s.indexOf(needle);
  const bodyAt = s.indexOf('){', at) + 1;
  let i = bodyAt, depth = 0, quote = null;
  for (; i < s.length; i += 1) {
    const c = s[i];
    if (quote) { if (c === '\\') { i += 1; continue; } if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) { i += 1; break; } }
  }
  console.log(file, needle, `[${at},${i})`, i - at, JSON.stringify(s.slice(i, i + 30)));
}
measure('extracted-v2/modules/chunk-kjfwbh4w.js', 'function To({host');
measure('extracted-v2/modules/chunk-am9mebpw.js', 'function Ey(');
