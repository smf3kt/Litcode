// W45-75 evidence: the terminal capability and image-file probe stores. Records the two state
// machines the Image component reads and the defaults they fall back to.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const ledger = JSON.parse(fs.readFileSync('src/plugin-chain-terminal-capabilities-source-blocks.json', 'utf8'));
const source = fs.readFileSync('src/plugin-chain-terminal-capabilities-source.ts', 'utf8');

const evidence = {
  schema: 'W45TerminalCapabilitiesEvidence.v1',
  package: 'W45-75 — the terminal capability and image-file probe stores',
  date: '2026-10-17',
  question:
    'The Image component asks the terminal two questions — does it draw kitty graphics, and does it read files on this machine — and must not ask either twice. Where do those answers live, and what are the state transitions?',
  answer:
    'Both live in two small state machines of chunk-mvsmkx6d.js, copied whole (one block, 1,835 units): `i`, the image-file probe, and `o`, the capability readings, with the defaults `s` and the names `Q8n`. The only external body is the signal emitter `Oe`, which the registry-stores copy already carries. The file probe starts `unasked`; `begin` moves it to `asking` once; `unask` returns an asking probe to unasked; `answer` settles it once and emits the value; `onSettle` calls back immediately when settled and otherwise subscribes. The capability store is built from per-capability readings — `settled` at a value, or `pending` at a guess — and answers `now` with the settled value or the default (never the guess), settles a pending capability once, records a yes, lists what is still pending, and on `deadline` settles every pending capability at its guess with `, no answer` appended to its source.',
  measured: [
    'ImageFileProbe starts `{state:"unasked"}`; the first `begin()` answers true and moves it to asking; a second answers false.',
    '`unask()` only leaves asking; an answered probe refuses `begin()` and a second `answer()`.',
    '`onSettle` before the answer fires on it; after it, the listener is called at once.',
    'CapabilityReadings `now` returns the default for a pending capability (`synchronizedOutput` false although its guess was true).',
    '`answer` on a settled capability changes nothing and answers false; `confirmed` records only answers that were true.',
    '`deadline` settles the remaining capability at its guess and appends `, no answer` to the source.',
  ],
  ledger,
  decisiveFact:
    'The stores are self-contained apart from `Oe()`, the signal emitter the chain has carried since the registry-stores package; the capability environment guesses (`d()`) and the host wrappers that build them are not part of this package, so the stores are tested from explicit readings.',
  changes: [
    {
      file: 'src/plugin-chain-terminal-capabilities-source.ts',
      change: 'one copied block from chunk-mvsmkx6d.js [947,2782): `i`, `s`, `Q8n`, `o`; imports `Oe`',
      portSha256: sha(source),
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-terminal-capabilities.ts',
      change: 'the seam: aliases the four copied names to ImageFileProbe, CapabilityReadings, DEFAULT_CAPABILITIES and CAPABILITY_NAMES',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-terminal-capabilities.test.ts',
      change: 'nine tests: the probe transitions, its one-shot answer and listener order, the capability construction, now/default, answer/confirmed, pending, deadline and subscription',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-75-tsc.txt', 'utf8')) },
    undeclaredScan: 'src/plugin-chain-terminal-capabilities-source.ts: declared 10, unresolved 0',
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '9/9 new; chain family 553/553; full 1829/1829 pass, 0 fail',
    sourceIndex: '58 chunks, 1,424/28,854 statements, 250,759/10,379,080 units (2.4%)',
    identity: '4b7f1d22…',
  },
  next:
    'Partition 2b-ii: the Image component `No` and resolver `Ao` over these stores, with seams for the plugin client (`bC`), the internal querier (`QO`), the capability wrappers (`LT`/`Z8n`/`aWo`/`$1t`), the file path helper (`lPe`), the probe query (`uFo`), the source key (`er`) and the mount writers (`vLs`/`ELs`).',
};

fs.writeFileSync('research/ports/W45-terminal-capabilities-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', evidence.ledger.blocks.length, 'blocks');
