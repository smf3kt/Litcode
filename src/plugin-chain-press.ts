// The held-press store and the terminal input/select dispatch (W45-78), partition 4's core. The
// copied bodies live in ./plugin-chain-press-source.ts; this module is the seam around them.
//
// A drawing holds presses: each pressable element (Button, Input, Select, Markdown) carries a
// `press: {plugin, handle}` in its props, `XPt` walks a drawing and collects those handles, and
// `Rto` files them in the held-press store `AK` under the drawing key (`_f`), relabelling the
// drawing through `SFs`/`le` when a handle moves. `FM`/`BM` release the handles a replaced or
// unmounted drawing dropped. The terminal wires `UPn`/`jPn` to the input and select dispatch: `Xl`
// looks the held element up by handle (or by its full key), builds the request argument, and runs
// the chain through `aP` — the module's own press first (`Yl`, which also runs any per-handle runner
// `Hrt` registered), then the site's `check` over what it returned. `m_`/`bo` are the per-plugin
// runner table and the per-name serial queue the dispatch runs on.
//
// What the layer is made of, in source order (chunk-n3ykh62m.js, then chunk-p16hdq43.js):
//
//   - `m_`/`Hrt`, the per-plugin press runners; `g_`, whether a handle was released;
//   - `Yl`, the handler a dispatch appends to the chain;
//   - `bo`, a per-name serial queue; `_f`, the drawing key; `bf`, a press held under another
//     drawing of the same plugin; `S_`/`__`, the random handle space;
//   - `b_`/`AK`, the held-press store: `heldPress`, `holdDrawing`, `holdersOf`, `forgetPresses`,
//     `heldByKeyOf`, `hostedButtonsOf`, `heldPressCount`;
//   - `vAt`, release the handles a new drawing no longer holds; `Rto`, host a drawing and relabel
//     its press handles; `w_`, the input argument; `kf`/`Ef`/`Cf`/`vf`, the input and select site
//     queues and descriptors; `k_`, whether a plugin holds a press for an element;
//   - `FM`/`BM`, release what a replaced or unmounted drawing held;
//   - `Xl`, the dispatch; `x_`/`T_`, the ui.input and ui.select entry points; `ql`, run only when
//     the plugin holds the element; `UPn`/`jPn`, inputFromTerminal and selectFromTerminal;
//   - `XPt` and its walkers `_`/`I`/`ke`/`D`/`ve`, `je`/`K`/`le`/`SFs`, the press collect and
//     relabel passes over a drawing.
export {
  m_, g_, Hrt, Yl, bo, _f, bf, S_, __, b_, AK, vAt, Rto, w_, kf, Ef, k_, FM, BM,
  Xl, x_, R_, vf, T_, ql, UPn, Cf, jPn, XPt, SFs,
} from './plugin-chain-press-source.js';
