// W45-39 identity check: the seam's four transcriptions are the source's closure bodies with only the
// React hook wrappers removed, and its suppression test answers what the source expression answers.
// Exits non-zero on any difference, so the claim is measured rather than asserted in prose.
import fs from 'node:fs';

const chunk = fs.readFileSync('extracted-v2/modules/chunk-356hrhz3.js', 'utf8');
const seam = fs.readFileSync('src/plugin-chain-notify-queue.ts', 'utf8');

const flat = (text) => text.replace(/\s+/g, '');
/** The seam annotates the two arrow parameters the source leaves bare (`noImplicitAny`); a transcription
 *  check must not read those as a difference, so they come off before the comparison, as documented. */
const unannotate = (text) => text.replace(/\(a: (?:Notification|string)\)/g, '(a)');
const at = (needle) => {
  const index = chunk.indexOf(needle);
  if (index < 0) throw new Error(`the source no longer holds ${needle}`);
  return index;
};

/** The arrow body of a `le(() => { … }, [deps])` wrapper, wrapper removed. */
const wrapped = (start, endNeedle) => {
  const from = at(start) + start.length;
  const to = chunk.indexOf(endNeedle, from);
  if (to < 0) throw new Error(`no ${endNeedle} after ${start}`);
  return chunk.slice(from, to);
};
/** The body of a `const <name> = <body>;` line in the seam (each body is one line). */
const seamBody = (name) => {
  const line = seam.split('\n').find((l) => l.trimStart().startsWith(`const ${name} = `));
  if (!line) throw new Error(`the seam no longer declares ${name}`);
  return line.trimStart().slice(`const ${name} = `.length).replace(/;\s*$/, '');
};

const pairs = [
  ['processQueue', 'l', wrapped('l=le(', ',[n,i,s,k,b]),'), seamBody('l')],
  ['addNotification', 'H', wrapped('H=le(', ',[n,l,i,s,k,b]),'), seamBody('H')],
  ['removeNotification', 'A', wrapped('A=le(', ',[n,l,i]);'), seamBody('A')],
];

// The mount effect: `P(() => { … }, [])` inside `vo`, body only.
const mountFrom = at('return P(()=>{') + 'return P('.length;
const mountTo = chunk.indexOf('},[])', mountFrom);
if (mountTo < 0) throw new Error('the mount effect has no end');
const mountSource = chunk.slice(mountFrom, mountTo + '}'.length);
pairs.push(['mount', 'mount', mountSource, seamBody('mount')]);

const results = [];
for (const [what, name, source, port] of pairs) {
  const identical = flat(source) === flat(unannotate(port));
  results.push({ what, name, identical, sourceUnits: source.length, portUnits: port.length });
}

// The suppression test (`T`), two ways. Textually: the source's return expression, with its parameter
// names renamed to the seam's (`o` -> `c`, `n` -> `r`) and `p4n` -> `presentationOf`, is a substring of
// the seam's `T` after whitespace is flattened. Behaviourally: the source expression and the port answer
// the same for every input under the gate this build has — `vps()` is `!1`, so `i4n()` is false.
const tStart = at('function T({presentationContext:o,isScreenReaderEnabled:n})');
const tEnd = chunk.indexOf('function D(o)', tStart);
if (tEnd < 0) throw new Error('the suppression test has no end');
const tSource = chunk.slice(tStart, chunk.lastIndexOf('}', tEnd) + 1).trim();
const sourceExpr = flat('i4n()&&!r&&presentationOf(c)==="fullscreen"');
const seamFlat = flat(seam);
const expressionIdentical = seamFlat.includes(sourceExpr) && seamFlat.includes('presentationContext:c') && sourceExpr.length > 0;

const sourceT = new Function('i4n', 'p4n', `return ${tSource};`)(
  () => false,
  (value) => (value === null ? 'inline' : typeof value === 'string' ? value : value.latched),
);
const seamModule = await import('../dist/plugin-chain-notify-queue.js');
const seamT = seamModule.notificationQueueSuppressed;
const cases = [
  [{ presentationContext: 'fullscreen', isScreenReaderEnabled: false }, 'fullscreen, no reader'],
  [{ presentationContext: 'inline', isScreenReaderEnabled: false }, 'inline'],
  [{ presentationContext: null, isScreenReaderEnabled: false }, 'null context'],
  [{ presentationContext: { latched: 'fullscreen' }, isScreenReaderEnabled: false }, 'latched fullscreen'],
  [{ presentationContext: { latched: null }, isScreenReaderEnabled: false }, 'latched null'],
  [{ presentationContext: 'fullscreen', isScreenReaderEnabled: true }, 'fullscreen with a reader'],
];
const suppressed = cases.map(([input, why]) => ({
  input: why,
  source: sourceT(input),
  port: seamT(input, (value) => (value === null || value === undefined ? 'inline' : typeof value === 'string' ? value : (value.latched ??= 'inline'))),
}));
const gateOff = suppressed.every((row) => row.source === row.port && row.port === false);
const tIdentical = expressionIdentical && gateOff;

console.log(JSON.stringify({
  schema: 'W45NotifyQueueIdentity.v1',
  closures: results,
  suppression: { checked: tIdentical, expression_identical: expressionIdentical, gate: 'i4n() is false in this build (vps is !1)', cases: suppressed },
}, null, 1));
if (!results.every((row) => row.identical) || !tIdentical) {
  console.error('a transcription differs from the source body');
  process.exit(1);
}
