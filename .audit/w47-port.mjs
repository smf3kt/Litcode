// Port the gaps whose exports exist in the recovered tree, and let the compiler judge each one.
//
//   node .audit/w47-port.mjs [--apply]
//
// Candidate order is by evidence: first the chunk that actually exports the names the import sites
// ask for, then the chunks that merely mention the module's feature token (a whole-module re-export,
// which is a stand-in). A fill is kept only when it removes errors that named this module, and the
// run fails closed: any fill that raises the total is reverted.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const HARNESS = '/Users/mant1ssa/Projects/cc-base-2188';
const RECOVERED = path.resolve('recovered');
const APPLY = process.argv.includes('--apply');
const LOG = (name) => `/tmp/w47-${name}.txt`;

const tsc = (name) => {
  let out = '';
  try {
    execFileSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], { cwd: HARNESS, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  } catch (e) { out = (e.stdout ?? '') + (e.stderr ?? ''); }
  fs.writeFileSync(LOG(name), out);
  return out;
};

const classify = (text) => {
  const lines = text.split('\n').filter((l) => /error TS\d+/.test(l));
  const counts = new Map();
  for (const l of lines) {
    const m = l.match(/^([^\s(].*?)\(\d+,\d+\): error TS\d+/);
    if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  return { lines, counts, total: lines.length };
};

const exportsOf = (chunk) => {
  const text = fs.readFileSync(path.join(RECOVERED, chunk), 'utf8');
  const names = new Set();
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  return names;
};

const classification = JSON.parse(fs.readFileSync('.audit/w47-gap-classification.json', 'utf8'));
const fills = JSON.parse(fs.readFileSync('.audit/w47-fills.json', 'utf8'));
const record = new Map(fills.results.map((r) => [r.relative, r]));

const items = [];
for (const gap of classification.rows) {
  const entry = record.get(gap.module);
  if (entry === undefined) continue;
  const target = path.join(HARNESS, gap.module);
  const wanted = (entry.names ?? []).filter((n) => n !== 'default');
  const named = wanted
    .map((n) => ({ name: n, chunks: entry.survivors?.find((s) => s.name === n)?.in ?? [] }))
    .filter((s) => s.chunks.length > 0);
  const byChunk = new Map();
  for (const s of named) for (const c of s.chunks) {
    if (!byChunk.has(c)) byChunk.set(c, []);
    byChunk.get(c).push(s.name);
  }
  const candidates = [...byChunk].sort((a, b) => b[1].length - a[1].length)
    .map(([chunk, names]) => ({ chunk, names, form: 'named' }))
    .concat((gap.chunks ?? []).filter((c) => fs.existsSync(path.join(RECOVERED, c))).map((chunk) => ({ chunk, names: [], form: 'star' })));
  if (candidates.length === 0) continue;
  items.push({
    module: gap.module, target, wanted, candidates,
    importers: entry.importersList ?? [],
    original: fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null,
  });
}

const baseline = classify(tsc('p0'));
// Count only the errors this module is responsible for: the cannot-find for its own specifier, and
// any error that names one of the exports the import sites ask for. Counting every error in the
// importer files hid the fix behind unrelated ones in the same file.
const signal = (item, log) => {
  const needle = path.basename(item.module).replace(/\.tsx?$/, '');
  const wanted = item.wanted.filter((n) => n !== 'default');
  let n = 0;
  for (const line of log.lines) {
    const mine = line.includes(needle) || wanted.some((w) => line.includes(`'${w}'`));
    if (mine) n += 1;
  }
  return n;
};

const write = (item, { chunk, names, form }) => {
  const source = path.join(HARNESS, 'recovered', chunk);
  let rel = path.relative(path.dirname(item.target), source).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  const digest = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex').slice(0, 16);
  const head = [
    '// Ported from the 2.1.296 shipped build: the 2.1.88 dump omits this module.',
    `// Source: recovered/${chunk} (sha256 ${digest}…).`,
  ];
  if (form === 'named') {
    const present = names.filter((n) => exportsOf(chunk).has(n));
    head.push(`// Named re-export of ${present.length}/${item.wanted.length} of the names the import sites ask for.`);
    const missing = item.wanted.filter((n) => !present.includes(n));
    if (missing.length > 0) head.push(`// Not in the chunk: ${missing.join(', ')}`);
    fs.mkdirSync(path.dirname(item.target), { recursive: true });
    fs.writeFileSync(item.target, `${head.join('\n')}\nexport { ${present.join(', ')} } from '${rel}';\n`);
  } else {
    head.push('// Stand-in re-export: no name evidence for this module, so the chunk is re-exported whole.');
    fs.mkdirSync(path.dirname(item.target), { recursive: true });
    fs.writeFileSync(item.target, `${head.join('\n')}\nexport * from '${rel}';\n`);
  }
};

// Only candidates backed by a name the chunk actually exports are evaluated: a whole-module
// re-export with no name evidence is a stand-in, and the compiler already rejected it as an
// improvement. Acquisitions are cumulative and fail closed — a fill that lowers this module's own
// errors but raises the run total is reverted, because that means it broke something else.
const results = [];
let running = baseline.total;
for (const item of items) {
  const named = item.candidates.filter((c) => c.form === 'named');
  if (named.length === 0) { results.push({ module: item.module, verdict: 'no name evidence', delta: 0, tried: 0 }); continue; }
  const before = { signal: signal(item, baseline), total: running };
  let verdict = 'reverted', chosen = null, delta = 0, tried = 0, log = null;
  for (const candidate of named) {
    tried += 1;
    write(item, candidate);
    log = classify(tsc(`try-${path.basename(item.module, path.extname(item.module))}`));
    const gained = signal(item, log) - before.signal;
    if (gained < 0 && log.total <= before.total) {
      verdict = 'kept';
      chosen = candidate;
      delta = gained;
      running = log.total;
      break;
    }
    if (item.original === null) fs.rmSync(item.target, { force: true }); else fs.writeFileSync(item.target, item.original);
    delta = gained;
  }
  results.push({ ...row(item, chosen, before, log, delta), verdict, tried });
}

function row(item, candidate, before, log, delta) {
  return {
    module: item.module, chunk: candidate?.chunk ?? null, form: candidate?.form ?? null,
    names: (candidate?.names ?? []).filter((n) => n !== 'default'),
    signalBefore: before.signal, signalAfter: log === null ? null : signal(item, log), delta,
  };
}

const final = classify(tsc('p-final'));
const kept = results.filter((r) => r.verdict === 'kept');
const reverted = results.filter((r) => r.verdict !== 'kept');
const out = {
  schema: 'W47Ports.v1', baseline: baseline.total, final: final.total,
  candidates: results.length, kept: kept.length, reverted: reverted.length, results,
};
fs.writeFileSync('.audit/w47-ports.json', JSON.stringify(out, null, 1) + '\n');

console.log(`errors ${baseline.total} → ${final.total} | candidates ${results.length} | kept ${kept.length} | reverted ${reverted.length}`);
for (const r of kept) console.log(`  KEEP delta ${r.delta}  ${r.module}  <- ${r.chunk}  [${r.names.join(', ')}]`);
for (const r of reverted.filter((x) => x.delta < 0 || x.delta > 0)) console.log(`  drop delta ${r.delta}  ${r.module}  <- ${r.chunk ?? '-'}`);
