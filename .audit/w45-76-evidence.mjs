// W45-76 evidence: the Image site component and its resolver — partition 2b-ii and the close of the
// Image slice. Records the nine copied blocks, the host seam, the hook-runner extension the component
// forced, and the measured behaviour.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const ledger = JSON.parse(fs.readFileSync('src/plugin-chain-image-component-source-blocks.json', 'utf8'));
const source = fs.readFileSync('src/plugin-chain-image-component-source.ts', 'utf8');

const evidence = {
  schema: 'W45ImageComponentEvidence.v1',
  package: 'W45-76 — React layer partition 2b-ii: the Image site component and its resolver',
  date: '2026-10-17',
  question:
    'How does a plugin Image site draw? The resolver must allocate an image id, ask the wire layer to transmit the source, decide whether the terminal can read files, and fall back to alt text. Which bodies do that, and what host state do they read?',
  answer:
    'Nine blocks are copied verbatim (4,944 units): the probe query `uFo` and error-code reader `E`; the alt decision `Eo`; the probe constants, `Lo`, `tr`, `rr`, `dt`, `or`, `Po`, `Ho` and the tracker `xt`; the id-width table `Ke`; the mount registration `Mo`; the file-answer subscription `Oo`; the resolver `Ao`; and the component `No`. The resolver allocates an id on mount, transmits on the first render and on a source or size change, skips a resend of the same file/shm reference, and registers a callback through the image mount writer (`ELs`/`vLs`, already carried) whose answer is the alt element or undefined. The component renders that answer as a Box holding one `ink-raw-ansi` element, or the alt text when the resolver answers undefined. The file-read probe writes a 4-byte probe image to a temp path, asks through `uFo`, and settles the W45-75 store with the answer; six transient filesystem errors leave it inconclusive.',
  measured: [
    '`Eo` answers five distinct alt reasons in order (no root, no placeholders, no id, files unasked, cannot read files) and lets an inline source draw even when files cannot be read.',
    '`Ho` reports a refusal once per key per message within 5 s; a changed message is reported immediately.',
    '`vo` answers undefined below indexed colour, 8 bits at indexed colour and 24 at truecolor, and undefined when the terminal does not draw kitty graphics.',
    '`dt` settles the store true with `probe: file query answered OK`, false with `probe: no reply to the file query` when flushed without a reply, and returns the store to unasked when the query was dropped.',
    'The probe request is `uFo(id, path)` with the id allocated at width 24, and the temp file is unlinked after the answer.',
    'The inline component transmits once with `resend: true` and draws `lFo(id, columns, rows)`; unmount frees the id.',
    'A file source on a terminal that cannot read files draws the alt Text and answers the mounted callback with the cannot-read-files sentence.',
  ],
  partition: {
    slice: '2. Image site component and image source/decode',
    state: 'closed',
    packages: [
      { package: 'W45-73', bodies: ['u', 'D', 'k', 'v', 'O', 'S', 'lFo', 'd', 'Y', 'M', 'cFo', 'hun', 'G', 'N', 'h$t', 'b', 'R', 'f', 'y', 'm', 'L'], units: 3783 },
      { package: 'W45-74', bodies: ['ac', 'Z4t', 'B_', 'Uto', 'Dss'], units: 554 },
      { package: 'W45-75', bodies: ['i', 'o', 's', 'Q8n'], units: 1835 },
      { package: 'W45-76', bodies: ['E', 'uFo', 'Eo', 'Lo', 'tr', 'rr', 'dt', 'or', 'Po', 'Ho', 'xt', 'Ke', 'vo', 'Mo', 'Oo', 'Ao', 'No', 'xi', 'hi', 'yi', 'gi'], units: 4944 },
    ],
    remaining: 'The rest of the React layer: the leaf components, the interactive elements, the Client host, and last the site-tree walker `je` with the terminal glue.',
  },
  ledger,
  decisiveFact:
    'The component forced two additions to the W45-72 hook seam. `y` now accepts the source\'s three initializer forms (`y(fn)`, `y(value)`, `y()`), and `runComponent` re-renders after a state setter, the way React does: the resolver\'s id only exists after its mount effect, so the component\'s first render sees none. Effects also run the previous cleanup when their dependencies change, so re-rendering does not leave a second mount registration behind. The host seam (./plugin-chain-image-host.ts) serves the capability and probe accessors, the client and querier contexts (null by default, which the source already treats as absent), the colour level and the temp path builder; the client and querier contracts are read from the source\'s calls.',
  changes: [
    {
      file: 'src/plugin-chain-image-component-source.ts',
      change: 'nine copied blocks: `E` from chunk-886tf6ja.js; `uFo` from chunk-fzk4rpqy.js; `Eo`, the probe constants and helpers, `Ke`, `Mo`, `Oo`, `Ao`, `No` from chunk-kjfwbh4w.js',
      portSha256: sha(source),
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-image-component.ts',
      change: 'the seam: re-exports the bodies and documents the resolve path',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-image-host.ts',
      change: 'the host boundary: `LT`/`Z8n`/`aWo`/`$1t` over the W45-75 stores, `bC`/`QO` fixture contexts, `ge`, and `lPe`',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-react-hooks.ts',
      change: '`P` (the source\'s second effect hook) and `le` (useCallback); `y` initializer forms; the runner re-renders after state updates and runs an effect\'s previous cleanup on a dependency change',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-image-component.test.ts',
      change: 'fifteen tests: the probe query and error code, five alt reasons, the refusal log, the transmit builder, the id width, the mount registration, the three probe outcomes and the component renders',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-76-tsc.txt', 'utf8')) },
    undeclaredScan: 'src/plugin-chain-image-component-source.ts: declared 81, unresolved 0',
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '15/15 new; chain family 568/568; full 1844/1844 pass, 0 fail',
    sourceIndex: '58 chunks, 1,441/28,854 statements, 255,604/10,379,080 units (2.5%)',
    identity: '7b53418e…',
  },
  next:
    'Partition 3: the leaf components (`lt` Code, `Xt` Markdown, the text/link group), then the interactive elements, the Client host, and last the site-tree walker `je` with the terminal glue. The Image slice is closed.',
};

fs.writeFileSync('research/ports/W45-image-component-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', evidence.ledger.blocks.length, 'blocks');
