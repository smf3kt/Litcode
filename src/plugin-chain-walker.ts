// The site-tree walker (W45-86): one function that turns the plugin's tree value into the surface
// elements the chain renders. It dispatches every node type to the component that draws it — Button,
// Input, Select, Code, Markdown, Client, Svg, Image, Raster, Link and the text/Box containers — and
// carries the hover group, the Box hover scope and the inline/block split. The copied bodies live in
// ./plugin-chain-walker-host-source.ts; this module is the seam around them.
//
// Source, chunk-kjfwbh4w.js:
//   function je(o,i,p=new Set()){…} [38173,40655) — the walker. Strings become Text children; an
//   `engine` node returns `i(o.ref)`; each site type becomes its component with the press handle and
//   the props the source passes; a Link resolves `Mrt(href)` for its display text and `Nrt(href)` for
//   its URL and draws the host link component `Wt`; a keyed Box becomes a HoverScope and reports a
//   duplicate key through `X4t`; everything else is a Text or Box, through `Ut` when it carries a
//   hover block or through `De(o.props)` otherwise.
// Source, chunk-n3ykh62m.js: `Mrt` [238267,238357) — the display href encoder — and `X4t`
// [233611,233808) — the one-scope-per-key check.
// Source, chunk-nyce03br.js: `y$` [112643,112741) and chunk-t58kj6z7.js: `zDe`/`zpr`/`pot`
// [615,799) — the control-character and bidi-mark patterns the display encoder uses.
//
// The host link component (`Wt`) lives in ./plugin-chain-walker-host.ts.
export { je, Mrt, y$, zDe, zpr, pot, X4t } from './plugin-chain-walker-host-source.js';

/** Source `je`: the walker from a plugin tree to surface elements. */
export { je as renderSiteTree } from './plugin-chain-walker-host-source.js';
/** Source `Mrt`: the display href encoder (unsafe characters percent-encoded). */
export { Mrt as encodeDisplayHref } from './plugin-chain-walker-host-source.js';
/** Source `X4t`: the Box-key hover-scope check. */
export { X4t as hoverScopeProblem } from './plugin-chain-walker-host-source.js';
