import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verifier = path.join(project, 'scripts/verify-extraction.mjs');
const sha = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
const writeJson = (file: string, value: unknown) => fs.writeFileSync(file, JSON.stringify(value) + '\n');

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bun-integrity-')));
  const binary = path.join(root, 'fixture.macho'), extraction = path.join(root, 'extraction');
  fs.mkdirSync(path.join(extraction, 'modules'), { recursive: true });
  const specs = [
    { path: 'binary.js', encoding: 0, raw: Buffer.from([0xff, 0, 0x80, 1]) },
    { path: 'latin.js', encoding: 1, raw: Buffer.from('function latin(){ /* cafeé */ return 1; }', 'latin1') },
    { path: 'utf16.js', encoding: 2, raw: Buffer.from('function unicode(){ /* 😀 */ return 2; }', 'utf16le') },
    { path: 'broken.js', encoding: 1, raw: Buffer.from('function {') },
  ];
  const chunks: Buffer[] = [], pointers: { offset: number; length: number }[][] = [];
  let length = 0;
  const append = (bytes: Buffer) => {
    const pointer = { offset: length, length: bytes.length };
    chunks.push(bytes); length += bytes.length; return pointer;
  };
  for (const spec of specs) pointers.push([
    append(Buffer.from(`/$bunfs/root/${spec.path}\0`)), append(spec.raw),
    append(Buffer.from('{}')), append(Buffer.from([1, 2, 3])), append(Buffer.from([4])),
    append(Buffer.from(`/$bunfs/root/${spec.path}\0`)),
  ]);
  const tableOffset = length, table = Buffer.alloc(specs.length * 52);
  for (let i = 0; i < specs.length; i++) {
    pointers[i]!.forEach((pointer, field) => {
      table.writeUInt32LE(pointer.offset, i * 52 + field * 8);
      table.writeUInt32LE(pointer.length, i * 52 + field * 8 + 4);
    });
    table.set([specs[i]!.encoding, 1, 2, 3], i * 52 + 48);
  }
  append(table);
  const data = Buffer.concat(chunks), tail = Buffer.alloc(32), magic = Buffer.from('\n---- Bun! ----\n');
  tail.writeBigUInt64LE(BigInt(data.length), 0);
  tail.writeUInt32LE(tableOffset, 8); tail.writeUInt32LE(table.length, 12);
  tail.writeUInt32LE(1, 16); tail.writeUInt32LE(data.length, 20); tail.writeUInt32LE(8191, 28);
  const sectionOffset = 256, base = sectionOffset + 8;
  const sectionSize = 8 + data.length + tail.length + magic.length;
  const bytes = Buffer.alloc(sectionOffset + sectionSize);
  bytes.writeUInt32LE(0xfeedfacf, 0); bytes.writeUInt32LE(0x100000c, 4);
  bytes.writeUInt32LE(2, 12); bytes.writeUInt32LE(1, 16); bytes.writeUInt32LE(152, 20);
  bytes.writeUInt32LE(0x19, 32); bytes.writeUInt32LE(152, 36); bytes.write('__BUN', 40);
  bytes.writeBigUInt64LE(BigInt(sectionOffset), 72); bytes.writeBigUInt64LE(BigInt(sectionSize), 80);
  bytes.writeUInt32LE(1, 96); bytes.write('__bun', 104); bytes.write('__BUN', 120);
  bytes.writeBigUInt64LE(BigInt(sectionSize), 144); bytes.writeUInt32LE(sectionOffset, 152);
  bytes.writeBigUInt64LE(BigInt(sectionSize - 8), sectionOffset);
  data.copy(bytes, base); tail.copy(bytes, base + data.length); magic.copy(bytes, base + data.length + 32);
  fs.writeFileSync(binary, bytes);
  const modules = specs.map((spec, id) => {
    const decoded = spec.encoding === 0 ? spec.raw : Buffer.from(spec.raw.toString(spec.encoding === 1 ? 'latin1' : 'utf16le'));
    fs.writeFileSync(path.join(extraction, 'modules', spec.path), decoded);
    return { id, path: spec.path, originalName: `/$bunfs/root/${spec.path}`,
      contentFileOffset: base + pointers[id]![1]!.offset, contentBytes: spec.raw.length,
      rawSha256: sha(spec.raw), decodedSha256: sha(decoded), encoding: spec.encoding,
      loader: 1, format: 2, side: 3, sourcemapBytes: 2, bytecodeBytes: 3, moduleInfoBytes: 1,
      bytecodeOrigin: `/$bunfs/root/${spec.path}` };
  });
  const manifest = { schema: 'BunModuleExtraction.v1', input: binary, sha256: sha(bytes),
    segment: { offset: sectionOffset, size: sectionSize }, base, offsetsFileOffset: base + data.length,
    byteCount: data.length, flags: 8191, recordWidth: 52, entry: 1, moduleCount: 4, sourceMaps: 4, modules };
  const manifestFile = path.join(extraction, 'manifest.json');
  writeJson(manifestFile, manifest);
  const indexFile = path.join(root, 'index.json');
  const parsed = modules.slice(1, 3).map((record) => {
    const decoded = fs.readFileSync(path.join(extraction, 'modules', record.path));
    return { path: record.path, sha256: record.decodedSha256, encoding: record.encoding,
      contentFileOffset: record.contentFileOffset, contentBytes: record.contentBytes, bytes: decoded.length,
      functions: [{ start: 0, end: decoded.toString('utf8').length, coordinates: 'utf16',
        range: 'left-closed/end-exclusive', bytes: decoded.length }] };
  });
  const provenance = (record: typeof modules[number]) => ({ sha256: record.decodedSha256,
    encoding: record.encoding, contentFileOffset: record.contentFileOffset, contentBytes: record.contentBytes });
  const index = { schema: 'StaticModuleIndex.v3', artifactSha256: manifest.sha256,
    manifestSha256: sha(fs.readFileSync(manifestFile)),
    generator: { sha256: sha(fs.readFileSync(path.join(project, 'scripts/index-modules.mjs'))) },
    generation: { extractor: { sha256: sha(fs.readFileSync(path.join(project, 'scripts/extract-bun.mjs'))) },
      preflight: { verifiedModules: 4 } },
    coordinates: 'UTF-16 source indices; end is exclusive; bytes counts UTF-8 text', parsed: 2, modules: parsed,
    skipped: [{ path: 'binary.js', reason: 'binary-encoding', loader: 1,
      rawSha256: modules[0]!.rawSha256, ...provenance(modules[0]!) }],
    failures: [{ path: 'broken.js', error: 'Synthetic parse failure observation', ...provenance(modules[3]!) }] };
  writeJson(indexFile, index);
  const run = (extra: string[] = []) => spawnSync(process.execPath, [verifier, binary, extraction, ...extra],
    { cwd: project, encoding: 'utf8', timeout: 10_000 });
  const saveBinary = () => { fs.writeFileSync(binary, bytes); manifest.sha256 = sha(bytes); writeJson(manifestFile, manifest); };
  return { root, binary, extraction, manifest, manifestFile, modules, bytes, base, tableOffset, pointers,
    index, indexFile, run, saveBinary, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('independent CLI verifies binary, latin1 and UTF16LE with output identity and finite index coverage', () => {
  const f = fixture();
  try {
    const output = path.join(f.root, 'verification.json');
    const run = f.run([f.indexFile, '--output', output]);
    assert.equal(run.status, 0, run.stderr + run.stdout);
    const result = JSON.parse(run.stdout);
    assert.equal(result.status, 'verified');
    assert.equal(result.rawValidatedModules, 4); assert.equal(result.diskValidatedModules, 4);
    assert.deepEqual(result.encodings, [{ encoding: 0, modules: 1 }, { encoding: 1, modules: 2 }, { encoding: 2, modules: 1 }]);
    assert.equal(result.artifactSha256, sha(f.bytes));
    assert.equal(result.manifestSha256, sha(fs.readFileSync(f.manifestFile)));
    assert.equal(result.verifierSha256, sha(fs.readFileSync(verifier)));
    assert.equal(result.indexSha256, sha(fs.readFileSync(f.indexFile)));
    assert.equal(result.index.parseFailures.length, 1); assert.equal(result.errors.length, 0);
    assert.equal(result.index.omissions.binaryModules, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), result);
    const again = f.run(['--output', output]);
    assert.equal(again.status, 1); assert.match(again.stderr, /EEXIST/);
    const inside = path.join(f.extraction, 'new.json');
    const escapingOutput = f.run(['--output', inside]);
    assert.equal(escapingOutput.status, 1); assert.match(escapingOutput.stderr, /outside extraction/);
    assert.equal(fs.existsSync(inside), false);
  } finally { f.cleanup(); }
});

