// W45-73 evidence: the kitty image wire layer, partition 2a of the React layer's Image slice. Records
// the measured body semantics, the one ported constant, and the split that leaves the Image component
// and its source/decode bodies for partition 2b.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const ledger = JSON.parse(fs.readFileSync('src/plugin-chain-image-wire-source-blocks.json', 'utf8'));
const source = fs.readFileSync('src/plugin-chain-image-wire-source.ts', 'utf8');

const evidence = {
  schema: 'W45ImageWireEvidence.v1',
  package: 'W45-73 — React layer partition 2a: the kitty image wire layer',
  date: '2026-10-17',
  question:
    'The Image site component has two terminal-facing outputs: the transmit that asks the terminal to draw a source, and the alt text drawn when it cannot. Both are built by a wire layer of the same chunk (`lFo`, `cFo` and their helpers). What exactly does each body do, and what is the payload taken from?',
  answer:
    'The wire layer is copied verbatim from chunk-fzk4rpqy.js (12 blocks, 3,783 units; module sha256 bb2b14f9…). `cFo` validates the id against 4294967295 and the cell counts against the placeholder table, requires a pixel size for every non-png format, then branches on the payload medium: a file or shm name (`k`: non-empty, no NUL, at most 3072 UTF-8 bytes) is sent as a `q=1` control message whose payload is the name in base64 (`v`), and an inline payload (`D`: standard base64) is sent as `q=2`, split at 4096 characters with `m=1` on every chunk but the last (`m=0`). `lFo` renders the alt text: `O` writes the colour (`38;5;n` below 256, else the number read as a 24-bit colour), `S` takes the first n code points of the table `y` (297 entries), and each cell is the prefix `N` (U+10F286) plus the row and column placeholders, each row terminated by `hun` (SGR 39) and rows joined by a newline. One framed message is `d`: the introducer `G` (ESC _ G), the body, an optional `;payload`, and the terminator ESC backslash.',
  measured: [
    '`u` accepts an integer in [1, limit] and rejects 0, limit+1, fractions and NaN with the same TypeError.',
    '`O(255)` is `38;5;255`; `O(256)` is `38;2;0;1;0`, so from 256 the number is read as a 24-bit colour, not as a palette index.',
    '`k` counts UTF-8 bytes: 1536 U+00E9 code points (3072 bytes) pass, 1537 (3074 bytes) fail.',
    '`cFo` checks the pixel size before the medium, so a non-png file or shm source without width/height throws.',
    'A file or shm source skips the base64 check; an inline source without a medium is base64-checked.',
    'A payload of exactly the chunk size (4096) stays in one message; 4097 characters become two (m=1 then m=0), 9000 become three with payload lengths 4096/4096/808.',
    'An unknown format reads as `undefined` inside the header (`Y[format]` is undefined); the source does not reject it, and the typed callers never supply one.',
  ],
  partition: {
    slice: '2. Image site component and image source/decode',
    taken: {
      package: 'W45-73',
      bodies: ['u', 'D', 'k', 'v', 'O', 'S', 'lFo', 'd', 'Y', 'M', 'cFo', 'hun', 'G', 'N', 'h$t', 'b', 'R', 'f', 'y', 'm', 'L'],
      units: 3783,
      note: 'The wire half: the two encoders and every helper they read. `lFo` is also named in slice 2\'s evidence entry because it is the alt renderer the Image component calls.',
    },
    remaining: {
      slice: '2b',
      bodies: ['Z4t', 'Uto', 'Dss', 'Ao', 'No'],
      note: 'The image source/decode bodies and the Image site component itself; it needs the client (`bC`), the settings and theme it reads, so those seams are taken with it.',
    },
  },
  ledger,
  decisiveFact:
    'One name of the wire layer lives in another chunk: `hxn` is chunk-kexg5hxg.js `var hxn=PH+"\\\\"`, the string terminator `d` appends. chunk-kexg5hxg.js is not one of this package\'s modules, so `hxn` is ported in the copy header with the source expression quoted, not copied. The other 21 exports are whole copied blocks.',
  changes: [
    {
      file: 'src/plugin-chain-image-wire-source.ts',
      change: 'twelve copied blocks from chunk-fzk4rpqy.js: the SGR builders and tables, the wire constants, `u`, `D`, `k`, `v`, `O`, `S`, `lFo`, `d`, `Y`/`M`, `cFo`; `hxn` ported, `CZ`/`PH`/`fl` imported from the raster surface copy',
      portSha256: sha(source),
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-image-wire.ts',
      change: 'the seam: re-exports the wire layer under its own module name, with the format it writes documented',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-image-wire.test.ts',
      change: 'twenty-eight tests: constants and code tables, the three checks, UTF-8 base64, both colour forms, the placeholder table and the alt layout, framing, the file/shm and inline transmits, the size-before-medium order, the base64 skip, and the chunk split at the exact size',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-73-tsc.txt', 'utf8')) },
    undeclaredScan: 'src/plugin-chain-image-wire-source.ts: declared 56, unresolved 0',
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '28/28 new; chain family 531/531; full 1807/1807 pass, 0 fail',
    sourceIndex: '57 chunks, 1,416/28,817 statements, 248,370/10,372,020 units (2.4%)',
    identity: '9c6d2d17…',
  },
  next:
    'Partition 2b: the image source/decode bodies (`Z4t`, `Uto`, `Dss`) and the Image site component (`Ao`, `No`), with the client, settings and theme seams it reads. Then the leaves, the interactive elements, the Client host, and last the site-tree walker `je` with the terminal glue.',
};

fs.writeFileSync('research/ports/W45-image-wire-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', evidence.ledger.blocks.length, 'blocks');
