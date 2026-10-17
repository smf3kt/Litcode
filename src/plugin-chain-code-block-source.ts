// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-yfhs3yf4.js sha256 6ffe40814d515224c1fdcdc6ad4d4eb83fde964dc3364a61eb99c6b2d5c9ea6e
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { extname as bt } from 'node:path';
import { Xe as e, Xe as r, P, R, w, y, n as Do, n, s, km } from './plugin-chain-react-surface.js';
import { b, bn } from './tui-bundle-runtime.js';
import { MXe } from './tui-highlight-cache.js';
import { RU } from './tui-component-host.js';
import { kAe } from './tui-highlight-manager.js';
import { hr, Tj, Mi, Kl, Ys, rDr } from './plugin-chain-code-host.js';
import { pn, Lt } from './tui-markdown-host.js';
import { HN } from './plugin-chain-leaf-walkers.js';
import { ge } from './tui-color.js';
import { t } from './plugin-chain-host.js';
import { ydn, DXe, dje, uu } from './plugin-chain-code-diff-source.js';

// chunk-yfhs3yf4.js `j` — split a source into lines and remember where each was truncated [1765,1972) 207 units sha256 4726e25b84c0d189e4bed01ea1488380429c89913db18c342ed9a8549f1547e4
function j(l){let a=new Map;if(l.length<=ydn)return{text:l,markers:a};return{text:l.split(`
`).map((d,o)=>{let{code:m,truncatedChars:c}=DXe(d);if(c>0)return a.set(o,dje(c)),m;return d}).join(`
`),markers:a}}

// chunk-yfhs3yf4.js `H` — append the truncation marker to the line it belongs to [1972,2093) 121 units sha256 b2c0d05fcc09bab3b8467b47991ba5088b49370a06238de781dd41b75986d01b
function H(l,a){if(a.size===0)return l;return l.split(`
`).map((i,u)=>{let d=a.get(u);return d?i+ge.dim(d):i}).join(`
`)}

// chunk-yfhs3yf4.js `B` — draw a whole source: highlight it, or the uncoloured text when the terminal skips colour [2093,2778) 685 units sha256 cf597910e6039bd023a1e90469ae8248b27da2840afce68e5c37cb88277aeee5
function B(l){let c=w(16),{code:a,filePath:i,dim:u,skipColoring:d}=l,o=u===void 0?!1:u,m=d===void 0?!1:d,g,h;if(c[0]!==a||c[1]!==o||c[2]!==m){h=bn;ce:{g=HN(a);if(m){let{text:x,markers:_}=j(g);const C=e(Do,{children:H(x,_)});let W;if(c[5]!==o||c[6]!==C)W=e(n,{dimColor:o,children:C}),c[5]=o,c[6]=C,c[7]=W;else W=c[7];h=W;break ce}}c[0]=a,c[1]=o,c[2]=m,c[3]=g,c[4]=h}else g=c[3],h=c[4];if(h!==bn)return h;let C;if(c[8]!==i)C=bt(i).slice(1),c[8]=i,c[9]=C;else C=c[9];let p=C,W;if(c[10]!==g||c[11]!==p)W=e(nt,{codeWithSpaces:g,language:p}),c[10]=g,c[11]=p,c[12]=W;else W=c[12];let _t;if(c[13]!==o||c[14]!==W)_t=e(n,{dimColor:o,children:W}),c[13]=o,c[14]=W,c[15]=_t;else _t=c[15];return _t}

// chunk-yfhs3yf4.js `nt` — highlight one source through the render cache, falling back to markdown [2778,3503) 725 units sha256 d7c8e9c5db18d4fcd68bb138fa899345d3fdb8f5dff531847413f574f502c1c6
function nt(l){let u=w(7),{codeWithSpaces:a,language:i}=l,d;if(u[0]===b)d=RU(),u[0]=d;else d=u[0];let o=d,{highlightedCode:m}=Tj(),c=kAe.pluginGrammarGeneration,g;if(u[1]!==a||u[2]!==m||u[3]!==i){ce:{let{text:h,markers:x}=j(a);let _="markdown";if(i){if(o.supportsLanguage(i))_=i;else t(`Language not supported while highlighting code, falling back to markdown: ${i}`)};try{g=H(MXe(m,o,h,_),x)}catch(C){let W=C;if(W instanceof Error&&W.message.includes("Unknown language")){g=(t(`Language not supported while highlighting code, falling back to markdown: ${W}`),H(MXe(m,o,h,"markdown"),x));break ce}g=H(h,x)}}u[1]=a,u[2]=m,u[3]=i,u[4]=g}else g=u[4];let p=g,C;if(u[5]!==p)C=e(Do,{children:p}),u[5]=p,u[6]=C;else C=u[6];return C}

// chunk-yfhs3yf4.js `he` — wrap one line of a rendered source as Text [3503,3568) 65 units sha256 812f86fbdc03c5173cffe4145934a083f75bc5066578c6a69e6f3b1fe59c78ad
function he(ke,xe){return e(n,{children:e(Do,{children:ke})},xe)}

