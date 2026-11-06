// W45-74 evidence: the Image source model — the shape predicates and the wire-source encoder, the
// first half of partition 2b. Records what the two copied statements answer and the transmit shape
// they hand to W45-73's cFo.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const ledger = JSON.parse(fs.readFileSync('src/plugin-chain-image-model-source-blocks.json', 'utf8'));
const source = fs.readFileSync('src/plugin-chain-image-model-source.ts', 'utf8');

const evidence = {
  schema: 'W45ImageSourceEvidence.v1',
  package: 'W45-74 — React layer partition 2b-i: the Image source model',
  date: '2026-10-17',
  question:
    'The Image component holds a plugin-supplied source in one of four shapes and hands it to the transmit. Which bodies test those shapes, what is a source\'s decoded size, and how is each shape turned into what `cFo` sends?',
  answer:
    'The Image source model is two statements of chunk-n3ykh62m.js, copied verbatim (554 units): `ac`/`Z4t`/`B_` (the png and file/shm shape tests and the decoded byte size) and `Uto`/`Dss` (the shm test and the encoder to the transmit shape). The validators that admit the shapes, and the base64 decoder `B_` reads, were already carried by the ui.blit copy (W45-58: `Mss`, `G_`, `z_`, `Y_`, `q_`, `F_`, `fs`, `ds`), so only the two statements the Image component itself calls are copied. `Dss` passes an inline png through, passes an inline rgba source through with its pixel size, and for a file or shm reference answers the medium, the name and — unless the format is png — the pixel size. A malformed source carrying both `file` and `shm` resolves to shm, because the shm test is asked first.',
  measured: [
    '`ac` is true only for the inline png shape; `Z4t` for the two reference shapes; `Uto` only for shm.',
    '`B_` answers the base64 payload\'s decoded byte count (four characters are three bytes) and 0 for a file or shm reference.',
    '`Dss` carries the pixel size for an inline rgba source and for a non-png file/shm reference, and omits it for png.',
    'A source with both `file` and `shm` encodes as shm.',
    'The encoder output is exactly the transmit shape: feeding it to W45-73 `cFo` yields the q=1 control message for a reference and the q=2 message for an inline source.',
  ],
  partition: {
    slice: '2. Image site component and image source/decode',
    taken: {
      package: 'W45-73',
      bodies: ['u', 'D', 'k', 'v', 'O', 'S', 'lFo', 'd', 'Y', 'M', 'cFo', 'hun', 'G', 'N', 'h$t', 'b', 'R', 'f', 'y', 'm', 'L'],
      units: 3783,
      state: 'landed',
    },
    takenNow: {
      package: 'W45-74',
      bodies: ['ac', 'Z4t', 'B_', 'Uto', 'Dss'],
      units: 554,
      state: 'landed',
      note: 'The shape half of 2b. The validators around it (Mss and its helpers) were carried by W45-58 in the ui.blit copy.',
    },
    remaining: {
      slice: '2b-ii',
      bodies: ['Ao', 'No', 'Oo', 'Mo', 'vo', 'Eo', 'Ho', 'dt', 'Lo', 'tr', 'rr', 'or', 'xt', 'Ke'],
      note: 'The Image component and its resolver, with seams for the plugin client (`bC`), the internal querier (`QO`), terminal capability level (`Z8n`, `aWo`, `ge`), the file probe (`lPe`) and the mount writers (`vLs`/`ELs`).',
    },
  },
  ledger,
  decisiveFact:
    'Most of the Image source layer was already carried. The shape validators `Mss`/`G_`/`z_`/`Y_`/`q_`/`F_`, the byte decoder `ds` and the size helpers live in the ui.blit copy (W45-58); this package copies only `ac`/`Z4t`/`B_` and `Uto`/`Dss`, which are contiguous statements the Image component calls directly. `B_` imports `ds` from that copy rather than carrying a second decoder.',
  changes: [
    {
      file: 'src/plugin-chain-image-model-source.ts',
      change: 'two copied blocks from chunk-n3ykh62m.js [242804,242947) and [245185,245596); imports `ds` from the ui.blit copy',
      portSha256: sha(source),
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-image-model.ts',
      change: 'the seam: re-exports the five bodies and documents the four source shapes',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-image-model.test.ts',
      change: 'thirteen tests: the three predicates, the decoded-size reader, the four encode forms, the shm preference and the transmit integration',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-74-tsc.txt', 'utf8')) },
    undeclaredScan: 'src/plugin-chain-image-model-source.ts: declared 15, unresolved 0',
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '13/13 new; chain family 544/544; full 1820/1820 pass, 0 fail',
    sourceIndex: '57 chunks, 1,421/28,817 statements, 248,924/10,372,020 units (2.4%)',
    identity: '88e22d52…',
  },
  next:
    'Partition 2b-ii: the Image component `No` and its resolver `Ao`, with the client, querier, terminal-capability, file-probe and mount-writer seams they read. Then the leaves, the interactive elements, the Client host, and last the site-tree walker `je` with the terminal glue.',
};

fs.writeFileSync('research/ports/W45-image-source-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', evidence.ledger.blocks.length, 'blocks');