test('CLI rejects source/disk/manifest tampering, malformed pointers and escaping or duplicate paths', () => {
  const cases: [string, (f: ReturnType<typeof fixture>) => void, RegExp][] = [
    ['source', f => { f.bytes[f.modules[1]!.contentFileOffset] ^= 1; fs.writeFileSync(f.binary, f.bytes); }, /artifact digest/],
    ['raw with updated artifact', f => { f.bytes[f.modules[1]!.contentFileOffset] ^= 1; f.saveBinary(); }, /rawSha256/],
    ['disk', f => fs.appendFileSync(path.join(f.extraction, 'modules/latin.js'), 'x'), /disk bytes/],
    ['manifest', f => { f.manifest.flags++; writeJson(f.manifestFile, f.manifest); }, /flags/],
    ['metadata', f => { f.bytes[f.base + f.tableOffset + 49] = 3; f.saveBinary(); }, /loader/],
    ['count', f => { f.bytes.writeUInt32LE(0, f.manifest.offsetsFileOffset + 12); f.saveBinary(); }, /width\/count/],
    ['entry', f => { f.bytes.writeUInt32LE(9, f.manifest.offsetsFileOffset + 16); f.saveBinary(); }, /entry record/],
    ['pointer', f => { f.bytes.writeUInt32LE(0xffffffff, f.base + f.tableOffset + 16); f.saveBinary(); }, /pointer outside/],
    ['graph pointer', f => { f.bytes.writeUInt32LE(0xffffffff, f.manifest.offsetsFileOffset + 20); f.saveBinary(); }, /pointer outside/],
    ['encoding', f => { f.bytes[f.base + f.tableOffset + 48] = 3; f.saveBinary(); }, /Unsupported encoding/],
    ['odd utf16', f => { f.bytes.writeUInt32LE(f.modules[2]!.contentBytes - 1, f.base + f.tableOffset + 2 * 52 + 12); f.saveBinary(); }, /Odd UTF-16/],
    ['traversal', f => { Buffer.from('/$bunfs/root/../raw.js\0').copy(f.bytes, f.base + f.pointers[0]![0]!.offset); f.saveBinary(); }, /Unsafe module path/],
    ['duplicate', f => { f.bytes.writeUInt32LE(f.pointers[0]![0]!.offset, f.base + f.tableOffset + 52);
      f.bytes.writeUInt32LE(f.pointers[0]![0]!.length, f.base + f.tableOffset + 56); f.saveBinary(); }, /Duplicate embedded/],
    ['symlink', f => { const file = path.join(f.extraction, 'modules/latin.js'), outside = path.join(f.root, 'outside.js');
      fs.copyFileSync(file, outside); fs.unlinkSync(file); fs.symlinkSync(outside, file); }, /Symlink/],
    ['extra disk file', f => fs.writeFileSync(path.join(f.extraction, 'modules/extra.js'), 'unrecorded'), /Unrecorded extraction/],
  ];
  for (const [label, mutate, error] of cases) {
    const f = fixture();
    try {
      mutate(f); const run = f.run();
      assert.equal(run.status, 1, label + run.stderr + run.stdout);
      const result = JSON.parse(run.stdout);
      assert.equal(result.status, 'failed', label); assert.match(result.errors.join(' '), error, label);
    } finally { f.cleanup(); }
  }
});

