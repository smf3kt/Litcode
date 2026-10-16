// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-bf3z2ftn.js sha256 1c4ed6b761e5ced6000d4a7c4c43b970eb1d35c37015a35c3ac825b5739478b3
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The Unicode normalise pass under the plugin label sanitiser (W45-36) together with the tab and
// ESC-sequence expander it hands text to (W45-37). `kt` folds every control, surrogate and
// invisible mark to U+FFFD and then passes the result to the grapheme-budget preview `Lr`; `Zs` is
// `kt` with the preview on, which is the form `O` in ./plugin-chain-label-text-source.js calls.
// `Epe` is the entry to the expander, `mCo` the pass itself, `ht` the tokenizer's entry, `yt` the
// text of one token and `mt` the C1 replacement — all copied whole.
//
// `twe` is imported rather than copied a second time. src/tui-ansi-tokenizer.ts already carries
// that body byte-identical to chunk-yn0pfn70.js [3260,3602) 342 units, together with the ESC state
// machine `L` it drives ([3672,6275) 2,603 units, also byte-identical), ported by W44 — and
// .audit/w45-37-tokenizer-identity.mjs recomputes both comparisons from the module and that file,
// so the reuse is a measured fact rather than an assumption. What is copied here is the only part
// of the pass this product did not already own.
import { ae, ra } from './plugin-chain-text-clamp-source.js';
import { twe } from './tui-ansi-tokenizer.js';

// chunk-bf3z2ftn.js declares the mark budget and the six ESC-sequence patterns the pass below tests [2332,2479) 147 units sha256 dbd22234223e487351813dbfe46a427e06d1a5999a1f3ee56a327b078cea4746
var nPe=8,yr=/(\t|\n)/,br=/[\x1b\x9b]/g,wr=/[\x90\x98\x9d-\x9f]/g,Er=/[\x1b\x90\x98\x9b\x9d-\x9f]/,Sr=/^\x1b[P\]X^_k]/,Rr=/^\x1b[P_].*\x07$|\x9c/s;

// chunk-bf3z2ftn.js declares Epe, the entry to the tab and ESC-sequence pass: untouched unless the text holds a tab or an ESC-class byte [2479,2557) 78 units sha256 76273813b7a9f56af2dc9d1971a7e347e459980690ac99ce47b0ece195ba1927
function Epe(e,n=nPe){return e.includes("\t")||gCo([e])?mCo([e],n).join(""):e}

// chunk-bf3z2ftn.js declares mCo, the expander: a line without a tab or an escape is passed through while the running column is tracked, otherwise the line is tokenized and every tab becomes the spaces up to the next stop, a line feed resetting the column [2557,2960) 403 units sha256 982e350e5c53cf2d875af214f140f3cd17bfd26d533621cc1859273f2e1c9e18
function mCo(e,n=nPe){let r=0,i="";return e.map((o,s)=>{if(!gGn(o)&&!o.includes("\t")){let d=o.lastIndexOf(`
`)+1;if(d>0)r=0,i="";return i+=d>0?o.slice(d):o,o}let u="";for(let d of ht(o,s===e.length-1)){let p=yt(d);if(p===void 0){u+=d.value,i+=d.value;continue}for(let h of p.split(yr))if(h==="\t"){r+=ae(i);let R=n-r%n;u+=" ".repeat(R),r+=R,i=""}else if(h===`
`)u+=h,r=0,i="";else u+=h,i+=h}return u})}

// chunk-bf3z2ftn.js declares gGn, does the text hold an ESC-class byte [2960,2994) 34 units sha256 9bf378903ab08dda67a4881b85c2fe0ad60b2846faf6d2bcd5e322ba54911d40
function gGn(e){return Er.test(e)}

// chunk-bf3z2ftn.js declares gCo, does tokenizing the text change it, which is the pass' own reachability test [2994,3099) 105 units sha256 93d9d1575d24d9a11173dd7b70c1c8e3c2aca8efed877feca657979bef60a648
function gCo(e){return e.some((n,r)=>gGn(n)&&ht(n,r===e.length-1).some((i)=>(yt(i)??i.value)!==i.value))}

