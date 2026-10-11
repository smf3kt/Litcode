import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const [rootArg, outputArg] = process.argv.slice(2);
if (!rootArg || !outputArg) throw new Error('Usage: node scripts/index-modules.mjs EXTRACTION OUTPUT_JSON');
const root = path.resolve(rootArg);
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function requireDirectory(file) {
  if (!fs.lstatSync(file).isDirectory()) throw new Error('Expected a directory without symlinks');
}
function readRegularFile(file) {
  if (!fs.lstatSync(file).isFile()) throw new Error('Expected a regular file without symlinks');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error('Expected a regular file');
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}
requireDirectory(root);
const manifestBytes = readRegularFile(path.join(root, 'manifest.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
if (!manifest || manifest.schema !== 'BunModuleExtraction.v1' || !digest(manifest.sha256)
  || !integer(manifest.moduleCount) || !Array.isArray(manifest.modules)
  || manifest.moduleCount !== manifest.modules.length || !integer(manifest.base)
  || !integer(manifest.byteCount) || !integer(manifest.base + manifest.byteCount)) {
  throw new Error('Invalid extraction manifest schema, identity, or module count');
}
const dataEnd = manifest.base + manifest.byteCount;
const segment = manifest.segment;
if (!segment || !integer(segment.offset) || !integer(segment.size)
  || !integer(segment.offset + segment.size) || !integer(manifest.offsetsFileOffset)
  || !integer(manifest.flags) || manifest.flags > 0xffffffff || manifest.recordWidth !== 52
  || !integer(manifest.entry) || manifest.entry >= manifest.moduleCount
  || !integer(manifest.sourceMaps) || manifest.sourceMaps > manifest.moduleCount
  || manifest.base !== segment.offset + 8 || manifest.offsetsFileOffset !== dataEnd
  || dataEnd + 32 + Buffer.byteLength('\n---- Bun! ----\n') !== segment.offset + segment.size) {
  throw new Error('Invalid extraction manifest segment or data range');
}
const seen = new Set();
// Admit every record before touching its content, including skipped binary and asset records.
for (const [index, record] of manifest.modules.entries()) {
  if (!record || typeof record.path !== 'string' || !record.path || record.path.includes('\0')
    || record.path.includes('\\') || record.path.includes(':') || path.posix.isAbsolute(record.path)
    || record.path.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Unsafe module path');
  }
  if (seen.has(record.path)) throw new Error(`Duplicate module path: ${record.path}`);
  seen.add(record.path);
  if (record.id !== index || ![0, 1, 2].includes(record.encoding)
    || !integer(record.contentFileOffset) || !integer(record.contentBytes)
    || !integer(record.contentFileOffset + record.contentBytes)
    || record.contentFileOffset < manifest.base
    || record.contentFileOffset + record.contentBytes > manifest.base + manifest.byteCount
    || record.encoding === 2 && record.contentBytes % 2
    || !digest(record.rawSha256) || !digest(record.decodedSha256)
    || ['loader', 'format', 'side'].some((key) => !integer(record[key]) || record[key] > 255)
    || ['sourcemapBytes', 'bytecodeBytes', 'moduleInfoBytes'].some((key) => !integer(record[key]))) {
    throw new Error(`Invalid module record: ${record.path}`);
  }
}
const modulesRoot = path.join(root, 'modules');
requireDirectory(modulesRoot);
const verified = [];
for (const record of manifest.modules) {
  let file = modulesRoot;
  const parts = record.path.split('/');
  for (const part of parts.slice(0, -1)) {
    file = path.join(file, part);
    requireDirectory(file);
  }
  const bytes = readRegularFile(path.join(file, parts.at(-1)));
  if (sha256(bytes) !== record.decodedSha256) throw new Error(`Module digest mismatch: ${record.path}`);
  verified.push({ record, bytes });
}
const generator = { sha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))) };
const generation = {
  // This identifies the current extractor script, not its historical execution.
  extractor: { sha256: sha256(fs.readFileSync(fileURLToPath(new URL('./extract-bun.mjs', import.meta.url)))) },
  preflight: { verifiedModules: verified.length },
};
const provenance = (record) => ({ sha256: record.decodedSha256, encoding: record.encoding,
  contentFileOffset: record.contentFileOffset, contentBytes: record.contentBytes });
const markers = ['queryLoop invariant broken', 'executePreToolHooks called', 'microcompact_boundary',
  'autoCompactWindow', 'compact_boundary', 'createStreamingToolExecutor', 'isSubagentLoop',
  'appendFileSync', 'sessionId', 'cache_control'];
const modules = [], failures = [], skipped = [];
for (const { record, bytes } of verified) {
  if (!/\.(?:m?js|cjs)$/.test(record.path) && record.path !== 'cli') continue;
  if (record.encoding === 0) {
    skipped.push({ path: record.path, reason: 'binary-encoding', loader: record.loader,
      rawSha256: record.rawSha256, ...provenance(record) });
    continue;
  }
  const source = bytes.toString('utf8');
  let ast;
  try { ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true }); }
  catch (error) { failures.push({ path: record.path, error: error.message, ...provenance(record) }); continue; }
  const imports = ast.body.filter((n) => n.type === 'ImportDeclaration' || n.type.startsWith('Export') && n.source)
    .map((n) => n.source.value);
  const functions = [];
  function walk(node, parentName = null) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const item of node) walk(item, parentName); return; }
    const name = node.type === 'VariableDeclarator' ? node.id.name : parentName;
    if (/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type)) {
      const text = source.slice(node.start, node.end);
      const hits = markers.filter((m) => text.includes(m));
      if (hits.length) functions.push({ name: node.id?.name ?? parentName ?? '<anonymous>', start: node.start,
        end: node.end, coordinates: 'utf16', range: 'left-closed/end-exclusive',
        bytes: Buffer.byteLength(text), async: node.async, generator: node.generator, markers: hits });
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === 'start' || key === 'end' || key === 'loc') continue;
      if (child && typeof child === 'object') walk(child, name);
    }
  }
  walk(ast);
  modules.push({ path: record.path, ...provenance(record), bytes: Buffer.byteLength(source), imports,
    markers: markers.filter((m) => source.includes(m)), functions });
}
const result = { schema: 'StaticModuleIndex.v3', artifactSha256: manifest.sha256,
  manifestSha256: sha256(manifestBytes), generator, generation,
  coordinates: 'UTF-16 source indices; ranges are left-closed/end-exclusive; bytes counts UTF-8 text',
  parsed: modules.length, skipped, failures, modules };
fs.writeFileSync(path.resolve(outputArg), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ parsed: modules.length, skipped, failures,
  focused: modules.filter((m) => m.markers.includes('queryLoop invariant broken') || m.markers.includes('executePreToolHooks called'))
    .map((m) => ({ path: m.path, bytes: m.bytes, functions: m.functions.filter((f) => f.markers.includes('queryLoop invariant broken') || f.markers.includes('executePreToolHooks called')) })) }));
