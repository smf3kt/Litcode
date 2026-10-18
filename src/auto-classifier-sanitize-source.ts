// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-ax7r0qj7.js sha256 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e
//   chunk-ts42ykgs.js sha256 d8b5f9ef6550b5e71556d694a6f054baf30aaaedd82983b1c169c3b3523eed33
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
let N0t, b, DW, Qtr;

// chunk-ax7r0qj7.js escape pattern [677,739) 62 units sha256 6afca7885a6d64046cc2b6c86cedc7bee37203f59d18f398a0f74f34ada81a19
function gl(t){return t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}

// chunk-ts42ykgs.js delimiter tables [24502,25269) 767 units sha256 8d4c4eabfa4cb8c2db5640c6748b4fe7a7731bb2ccdfec7a47497af7f00e3d10
var RAr="\\u00ad\\u034f\\u0600-\\u0605\\u061c\\u06dd\\u070f\\u0890\\u0891\\u08e2\\u115f\\u1160\\u17b4\\u17b5\\u180b-\\u180f\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u206f\\u3164\\ufe00-\\ufe0f\\ufeff\\uffa0\\ufff0-\\ufffb\\u{110bd}\\u{110cd}\\u{13430}-\\u{1343f}\\u{1bca0}-\\u{1bca3}\\u{1d173}-\\u{1d17a}\\u{16fe4}\\u{e0000}-\\u{e0fff}",C={"\uFF1C":"<","\uFF1E":">","\uFE64":"<","\uFE65":">","\u2329":"<","\u232A":">","\u27E8":"<","\u27E9":">","\u3008":"<","\u3009":">","\u2039":"<","\u203A":">","\u02C2":"<","\u02C3":">","\u1438":"<","\u1433":">","\u276C":"<","\u276D":">","\u276E":"<","\u276F":">","\u2770":"<","\u2771":">","\u29FC":"<","\u29FD":">","\u226E":"<","\u226F":">","\u227A":"<","\u227B":">","\u22D6":"<","\u22D7":">","\uFF0F":"/","\u2215":"/","\u2044":"/"}

// chunk-ts42ykgs.js delimiter alphabet [25697,25716) 19 units sha256 8ba04288b8e55ac7ee1396eb169f367ee7ef255885664ac4e1c3759c34b9e1d7
N0t="A-Za-z0-9_\\-"

// chunk-ts42ykgs.js delimiter forms [26112,26431) 319 units sha256 df8be1668f2b44e97b00befea5dd0ceba213a545106d14611d797b9c78c8b133
b=(()=>{let u={"<":"<",">":">","/":"/"};for(let[e,d]of Object.entries(C))u[d]+=e;return{open:u["<"],close:u[">"],slash:u["/"],filler:`^${N0t}${u["<"]}${u[">"]}`,lookalikePattern:new RegExp(`[${Object.keys(C).join("")}]`,"g"),invisiblePattern:new RegExp(`[${RAr}]`,"gu")}})(),DW={open:b.open,close:b.close,slash:b.slash}

// chunk-sfn1dbxq.js normalization and framing [134392,134912) 520 units sha256 184fea2b2aa3e9fda0f4507376ec109e60fd274de07c4ff585c5ea5b476b1446
Qtr=/\r\n?|[\u001c-\u001e\u2028\u2029\u0085\v\f]/g;function qGe(e){return e.replace(Qtr,`
`)}var o6t=/[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu,{open:Flt,close:$lt,slash:LUn}=DW;function VD(e,n){return n.replace(o6t,"").replace(new RegExp(`[${Flt}]([\\s${LUn}]*${gl(e)}\\b(?:[^${Flt}${$lt}]*[${$lt}])?)`,"gi"),(r,s)=>"["+s)}var YD="forwarded_user_turns",Zw="forwarded_turn",FUn=["transcript",YD,Zw];function vC(e){let n=e;for(let r of FUn)n=VD(r,n);return n}function gm(e){return"  "+vC(qGe(e)).split(`
`).join(`
  `)}

// chunk-sfn1dbxq.js call ID sanitizer [1068070,1068144) 74 units sha256 aa33f3694a150c020650f533691e52623487aa159de220b82a88e6a77a3a8995
function Cue(e){return String(e).slice(-6).replace(/[^A-Za-z0-9_-]/g,"_")}

// chunk-sfn1dbxq.js line-break JSON escape [1068263,1068388) 125 units sha256 9e03e5e86d0c61fa7d0fd110affd6a0f776ccfd4299dae9f8b32f3ad2fe31300
var Ruo=/[\u2028\u2029\u0085]/g;function ZL(e){return e.replace(Ruo,(n)=>"\\u"+n.charCodeAt(0).toString(16).padStart(4,"0"))}


export { vC, gm, ZL, Cue };