// chunk-bf3z2ftn.js declares ht, the tokenizer's entry: a line without an ESC-class byte is one text token, otherwise the state machine feeds it and an unterminated tail becomes a sequence or a text token [3099,3269) 170 units sha256 225656250f11e8514d3efc8b64d6bcc56ed1c054778c4482cf976ff0cddf362f
function ht(e,n){if(!gGn(e))return[{type:"text",value:e}];let r=twe(),i=r.feed(e),o=r.buffer();if(o!=="")i.push({type:n&&!Sr.test(o)?"sequence":"text",value:o});return i}

// chunk-bf3z2ftn.js declares yt, the text of one token with its controls rewritten, and nothing for a sequence token [3269,3463) 194 units sha256 574f1878481de4d997a0e3f4f9e6573b1ed70f77b1817bead423308680ef4c4f
function yt(e){if(e.type==="text"||e.value.includes(`
`)||Rr.test(e.value))return mt(e.value.replace(br,"\x18"));if(e.value.startsWith("\x1Bk"))return mt(e.value.replace(/\x9b/g,"\x18"));return}

// chunk-bf3z2ftn.js declares mt, the C1 controls replaced by the replacement character [3463,3508) 45 units sha256 f570438de042c3cf4700f59e3f0c4acfa11c5a2bf4e51d19a688bf8a062787a5
function mt(e){return e.replace(wr,"\uFFFD")}

// chunk-bf3z2ftn.js declares Et, a control that is not a tab or a line feed [3508,3577) 69 units sha256 440ae16a5900bfe5b2e26fdbe3391c1da7bcb62e8cb9f2feaf423c06d5409494
function Et(e){if(e===9||e===10)return!1;return e<32||e>=127&&e<=159}

// chunk-bf3z2ftn.js declares Rt, the Arabic number signs and their format characters [3577,3644) 67 units sha256 877b53edc4c29511a194f4dbebc2bf2c10bf8df0e27b7f4ca1e4269c90e0f4de
function Rt(e){return e===1564||e>=8234&&e<=8238||e>=8294&&e<=8297}

// chunk-bf3z2ftn.js declares _r, the variation selectors, dropped rather than replaced [3644,3687) 43 units sha256 f6ccfbb046fc3ae7c7fc3ceb6292ce2489a2e60626b75ccaf9afd0da605cb987
function _r(e){return e===65038||e===65039}

// chunk-bf3z2ftn.js declares Pr, a surrogate half [3687,3728) 41 units sha256 6d155ed00710002b5eaa250450cd13417833e7a1a579fe3019360763589ba62e
function Pr(e){return e>=55296&&e<=57343}

// chunk-bf3z2ftn.js declares _t, the cell width of one grapheme: zero for a control, one for an Arabic number sign format character, otherwise measured [3728,3856) 128 units sha256 f7b2be274aded8e7121881c2912b00020eddca5238c372002eafc0566a49eb74
function _t(e){let n=e.codePointAt(0);if(e.length===1){if(n<=31)return 0;if(Rt(n))return 1}let r=ae(e);return r===0?0:r===1?1:r}

// chunk-bf3z2ftn.js declares the preview budgets: the per-line character ceiling and the two square budgets beside the marker pattern this pass does not read [3856,3916) 60 units sha256 1831bc24bcc88c309f7a3476b4d9177f6812929e3319c520ff9a144ffbb63dfa
var ve=4096,rPe=/\u2026 \[\+\d+ graphemes\]/,kr=4064,xr=256;

// chunk-bf3z2ftn.js declares bt, does every grapheme's measured width match its own cell width [4178,4302) 124 units sha256 b7b3d9edab7d807f212b4bc4c35079d11560bd3565420b842cdd8404b7e242ee
function bt(e){let n="",r=0;for(let{segment:i}of ra().segment(e)){n+=i;let o=ae(n),s=o-r;if(r=o,s!==_t(i))return!1}return!0}

// chunk-bf3z2ftn.js declares Ir, rewrite the graphemes whose measured width disagrees with their cell width [4302,4433) 131 units sha256 d337243b393543e3b6e4d82dc58ad48d60e7ab44895b6f75657c9ada4b7bdc83
function Ir(e){let n="",r="",i=0;for(let{segment:o}of ra().segment(e)){r+=o;let s=ae(r),u=s-i;i=s,n+=u===_t(o)?o:"\uFFFD"}return n}

