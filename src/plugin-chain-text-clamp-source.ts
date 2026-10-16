// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-eb9r2hbv.js sha256 3b1f83a5d1fcec7a1aa8a7d0adf139d8643ace6755985b79f19ddc1e7de22abe
//   chunk-yn0pfn70.js sha256 1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f
//   chunk-ax7r0qj7.js sha256 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e
//   chunk-pa2d6xdm.js sha256 0a153d833913cb0d61d58e8fcef2305314884997ff8ade99440e04c4cc1e5b2e
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The width primitives and the two truncations the plugin label sanitiser clamps with (W45-36).
// `ae` is one line over `Bun.stringWidth`, which this product's ./tui-render-host.ts already
// provides as its own cell-accurate function, so the copied `z` option is inert: the product's
// width notion is already the source's narrow-ambiguous Bun semantics (see that file's
// GraphemeState comment). `ct` cuts by grapheme, `jo` clamps the first line, `Qe`/`Ar` take the
// text up to the first line feed and `$8` is the identity.
import { Bun } from './tui-render-host.js';

// chunk-eb9r2hbv.js declares the segmenter memo beside the display-name memo this pass does not read [615,640) 25 units sha256 1e97a7dd9a3cde5e248eb964e48866c34f2c886df604cf852cb7353ce3d954a8
var a=null,s=null,u=null;

// chunk-eb9r2hbv.js declares ra, the lazily built grapheme segmenter every width and cut below reads [720,803) 83 units sha256 3bb900c08b81c7434cc11e06c5859e506f3ee3886c81a6c1f20f4b51f50a2ffb
function ra(){if(!a)a=new Intl.Segmenter(void 0,{granularity:"grapheme"});return a}

// chunk-yn0pfn70.js declares z, the width options the host call is given [863,892) 29 units sha256 cb8b1e574afc6c8b9f7d8a0e49416270f6ad961cf44bad2557078f680a79c3d9
var z={ambiguousIsNarrow:!0};

// chunk-yn0pfn70.js declares ae, the width of a string [892,935) 43 units sha256 f4f9588d319d263d23717eb01e33c366d8a7ebcab863b4e2a0e1ba8aafecffaf
function ae(e){return Bun.stringWidth(e,z)}

// chunk-yn0pfn70.js declares ct, cut to a column budget without splitting a grapheme, ellipsis included in the budget [8443,8612) 169 units sha256 b8519145022d51041df2bb7d36d334a20ba13d82a6d2d8e757db4afbec6449eb
function ct(e,t){if(ae(e)<=t)return e;if(t<=1)return"\u2026";let r=0,n="";for(let{segment:s}of ra().segment(e)){let o=ae(s);if(r+o>t-1)break;n+=s,r+=o}return n+"\u2026"}

// chunk-yn0pfn70.js declares jo, the first line only, ellipsis appended or the line cut to the budget [9072,9254) 182 units sha256 85a2dba66536933d609af7f0898adf918f67f730add19f7a977c89b3754a73d8
function jo(e,t,r=!1){let n=e;if(r){let s=e.indexOf(`
`);if(s!==-1){if(n=e.substring(0,s),ae(n)+1>t)return ct(`${n}\u2026`,t);return`${n}\u2026`}}if(ae(n)<=t)return n;return ct(n,t)}

// chunk-ax7r0qj7.js declares Qe, the text before a separator [3224,3289) 65 units sha256 7184cd31a9af8f0fac35de5b85a290da988105f5df932de856f663e2dc2427cd
function Qe(t,n){let e=t.indexOf(n);return e===-1?t:t.slice(0,e)}

// chunk-ax7r0qj7.js declares Ar, the first line of a text [3529,3561) 32 units sha256 b4022a3d073a7db41c37c63237ed26eb7fb5f7a1caff06b8c1be5c4a57d00cf4
function Ar(t){return Qe(t,`
`)}

// chunk-pa2d6xdm.js declares $8, the identity the sanitiser returns its clamped text through [720,744) 24 units sha256 e68496fc882a9433d7d05681c1369d627589a6def1594d4ab56db4d3685d9e03
function $8(e){return e}


export { ra, z, ae, ct, jo, Qe, Ar, $8 };
