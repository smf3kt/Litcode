import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const check = (condition, message) => { if (!condition) throw new Error(message); };
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const same = (actual, expected, label) => check(actual === expected, `${label} mismatch`);
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function safeName(name) {
  check(typeof name === 'string' && name.length > 0 && !/[\\\0:]/.test(name)
    && !path.isAbsolute(name) && !/^[A-Za-z]:/.test(name)
    && name.split('/').every((part) => part && part !== '.' && part !== '..'), 'Unsafe module path');
  return name;
}

function readMember(root, relative) {
  let target = root;
  const parts = relative.split('/');
  for (let i = 0; i < parts.length; i++) {
    target = path.join(target, parts[i]);
    const stat = fs.lstatSync(target);
    check(!stat.isSymbolicLink(), `Symlink in extraction: ${relative}`);
    check(i === parts.length - 1 ? stat.isFile() : stat.isDirectory(), `Invalid extraction file: ${relative}`);
  }
  const real = fs.realpathSync(target);
  check(real.startsWith(root + path.sep), `Extraction path escape: ${relative}`);
  const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    check(fs.fstatSync(fd).isFile(), `Invalid extraction file: ${relative}`);
    const bytes = fs.readFileSync(fd);
    same(fs.realpathSync(target), real, `Extraction path ${relative}`);
    return bytes;
  } finally { fs.closeSync(fd); }
}

// Observe bytes independently of the extractor and recovered application code.
function observeBinary(bytes) {
  const range = (offset, length, end = bytes.length) => {
    check(integer(offset) && integer(length) && offset <= end && length <= end - offset,
      `Invalid binary range ${offset}:${length}`);
    return bytes.subarray(offset, offset + length);
  };
  const u32 = (offset) => { range(offset, 4); return bytes.readUInt32LE(offset); };
  const u64 = (offset) => {
    range(offset, 8);
    const value = bytes.readBigUInt64LE(offset);
    check(value <= BigInt(Number.MAX_SAFE_INTEGER), `Oversized integer at ${offset}`);
    return Number(value);
  };
  const fixedName = (offset) => range(offset, 16).toString('ascii').split('\0')[0];
  range(0, 32);
  same(u32(0), 0xfeedfacf, 'Mach-O 64-bit little-endian magic');
  const commands = u32(16), commandBytes = u32(20);
  range(32, commandBytes);
  check(commands > 0 && commands <= Math.floor(commandBytes / 8), 'Invalid load command count');
  const commandEnd = 32 + commandBytes;
  let cursor = 32, segment;
  for (let i = 0; i < commands; i++) {
    range(cursor, 8, commandEnd);
    const kind = u32(cursor), width = u32(cursor + 4);
    check(width >= 8 && width % 8 === 0, 'Invalid load command size');
    range(cursor, width, commandEnd);
    if (kind === 0x19) {
      check(width >= 72, 'Truncated segment command');
      const sections = u32(cursor + 64);
      same(width, 72 + sections * 80, 'Segment section count');
      const fileOffset = u64(cursor + 40), fileBytes = u64(cursor + 48);
      range(fileOffset, fileBytes);
      for (let j = 0; j < sections; j++) {
        const section = cursor + 72 + j * 80;
        if (fixedName(cursor + 8) === '__BUN' && fixedName(section) === '__bun') {
          same(fixedName(section + 16), '__BUN', 'Bun section segment name');
          check(!segment, 'Duplicate Bun section');
          same(u32(section + 64) & 0xff, 0, 'Bun section type');
          segment = { offset: u32(section + 48), size: u64(section + 40) };
          check(segment.offset >= fileOffset && segment.size <= fileOffset + fileBytes - segment.offset,
            'Bun section exceeds segment');
          check(segment.offset >= commandEnd, 'Bun section overlaps Mach-O commands');
          range(segment.offset, segment.size);
        }
      }
    }
    cursor += width;
  }
  same(cursor, commandEnd, 'Mach-O command area');
  check(segment && segment.size >= 56, 'Missing or truncated Bun section');
  const trailer = Buffer.from('\n---- Bun! ----\n');
  const trailerOffset = segment.offset + segment.size - trailer.length;
  check(range(trailerOffset, trailer.length).equals(trailer), 'Invalid Bun trailer');
  const offsetsFileOffset = trailerOffset - 32;
  const byteCount = u64(offsetsFileOffset), base = segment.offset + 8;
  same(base + byteCount, offsetsFileOffset, 'Bun data coordinates');
  same(u64(segment.offset), segment.size - 8, 'Bun section byte prefix');
  const tableOffset = u32(offsetsFileOffset + 8), tableBytes = u32(offsetsFileOffset + 12);
  const recordWidth = 52, entry = u32(offsetsFileOffset + 16), flags = u32(offsetsFileOffset + 28);
  check(tableBytes > 0 && tableBytes % recordWidth === 0, 'Invalid Bun module table width/count');
  const count = tableBytes / recordWidth;
  check(entry < count, 'Invalid Bun entry record');
  const relative = (offset, length) => {
    check(integer(offset) && integer(length) && offset <= byteCount && length <= byteCount - offset,
      `Bun pointer outside data ${offset}:${length}`);
    return range(base + offset, length);
  };
  relative(tableOffset, tableBytes);
  const pointer = (at) => ({ offset: u32(at), length: u32(at + 4) });
  const readString = (p) => {
    const value = utf8.decode(relative(p.offset, p.length)).replace(/\0$/, '');
    check(!value.includes('\0'), 'Embedded NUL in Bun name/origin');
    return value;
  };
  const graphPointer = pointer(offsetsFileOffset + 20);
  const graphBytes = relative(graphPointer.offset, graphPointer.length);
  const modules = [], seen = new Set();
  for (let id = 0; id < count; id++) {
    const at = base + tableOffset + id * recordWidth;
    const pointers = Array.from({ length: 6 }, (_, n) => pointer(at + n * 8));
    const payloads = pointers.map((p) => relative(p.offset, p.length));
    const originalName = readString(pointers[0]);
    check(originalName.startsWith('/$bunfs/root/'), 'Unexpected embedded module root');
    const name = safeName(originalName.slice('/$bunfs/root/'.length));
    const alias = name.normalize('NFC').toLowerCase();
    check(!seen.has(alias), `Duplicate embedded path: ${name}`);
    seen.add(alias);
    const raw = payloads[1], encoding = bytes[at + 48];
    check(encoding <= 2, `Unsupported encoding ${encoding}: ${name}`);
    check(encoding !== 2 || raw.length % 2 === 0, `Odd UTF-16LE byte count: ${name}`);
    const decoded = encoding === 0 ? raw : Buffer.from(raw.toString(encoding === 1 ? 'latin1' : 'utf16le'), 'utf8');
    modules.push({ id, path: name, originalName, contentFileOffset: base + pointers[1].offset,
      contentBytes: raw.length, rawSha256: digest(raw), decodedSha256: digest(decoded),
      encoding, loader: bytes[at + 49], format: bytes[at + 50], side: bytes[at + 51],
      sourcemapBytes: payloads[2].length, bytecodeBytes: payloads[3].length, moduleInfoBytes: payloads[4].length,
      bytecodeOrigin: readString(pointers[5]), decoded,
      pointerEvidence: pointers.map((p, n) => ({ ...p, sha256: digest(payloads[n]) })) });
  }
  return { segment, base, offsetsFileOffset, byteCount, flags, recordWidth, entry,
    tableOffset, tableBytes, graphPointer: { ...graphPointer, sha256: digest(graphBytes) }, modules };
}

