// The Markdown leaf (W45-80), the last leaf of the React layer's partition 4. The copied bodies
// live in ./plugin-chain-markdown-source.ts; this module is the seam around them.
//
// Source, chunk-kjfwbh4w.js and chunk-1r9zp6s1.js. The leaf is one component and three things it
// reads:
//
//   function Xt({text:o,dimColor:i,press:p,elementKey:a,pressableLinks:m}){…}
//   [24354,25250) 896 units — the component. It draws the text through the markdown renderer `Ya`
//   with the scheme set `mdn`, and when the drawing holds a press it wraps the answer in a Box that
//   listens for a click. A click over a hyperlink the drawing declared pressable stops the
//   terminal's own activation, waits `tun` (500 ms) while watching the selection, and then runs the
//   press through the terminal entry `TIe` with `{href}` — unless a selection appeared, in which
//   case it cancels instead. A click that carries no hyperlink, carries ctrl or alt, names a link
//   the drawing did not declare, is a window activation, or lands within `vje` (300 ms) of the
//   drawing is left to the terminal.
//
//   var mdn=new Set(["https","http","file"]);  [24313,24354) 41 units — the schemes kept pressable.
//   var S0=…,vje=300,tun=500;                 [135682,135731) 49 units, chunk-06azbynj.js — the
//     double-activation window and the press delay.
//   function on(){let o=Ae(eE);…}              [17969,18071) 102 units — the clock hook.
//   function wC(){Ae(Gfe);let o=oi().get(process.stdout);…} [26659,27318) 659 units — the selection
//     accessor: the instance's readers when the output stream has one, and a fixed no-selection
//     object otherwise.
//
// The renderer `Ya` is the body this product already carries in ./tui-markdown-components.ts, copied
// from the same chunk (its own provenance is research/ports/W44-visual-copies.json), so the leaf
// imports that copy rather than porting the renderer twice. The two contexts and the selection map
// are host bindings and live in ./plugin-chain-markdown-host.ts.
export {
  Xt,
  mdn, vje, tun, on, wC,
} from './plugin-chain-markdown-source.js';

/** Source `mdn`: the link schemes the markdown renderer keeps pressable. */
export { mdn as MARKDOWN_LINK_SCHEMES } from './plugin-chain-markdown-source.js';
/** Source `vje`: how long after a drawing its click is treated as a stray window activation. */
export { vje as DOUBLE_ACTIVATION_WINDOW_MS } from './plugin-chain-markdown-source.js';
/** Source `tun`: how long a click over a declared link waits for the selection to settle. */
export { tun as PRESS_SETTLE_DELAY_MS } from './plugin-chain-markdown-source.js';
