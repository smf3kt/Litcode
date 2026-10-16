import fs from 'node:fs';

const root = 'extracted-v2/modules/';
const text = (file) => fs.readFileSync(root + file, 'utf8');

// Prints [start,end) for a declaration whose body the brace matcher can walk, and reports the
// declaration's extent so the comment citations in the ported code use measured offsets.
function extent(file, marker, from = 0) {
  const source = text(file);
  const at = source.indexOf(marker, from);
  if (at < 0) return console.log(`${file} ${marker} NOT FOUND`);
  let depth = 0;
  let i = source.indexOf('{', at);
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' || ch === "'") { const quote = ch; i++; while (i < source.length && source[i] !== quote) i += source[i] === '\\' ? 2 : 1; continue; }
    if (ch === '`') { i++; let nest = 0; while (i < source.length) { if (source[i] === '\\') { i += 2; continue; } if (source[i] === '$' && source[i + 1] === '{') { nest++; i += 2; continue; } if (source[i] === '}' && nest > 0) { nest--; i++; continue; } if (source[i] === '`' && nest === 0) break; i++; } continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  console.log(`${file} ${marker} [${at},${i}) ${i - at} units`);
}

extent('chunk-sfn1dbxq.js', 'async function*I9r(');
extent('chunk-sfn1dbxq.js', 'async function*dze(');
extent('chunk-sfn1dbxq.js', 'function _X(');
extent('chunk-sfn1dbxq.js', 'function mze(');
extent('chunk-sfn1dbxq.js', 'async function sxr(');
extent('chunk-sfn1dbxq.js', 'async function _or(');
extent('chunk-sfn1dbxq.js', 'async function kpn(');
extent('chunk-r2vtj1kh.js', 'p(()=>k().and(u({hook_event_name:C("PermissionDenied")');
extent('chunk-r2vtj1kh.js', 'p(()=>k().and(u({hook_event_name:C("PermissionRequest")');
extent('chunk-n3ykh62m.js', 'u({hookEventName:C("PermissionDenied"),retry:');
extent('chunk-n3ykh62m.js', 'u({hookEventName:C("PermissionRequest"),decision:');