test('v3 index rejects stale digests, malformed coordinates and incomplete coverage; v2 is explicit failure', () => {
  const cases: [string, (index: ReturnType<typeof fixture>['index']) => void, RegExp][] = [
    ['schema', index => { index.schema = 'StaticModuleIndex.v2'; }, /v3 required/],
    ['artifact', index => { index.artifactSha256 = '0'.repeat(64); }, /artifact digest/],
    ['manifest', index => { index.manifestSha256 = '0'.repeat(64); }, /manifest digest/],
    ['module', index => { index.modules[0]!.sha256 = '0'.repeat(64); }, /decoded digest/],
    ['raw coordinates', index => { index.modules[0]!.contentFileOffset++; }, /contentFileOffset/],
    ['function coordinates', index => { index.modules[0]!.functions[0]!.coordinates = 'utf8'; }, /function coordinates/],
    ['range convention', index => { index.modules[0]!.functions[0]!.range = 'inclusive'; }, /range convention/],
    ['skipped provenance', index => { index.skipped[0]!.contentFileOffset++; }, /contentFileOffset/],
    ['failure provenance', index => { index.failures[0]!.sha256 = '0'.repeat(64); }, /decoded digest/],
    ['function range', index => { index.modules[0]!.functions[0]!.end = 999; }, /function range/],
    ['function byte count', index => { index.modules[1]!.functions[0]!.bytes--; }, /function byte count/],
    ['coverage', index => { index.modules.pop(); index.parsed--; }, /Missing index coverage/],
    ['duplicate coverage', index => { index.modules.push(index.modules[0]!); index.parsed++; }, /Duplicate index coverage/],
    ['preflight', index => { index.generation.preflight.verifiedModules--; }, /preflight coverage/],
  ];
  for (const [label, mutate, error] of cases) {
    const f = fixture();
    try {
      mutate(f.index); writeJson(f.indexFile, f.index);
      const run = f.run([f.indexFile]);
      assert.equal(run.status, 1, label + run.stderr + run.stdout);
      const result = JSON.parse(run.stdout);
      assert.equal(result.diskValidatedModules, 4, label); assert.match(result.errors.join(' '), error, label);
    } finally { f.cleanup(); }
  }
});
