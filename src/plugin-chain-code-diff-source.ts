// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-3qabb19b.js sha256 ceb8c8490f39408310286cc14cacb1998192c8c34a80724882f988431f1bf5f2
//   chunk-04m6g9sr.js sha256 f9592a99f1db870e5f9dd7a4b9c28fdf71d8b7450c6ad9a5dd2715a3b91f61bc
//   chunk-1r9zp6s1.js sha256 444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e
//   chunk-nnwag7zt.js sha256 63256421ad61e9dca4c0476f8a2bb02dd4da7d80dc56fab9d23a6d77c10a7c6f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { ge } from './tui-color.js';
import { Xe as e, Xe as r, w, s, s as ld, n, km } from './plugin-chain-react-surface.js';
import { ne } from './plugin-chain-source.js';
import { Mi, nt, Tj, hr, Qdn, Kl, CNo } from './plugin-chain-code-host.js';
import { Epe } from './plugin-chain-normalize-source.js';
import { ae } from './tui-render-host.js';
import { vu } from './tui-render-engine.js';
import { Int } from './plugin-chain-leaf-walkers.js';
import { Zoo } from './plugin-chain-diff-source.js';

// chunk-3qabb19b.js `uwe` — interleave a separator between hunks [615,673) 58 units sha256 c8943c1d39754eee22be2c889ba998320247a60f7a57b02ecfec2d074f1c2463
function uwe(n,e){return n.flatMap((r,t)=>t?[e(t),r]:[r])}

// chunk-04m6g9sr.js `ydn` — the longest line shown before it is truncated [1306,1319) 13 units sha256 e172f34f2de8c47be963a9169b533903b3acdeed619a6445e37f0be76ef77a35
var ydn=2000;

// chunk-04m6g9sr.js `DXe` — truncate a long line and count the characters dropped [1319,1486) 167 units sha256 45246a1be5182d489f44a3c4fa0c4caecb46288815f8ae6d34f4418374cae2cc
function DXe(e,n=0){if(e.length-n<=ydn)return{code:e.slice(n),truncatedChars:0};let t=e.slice(n,n+ydn+1),s=ne(t,ydn);return{code:s,truncatedChars:e.length-n-s.length}}

// chunk-04m6g9sr.js `dje` — the sentence that says how many characters were dropped [1486,1532) 46 units sha256 aa4dc5b55c31214a813e8b7984c08eb2f64a9b7fc8d4826fdf455943c8950655
function dje(e){return` \u2026 [+${e} chars]`}

// chunk-1r9zp6s1.js `uu` — a column that may reach the left edge of the screen [21431,21770) 339 units sha256 54ddbe2c1927c25432a332c7a12102815f168696b50cca2542e0bd78146af78a
function uu(o){let r=w(9),l,u,c;if(r[0]!==o)({children:u,fromLeftEdge:c,...l}=o),r[0]=o,r[1]=l,r[2]=u,r[3]=c;else l=r[1],u=r[2],c=r[3];const p=c?"stretch":void 0,m=c?"from-left-edge":!0;let C;if(r[4]!==l||r[5]!==u||r[6]!==p||r[7]!==m)C=e(ld,{alignSelf:p,...l,noSelect:m,children:u}),r[4]=l,r[5]=u,r[6]=p,r[7]=m,r[8]=C;else C=r[8];return C}

// chunk-1r9zp6s1.js `DIe` — pre-rendered lines drawn as one raw ANSI element [21770,22067) 297 units sha256 2b50f9eedc3d3c6b07748c35121c0994be2ffe3f5bedc3031947c66cb48583b1
function DIe(o){let u=w(6),{lines:r,width:l}=o;if(r.length===0){return null}let c;if(u[0]!==r)c=r.join(`
`),u[0]=r,u[1]=c;else c=u[1];let p;if(u[2]!==r.length||u[3]!==c||u[4]!==l)p=e("ink-raw-ansi",{rawText:c,rawWidth:l,rawHeight:r.length}),u[2]=r.length,u[3]=c,u[4]=l,u[5]=p;else p=u[5];return p}

// chunk-nnwag7zt.js `pe` — wrap one rendered line as a Box child [1319,1363) 44 units sha256 a57680294e11116e485fc9158f7806044378bb9acc6b288a66985aa503d1becd
function pe(m,x){return e(s,{children:m},x)}

// chunk-nnwag7zt.js `ie` — the share of changed characters above which a word diff is not drawn [1363,1374) 11 units sha256 0432205a507e33f60427c57a54dbfa2be5f201a1df1bdc8a1715647b1c9c5449
var ie=0.4;