// chunk-yfhs3yf4.js `Wt` and `Ob` — the default width and the Code block renderer [3568,5882) 2314 units sha256 4a6d5d6dce96f96dc9ffe4640b8b4806df1a6add252e388fc2863dad0d061570
var Wt=80,Ob=km(function(a){let L=w(40),{code:i,filePath:u,width:d,dim:o,startLine:m,lineNumbers:c}=a,g=o===void 0?!1:o,h=m===void 0?1:m,x=c===void 0?!0:c,_=R(null),[C,W]=y(Wt),ce=d||C,[p]=hr(),v=Kl().syntaxHighlightingDisabled??!1,O;if(L[0]!==i||L[1]!==u||L[2]!==v){Ye:{if(v){O=null;break Ye}let $t=rDr();if(!$t){O=null;break Ye}O=new $t(HN(i),u)}L[0]=i,L[1]=u,L[2]=v,L[3]=O}else O=L[3];let A=O,vt,It;if(L[4]!==d)vt=()=>{if(!d&&_.current){let{width:Tt}=Ys(_.current);if(Tt>0)W(Tt-2)}},It=[d],L[4]=d,L[5]=vt,L[6]=It;else vt=L[5],It=L[6];P(vt,It);let zt;if(L[7]!==i)zt=K(i),L[7]=i,L[8]=zt;else zt=L[8];let fe=String(zt).length+2,ut;Ze:{if(!x||h===1){ut=null;break Ze}let Ot=K(i);let Q=String(h+Ot-1).length;const M=Math.max(0,Q-String(Ot).length);let f;if(L[9]!==Q||L[10]!==M)f={digits:Q,extraCols:M},L[9]=Q,L[10]=M,L[11]=f;else f=L[11];ut=f}let mt=ut,pe=Mi()||h!==1,M;ei:{if(A===null){M=null;break ei}let I=ce-(mt?.extraCols??0)+(x?0:fe);if(x&&!pe){let f;if(L[12]!==A||L[13]!==I||L[14]!==g||L[15]!==p)f=A.render(p,I,g)??[],L[12]=A,L[13]=I,L[14]=g,L[15]=p,L[16]=f;else f=L[16];let G;if(L[17]!==f)G={split:!1,lines:f},L[17]=f,L[18]=G;else G=L[18];M=G;break ei}let f;if(L[19]!==A||L[20]!==I||L[21]!==g||L[22]!==p)f=A.renderSplit(p,I,g),L[19]=A,L[20]=I,L[21]=g,L[22]=p,L[23]=f;else f=L[23];let{gutters:ht,contents:ct}=f;let G;if(L[24]!==ct||L[25]!==ht)G={split:!0,gutters:ht,contents:ct},L[24]=ct,L[25]=ht,L[26]=G;else G=L[26];M=G}let k=M,f;ii:{if(mt===null||k===null||!k.split){f=null;break ii}let{digits:V}=mt;let G;if(L[27]!==V||L[28]!==k.gutters||L[29]!==h){let ft=h;G=k.gutters.map((be)=>{if(pn(be).trim()===""){return" ".repeat(V+2)}let ye=ft;return ft=ft+1,` ${String(ye).padStart(V)} `});L[27]=V,L[28]=k.gutters,L[29]=h,L[30]=G}else G=L[30];f=G}let pt=f,G;if(L[31]!==i||L[32]!==g||L[33]!==pt||L[34]!==u||L[35]!==x||L[36]!==k||L[37]!==h||L[38]!==v)G=e(s,{ref:_,children:k?e(s,{flexDirection:"column",children:k.split?k.contents.map((Xt,Y)=>!x?e(n,{children:e(Do,{children:Xt})},Y):e(gt,{gutter:k.gutters[Y],content:Xt,displayGutter:pt?.[Y]},Y)):k.lines.map(he)}):r(s,{flexDirection:"column",children:[x&&h!==1&&r(n,{dimColor:!0,children:["\u2026 from line ",h]}),e(B,{code:i,filePath:u,dim:g,skipColoring:v})]})}),L[31]=i,L[32]=g,L[33]=pt,L[34]=u,L[35]=x,L[36]=k,L[37]=h,L[38]=v,L[39]=G;else G=L[39];return G});

// chunk-yfhs3yf4.js `K` — how many lines a source holds, without counting the final newline [5882,5943) 61 units sha256 f009c19da25e01f66effeb606e6ce2f94251738aedcf1804ff5e5781ff718bb8
function K(l){let a=Lt(l,`
`)+1;return l.endsWith(`
`)?a-1:a}

// chunk-yfhs3yf4.js `gt` — one source line beside its gutter [5943,6371) 428 units sha256 6fe6ade999f581ae5e29a7f55fb198367eb0a0f78ada5870a2209d2b4a25f04f
function gt(l){let d=w(8),{gutter:a,content:i,displayGutter:u}=l,o;if(d[0]!==u||d[1]!==a)o=e(uu,{fromLeftEdge:!0,children:u===void 0?e(n,{children:e(Do,{children:a})}):e(n,{dimColor:!0,children:u})}),d[0]=u,d[1]=a,d[2]=o;else o=d[2];let m;if(d[3]!==i)m=e(n,{children:e(Do,{children:i})}),d[3]=i,d[4]=m;else m=d[4];let c;if(d[5]!==o||d[6]!==m)c=r(s,{flexDirection:"row",children:[o,m]}),d[5]=o,d[6]=m,d[7]=c;else c=d[7];return c}


export { Ob, B, nt };
