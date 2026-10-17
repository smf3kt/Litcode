// W45-84 evidence: the pressable Button `Zt`, the action-key store `Yt` and seat `Qt`/`Jt`, the
// hotkey seat `y3n`, the focus blur `_3n`, the click subscriber `wFt`, the key normalization
// `go`/`ko`, the keybinding service `Lc`, the dialog store `aq`/`Ff`/`iv`/`kj`, the default app
// context `Pg`/`Zy` and the identity wrapper `Ge`.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const source = 'src/plugin-chain-press-button-source.ts';
const ledger = readJson(source.replace(/\.ts$/, '-blocks.json'));
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
const empty = ledger.blocks.filter((block) => block.units === 0).map((block) => block.range);
if (empty.length > 0) throw new Error(`empty blocks: ${empty.join(', ')}`);
const sourceHash = sha(fs.readFileSync(source, 'utf8'));

const answer = [
  ledger.blocks.length + ' blocks are copied verbatim (' + units.toLocaleString('en-US') + ' units) into one module.',
  '`xo` is the action-key store: entries are `{action, rank, seq, plugin, handle, …}`, the winner is the highest rank and then the latest sequence (`co`), re-adding moves an entry, and `Yt` is the shared store.',
  '`Qt` is the seat: it registers one handler per binding context of its action (`Ds`) through the keybinding service (`Lc`), gives the handler the component rank (`_s`: Pane 2, AbovePrompt 1, else 0) and holds one descriptor; registration is skipped without a service and while a dialog is open (`kj` reads `iv`).',
  '`Jt` is the seat as a childless component.',
  '`Zt` is the button: a click box that blurs a focused descendant (`_3n`) and stops the immediate propagation, the seat when an action is given, and a focusable action box (`KH`) whose render prop draws the bracketed label (focused or hovered inverse, plain/hotkey, held labels, dim, primary) and takes its `ref` from the site-focus cell (`pdn`).',
  '`wFt` subscribes to app clicks and fires unless the press landed inside its ref or was a window activation; without a host context it reads the default `Pg` (no-ops).',
  '`ko`/`go` turn one key event into a `{key, ctrl, shift, meta}` binding, naming space and the named keys and ignoring wheel events.',
].join(' ');