// chunk-nnwag7zt.js `_` — draw a whole hunk without the structured diff [1374,1770) 396 units sha256 83fe29b1b92b690c903b48971c92c9841337c5e118e925bfb93208a481d1e656
function _(d){let c=w(10),{patch:i,dim:t,width:o}=d,[a]=hr(),l;if(c[0]!==t||c[1]!==i.lines||c[2]!==i.oldStart||c[3]!==a||c[4]!==o)l=U(i.lines,i.oldStart,o,t,a),c[0]=t,c[1]=i.lines,c[2]=i.oldStart,c[3]=a,c[4]=o,c[5]=l;else l=c[5];let f=l,u;if(c[6]!==f)u=f.map(pe),c[6]=f,c[7]=u;else u=c[7];let R;if(c[8]!==u)R=e(s,{flexDirection:"column",flexGrow:1,children:u}),c[8]=u,c[9]=R;else R=c[9];return R}

// chunk-nnwag7zt.js `fe` — read each hunk line's kind off its marker [1770,1967) 197 units sha256 047c0b89a1fbc5c840b1e8129f8f7d4239a6433d19764bb98830e81501764d92
function fe(d){return d.map((i)=>{let t=i.startsWith("+")?"add":i.startsWith("-")?"remove":"nochange",{code:o,truncatedChars:a}=DXe(i,1);return{code:o,i:0,type:t,originalCode:o,truncatedChars:a}})}

// chunk-nnwag7zt.js `le` — pair removed lines with the added lines that replaced them [1967,2507) 540 units sha256 83208166231bba2567ee71e70ad78c1d36485d6f973301705c8f2e2820446660
function le(d){let i=[],t=0;while(t<d.length){let o=d[t];if(!o){t++;continue}if(o.type==="remove"){let a=[o],c=t+1;while(c<d.length&&d[c]?.type==="remove"){let f=d[c];if(f)a.push(f);c++}let l=[];while(c<d.length&&d[c]?.type==="add"){let f=d[c];if(f)l.push(f);c++}if(a.length>0&&l.length>0){let f=Math.min(a.length,l.length);for(let u=0;u<f;u++){let R=a[u],m=l[u];if(R&&m)R.wordDiff=!0,m.wordDiff=!0,R.matchedLine=m,m.matchedLine=R}i.push(...a.filter(Boolean)),i.push(...l.filter(Boolean)),t=c}else i.push(o),t++}else i.push(o),t++}return i}

// chunk-nnwag7zt.js `ue` — the word diff between a removed and an added line [2507,2556) 49 units sha256 dc2679a00cec54c07c3ff638b936d3d6b6fd8a249ea6d285f6c6349ae694fbeb
function ue(d,i){return Zoo(d,i,{ignoreCase:!1})}

// chunk-nnwag7zt.js `he` — draw one word-diffed line [2556,4173) 1617 units sha256 6742176bd9c7ccb261918ae4b268d4c6dd5e0d4a65bbae842ed12ad8b5bd050d
function he(d,i,t,o,a){let{type:c,i:l,wordDiff:f,matchedLine:u,originalCode:R}=d;if(!f||!u)return null;let m=c==="remove"?R:u.originalCode,x=c==="remove"?u.originalCode:R,b=ue(m,x),M=m.length+x.length;if(b.filter((h)=>h.added||h.removed).reduce((h,H)=>h+H.value.length,0)/M>ie||o)return null;let T=c==="add"?"+":"-",v=T.length,g=Math.max(1,i-t-1-v),C=[],L=[],D=0;if(b.forEach((h,H)=>{let S=!1,P;if(c==="add"){if(h.added)S=!0,P="diffAddedWord";else if(!h.removed)S=!0}else if(c==="remove"){if(h.removed)S=!0,P="diffRemovedWord";else if(!h.added)S=!0}if(!S)return;vu(h.value,g,"wrap").split(`
`).forEach((E,B)=>{if(!E)return;if(B>0||D+ae(E)>g){if(L.length>0)C.push({content:[...L],contentWidth:D}),L=[],D=0}L.push(e(n,{backgroundColor:P,children:E},`part-${H}-${B}`)),D+=ae(E)})}),L.length>0)C.push({content:L,contentWidth:D});let k=d.truncatedChars>0?dje(d.truncatedChars):"",y=-1;if(k&&C.length>0){if(C.at(-1).contentWidth+ae(k)>g)C.push({content:[],contentWidth:0});y=C.length-1}return C.map(({content:h,contentWidth:H},S)=>{let P=`${c}-${l}-${S}`,O=c==="add"?o?"diffAddedDimmed":"diffAdded":o?"diffRemovedDimmed":"diffRemoved",A=S===0?l:void 0,E=(A!==void 0?A.toString().padStart(t):" ".repeat(t))+" ",B=S===y?k:"",j=E.length+v+H+ae(B),re=Math.max(0,i-j);return r(s,{flexDirection:"row",children:[e(uu,{fromLeftEdge:!0,children:r(n,{color:a?"text":void 0,backgroundColor:O,dimColor:o,children:[E,T]})}),e(n,{color:a?"text":void 0,backgroundColor:O,dimColor:o,children:h}),B?e(n,{dimColor:!0,children:B}):null,e(n,{"aria-hidden":!0,color:a?"text":void 0,backgroundColor:O,dimColor:o,children:" ".repeat(re)})]},P)})}

