// The Input field site (W45-82). The copied bodies live in ./plugin-chain-input-field-source.ts;
// this module is the seam around them.
//
// Source, chunk-kjfwbh4w.js. The site is one function and the values it composes:
//
//   function Vt(o){…}  [23378,24196) 818 units — the Input site. It reads the site focus through
//   `xe` (the same reader the Select uses), the field value from the input-fields context `cdn`
//   (`textOf(plugin, element)`), falling back to the drawn `value` and then "", and the terminal
//   columns from the size hook `ke`, with the site-columns context `ddn` — when mounted — replacing
//   the column count. It keeps a cursor offset `h` in `y(g.length)`, and while the field holds
//   keyboard focus raises it to `Number.MAX_SAFE_INTEGER` so the editor keeps the caret at the end.
//   The header is `label + ": "` (or empty) and the hint is ` ⏎ <submitLabel|submit>`. Focused, it
//   draws the host text editor `wr` with the value, `onChange` → `u.edit({plugin,handle,element},
//   value)`, the placeholder, the width `max(Gt, columns - width(label) - width(hint))`, the
//   clamped cursor offset and the editor flags; unfocused it draws the value dim (the placeholder
//   when empty, `?? ""`). The label draws whenever one is given; the ` ⏎` hint draws only while
//   the field holds keyboard focus.
//   var Gt=12;  [22928,22938) 10 units — the minimum field width.
//   var cdn=qt(null); var ddn=qt(null); [22946,22963), [22967,22984) 17 units each — the
//   input-fields and site-columns contexts a host provider mounts.
//
// Source, chunk-tz1x0g31.js and chunk-z7whhrje.js:
//   function ke(){…}  [715,829) 114 units — the terminal-size hook: `Ae(Zm)`, throwing
//   "useTerminalSize must be used within an Ink App component" when no provider is mounted.
//   var Zm=qt(null);  [10384,10400) 16 units — the terminal-size context it reads.
//
// The width arithmetic reuses `ae` (the recovered width of a string) from the text-clamp module,
// and the focus reader `xe` from the select-field module; both are the same recovered bodies, not
// reimplementations.
export {
  Vt, Gt, cdn, ddn, ke, Zm,
} from './plugin-chain-input-field-source.js';

/** Source `Vt`: the Input field site component. */
export { Vt as InputField } from './plugin-chain-input-field-source.js';
/** Source `Gt`: the minimum field width (12). */
export { Gt as FIELD_MIN_COLUMNS } from './plugin-chain-input-field-source.js';
/** Source `cdn`: the input-fields context — `textOf(plugin, element)` and `edit(site, value)`. */
export { cdn as InputFields } from './plugin-chain-input-field-source.js';
/** Source `ddn`: the site-columns context — its `columns` replaces the terminal width. */
export { ddn as SiteColumns } from './plugin-chain-input-field-source.js';
/** Source `ke`: the terminal-size hook — throws outside a provider. */
export { ke as useTerminalSize } from './plugin-chain-input-field-source.js';
/** Source `Zm`: the terminal-size context the hook reads. */
export { Zm as TerminalSizeContext } from './plugin-chain-input-field-source.js';