// chunk-bf3z2ftn.js declares wt, settle the text by rewriting it until every width agrees, or give up and fill it with replacement characters [4433,4599) 166 units sha256 82b8c60be5b442dd6876005df7e07f7a49883b1c64af791735086bc62146aa78
function wt(e){let n=e;for(let r=0;r<16;r++){if(bt(n))return n;let i=Ir(n);if(i===n)break;n=i}if(bt(n))return n;return[...ra().segment(n)].map(()=>"\uFFFD").join("")}

// chunk-bf3z2ftn.js declares Cr, take whole graphemes up to a character budget [4599,4706) 107 units sha256 9252ee5a7ab73a05cc522459ecd293f040456c7bd79f4f0eb04bb10cfea2b89c
function Cr(e,n){let r="";for(let{segment:i}of ra().segment(e)){if(r.length+i.length>n)break;r+=i}return r}

// chunk-bf3z2ftn.js declares vr, cut a line to the preview's character ceiling [4706,4737) 31 units sha256 94147fc846561fb9553bd2be188a668c154aaad3d47ed5c6685a1b43fc59a349
function vr(e){return Pt(e,kr)}

// chunk-bf3z2ftn.js declares Pt, the cut itself: whole graphemes where possible, otherwise a slice that never splits a surrogate pair [4737,4885) 148 units sha256 be7538ed83cd3b25dd7364a9266a8ff7fac5c02100566c0626109343bb923015
function Pt(e,n){let r=Cr(e,n);if(r.length>0)return r;let i=Math.min(n,e.length),o=e.charCodeAt(i-1);if(o>=55296&&o<=56319)i-=1;return e.slice(0,i)}

// chunk-bf3z2ftn.js declares the three preview budgets, the line budget being the square of the character ceiling [4885,4920) 35 units sha256 b71e9ac55aca7e930987779d18ec327ab56fb98c299ecce0cf8249021e93fd43
var Ar=4*ve*ve,qe=1024,Or=64*qe*qe;

// chunk-bf3z2ftn.js declares Lr, the grapheme-budget preview: per line, keep the ellipsised tail already there, settle the line within the line budget, else cut to the character budget, else collapse the line to a grapheme count [4920,5531) 611 units sha256 21a3d1548cdf8124b2f939ed1effc88261abf093bd59d0c0602d4298e417360e
function Lr(e){let n=Ar,r=Or,i=(o)=>[...ra().segment(o)].length;return e.split(`
`).map((o)=>{if(o==="")return o;if(/^\u2026 \[\+\d+ graphemes\]$/.test(o))return o;let s=o.match(/\u2026 \[\+\d+ graphemes\]$/),u=s?s[0]:"",d=s?o.slice(0,o.length-u.length):o,p=d.length>ve,h=p?vr(d):d,R=p?`\u2026 [+${i(d.slice(h.length))} graphemes]`:"",w=h.length+R.length+u.length,y=w*w;if(y<=n)return n-=y,wt(h)+R+u;let b=Pt(d,qe),v=b.length<d.length?`\u2026 [+${i(d.slice(b.length))} graphemes]`:"",C=b.length+v.length+u.length,P=C*C;if(b.length>0&&P<=r)return r-=P,wt(b)+v+u;return`\u2026 [+${i(d)} graphemes]`+u}).join(`
`)}

// chunk-bf3z2ftn.js declares Zs, the normalise pass with the preview on [5614,5645) 31 units sha256 b2fc5b7f050ff72a36ec7fe8074d35fe0beb7c4d677795e83230a948fba46f69
function Zs(e){return kt(e,!0)}

// chunk-bf3z2ftn.js declares kt, the fold: variation selectors dropped, controls, number-sign format characters and surrogate halves replaced, then the tab and ESC-sequence pass and the preview [5645,5792) 147 units sha256 b99bd99d3928f7686b50b8cf7b282be032c4eb30eb8da631f1a13d0534815cf2
function kt(e,n){let r="";for(let o of e){let s=o.codePointAt(0);if(_r(s))continue;r+=Et(s)||Rt(s)||Pr(s)?"\uFFFD":o}let i=Epe(r);return n?Lr(i):i}


export { nPe, mCo, Epe, gGn, gCo, ht, yt, mt, Et, Rt, _r, Pr, _t, ve, bt, Ir, wt, Cr, vr, Pt, qe, Lr, Zs, kt };
