import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const project = fileURLToPath(new URL('../', import.meta.url));
const script = path.join(project, 'scripts/index-modules.mjs');
const digest = (bytes: string | Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
const source = 'const prefix = "\u{1f600}"; export async function focus() { return "queryLoop invariant broken"; }\n';

function fixture() {
  const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'module-index-fixture-')));
  const root = path.join(scratch, 'extraction');
  fs.mkdirSync(path.join(root, 'modules/nested'), { recursive: true });
  const entries = [
    { path: 'nested/focus.js', raw: Buffer.from(source, 'utf16le'), bytes: Buffer.from(source), encoding: 2 },
    { path: 'opaque.js', raw: Buffer.from([0xff, 0, 0x80]), bytes: Buffer.from([0xff, 0, 0x80]), encoding: 0 },
    { path: 'asset.dat', raw: Buffer.from([1, 2, 3]), bytes: Buffer.from([1, 2, 3]), encoding: 0 },
    { path: 'broken.js', raw: Buffer.from('export function ('), bytes: Buffer.from('export function ('), encoding: 1 },
    { path: 'notes.txt', raw: Buffer.from('notes'), bytes: Buffer.from('notes'), encoding: 1 },
  ];
  let offset = 8;
  const modules = entries.map((entry, id) => {
    fs.writeFileSync(path.join(root, 'modules', entry.path), entry.bytes);
    const record = { id, path: entry.path, originalName: `/$bunfs/root/${entry.path}`,
      contentFileOffset: offset, contentBytes: entry.raw.length,
      rawSha256: digest(entry.raw), decodedSha256: digest(entry.bytes), encoding: entry.encoding,
      loader: 1, format: 1, side: 0, sourcemapBytes: 0, bytecodeBytes: 0, moduleInfoBytes: 0,
      bytecodeOrigin: '' };
    offset += entry.raw.length;
    return record;
  });
  const manifest = { schema: 'BunModuleExtraction.v1', input: '/private-fixture/sample',
    sha256: digest(Buffer.concat(entries.map(entry => entry.raw))), base: 8, byteCount: offset - 8,
    segment: { offset: 0, size: offset + 32 + Buffer.byteLength('\n---- Bun! ----\n') },
    offsetsFileOffset: offset, flags: 0, recordWidth: 52, entry: 0, sourceMaps: 0,
    moduleCount: modules.length, modules };
  const manifestFile = path.join(root, 'manifest.json');
  const save = () => fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  save();
  const output = path.join(scratch, 'index.json');
  const run = (target = output) => spawnSync(process.execPath, [script, root, target], {
    cwd: project, encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, INDEX_PRIVATE_SECRET: 'index-private-value' },
  });
  return { root, scratch, output, manifest, manifestFile, save, run,
    cleanup: () => fs.rmSync(scratch, { recursive: true, force: true }) };
}

test('index CLI binds manifest, generators and UTF-16 ranges deterministically', () => {
  const f = fixture();
  try {
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const text = fs.readFileSync(f.output, 'utf8');
    const index = JSON.parse(text);
    assert.equal(index.schema, 'StaticModuleIndex.v3');
    assert.equal(index.artifactSha256, f.manifest.sha256);
    assert.equal(index.manifestSha256, digest(fs.readFileSync(f.manifestFile)));
    assert.deepEqual(index.generator, { sha256: digest(fs.readFileSync(script)) });
    assert.deepEqual(index.generation, {
      extractor: { sha256: digest(fs.readFileSync(path.join(project, 'scripts/extract-bun.mjs'))) },
      preflight: { verifiedModules: 5 },
    });
    assert.equal(index.parsed, 1);
    assert.equal(index.skipped[0].path, 'opaque.js');
    assert.equal(index.skipped[0].reason, 'binary-encoding');
    assert.equal(index.failures[0].path, 'broken.js');
    const module = index.modules[0];
    assert.equal(module.sha256, digest(source));
    assert.equal(module.encoding, 2);
    assert.equal(module.contentFileOffset, 8);
    assert.equal(module.contentBytes, Buffer.byteLength(source, 'utf16le'));
    const fn = module.functions[0];
    assert.equal(fn.coordinates, 'utf16');
    assert.equal(fn.range, 'left-closed/end-exclusive');
    assert.equal(fn.start, source.indexOf('async function'));
    assert.equal(fn.end, source.indexOf('}') + 1);
    assert.equal(fn.bytes, Buffer.byteLength(source.slice(fn.start, fn.end)));
    assert.equal(index.extraction, undefined);
    for (const privateValue of [f.root, f.scratch, f.manifest.input, 'index-private-value']) {
      assert.equal(text.includes(privateValue), false);
    }
    const secondOutput = path.join(f.scratch, 'second.json');
    const second = f.run(secondOutput);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(fs.readFileSync(secondOutput, 'utf8'), text);
    const duplicate = f.run();
    assert.ok(duplicate.status !== 0);
    assert.equal(fs.readFileSync(f.output, 'utf8'), text);
  } finally { f.cleanup(); }
});