function verifyIndex(indexBytes, manifestSha256, artifactSha256, records, scriptsDirectory) {
  const index = JSON.parse(indexBytes.toString('utf8'));
  same(index.schema, 'StaticModuleIndex.v3', 'Index schema (v3 required)');
  same(index.artifactSha256, artifactSha256, 'Index artifact digest');
  same(index.manifestSha256, manifestSha256, 'Index manifest digest');
  check(hash(index.generator?.sha256), 'Missing index generator digest');
  same(index.generator.sha256, digest(fs.readFileSync(path.join(scriptsDirectory, 'index-modules.mjs'))), 'Index generator digest');
  check(hash(index.generation?.extractor?.sha256), 'Missing index extractor digest');
  same(index.generation.extractor.sha256, digest(fs.readFileSync(path.join(scriptsDirectory, 'extract-bun.mjs'))), 'Index extractor digest');
  same(index.generation?.preflight?.verifiedModules, records.length, 'Index preflight coverage');
  check(typeof index.coordinates === 'string' && /UTF-16/.test(index.coordinates)
    && /exclusive/.test(index.coordinates) && /UTF-8/.test(index.coordinates), 'Missing index coordinate contract');
  check(Array.isArray(index.modules) && Array.isArray(index.skipped) && Array.isArray(index.failures), 'Missing index coverage arrays');
  same(index.parsed, index.modules.length, 'Index parsed count');
  const byPath = new Map(records.map((record) => [record.path, record]));
  const eligible = (record) => /\.(?:m?js|cjs)$/.test(record.path) || record.path === 'cli';
  const covered = new Set();
  const select = (item) => {
    safeName(item.path);
    const record = byPath.get(item.path);
    check(record && eligible(record), `Unknown/non-source index member: ${item.path}`);
    check(!covered.has(item.path), `Duplicate index coverage: ${item.path}`);
    covered.add(item.path);
    return record;
  };
  let functions = 0;
  for (const item of index.modules) {
    const record = select(item);
    check(record.encoding !== 0, `Binary module marked parsed: ${item.path}`);
    for (const field of ['encoding', 'contentFileOffset', 'contentBytes']) same(item[field], record[field], `Index ${item.path} ${field}`);
    same(item.sha256, record.decodedSha256, `Index ${item.path} decoded digest`);
    same(item.bytes, record.decoded.length, `Index ${item.path} decoded byte count`);
    const source = utf8.decode(record.decoded);
    check(Array.isArray(item.functions), `Missing function ranges: ${item.path}`);
    for (const fn of item.functions) {
      same(fn.coordinates, 'utf16', `Index ${item.path} function coordinates`);
      same(fn.range, 'left-closed/end-exclusive', `Index ${item.path} function range convention`);
      check(integer(fn.start) && integer(fn.end) && fn.start < fn.end && fn.end <= source.length, `Invalid function range: ${item.path}`);
      const text = Buffer.from(source.slice(fn.start, fn.end), 'utf8');
      same(fn.bytes, text.length, `Index ${item.path} function byte count`);
      if (Object.hasOwn(fn, 'sha256')) same(fn.sha256, digest(text), `Index ${item.path} function digest`);
      functions++;
    }
  }
  for (const item of index.skipped) {
    const record = select(item);
    same(record.encoding, 0, `Index skipped ${item.path} encoding`);
    for (const field of ['encoding', 'contentFileOffset', 'contentBytes']) same(item[field], record[field], `Index skipped ${item.path} ${field}`);
    same(item.sha256, record.decodedSha256, `Index skipped ${item.path} decoded digest`);
    same(item.reason, 'binary-encoding', `Index skipped ${item.path} reason`);
    same(item.loader, record.loader, `Index skipped ${item.path} loader`);
    same(item.rawSha256, record.rawSha256, `Index skipped ${item.path} raw digest`);
  }
  for (const item of index.failures) {
    const record = select(item);
    check(record.encoding !== 0 && typeof item.error === 'string' && item.error.length > 0, `Invalid parse failure metadata: ${item.path}`);
    for (const field of ['encoding', 'contentFileOffset', 'contentBytes']) same(item[field], record[field], `Index failure ${item.path} ${field}`);
    same(item.sha256, record.decodedSha256, `Index failure ${item.path} decoded digest`);
  }
  const missing = records.filter((record) => eligible(record) && !covered.has(record.path));
  check(missing.length === 0, `Missing index coverage: ${missing[0]?.path}`);
  return { status: 'verified-recorded-facts', sha256: digest(indexBytes), generatorSha256: index.generator.sha256,
    extractorSha256: index.generation.extractor.sha256, verifiedPreflightModules: records.length,
    parsedModules: index.modules.length, skippedModules: index.skipped.length, functions,
    parseFailures: index.failures, omissions: { nonSourceModules: records.filter((record) => !eligible(record)).length,
      binaryModules: index.skipped.length, unaccountedSourceModules: 0 },
    limitations: ['Function ranges and byte counts are checked against verified decoded text; AST semantics, marker selection, imports and recorded parse failures are not independently reparsed.'] };
}

