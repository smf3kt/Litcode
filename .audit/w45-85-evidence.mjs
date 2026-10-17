// W45-85 evidence: the Client host `Io`, the acquisition hook `So`, the terminal mount `To`, the
// key binding `wo`, the clock adapter `Ro`, the loading snapshot `bo`, the inert client `Co`, the
// error boundary `XD` and the keybinding pre-dispatch hook `Ey`.
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const source = 'src/plugin-chain-client-host-source.ts';
const ledger = readJson(source.replace(/\.ts$/, '-blocks.json'));
const units = ledger.blocks.reduce((sum, block) => sum + block.units, 0);
const empty = ledger.blocks.filter((block) => block.units === 0).map((block) => block.range);
if (empty.length > 0) throw new Error(`empty blocks: ${empty.join(', ')}`);
const sourceHash = sha(fs.readFileSync(source, 'utf8'));

const answer = [
  ledger.blocks.length + ' blocks are copied verbatim (' + units.toLocaleString('en-US') + ' units) into one module.',
  '`So` acquires the plugin client for the element (`G1o.acquire`), keyed by plugin, component, request id (`requestId\\0client\\0key`), surface `terminal`, the element key, module and props, with the clock adapter `Ro`; it releases on unmount and starts from the inert `Co`.',
  '`Io` subscribes to the acquired snapshot (`Rt`), draws the client under the error boundary `XD` with the layout box as the fallback, and passes the mount `To` the host, the instance and the snapshot.',
  '`To` binds the client ref, forwards props, redraw, layout, resize, pointer and key events, and draws the rebuilt tree or the failed text; `wo` clears the client focus when a pane takes focus and registers the pre-dispatch key handler that only the focused client consumes (escape and ctrl+c/d drop focus first).',
  '`XD` resets on a new `resetKey`, reports a throw once through the telemetry message, the capture sink and the caller, and draws the fallback while caught.',
  '`Ey` registers a pre-dispatch handler while active and unbinds on unmount.',
].join(' ');