test('index CLI rejects tampering in parsed, skipped, failed and non-JS records before output', () => {
  for (const relative of ['nested/focus.js', 'opaque.js', 'asset.dat', 'broken.js', 'notes.txt']) {
    const f = fixture();
    try {
      fs.appendFileSync(path.join(f.root, 'modules', relative), 'tampered');
      const result = f.run();
      assert.ok(result.status !== 0, relative);
      assert.match(result.stderr, /Module digest mismatch/);
      assert.equal(result.stdout, '');
      assert.equal(fs.existsSync(f.output), false);
    } finally { f.cleanup(); }
  }
});

test('index CLI rejects unsafe paths, symlinks and malformed all-record metadata', () => {
  const cases: [string, (f: ReturnType<typeof fixture>) => void][] = [
    ...['../escape.js', '/absolute.js', 'nested/../focus.js', 'nested\\focus.js',
      'nested//focus.js', 'nested/./focus.js', 'nul\0.js', 'C:/focus.js'].map(relative =>
      [relative, (f: ReturnType<typeof fixture>) => { f.manifest.modules[4]!.path = relative; }] as
      [string, (f: ReturnType<typeof fixture>) => void]),
    ['duplicate', f => { f.manifest.modules[4]!.path = f.manifest.modules[0]!.path; }],
    ['schema', f => { f.manifest.schema = 'BunModuleExtraction.v0'; }],
    ['count', f => { f.manifest.moduleCount++; }],
    ['artifact digest', f => { f.manifest.sha256 = 'x'.repeat(64); }],
    ['raw digest', f => { f.manifest.modules[4]!.rawSha256 = 'x'.repeat(64); }],
    ['decoded digest', f => { f.manifest.modules[4]!.decodedSha256 = '00'; }],
    ['encoding', f => { f.manifest.modules[4]!.encoding = 3; }],
    ['fractional offset', f => { f.manifest.modules[4]!.contentFileOffset = 8.5; }],
    ['negative length', f => { f.manifest.modules[4]!.contentBytes = -1; }],
    ['unsafe range sum', f => { f.manifest.modules[4]!.contentFileOffset = Number.MAX_SAFE_INTEGER; }],
    ['fractional base', f => { f.manifest.base = 8.5; }],
    ['negative byte count', f => { f.manifest.byteCount = -1; }],
    ['segment base mismatch', f => { f.manifest.segment.offset = 1; }],
    ['segment end mismatch', f => { f.manifest.segment.size++; }],
    ['offset table mismatch', f => { f.manifest.offsetsFileOffset++; }],
    ['past data end', f => { f.manifest.modules[4]!.contentFileOffset = f.manifest.base + f.manifest.byteCount; }],
    ['outside data', f => { f.manifest.modules[4]!.contentFileOffset = 0; }],
    ['odd UTF-16', f => { f.manifest.modules[0]!.contentBytes--; }],
    ['record identity', f => { f.manifest.modules[4]!.id = 0; }],
    ['loader byte', f => { f.manifest.modules[4]!.loader = 256; }],
    ['metadata length', f => { f.manifest.modules[4]!.moduleInfoBytes = 1.5; }],
    ['module symlink', f => {
      const file = path.join(f.root, 'modules/notes.txt');
      const outside = path.join(f.scratch, 'outside.txt');
      fs.renameSync(file, outside);
      fs.symlinkSync(outside, file);
    }],
    ['directory symlink', f => {
      const nested = path.join(f.root, 'modules/nested');
      const outside = path.join(f.scratch, 'outside');
      fs.renameSync(nested, outside);
      fs.symlinkSync(outside, nested);
    }],
    ['missing non-JS file', f => { fs.unlinkSync(path.join(f.root, 'modules/notes.txt')); }],
  ];
  for (const [name, mutate] of cases) {
    const f = fixture();
    try {
      mutate(f);
      f.save();
      const result = f.run();
      assert.ok(result.status !== 0, name);
      assert.equal(result.stdout, '', name);
      assert.equal(fs.existsSync(f.output), false, name);
    } finally { f.cleanup(); }
  }
});
