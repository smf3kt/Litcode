// The kitty image wire layer (W45-73). The copied bodies live in ./plugin-chain-image-wire-source.ts;
// this module is the seam around them. The source's Image site component asks the terminal to
// transmit a source (`cFo`) and draws the alt text when it cannot (`lFo`); both are written in this
// wire layer, which is its own terminal protocol: one framed message is `d`, the places a payload
// can come from are checked by `D` (inline base64) and `k` (a file path or shared-memory name), and
// the placement is described by the format codes `Y` and the medium codes `M`.
//
// What the layer is made of, in source order (chunk-fzk4rpqy.js):
//
//   - the SGR builders `tFo`/`mun`/…/`iFo` and the colour and border name tables `h`/`_`; `hun`
//     (`fl(39,"m")`, the default-foreground reset) is the suffix one alt row carries;
//   - the wire constants: `P` = ESC + APC, `G` = P + "G" (the graphics introducer), `m` = 4096 (the
//     payload chunk), `y` (the placeholder code point table), `h$t` = 256 (the 256-colour boundary),
//     `b` = 4294967295 (the id cap), `R` = 10000 (the pixel-size cap), `f` (the colour channel masks),
//     `L` = m/4*3 = 3072 (the name byte cap);
//   - `u`, a positive-integer range check; `D`, the base64 payload check; `k`, the file/shm name
//     check; `v`, UTF-8 to base64;
//   - `O`, a colour as an SGR sequence — `38;5;n` below 256, `38;2;r;g;b` otherwise; `S`, the first
//     n placeholder code points; `lFo`, the alt text (a colour sequence and one placeholder per
//     cell, each row terminated by `hun` and rows joined by a newline);
//   - `d`, one framed message: introducer + body + optional `;payload` + the string terminator;
//   - `cFo`, the transmit: a `q=1` control message for a file/shm name (the name base64-encoded as
//     the payload), otherwise a `q=2` message with the base64 inline, split at `m` characters with
//     `m=1` on every chunk but the last (`m=0`).
//
// The source's own text is the wire format; this module adds no behaviour. It exists so the site
// components import the layer under its own name, the way the surface components import theirs.
export {
  u, D, k, v, O, S, lFo, d, Y, M, cFo,
  hun, G, N, h$t, b, R, f, y, m, L,
} from './plugin-chain-image-wire-source.js';
