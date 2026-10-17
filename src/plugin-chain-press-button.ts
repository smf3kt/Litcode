// The pressable Button (W45-84): the site the press pipeline draws, with its action-key seat, plus
// the action-key store, the focusable action box, the click subscriber and the key normalization the
// chain uses. The copied bodies live in ./plugin-chain-press-button-source.ts; this module is the
// seam around them. (The W45-66 Button leaf check lives in ./plugin-chain-button.ts.)
//
// Source, chunk-kjfwbh4w.js:
//   var co=(o,i)=>…; [25258,25316) — rank, then sequence: the action-key order.
//   function xo(){…} [25316,25578) — the action-key store: `add` (re-adding moves the entry),
//   `remove`, `winnerOf(action)` (highest rank, then latest sequence), `held`, `clear`.
//   var Yt=Ge(xo(),…) [25578,25609) — the store the seats register in.
//   var Ds=(o,i)=>…; [25609,25674) — the binding contexts an action is bound in.
//   var _s=(o)=>…; [25674,25721) — a component's rank: Pane 2, AbovePrompt 1, else 0.
//   var ee=qt(null); [25725,25741) — the render-instance context (`{component}`).
//   function Qt(o){…} [25741,26268) — the action-key seat: one registration per bound context; the
//   handler dispatches the winning held press through `TIe`. Skipped when no keybinding service or
//   while a dialog is open.
//   function Jt(o){…} [26268,26301) — the seat as a childless component.
//   var y3n=qt(null); [26305,26322) — the hotkey seat context: `(hotkey, ref) => unbind`.
//   function _3n(o){…} [26322,26437) — blur the focused descendant of the pressed button.
//   function Zt({…}){…} [26437,27368) — the Button: a click box that blurs a focused descendant and
//   stops the immediate propagation, the action-key seat when an action is given, and the focusable
//   action box whose render prop draws the label, hotkey and held labels.
//   function yo(o){…} [27380,27488) — the alignment name of a position.
//   function wFt(o){…} [27496,27679) — subscribe to app clicks; fire unless the click landed inside
//   the ref or was a window activation.
//   var go=[…]; function ko(o,i){…} [27679,28121) — one key event as a `{key,ctrl,shift,meta}`
//   binding (named keys mapped, wheel ignored, space named).
// Source, chunk-ae84tp6z.js: function Ge(t,e){return t} [5355,5381) — the identity wrapper.
// Source, chunk-bwyexfny.js: function Lc(){return Ae(u)} [3552,3579) — the keybinding service.
// Source, chunk-06azbynj.js: var Pg=qt({…}) [224520,224782) — the default app context (no-op
// subscriptions); var Zy=Pg; [224818,224828) — the name the click subscriber reads.
// Source, chunk-8zgs1qmk.js: `aq` [3768,3784), `Ff` [3784,3957), `iv` [911,976), `kj` [4043,4125)
// — the dialog store, its provider error and the open-dialog gate.
//
// The host bindings (the keybinding context, the focus manager and the focusable action box) live in
// ./plugin-chain-press-button-host.ts.
export {
  co, xo, Yt, Ds, _s, ee, Qt, Jt, y3n, _3n, Zt, yo, wFt, go, ko,
  Ge, Lc, aq, Ff, iv, kj, Pg, Zy,
} from './plugin-chain-press-button-source.js';

/** Source `Zt`: the pressable Button site component. */
export { Zt as PressButton } from './plugin-chain-press-button-source.js';
/** Source `Jt`: the action-key seat as a component. */
export { Jt as ActionKeysSeat } from './plugin-chain-press-button-source.js';
/** Source `y3n`: the hotkey seat context. */
export { y3n as HotkeySeat } from './plugin-chain-press-button-source.js';
/** Source `ee`: the render-instance context (`{component}` drives the action-key rank). */
export { ee as RenderInstance } from './plugin-chain-press-button-source.js';
/** Source chunk-kjfwbh4w's export-table entry `releaseInkFocus`: `_3n` under the name the AbovePrompt
 *  toggle reads through its module namespace (`Sc.releaseInkFocus`). */
export { _3n as releaseInkFocus } from './plugin-chain-press-button-source.js';