export function verifyExtraction(binary, extraction, indexFile) {
  const script = fileURLToPath(import.meta.url), scriptsDirectory = path.dirname(script);
  const result = { schema: 'BunModuleVerification.v1', status: 'failed', binary: path.resolve(binary),
    extraction: path.resolve(extraction), verifierSha256: digest(fs.readFileSync(script)),
    artifactSha256: null, manifestSha256: null, indexSha256: null,
    rawValidatedModules: 0, decodedValidatedModules: 0, diskValidatedModules: 0, errors: [],
    limitations: ['This verification covers one 64-bit little-endian Mach-O Bun record layout of width 52.',
      'Metadata pointers and bytes are measured; bytecode semantics and application runtime behavior remain unverified.'] };
  try {
    const bytes = fs.readFileSync(result.binary);
    result.artifactSha256 = digest(bytes);
    const rootStat = fs.lstatSync(result.extraction);
    check(rootStat.isDirectory() && !rootStat.isSymbolicLink(), 'Invalid extraction root');
    const root = fs.realpathSync(result.extraction);
    const manifestBytes = readMember(root, 'manifest.json');
    result.manifestSha256 = digest(manifestBytes);
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    same(manifest.schema, 'BunModuleExtraction.v1', 'Extraction schema');
    same(manifest.sha256, result.artifactSha256, 'Original artifact digest');
    const observed = observeBinary(bytes);
    for (const field of ['offset', 'size']) same(manifest.segment?.[field], observed.segment[field], `Manifest segment ${field}`);
    for (const field of ['base', 'offsetsFileOffset', 'byteCount', 'flags', 'recordWidth', 'entry']) same(manifest[field], observed[field], `Manifest ${field}`);
    for (const field of ['tableOffset', 'tableBytes']) if (Object.hasOwn(manifest, field)) same(manifest[field], observed[field], `Manifest ${field}`);
    check(Array.isArray(manifest.modules), 'Missing manifest modules');
    same(manifest.moduleCount, observed.modules.length, 'Manifest module count');
    same(manifest.modules.length, observed.modules.length, 'Manifest record count');
    same(manifest.sourceMaps, observed.modules.filter((record) => record.sourcemapBytes > 0).length, 'Manifest source map count');
    const fields = ['id', 'path', 'originalName', 'contentFileOffset', 'contentBytes', 'rawSha256', 'decodedSha256',
      'encoding', 'loader', 'format', 'side', 'sourcemapBytes', 'bytecodeBytes', 'moduleInfoBytes', 'bytecodeOrigin'];
    const metadata = crypto.createHash('sha256');
    for (let i = 0; i < observed.modules.length; i++) {
      const record = observed.modules[i], claimed = manifest.modules[i];
      check(claimed && typeof claimed === 'object', `Invalid manifest record ${i}`);
      safeName(claimed.path);
      for (const field of fields) same(claimed[field], record[field], `Manifest record ${i} ${field}`);
      result.rawValidatedModules++;
      result.decodedValidatedModules++;
      const disk = readMember(root, `modules/${record.path}`);
      check(disk.equals(record.decoded), `Decoded disk bytes mismatch: ${record.path}`);
      same(digest(disk), claimed.decodedSha256, `Decoded disk digest ${record.path}`);
      result.diskValidatedModules++;
      metadata.update(JSON.stringify({ id: i, path: record.path, pointers: record.pointerEvidence }) + '\n');
    }
    result.moduleCount = observed.modules.length;
    const expectedPaths = new Set(observed.modules.map((record) => record.path));
    const walk = (directory, prefix = '') => {
      for (const member of fs.readdirSync(directory, { withFileTypes: true })) {
        const relative = prefix + member.name;
        check(!member.isSymbolicLink(), `Symlink in extraction: ${relative}`);
        if (member.isDirectory()) walk(path.join(directory, member.name), relative + '/');
        else check(member.isFile() && expectedPaths.has(relative), `Unrecorded extraction file: ${relative}`);
      }
    };
    const modulesRoot = path.join(root, 'modules');
    check(fs.lstatSync(modulesRoot).isDirectory() && !fs.lstatSync(modulesRoot).isSymbolicLink(), 'Invalid modules root');
    walk(modulesRoot);
    result.manifestVerifiedFields = fields;
    result.graph = { segment: observed.segment, base: observed.base, offsetsFileOffset: observed.offsetsFileOffset,
      byteCount: observed.byteCount, flags: observed.flags, entry: observed.entry, recordWidth: observed.recordWidth,
      tableOffset: observed.tableOffset, tableBytes: observed.tableBytes, graphPointer: observed.graphPointer,
      modulePointersSha256: metadata.digest('hex') };
    result.encodings = [0, 1, 2].map((encoding) => ({ encoding, modules: observed.modules.filter((record) => record.encoding === encoding).length }));
    result.index = { status: 'not-requested' };
    if (indexFile) {
      const indexBytes = fs.readFileSync(path.resolve(indexFile));
      result.indexSha256 = digest(indexBytes);
      result.index = verifyIndex(indexBytes, result.manifestSha256, result.artifactSha256, observed.modules, scriptsDirectory);
    }
    result.status = 'verified';
  } catch (error) { result.errors.push(error instanceof Error ? error.message : String(error)); }
  return result;
}

function main(args) {
  const positional = [], options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output') {
      check(!options.output && args[i + 1], 'Expected one --output NEW_JSON');
      options.output = args[++i];
    } else { check(!args[i].startsWith('--'), `Unknown option ${args[i]}`); positional.push(args[i]); }
  }
  check(positional.length >= 2 && positional.length <= 3, 'Usage: node scripts/verify-extraction.mjs BINARY EXTRACTION [INDEX_JSON] [--output NEW_JSON]');
  const result = verifyExtraction(...positional);
  const json = JSON.stringify(result, null, 2) + '\n';
  if (options.output) {
    const root = fs.realpathSync(path.resolve(positional[1]));
    const target = path.resolve(options.output);
    const canonical = path.join(fs.realpathSync(path.dirname(target)), path.basename(target));
    check(canonical !== root && !canonical.startsWith(root + path.sep), 'Output must be outside extraction');
    check(canonical !== fs.realpathSync(path.resolve(positional[0]))
      && (!positional[2] || canonical !== fs.realpathSync(path.resolve(positional[2]))), 'Output overlaps an input');
    fs.writeFileSync(canonical, json, { flag: 'wx' });
  }
  process.stdout.write(json);
  if (result.status !== 'verified') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
}