// chunk-nnwag7zt.js `U` — lay out a hunk: line numbers, markers and the wrapped text [4173,5319) 1146 units sha256 da9d93b72aeaa03a57fe8c4a20a5af5f74933046466f70a8f30979c28eb317a5
function U(d,i,t,o,a){let c=Math.max(1,Math.floor(t)),l=fe(d),f=le(l),u=me(f,i),R=Math.max(...u.map(({i:x})=>x),0),m=Math.max(R.toString().length+1,0);return u.flatMap((x)=>{let{type:b,code:M,i:W,wordDiff:p,matchedLine:T}=x;if(p&&T){let y=he(x,c,m,o,a);if(y!==null)return y}let v=2,g=Math.max(1,c-m-1-v),L=vu(M,g,"wrap").split(`
`),D=x.truncatedChars>0?dje(x.truncatedChars):"",k=-1;if(D&&L.length>0){let y=L.at(-1);if(ae(y)+ae(D)>g)L.push("");k=L.length-1}return L.map((y,h)=>{let H=`${b}-${W}-${h}`,S=h===0?W:void 0,P=(S!==void 0?S.toString().padStart(m):" ".repeat(m))+" ",O=b==="add"?"+":b==="remove"?"-":" ",A=h===k?D:"",E=P.length+1+ae(y)+ae(A),B=Math.max(0,c-E),j=b==="add"?o?"diffAddedDimmed":"diffAdded":b==="remove"?o?"diffRemovedDimmed":"diffRemoved":void 0;return r(s,{flexDirection:"row",children:[e(uu,{fromLeftEdge:!0,children:r(n,{color:a?"text":void 0,backgroundColor:j,dimColor:o||b==="nochange",children:[P,O]})}),e(n,{color:a?"text":void 0,backgroundColor:j,dimColor:o,children:y}),A?e(n,{dimColor:!0,children:A}):null,e(n,{"aria-hidden":!0,color:a?"text":void 0,backgroundColor:j,dimColor:o,children:" ".repeat(B)})]},H)})})}

// chunk-nnwag7zt.js `me` — number the hunk lines, keeping removed lines on one number [5319,5892) 573 units sha256 38815bacd33ef217549a095b7eb1ee7518a9a576274aa6ee1b993bf4a1f4146e
function me(d,i){let t=i,o=[],a=[...d];while(a.length>0){let c=a.shift(),{code:l,type:f,originalCode:u,truncatedChars:R,wordDiff:m,matchedLine:x}=c,b={code:l,type:f,i:t,originalCode:u,truncatedChars:R,wordDiff:m,matchedLine:x};switch(f){case"nochange":t++,o.push(b);break;case"add":t++,o.push(b);break;case"remove":{o.push(b);let M=0;while(a[0]?.type==="remove"){t++;let W=a.shift(),{code:p,type:T,originalCode:v,truncatedChars:g,wordDiff:C,matchedLine:L}=W,D={code:p,type:T,i:t,originalCode:v,truncatedChars:g,wordDiff:C,matchedLine:L};o.push(D),M++}t-=M;break}}}return o}

// chunk-nnwag7zt.js `oe` — the six theme slots a structured diff reads [5892,5999) 107 units sha256 041ce1c76fe0cb9e86e35a64f0b3b6eacace7a35052af1cfd5493754503cb0a5
var oe=["diffAdded","diffRemoved","diffAddedDimmed","diffRemovedDimmed","diffAddedWord","diffRemovedWord"];

