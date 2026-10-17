// The host seam the Input field site reads (W45-82). The site body lives in
// ./plugin-chain-input-field-source.ts; this module supplies the text editor it draws while the
// site holds keyboard focus and nothing else.
//
//   · `wr` — the terminal text editor. The source declares it at chunk-s7977spq.js [7424,11062)
//     (3,638 units), a component whose closure reaches the key decoder (`hr`, `Qc`), the offset and
//     history machines (`JN`, `nt`, `Kmt`), the paste pipeline (`$dn`), the highlight and theme
//     mapping (`Xt`, `Wn`, `ge`) and its renderer (`BFt`, `UFt`). That subsystem is outside the
//     site layer this package ports, so the site's own dependency on it is a component token, the
//     same way `s`/`n` are the shell's `'Box'`/`'Text'` tokens: the host renderer resolves
//     `'TextEditor'` and the site passes it one fixed prop set.
//
// The site renders the editor only while focused, with:
//   value, onChange(v), placeholder, columns, cursorOffset, onChangeCursorOffset,
//   focus: true, showCursor: true, multiline: false, disableEscapeDoublePress: true.
export const wr = 'TextEditor';
