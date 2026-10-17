import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const ledger = JSON.parse(fs.readFileSync('src/plugin-chain-react-surface-source-blocks.json', 'utf8'));
const source = fs.readFileSync('src/plugin-chain-react-surface-source.ts', 'utf8');

const evidence = {
  schema: 'W45ReactSurfaceEvidence.v1',
  package: 'W45-72 — React layer partition 1: the Raster site component and its surface hook',
  date: '2026-10-17',
  question:
    'How is a plugin Raster site drawn? The source tree walker turns a Raster node into a component (`jo`), the component registers a mount through `hNs`, and the surface hook `Ko` binds that mount to the ink node it paints through. What exactly does each body do, and how is the React layer carried when this build has no React runtime?',
  answer:
    'The React layer is a seam. The source bodies are copied verbatim into src/plugin-chain-react-surface-source.ts (ten blocks, 1,479 units, two chunks) and call the host layer in src/plugin-chain-react-hooks.ts: element creation (`Tc`, with `s` = Box and `n` = Text), the hooks (`y`/`Z`/`R`/`en`/`Ae`), the context token (`qt`, and `ee = qt(null)` from the source), and the two ink node helpers `tI`/`ZFt`. `runComponent` renders one component, commits the element tree (which binds every `ref` to a node), then runs the queued effects; `unmount` runs their cleanups. `jo` renders a Box holding one `ink-raw-ansi` element sized to the frame; `Ko` registers the mount under `plugin:requestId:key` (NUL-joined by `e5t`), paints through `Fo`, writes the frame into the node with `_o`, and calls `tI`/`ZFt`; `nr` schedules the next paint only while the surface is not complete (16 ms progressing, 250 ms waiting). The partition of the rest of the layer is recorded below.',
  partition: [
    {
      slice: '1. Raster site component and surface hook (this package)',
      bodies: ['jo', 'Ko', 'Fo', 'Wo', '_o', 'Bo', 'nr', 'eg', 'ee', 'Ce', 'tI', 'ZFt'],
      units: 1479 + 281,
      state: 'landed',
      note: 'The two ink node helpers are ported (not copied) because they are declarators inside one large var statement in chunk-06azbynj.js; their source text is quoted in the hook seam.',
    },
    {
      slice: '2. Image site component and image source/decode',
      bodies: ['No', 'Ao', 'lFo'],
      units: 323 + 1410,
      state: 'pending',
      note: '`Ao` is the image-source resolver (1,410 units) and `lFo` is the decoded-frame renderer from chunk-fzk4rpqy.js; the Image component is the Raster component\'s sibling.',
    },
    {
      slice: '3. Leaf components',
      bodies: ['lt (Code)', 'Xt (Markdown)', 'Ya/mdn/Wt (text and links)', 'Mrt/Nrt'],
      units: null,
      state: 'pending',
      note: 'The source bodies the W45-65 Markdown and W45-64 style packages already support from below.',
    },
    {
      slice: '4. Input, Select, Button and hover',
      bodies: ['Vt', 'sr', 'Zt', 'Ut', 'Qt'],
      units: null,
      state: 'pending',
      note: 'The action-key, list-window and hover-group hooks and the three interactive elements.',
    },
    {
      slice: '5. Client host',
      bodies: ['Io', 'So', 'XD', 'To'],
      units: null,
      state: 'pending',
      note: 'The plugin client island: acquire a client, subscribe to its snapshot and mount `To` over it.',
    },
    {
      slice: '6. Site-tree walker and terminal glue',
      bodies: ['je', 'hdn', 'xr', 'VH', 'pr', 'ar', 'ur', 'cr', '...'],
      units: 2482,
      state: 'pending',
      note: '`je` dispatches every node type to the components above; the hooks and terminal glue under it are the rest of the 242 statements / 45,881 units in chunk-kjfwbh4w.js. It is taken last, when every component it names is carried.',
    },
  ],
  ledger,
  decisiveFact:
    'The product carries no React runtime. The component bodies are obtainable source text, so they are copied verbatim and the hook layer is the host seam, exactly as W45-38 served the bar. The seam is split into a hooks module and a surface module to avoid an import cycle: the source copy imports the hooks module; the surface module re-exports both. The only bodies not copied are `tI` and `ZFt`, which no statement range can isolate (`var SE=…,tI=…,ZFt=…,ay=…`); they are ported in the hooks module with the source text quoted and the same ancestor walk.',
  blocks: ledger.blocks,
  changes: [
    {
      file: 'src/plugin-chain-react-surface-source.ts',
      change: 'ten copied blocks: `ee`, `Ce`, `Fo`, `Wo`, `_o`, `Bo`, `nr`, `Ko`, `jo` from chunk-kjfwbh4w.js and `eg` from chunk-z9nv3z8k.js; imports the hook seam and the already-carried raster helpers',
      portSha256: sha(source),
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-react-hooks.ts',
      change: 'the host seam: `qt`, `Tc`, `s`/`n`, `y`/`Z`/`R`/`en`/`Ae`, the component runner and commit, and the two ported node helpers `tI`/`ZFt`',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-react-surface.ts',
      change: 'the public seam: re-exports the source bodies and the hook layer',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-react-surface.test.ts',
      change: 'eleven tests: the rendered element tree, the mount registry key and unmount, the detached fallback, the paint path (`rawText`, `dirty`, yoga mark, root render), paint coalescing, the scheduler and its cancel, the `nr` delays, `Wo`, and the ref-binding after commit',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-72-tsc.txt', 'utf8')) },
    undeclaredScan: 'src/plugin-chain-react-surface-source.ts: declared 43, unresolved 0',
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '11/11 new; chain family 503/503; full 1779/1779 pass, 0 fail',
    sourceIndex: '56 chunks, 1,404/28,784 statements, 244,587/10,361,990 units (2.4%)',
    identity: '571df984…',
  },
  next:
    'Partition 2: the Image site component and the image source/decode bodies (`No`, `Ao`, `lFo`). Then the leaf components, the interactive elements, the Client host, and last the site-tree walker `je` with the terminal glue.',
};

fs.writeFileSync('research/ports/W45-react-surface-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', evidence.blocks.length, 'blocks');