const evidence = {
  schema: 'W45PressButtonEvidence.v1',
  package: 'W45-84 — the Button and the action keys',
  date: '2026-10-17',
  question:
    'How does the recovered Button draw its label and action keys, and how do its seats, the click subscriber and the key normalization bind a press to the winning site?',
  answer,
  measured: [
    '`co({rank:2,seq:0},{rank:1,seq:9})` is true and equal ranks/sequences answer false; `xo` answers the later same-rank entry, `remove` falls back to the earlier, `winnerOf("z")` is undefined and `clear` empties `held`.',
    '`Ds("act", rows)` is `["Pane","Global"]` (duplicates and other actions dropped); `_s` answers 2, 1, 0, 0 for Pane, AbovePrompt, Chat, undefined; `Ge("x",1)` is `"x"`.',
    '`yo` maps 0/1/2 to left/middle/right and undefined to undefined; `ko` maps `" "` to `{key:"space"}`, `{return:true}` to `{key:"return"}`, keeps `ctrl`/`meta` only when true, and answers undefined for a wheel event and an empty key.',
    '`Lc()` is null without a context and the mounted service with one; `Ff()` outside its provider throws the source message; `iv({open:[user,plain]})` is the last non-user entry and `iv({open:[]})` is null; `kj()` is true only while a dialog is open.',
    'A seat with two bindings registers two handlers with `{singleKey:true, fallback:true}`, holds one descriptor at rank 2, removes it on unmount, and the handler answers false with no winner; an open dialog and a missing service both register nothing; `Jt` renders null.',
    'The button root is a Box with `flexShrink:0`, `alignSelf:"flex-start"`, the element key/plugin and an `onClick`; it nests `KH` with `tabIndex:-1` and the focus ref; with an action it nests the seat first.',
    'The label is `"[ OK ]"` (bold) by default, inverse when focused or hovered, and the plain variant draws `["", "", "OK"]` with a hotkey drawing a suggestion Text and `": "`; held draws `["[ ","A","B"," ]"]`; the dim and primary variants carry `dimColor` and `color:"suggestion"`.',
    'A click stops the immediate propagation and blurs only when the focused element is inside the pressed node; `_3n` outside it does not blur; `ix` on an unbound node throws `no focus manager is bound to this node`.',
    'The hotkey seat receives `("k", ref)` on mount and its unbind on unmount; the click subscriber fires outside the ref, ignores a window activation and an inside press, and falls back to `Pg` without a context.',
  ],
  partition: {
    slice: '4. The terminal press pipeline, the leaves and the interactive elements',
    state: 'in progress',
    packages: [
      { package: 'W45-80', units: 1747, note: 'the Markdown leaf' },
      { package: 'W45-81', units: 1360, note: 'the Select site, its window and the site-focus reader' },
      { package: 'W45-82', units: 992, note: 'the Input field site' },
      { package: 'W45-83', units: 2240, note: 'the hover group' },
      {
        package: 'W45-84',
        bodies: ['co', 'xo', 'Yt', 'Ds', '_s', 'ee', 'Qt', 'Jt', 'y3n', '_3n', 'Zt', 'yo', 'wFt', 'go', 'ko', 'Ge', 'Lc', 'aq', 'Ff', 'iv', 'kj', 'Pg', 'Zy'],
        units,
      },
    ],
    remaining: 'The Client host (`Io`/`So`/`To`/`wo`/`Ro`/`Co`), and last the site-tree walker `je` with the terminal glue.',
  },
  ledger: { blocks: ledger.blocks.length, units, sources: ledger },
  decisiveFact:
    'The Button owns no press state: every actionable press is an entry in the shared action-key store, and the seat registers one keybinding handler per bound context whose rank decides which held entry wins (`co`: rank then sequence). The handler dispatches the winner through the press dispatcher and answers false when nothing is held. The label is drawn by the action box render prop, so focus and hover come from the box and only the override block differs between the bracketed and plain variants.',
  hostBoundary: [
    {
      token: 'u',
      source: 'chunk-bwyexfny.js — `var u=qt(null)`, read by `Lc`',
      reason:
        'The keybinding service is host state: its `bindings` rows decide which contexts a seat registers in, and `registerHandler` is owned by the host keybinding layer. With none mounted `Lc` answers null and the seat skips registration, the source own no-service path.',
    },
    {
      token: 'ix',
      source: 'chunk-06azbynj.js — `function ix(n){return eun(n).focusManager}`',
      reason:
        'The focus manager is per committed node. This build has no node registry, so the host binds a manager per node and the unbound path throws instead of returning a made-up manager.',
    },
    {
      token: 'KH',
      source: 'chunk-1r9zp6s1.js — `var KH=je`',
      reason:
        'The focusable action box is supplied by the renderer: it owns `tabIndex`, `onAction`, the `ref` and the render prop. The seam exposes the token the way `s`/`n` are exposed.',
    },
  ],
  seamChange: {
    file: 'scripts/source-undeclared-scan.mjs',
    change:
      '`ReferenceError` is a language global the copied `Ff` body reads; the scanner now recognizes it, so the source records no false undeclared name.',
  },
  changes: [
    {
      file: source,
      change: 'twenty-three copied blocks: the button cluster, the three keybinding/dialog helpers, the default app context and `Ge`',
      portSha256: sourceHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-press-button-host.ts',
      change: 'the host seam: the keybinding context `u`, the focus manager `ix`/`bindFocusManager` and the action-box token `KH`',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-press-button.ts',
      change: 'the seam: the source names plus `PressButton`, `ActionKeysSeat`, `HotkeySeat` and `RenderInstance`',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-press-button.test.ts',
      change: 'thirteen tests: the store, the key helpers, the service and dialog store, the seats, the button, the click subscriber and the aliases',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: '.audit/w45-84-plan.mjs',
      change: 'the copy plan: twenty-three blocks',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'scripts/source-undeclared-scan.mjs',
      change: 'add `ReferenceError` to the scanner globals',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-84-tsc.txt', 'utf8')) },
    undeclaredScan: { [source]: 'declared 67, unresolved 0' },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '13/13 new; chain family 690/690; full 1,966/1,966 pass, 0 fail',
    sourceIndex: '70 chunks, 1,652/30,105 statements, 300,970/10,873,013 units (2.8%)',
    identity: 'b6c1c882…',
  },
  next: 'The Client host (`Io`/`So`/`To`/`wo`/`Ro`/`Co`), and last the site-tree walker `je` with the terminal glue.',
};

fs.writeFileSync('research/ports/W45-press-button-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', ledger.blocks.length, 'blocks', units, 'units');
