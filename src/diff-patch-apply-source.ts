// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-f606a53w.js sha256 dd0a1dc61be769e7ea2ec7f4345b3b4f88996150d4d219b8ada90f03e89dd033
//   chunk-kcwp0ct0.js sha256 6e2a2f6d72577f973cdd9fa83e5b5801f6b05499f69792052b6070b20cb91bda
//   chunk-r2vtj1kh.js sha256 2b13302b83beea3fe54e83316b9d855c43e2298af6d0041b009cec563bbc1515
//   chunk-4qh9ecjv.js sha256 4e74c1bc713fb8237e118b58ce45ca1e1acd52ec22238268e0c270db3fca0999
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { t6 } from './diff-patch-core-source.js';

// chunk-f606a53w.js HN: each leading tab replaced by exactly two spaces [7703,7802) 99 units sha256 b23ca733c5b3a66a3f7bd6d6127d1f3eec7051452786079c0be887eb5d53437b
function HN(e){if(!e.includes("\t"))return e;return e.replace(/^\t+/gm,(n)=>"  ".repeat(n.length))}

// chunk-kcwp0ct0.js Ee/ke: the ampersand and dollar sentinel literals [14131,14186) 55 units sha256 e95e782d257330ae8947ff5f83323bc1b7b9ac1e427d420771976cd58278f488
var Ee="<<:AMPERSAND_TOKEN:>>",ke="<<:DOLLAR_TOKEN:>>";

// chunk-kcwp0ct0.js V: sentinel escaping [14186,14247) 61 units sha256 5365788aa5383a798b7178c8d0617813e08b65b9658f3eb3d61b67d37b18c1b8
function V(e){return e.replaceAll("&",Ee).replaceAll("$",ke)}

// chunk-kcwp0ct0.js Te: sentinel restoration [14247,14309) 62 units sha256 5b7e9f9da5acad8e69f4e47848fa16dedf590582788ab07444b8ccf3895426d2
function Te(e){return e.replaceAll(Ee,"&").replaceAll(ke,"$")}

// chunk-kcwp0ct0.js ckt/ucr: hunk context 3 and the 5000 ms diff timeout [14004,14023) 19 units sha256 f650e6d89d31c8f9de6cdf1cc87131f522d9946dc67dc14ddf21ce5774b328ba
var ckt=3,ucr=5000;

// chunk-kcwp0ct0.js Fle: post-effect structured patch between two known contents [14673,15003) 330 units sha256 f154280236f29aca51f62918bd756569c8bfc23ea102296de60883e9ff7792aa
function Fle({filePath:e,oldContent:n,newContent:r,ignoreWhitespace:s=!1,singleHunk:a=!1,convertTabs:h=!1,rawText:f=!1}){let S=f?(y)=>y:h?(y)=>V(HN(y)):V,w=t6(e,e,S(n),S(r),void 0,void 0,{ignoreWhitespace:s,context:a?1e5:ckt,timeout:ucr});if(!w)return[];if(f)return w.hunks;return w.hunks.map((y)=>({...y,lines:y.lines.map(Te)}))}

// chunk-kcwp0ct0.js yK: patch for a list of applied string edits [15003,15409) 406 units sha256 f8400f932c7780cc3e4569e66c6412e19d35c864a290baf853200d0e1e3e9f2a
function yK({filePath:e,fileContents:n,edits:r,ignoreWhitespace:s=!1}){let a=V(HN(n)),h=t6(e,e,a,r.reduce((f,S)=>{let{old_string:w,new_string:y}=S,b="replace_all"in S?S.replace_all:!1,P=V(HN(w)),v=V(HN(y));if(b)return f.replaceAll(P,()=>v);else return f.replace(P,()=>v)},a),void 0,void 0,{context:ckt,ignoreWhitespace:s,timeout:ucr});if(!h)return[];return h.hunks.map((f)=>({...f,lines:f.lines.map(Te)}))}

// chunk-r2vtj1kh.js L8: FileStateError [166481,166556) 75 units sha256 3389113f06e2c64a43de6fe6df84663c72c7787cf169219e9faf527d9b3e1b6a
class L8 extends Error{constructor(e){super(e);this.name="FileStateError"}}

// chunk-4qh9ecjv.js Q: literal replacement, with the trailing-newline consumption rule [5505,5685) 180 units sha256 548f90351df4dfca6d06049ec5bf1950cc2c4a47023bd5b0cb5b9427025f79d4
function Q(e,n,r,i=!1){let s=i?(a,c,u)=>a.replaceAll(c,()=>u):(a,c,u)=>a.replace(c,()=>u);if(r!=="")return s(e,n,r);return!n.endsWith(`
`)&&e.includes(n+`
`)?s(e,n+`
`,r):s(e,n,r)}

// chunk-4qh9ecjv.js S: the empty-file empty-to-empty edit [6122,6220) 98 units sha256 76a7f94404ff8074d644e6ecf86b99f0d053231a9146234e75cb277b393fa35e
function S(e,n){return!e&&n.length===1&&n[0]!==void 0&&n[0].old_string===""&&n[0].new_string===""}

// chunk-4qh9ecjv.js F: sequential edit application with overlap and no-op rejection [6220,6734) 514 units sha256 f9a1f0b9e80ef915095ea87b6d929c23d45cde0f3f44291192e79505ba8180d0
function F(e,n){if(S(e,n))return"";let r=e,i=[];for(let s of n){let o=s.old_string.replace(/\n+$/,"");for(let c of i)if(o!==""&&c.includes(o))throw Error("Cannot edit file: old_string is a substring of a new_string from a previous edit.");let a=r;if(r=s.old_string===""?s.new_string:Q(r,s.old_string,s.new_string,s.replace_all),r===a)throw new L8("String not found in file. Failed to apply edit.");i.push(s.new_string)}if(r===e)throw Error("Original and edited file match exactly. Failed to apply edit.");return r}

// chunk-4qh9ecjv.js BQr: apply edits and return the updated file plus its patch [5857,6122) 265 units sha256 9edf3945b406fd79f26479a985863ced556edcac77ed36a25e20cb58c1454fe8
function BQr({filePath:e,fileContents:n,edits:r}){if(S(n,r))return{patch:yK({filePath:e,fileContents:n,edits:[{old_string:n,new_string:n,replace_all:!1}]}),updatedFile:""};let i=F(n,r);return{patch:Fle({filePath:e,oldContent:HN(n),newContent:HN(i)}),updatedFile:i}}

// chunk-4qh9ecjv.js P3t: single old/new string edit [5685,5857) 172 units sha256 28ba9ce96173c93d3188778f8c00e14e8756a13fffc705ba80bb68458fd683b5
function P3t({filePath:e,fileContents:n,oldString:r,newString:i,replaceAll:s=!1}){return BQr({filePath:e,fileContents:n,edits:[{old_string:r,new_string:i,replace_all:s}]})}


export { HN, Ee, ke, V, Te, ckt, ucr, Fle, yK, L8, Q, S, F, BQr, P3t };
