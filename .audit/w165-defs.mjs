import fs from 'node:fs';
const targets = {
  'chunk-3dnyxzpb.js': ['sS', 'Na'],
  'chunk-g6j4g5k0.js': ['_e'],
  'chunk-fz2251t0.js': ['Se'],
  'chunk-0qkpwgr4.js': ['z'],
  'chunk-nh8hd3rr.js': ['pt'],
  'chunk-vew7ssxx.js': ['Mr'],
  'chunk-6j27z6m4.js': ['Ffe'],
  'chunk-qr9z1wer.js': ['Ht'],
  'chunk-ax7r0qj7.js': ['I'],
  'chunk-0wtqg4zf.js': ['Tl', 'rx'],
  'chunk-a8pz28bf.js': ['Ib'],
  'chunk-x90vmw14.js': ['fo'],
  'chunk-24k7d6mw.js': ['Uwe', 'pBe', 'pee'],
};
for (const [file, names] of Object.entries(targets)) {
  const text = fs.readFileSync(`extracted-v2/modules/${file}`, 'utf8');
  for (const name of names) {
    const patterns = [`function ${name}(`, `var ${name}=`, `let ${name}=`, `const ${name}=`];
    let at = -1, kind = '';
    for (const pattern of patterns) { const found = text.indexOf(pattern); if (found >= 0 && (at < 0 || found < at)) { at = found; kind = pattern; } }
    let preview = '';
    if (at >= 0) preview = text.slice(at, at + 180).replace(/\n/g, ' ');
    console.log(`${file} ${name} @${at} (${kind || 'missing'}) ${preview}`);
  }
}
