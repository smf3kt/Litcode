import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/extract-bun.mjs BINARY NEW_OUTPUT_DIRECTORY');
const bytes = fs.readFileSync(path.resolve(input));
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const u32 = (p) => bytes.readUInt32LE(p);
const u64 = (p) => {
  const value = bytes.readBigUInt64LE(p);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`Oversized integer at ${p}`);
  return Number(value);
};
const cstr = (p, n) => bytes.subarray(p, p + n).toString('ascii').split('\0')[0];
if (u32(0) !== 0xfeedfacf) throw new Error('Expected a little-endian 64-bit Mach-O');
let segment;
let at = 32;
for (let i = 0; i < u32(16); i++) {
  const cmd = u32(at), size = u32(at + 4);
  if (size < 8 || at + size > bytes.length) throw new Error('Invalid Mach-O load command');
  if (cmd === 0x19 && cstr(at + 8, 16) === '__BUN') {
    for (let j = 0; j < u32(at + 64); j++) {
      const section = at + 72 + j * 80;
      if (cstr(section, 16) === '__bun') segment = { offset: u32(section + 48), size: u64(section + 40) };
    }
  }
  at += size;
}
if (!segment || segment.offset + segment.size > bytes.length) throw new Error('Missing or invalid __BUN/__bun');
const magic = Buffer.from('\n---- Bun! ----\n');
const trailer = segment.offset + segment.size - magic.length;
if (!bytes.subarray(trailer, trailer + magic.length).equals(magic)) throw new Error('Unexpected Bun trailer');
const offsets = trailer - 32;
const byteCount = u64(offsets);
const base = offsets - byteCount;
if (base !== segment.offset + 8) throw new Error('Unrecognized Bun data base');
const tableOffset = u32(offsets + 8), tableBytes = u32(offsets + 12);
const entry = u32(offsets + 16), flags = u32(offsets + 28);
const stride = 52;
if (tableBytes % stride) throw new Error('Unrecognized module record width');
const region = (offset, length) => {
  if (offset + length > byteCount) throw new Error(`Out-of-range Bun pointer ${offset}:${length}`);
  return bytes.subarray(base + offset, base + offset + length);
};
const pointer = (p) => ({ offset: u32(p), length: u32(p + 4) });
const table = region(tableOffset, tableBytes);
const records = [];
const seen = new Set();
for (let i = 0; i < table.length / stride; i++) {
  const p = base + tableOffset + i * stride;
  const name = pointer(p), content = pointer(p + 8), sourcemap = pointer(p + 16);
  const bytecode = pointer(p + 24), moduleInfo = pointer(p + 32), origin = pointer(p + 40);
  const originalName = region(name.offset, name.length).toString('utf8').replace(/\0$/, '');
  const relative = originalName.replace(/^\/\$bunfs\/root\//, '');
  if (relative === originalName || !relative || relative.split(/[\\/]/).some((s) => s === '..' || s === '.' || !s) || relative.includes('\0')) {
    throw new Error(`Unsafe embedded path: ${JSON.stringify(originalName)}`);
  }
  if (seen.has(relative)) throw new Error(`Duplicate embedded path: ${relative}`);
  seen.add(relative);
  const raw = region(content.offset, content.length);
  const encoding = bytes[p + 48];
  if (encoding > 2) throw new Error(`Unknown encoding ${encoding}`);
  // Encoding comes from the graph; binary assets may have JavaScript suffixes.
  if (encoding === 2 && raw.length % 2) throw new Error(`Odd UTF-16 length: ${relative}`);
  const decoded = encoding === 0 ? raw : Buffer.from(raw.toString(encoding === 2 ? 'utf16le' : 'latin1'), 'utf8');
  records.push({ id: i, path: relative, originalName, contentFileOffset: base + content.offset,
    contentBytes: content.length, rawSha256: sha256(raw), decodedSha256: sha256(decoded),
    encoding, loader: bytes[p + 49], format: bytes[p + 50], side: bytes[p + 51],
    sourcemapBytes: sourcemap.length, bytecodeBytes: bytecode.length, moduleInfoBytes: moduleInfo.length,
    bytecodeOrigin: region(origin.offset, origin.length).toString('utf8').replace(/\0$/, ''), decoded });
  for (const value of [sourcemap, bytecode, moduleInfo]) region(value.offset, value.length);
}
const root = path.resolve(output);
// Validate every pointer and path before materializing target bytes.
fs.mkdirSync(root, { recursive: false });
for (const record of records) {
  const target = path.join(root, 'modules', record.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, record.decoded, { flag: 'wx' });
  delete record.decoded;
}
const manifest = { schema: 'BunModuleExtraction.v1', input: path.resolve(input), sha256: sha256(bytes),
  segment, base, offsetsFileOffset: offsets, byteCount, flags, recordWidth: stride, entry,
  moduleCount: records.length, sourceMaps: records.filter((r) => r.sourcemapBytes > 0).length,
  limitations: ['Record layout is validated for this sample, not all Bun versions.',
    'Source text is recovered; original source names, types and runtime behavior remain unverified.',
    'Bytecode and module metadata are validated and indexed, not decoded.'], modules: records };
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output: root, sha256: manifest.sha256, modules: records.length,
  javascript: records.filter((r) => /\.(?:m?js|cjs)$/.test(r.path)).length,
  sourceMaps: manifest.sourceMaps, entry: records[entry]?.path }));
