// The Select site component (W45-81), the first of the interactive elements. The copied bodies live
// in ./plugin-chain-select-field-source.ts; this module is the seam around them.
//
// Source, chunk-kjfwbh4w.js. The component is one function and five things it reads:
//
//   function sr(o){…}  [37348,38173) 825 units — the Select site. It draws the label, the picked
//   option (or "none") and a ▾/▴ marker, then the visible window of options from `S3n`, each row
//   `  <label>` with the highlighted one inverse, and a `… N more` row when the window is cut. The
//   picked value comes from the select-fields context `gdn` (`pickedOf`) falling back to `props.value`;
//   the open highlight from `gdn.open` when it names this plugin and handle.
//
//   function S3n(o,i){…}  [37192,37323) 131 units — the option window: with `ht` (8) visible options,
//   the first index keeps the highlight in view, `size` is what fits, `hidden` is the rest and `rows`
//   adds one for the "more" line.
//   var ht=8;            [37183,37192) 9 units — the visible option count.
//
//   function xe(o){…}    [23170,23378) 208 units — the site-focus reader: `hasKeyboardFocus` when
//   the focused-press context `fdn` names this plugin and handle, the ref from the focused-node
//   context `pdn` only then, and a click from the clicked-press context `ldn` through `udn`.
//   var udn=(o)=>(i)=>{…}; [23009,23128) 119 units — the click adapter: a hyperlink is left to the
//   terminal, and the handler runs unless the event is a window activation or a dropped stray.
//   var ldn=qt(null); var pdn=qt(null); var fdn=qt(null); var gdn=qt(null); [22992,…,37348) 17 each
//   — the four contexts a host provider mounts.
//
// The component draws through the jsx factories `e`/`r` (`Xe` in the hook seam), where children
// travel in props and the third argument is the key.
export {
  sr, xe, S3n, udn, ht, gdn, fdn, pdn, ldn,
} from './plugin-chain-select-field-source.js';

/** Source `sr`: the Select site component. */
export { sr as SelectField } from './plugin-chain-select-field-source.js';
/** Source `xe`: the site-focus reader a pressable site calls with its plugin and handle. */
export { xe as useSiteFocus } from './plugin-chain-select-field-source.js';
/** Source `S3n`: the option window — first index, size, hidden count and row count. */
export { S3n as listWindow } from './plugin-chain-select-field-source.js';
/** Source `udn`: the click adapter — allow a hyperlink default, skip a stray or window activation. */
export { udn as focusClick } from './plugin-chain-select-field-source.js';
/** Source `ht`: how many options the Select shows at once. */
export { ht as VISIBLE_OPTIONS } from './plugin-chain-select-field-source.js';
/** Source `gdn`: the select-fields context — `pickedOf(plugin, element)` and `open`. */
export { gdn as SelectFields } from './plugin-chain-select-field-source.js';
/** Source `fdn`: the focused-press context — the `{plugin, handle}` that holds keyboard focus. */
export { fdn as FocusedPress } from './plugin-chain-select-field-source.js';
/** Source `pdn`: the focused-node context — the ref a focused site binds. */
export { pdn as FocusedNode } from './plugin-chain-select-field-source.js';
/** Source `ldn`: the clicked-press context — the handler a site click calls. */
export { ldn as ClickedPress } from './plugin-chain-select-field-source.js';
