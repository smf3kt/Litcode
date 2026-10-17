// The host seam the site-tree walker reads (W45-86). The copied bodies live in
// ./plugin-chain-walker-host-source.ts; this module supplies the one host binding they ask for.
//
// `Wt` is the source's link component (chunk-1r9zp6s1.js): it decides whether the terminal can draw
// a real hyperlink, draws an `ink-link` element when it can, and otherwise draws the fallback text.
// That decision belongs to the renderer that owns the terminal, so the seam exposes a link token the
// same way the pressable action box is exposed (`KH`); the host renderer resolves it to its own link
// element and keeps the fallback its child.
export const Wt = 'Link';