const evidence = {
  schema: 'W45ClientHostEvidence.v1',
  package: 'W45-85 — the Client host',
  date: '2026-10-17',
  question:
    'How does the recovered Client host acquire a plugin client, mount its terminal view, forward input, and survive a client that throws?',
  answer,
  measured: [
    '`Ro(clock).every(100, fn)`: a tick at now 50 does not fire, now 100 fires once, now 190 does not; stopping unsubscribes. `Ro(null)` falls back to an interval of at least `eg` and stops on cleanup.',
    '`bo` is the frozen `{status:"loading"}`; `Co` is frozen with empty id/plugin/module, no pointer or key acceptance, and its snapshot is `bo`.',
    'A mount acquires with `{plugin:"p", component:"Pane", requestId:"r1", surface:"terminal", key:"b1", module:"m", props:{v:1}, clock:{every}}` and releases once on unmount; without the element context it uses `AbovePrompt`, request id `detached`, and undefined module/props.',
    '`Io` draws `XD` with the snapshot as `resetKey`, a telemetry thunk that answers null (no sink), the layout Box fallback (`flexShrink:0`, the given size, `overflow:"hidden"`) holding a blank Text, and `To` holding the same instance and snapshot.',
    '`To` draws a Box (`column`, `flexShrink:0`, the given size/grow, `overflow:"hidden"`, element key/plugin, the bound ref, pointer/enter/leave handlers), effects run `setProps`, `drawnAgain`, `laidOut`, `resize(0,0)` and `retainFinePointer`, and the drawn snapshot rebuilds the tree.',
    'A pointer-down carries `{type:"down",x,y,fine:{x,y},button:"right",shift,alt,ctrl}` after clearing the pane focus and focusing the client; enter/leave reuse the last position. A failed snapshot draws the truncating dim Text with its text; a loading client with neither capability has no handlers and no children.',
    '`wo` clears the client focus when a pane holds focus, and its key handler answers true only for the focused client (calling `key`), drops focus on escape and ctrl+c/d, and clears focus instead of consuming when the client rejects keys.',
    '`Ey` registers one pre-dispatch handler while active and unbinds on unmount; an inactive mount registers nothing.',
    '`XD` starts `{hasError:false,resetKey}`, resets only when `resetKey` changes, draws children or the fallback (or null), attaches a telemetry message once, replaces a frozen value with a new error carrying the message, and calls `onError` on every catch.',
    '`$pn`/`W1o` keep one focus id; `c9` focuses an open pane, ignores a closed id, and clears focus (`shownId` kept) for null; `kAt` maps modules (`a#e`, lead `a` or `hooks`); `Qrt` answers undefined for an unknown name; `i5t` is null; `m4n` retains the fine pointer through `Zy`.',
  ],
  partition: {
    slice: '5. Client host',
    state: 'landed',
    packages: [
      { package: 'W45-72', units: 1760, note: 'Raster site component and surface hook' },
      { package: 'W45-84', units: 3496, note: 'the Button and the action keys' },
      { package: 'W45-85', bodies: ['XD', 'wo', 'To', 'Ro', 'bo', 'Co', 'So', 'Io', 'Ey'], units },
    ],
    remaining: '6. The site-tree walker `je` with the terminal glue, taken last when every component it names is carried.',
  },
  ledger: { blocks: ledger.blocks.length, units, sources: ledger },
  decisiveFact:
    'The Client host is an acquisition boundary, not a renderer: `So` asks the registry for one client per element and releases it on unmount; `Io` only subscribes to the snapshot and mounts `To` under the boundary. `To` forwards every input event to the instance and never draws the client itself: the drawn tree comes from `host.rebuild(snapshot.tree)`. Focus is a host store shared by the pane layer and the clients, so pressing a client clears the pane focus and vice versa; the key path only reaches a client that holds the focus and accepts keys, with escape and ctrl+c/d dropping focus first.',
  hostBoundary: [
    {
      token: 'Kje/$pn/W1o',
      source: 'chunk-3xcmvqfg.js — `var Kje=Ge(gs({focusedId:null}),…)`, `$pn`, `W1o`',
      reason:
        'The focus store is host state shared with the pane layer: which client has focus depends on what the host mounted. The seam carries the same getState/setState/subscribe operations and the two copied setter bodies.',
    },
    {
      token: 'Ri/c9',
      source: 'chunk-tvdq3hrk.js — `var Ri=Ge(()=>it().panes,…)` and `var c9=…[6071,6330)`',
      reason:
        'The pane store is host state. `c9`\'s body is copied verbatim into the seam; `Ri()` is bound to a minimal pane store with the same snapshot shape (`open`, `focusedId`, `shownId`, `focusRequest`).',
    },
    {
      token: 'G1o',
      source: 'chunk-3xcmvqfg.js — `var G1o=AFr()`',
      reason:
        'The registry owns the whole plugin client lifecycle, which depends on the chain runtime this build does not host. The default `acquire` answers the same inert shape as the copied `Co`; a host with a client runtime replaces `G1o.acquire`.',
    },
    {
      token: 'i5t',
      source: 'chunk-n3ykh62m.js — `function i5t(...)`',
      reason:
        'Telemetry has no sink in this build. The source answer for "nothing to report" is null; the descriptor is still built by the copied `kAt` at the call site.',
    },
    {
      token: 'Zy/m4n',
      source: 'chunk-1r9zp6s1.js — the layout context `Zy` and `function m4n(o)` [25124,25247)',
      reason:
        'The layout context is owned by the host renderer. `Zy` defaults to a no-op fine-pointer retainer and `m4n` is copied verbatim over it.',
    },
    {
      token: 'iZr/ot/VV/c/t',
      source: 'chunk-kexg5hxg.js — the component base; chunk-886tf6ja.js — `ot`, `VV`; chunk-gsnbskq4.js — `c`; chunk-gyf58rwf.js — `t`',
      reason:
        'This build does not instantiate class components, so the base carries only the state surface the boundary reads. `ot` and `VV` are copied verbatim; the capture and log sinks are no-ops.',
    },
  ],
  seamChange: {
    file: 'src/plugin-chain-press-button-host.ts',
    change:
      '`KeybindingService` gains the optional `registerPreDispatch({handler})` the copied `Ey` calls, the same extension shape the source service has.',
  },
  changes: [
    {
      file: source,
      change: 'nine copied blocks: the boundary, the client view, the terminal mount, the clock adapter, the loading/inert shapes, the acquisition hook, the host component and the pre-dispatch hook',
      portSha256: sourceHash,
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-client-host.ts',
      change: 'the host seam: the focus stores, the pane focus setter, the client registry, the telemetry helpers, the layout context and the boundary base',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-client.ts',
      change: 'the seam: the source names plus `ClientHost`, `acquireClient`, `ClientMount`, `useClientInput`, `ErrorBoundary`, `usePreDispatch`, `clockEvery` and the two frozen aliases',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'test/plugin-chain-client.test.ts',
      change: 'twenty tests: the clock, the frozen shapes, acquisition, the host component, the mount, the input path, the pre-dispatch hook, the boundary and the host bindings',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: '.audit/w45-85-plan.mjs',
      change: 'the copy plan: nine blocks',
      coordinateUnit: 'utf16-half-open',
    },
    {
      file: 'src/plugin-chain-press-button-host.ts',
      change: 'the keybinding service gains `registerPreDispatch`',
      coordinateUnit: 'utf16-half-open',
    },
  ],
  validation: {
    tsc: { command: 'node_modules/.bin/tsc --noEmit --pretty false', exitCode: 0, diagnostics: 0, logSha256: sha(fs.readFileSync('.audit/w45-85-tsc.txt', 'utf8')) },
    undeclaredScan: { [source]: 'declared 67, unresolved 0' },
    notices: 'node scripts/dependency-notices.mjs --check exits 0',
    suite: '20/20 new; chain family 710/710; full 1,986/1,986 pass, 0 fail',
    sourceIndex: '71 chunks, 1,662/30,116 statements, 304,866/10,874,952 units (2.8%)',
    identity: 'dee1094f…',
  },
  next: 'The site-tree walker `je` with the terminal glue, taken last when every component it names is carried.',
};

fs.writeFileSync('research/ports/W45-client-host-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('evidence written', ledger.blocks.length, 'blocks', units, 'units');
