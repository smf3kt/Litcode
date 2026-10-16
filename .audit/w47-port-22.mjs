// Port the 22 gaps whose feature name survives in the recovered tree, and let the compiler decide
// whether each port holds: fill from the candidate chunk, run tsc, and keep the fill only when the
// files that import the gap stop erroring.
//
//   node .audit/w47-port-22.mjs            # measure, decide, report
//
// A fill is `export { … } from <chunk>` when the chunk exports the names the import sites ask for,
// and `export * from <chunk>` when the import sites ask for no names (barrel and require patterns).
// The second form is a stand-in: it resolves and type-checks, but it carries the chunk's own
// module-level side effects. Each written file says which of the two it is.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const HARNESS = '/Users/mant1ssa/Projects/cc-base-2188';
const RECOVERED = path.resolve('recovered');
const LOG = (name) => `/tmp/w47-${name}.txt`;

const emit = (name) => {
  try {
    execFileSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], { cwd: HARNESS, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  } catch (e) {
    fs.writeFileSync(LOG(name), (e.stdout ?? '') + (e.stderr ?? ''));
    return;
  }
  fs.writeFileSync(LOG(name), '');
};

const byFile = (logPath) => {
  const counts = new Map();
  const text = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  for (const m of text.matchAll(/^([^\s(].*?)\(\d+,\d+\): error TS\d+/gm)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  const total = (text.match(/error TS\d+/g) ?? []).length;
  return { counts, total };
};

const classification = JSON.parse(fs.readFileSync('.audit/w47-gap-classification.json', 'utf8'));
const fills = JSON.parse(fs.readFileSync('.audit/w47-fills.json', 'utf8'));
const gaps = classification.rows.filter((r) => r.verdict === 'present');
const record = new Map(fills.results.map((r) => [r.relative, r]));

const chunkExports = (chunk) => {
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

const before = byFile(LOG('before'));
const snapshot = new Map();
const plan = [];

for (const gap of gaps) {
  const target = path.join(HARNESS, gap.module);
  const entry = record.get(gap.module);
  const candidates = gap.chunks.filter((c) => fs.existsSync(path.join(RECOVERED, c)));
  plan.push({ gap, target, entry, candidates, original: fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null });
}
emit('before');
const baseline = byFile(LOG('before'));

const write = (item, chunk, form) => {
  const source = path.join(HARNESS, 'recovered', chunk);
  let rel = path.relative(path.dirname(item.target), source).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  const head = [
    `// Ported from the 2.1.296 shipped build: the 2.1.88 dump omits this module.`,
    `// Source: recovered/${chunk} (sha256 ${crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex').slice(0, 16)}…).`,
  ];
  const body = form.names.length > 0
    ? `export { ${form.names.join(', ')} } from '${rel}';`
    : `export * from '${rel}';`;
  head.push(form.exact
    ? '// Named re-export: every name the import sites ask for is exported by that chunk.'
    : form.names.length > 0
      ? '// Partial re-export: the chunk exports these of the names asked for; the rest are named below.'
      : '// Stand-in re-export: the import sites ask for no names (barrel or require pattern), so the chunk is re-exported whole.');
  if (form.missing.length > 0) head.push(`// Not in the chunk: ${form.missing.join(', ')}`);
  fs.mkdirSync(path.dirname(item.target), { recursive: true });
  fs.writeFileSync(item.target, head.join('\n') + '\n' + body + '\n');
};

const restore = (item) => {
  if (item.original === null) fs.rmSync(item.target, { force: true });
  else fs.writeFileSync(item.target, item.original);
};

const importerErrors = (item, log) => {
  const list = item.entry?.importersList ?? [];
  return list.reduce((sum, f) => sum + (log.counts.get(f) ?? 0), 0);
};

const results = [];
const round = (items, index) => {
  const roundName = `round${index + 1}`;
  for (const item of items) {
    const chunk = item.candidates[index];
    if (chunk === undefined) { results.push({ module: item.gap.module, chunk: null, verdict: 'no candidate', delta: 0 }); continue; }
    const exported = chunkExports(chunk);
    const names = (item.entry?.names ?? []).filter((n) => n !== 'default');
    const present = names.filter((n) => exported.has(n));
    const form = { names: present, missing: names.filter((n) => !present.includes(n)), exact: names.length > 0 && present.length === names.length };
    write(item, chunk, form);
  }
  emit(roundName);
  const after = byFile(LOG(roundName));
  for (const item of items) {
    const chunk = item.candidates[index];
    if (chunk === undefined) continue;
    const delta = importerErrors(item, after) - importerErrors(item, baseline);
    const verdict = delta < 0 ? 'kept' : 'reverted';
    if (verdict === 'reverted') restore(item);
    const exported = chunkExports(chunk);
    const names = (item.entry?.names ?? []).filter((n) => n !== 'default');
    const present = names.filter((n) => exported.has(n));
    results.push({
      module: item.gap.module, chunk, token: item.gap.token, verdict,
      form: names.length === 0 ? 'export *' : present.length === names.length ? 'named' : `partial ${present.length}/${names.length}`,
      importerErrorsBefore: importerErrors(item, baseline), importerErrorsAfter: importerErrors(item, after), delta,
      round: roundName,
    });
  }
  return after;
};

const after1 = round(plan, 0);
const retry = plan.filter((p) => results.find((r) => r.module === p.gap.module && r.verdict === 'reverted') && p.candidates.length > 1);
const after2 = retry.length > 0 ? round(retry, 1) : null;
emit('final');
const final = byFile(LOG('final'));

const out = {
  schema: 'W47Ports.v1',
  baseline: { errors: baseline.total },
  afterRound1: { errors: after1.total },
  afterRound2: after2 ? { errors: after2.total } : null,
  final: { errors: final.total },
  kept: results.filter((r) => r.verdict === 'kept').length,
  reverted: results.filter((r) => r.verdict === 'reverted').length,
  results,
};
fs.writeFileSync('.audit/w47-ports.json', JSON.stringify(out, null, 1) + '\n');

console.log(`baseline ${baseline.total} → round1 ${after1.total}${after2 ? ` → round2 ${after2.total}` : ''} → final ${final.total}`);
console.log(`kept ${out.kept} | reverted ${out.reverted}`);
for (const r of results.sort((a, b) => a.delta - b.delta)) {
  console.log(` ${r.verdict === 'kept' ? 'KEEP' : 'revert'} ${String(r.delta).padStart(5)}  ${r.module.padEnd(52)} ${String(r.form ?? 'none').padEnd(14)} ${r.chunk ?? '-'}`);
}