// chunk-nnwag7zt.js `X` — pick the theme slots a structured diff was given [5999,6097) 98 units sha256 bda3afee2882a898b09bd5c1a7a84eccb90ef033e4ee4271d6d24b3299293973
function X(d){if(!d)return;let i;for(let t of oe){let o=d[t];if(o!==void 0)i??={},i[t]=o}return i}

// chunk-nnwag7zt.js `I` — the structured diff, cached by file, width and theme [6097,6598) 501 units sha256 63a421ce0f2e69c874fb78ea01bb6a630778a465ab908018d993033181a218da
function I(d,i,t,o,a,c,l,f,u,R){let m=CNo();if(!m)return null;let x=R?Int(i):0,b=x>0&&x<f?x:0,M=l?oe.map((C)=>l[C]??"").join(","):"",W=`${c}|${M}|${f}|${u?1:0}|${b}|${ge.level}|${t??""}|${o}`,p=d.get(i),T=p?.get(W);if(T)return T;let v=new m(i,t,o,a),g;if(b>0){let{gutters:C,contents:L}=v.renderSplit(c,f,u,l);g={split:!0,gutterWidth:b,gutters:C,contents:L}}else{let C=v.render(c,f,u,l);if(C===null)return null;g={split:!1,lines:C}}if(!p)p=new Map,d.set(i,p);if(p.size>=4)p.clear();return p.set(W,g),g}

// chunk-nnwag7zt.js `ee` — expand tabs in every line of a hunk before layout [6598,6736) 138 units sha256 338175fefdaea719dd581628c8554b10b4695869543a9ef6e9c5ad7622b3b3a9
function ee(d){if(!d.lines.some((t)=>t.includes("\t")))return d;let i=d.lines.map((t)=>t.slice(0,1)+Epe(t.slice(1)));return{...d,lines:i}}

// chunk-nnwag7zt.js `H4` — one hunk: structured when the highlighter answers, the plain layout otherwise [6736,7825) 1089 units sha256 f1738d52e1b06d322bc75afc488f8a2250afc2bd7d3e191577f830053a6a665c
var H4=km(function(i){let p=w(19),{patch:t,dim:o,filePath:a,firstLine:c,fileContent:l,width:f,skipHighlighting:u}=i,R=u===void 0?!1:u,[m]=hr(),x=X(Qdn()),M=Kl().syntaxHighlightingDisabled??!1,W=nt(),T;if(p[0]!==W||p[1]!==t)T=W?ee(t):t,p[0]=W,p[1]=t,p[2]=T;else T=p[2];let v=T,g=Math.max(1,Math.floor(f)),C=Mi(),{structuredDiff:L}=Tj(),D=R||M||W?null:I(L,t,c,a,l??null,m,x,g,o,C);if(!D){const k=W?f-1:f;let y;if(p[3]!==o||p[4]!==v||p[5]!==k)y=e(s,{children:e(_,{patch:v,dim:o,width:k})}),p[3]=o,p[4]=v,p[5]=k,p[6]=y;else y=p[6];return y}if(D.split){let{gutterWidth:h,gutters:H,contents:S}=D;let k;if(p[7]!==h||p[8]!==H)k=e(uu,{fromLeftEdge:!0,flexShrink:0,children:e(DIe,{lines:H,width:h})}),p[7]=h,p[8]=H,p[9]=k;else k=p[9];const y=g-h;let P;if(p[10]!==S||p[11]!==y)P=e(DIe,{lines:S,width:y}),p[10]=S,p[11]=y,p[12]=P;else P=p[12];let O;if(p[13]!==k||p[14]!==P)O=r(s,{flexDirection:"row",children:[k,P]}),p[13]=k,p[14]=P,p[15]=O;else O=p[15];return O}let k;if(p[16]!==D.lines||p[17]!==g)k=e(s,{children:e(DIe,{lines:D.lines,width:g})}),p[16]=D.lines,p[17]=g,p[18]=k;else k=p[18];return k});

// chunk-nnwag7zt.js `tq` — the Code block's diff renderer [7825,8131) 306 units sha256 cef8af363134f63381c5a9994202499d83ede23ece6f957a6f053259c550694b
function tq({hunks:d,dim:i,width:t,filePath:o,firstLine:a,fileContent:c}){return uwe(d.map((l,f)=>e(s,{flexDirection:"column",children:e(H4,{patch:l,dim:i,width:t,filePath:o,firstLine:a,fileContent:c})},`hunk-${f}`)),(l)=>e(uu,{fromLeftEdge:!0,children:e(n,{dimColor:!0,children:"..."})},`ellipsis-${l}`))}


export { uu, DIe, ydn, DXe, dje, uwe, H4, tq };
