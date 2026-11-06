import fs from 'node:fs';

const plan = JSON.parse(fs.readFileSync('research/ports/W172-list-source-plan.json', 'utf8'));
const built = JSON.parse(fs.readFileSync('src/diff-dialog-list-source-blocks.json', 'utf8'));

const notes = new Map();
for (const block of plan.blocks) notes.set(`${block.file}:${block.range[0]}:${block.range[1]}`, block.note);

const ranges = built.blocks.map((block) => {
  const note = notes.get(`${block.module}:${block.range[0]}:${block.range[1]}`) ?? '';
  return {
    module: block.module,
    sha256: block.sha256,
    range: block.range,
    units: block.units,
    digest: block.bodySha256,
    note,
  };
});

const modules = [];
const seen = new Map();
for (const block of built.blocks) {
  const held = seen.get(block.module);
  if (held === undefined) seen.set(block.module, { module: block.module, sha256: block.sha256, blocks: 1, units: block.units });
  else {
    held.blocks += 1;
    held.units += block.units;
  }
}
modules.push(...seen.values());

const evidence = {
  schema: 'W172List.v1',
  package: 'W172-list',
  date: '2026-10-18',
  source: {
    copied: { blocks: built.blocks.length, units: built.blocks.reduce((sum, block) => sum + block.units, 0), modules, ranges },
    host_adapters: [
      {
        module: 'chunk-7n39kxwj.js',
        sha256: 'd61cd8ea69cc56b8014df554f8d044fd9a5a98208ec9976123b13e634715d69b',
        name: 'Wo',
        range: [1540, 1576],
        units: 36,
        body_sha256: 'd953213925fda328a86a224ac290ff8875a1c979c0bc5b024a785af392638b2e',
        product: 'src/diff-dialog-list-host.ts',
        note: 'apply a selector to the mounted app state; bound to this build\'s app-state context sx through Re',
      },
      {
        module: 'chunk-mrf41zrh.js',
        sha256: 'e800c49b7b53541ef7f7f801a686029a70f250a57f8c75b422301dd885ad687f',
        name: 'Mct',
        range: [4416, 4462],
        units: 46,
        body_sha256: 'd267c486bb3163c7d620aa17c04ab82a85ea612316cb00eac038abad9e707dc5',
        product: 'src/diff-dialog-list-host.ts',
        note: 'host arrow-navigation flag; local select already navigates with arrows, so the local answer is true',
      },
      {
        module: 'chunk-f37m98yh.js',
        sha256: '207b107a452d54c816419d533bc258f2c8567f8ccfc255cebc390160bb4c900d',
        name: '$h',
        range: [21892, 22233],
        units: 341,
        body_sha256: '4be627f69ae5e595b029e9c94a9c5653251fd17939fda50f4507fa9602dc5ebb',
        product: 'src/diff-dialog-list-host.ts',
        note: 'focus the ref node while enabled and keep focus inside; resolves the manager through ix, then the app context',
      },
    ],
    host_seams: [
      { module: 'chunk-kexg5hxg.js', name: 'w/P/en/Rt/Ae/Z', role: 'React hook seam', product: 'src/plugin-chain-react-hooks.ts' },
      { module: 'chunk-06azbynj.js', name: 'Zy', role: 'app context with the focus manager', product: 'src/plugin-chain-press-button-source.ts' },
      { module: 'chunk-06azbynj.js', name: 'ix', role: 'focus manager of a committed node', product: 'src/diff-dialog-frame-scope-source.ts' },
    ],
    reused: [
      { names: ['Xe as e', 'Xe as r', 'w', 'b', 'y', 'P', 'R', 'Ae', 'Z', 'Rt', 'le', 'en', 'To', 'qt', 's', 'n', 'N', 'Children', 'isValidElement', 'fragment'], product: 'src/plugin-chain-react-surface.ts' },
      { names: ['nt', 'kc', 'Ys'], product: 'src/plugin-chain-code-host.ts' },
      { names: ['nl', 'ns', 'aS'], product: 'src/diff-dialog-tabs-source.ts' },
      { names: ['ke'], product: 'src/plugin-chain-input-field-source.ts' },
      { names: ['on'], product: 'src/plugin-chain-markdown-source.ts' },
      { names: ['Zy', 'Lc'], product: 'src/plugin-chain-press-button-source.ts' },
      { names: ['nn'], product: 'src/plugin-chain-above-prompt-keybinding-source.ts' },
      { names: ['oo'], product: 'src/plugin-chain-keys-rows-source.ts' },
      { names: ['IU'], product: 'src/diff-dialog-frame-scope-source.ts' },
      { names: ['ld'], product: 'src/tui-primitives.ts' },
      { names: ['te'], product: 'src/tui-symbols.ts' },
      { names: ['ae'], product: 'src/plugin-chain-text-clamp-source.ts' },
      { names: ['ge'], product: 'src/tui-color.ts' },
      { names: ['sx'], product: 'src/plugin-chain-app-state-source.ts' },
      { names: ['O'], product: 'src/plugin-chain-fs-boundaries.ts' },
      { names: ['invalidatePrevFrame as F'], product: 'src/plugin-chain-above-prompt-host.ts' },
    ],
    remaining: ['the si wiring with PMr/Ht/Ffe', 'C-5 provider/key policy', 'C-6 remaining consumers', 'C-9 marketplace collisions', 'C-11 formatter differences', 'C-12 remaining plugin-chain work'],
  },
  product: {
    files: [
      'src/diff-dialog-list-source.ts',
      'src/diff-dialog-list-source-blocks.json',
      'src/diff-dialog-list-host.ts',
      'src/diff-dialog-list.ts',
      'test/diff-dialog-list.test.ts',
    ],
    exports: ['List', 'ListItem', 'ListHeading', 'ListContainer', 'useListNavigation', 'useListSelection', 'ListSelectionContext', 'SOURCE_BODIES'],
    notes: [
      'Tl is Cn with Item (Po) and Heading (Bo) attached; Cn groups headings for the accessible select (ZY) and dispatches the normal branch on visibleCount.',
      'Qe renders the windowed body: rows, headings, overflow hints, the scroll box and one selection context per row.',
      'fn owns list navigation: cursor, windowing, headings, page jumps, wrap/clamp edges, wheel and scrollbar bindings.',
      'NXe measures the list box and rows; list rows read the reserve and container contexts.',
      'The host resolves the focus manager through ix when the committed node carries one, otherwise through the mounted app context.',
    ],
  },
  validation: {
    focused: { passed: 10, failed: 0, file: 'test/diff-dialog-list.test.ts', new: 10 },
    full: { passed: 2565, failed: 0 },
    tsc: 0,
    build: 0,
    notices: 0,
    scan: [{ file: 'src/diff-dialog-list-source.ts', declared: 254, unresolved: 0 }],
  },
  identity: {
    sha256: '997d61f885bac709aeb3af35762ee15927dc1c5fe63e545796f7ebef58d85916',
    inputs: 672,
    validation: 228,
    build: 462,
  },
};

fs.writeFileSync('research/ports/W172-list-evidence.json', `${JSON.stringify(evidence, null, 2)}\n`);
console.log('wrote', built.blocks.length, 'ranges');
