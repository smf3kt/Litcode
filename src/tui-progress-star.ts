// @ts-nocheck
// Exact source bodies: research/ports/W44-progress-copies.json.
import {w} from "./tui-react-memo.js";
import {s,n} from "./tui-base-components.js";
import {qS} from "./tui-theme.js";
import {jsx as e} from "./tui-jsx.js";
import {HIe,MIe,SC,Uh,Sm,lS} from "./tui-progress-source.js";
import {bn} from "./tui-bundle-runtime.js";
const b = Symbol.for("react.memo_cache_sentinel");
var Hmt="\u25CF";
var M=2000;
var P={r:171,g:43,b:63};
var T={r:0,g:0,b:0};
function bie(ae){let a=w(35),{frame:le,messageColor:l,stalledIntensity:X,thinkingIntensity:Y,reducedMotion:Z,time:U}=ae,p=X===void 0?0:X,i=Y===void 0?0:Y,he=Z===void 0?!1:Z,de=U===void 0?0:U,m=qS();if(he){let u=1-MIe(de,M);let R=i>0?"warning":l;let B=m[R];let g;if(a[0]!==B||a[1]!==u||a[2]!==i){g=bn;Re:{let S=B?lS(B):null;if(S){let ce=Uh(S,T,0.5);let me=Uh(ce,S,SC(u));const r=e(n,{color:Sm(me),bold:i>=0.5,children:Hmt});let t;if(a[4]!==r)t=e(s,{"aria-hidden":!0,flexWrap:"wrap",height:1,width:2,children:r}),a[4]=r,a[5]=t;else t=a[5];g=t;break Re}}a[0]=B,a[1]=u,a[2]=i,a[3]=g}else g=a[3];if(g!==bn)return g;const r=u<0.5;const t=i>=0.5;let h;if(a[6]!==R||a[7]!==r||a[8]!==t)h=e(s,{"aria-hidden":!0,flexWrap:"wrap",height:1,width:2,children:e(n,{color:R,dimColor:r,bold:t,children:Hmt})}),a[6]=R,a[7]=r,a[8]=t,a[9]=h;else h=a[9];return h}let g;if(a[10]===b)g=HIe(),a[10]=g;else g=a[10];let q=g,o=q[le%q.length];if(p>0){let I=m[l];let r;if(a[11]!==I||a[12]!==o||a[13]!==p){r=bn;Be:{let z=I?lS(I):null;if(z){let ge=Uh(z,P,SC(p));const t=e(n,{color:Sm(ge),children:o});let h;if(a[15]!==t)h=e(s,{"aria-hidden":!0,flexWrap:"wrap",height:1,width:2,children:t}),a[15]=t,a[16]=h;else h=a[16];r=h;break Be}}a[11]=I,a[12]=o,a[13]=p,a[14]=r}else r=a[14];if(r!==bn)return r;let W=p>0.5?"error":l;let t;if(a[17]!==W||a[18]!==o)t=e(s,{"aria-hidden":!0,flexWrap:"wrap",height:1,width:2,children:e(n,{color:W,children:o})}),a[17]=W,a[18]=o,a[19]=t;else t=a[19];return t}if(i>0){let k=m[l];let y,r;if(a[20]!==k||a[21]!==o||a[22]!==m.warning||a[23]!==i){r=bn;Ie:{let E=k?lS(k):null;let _=lS(m.warning);y=i>=0.5;if(E&&_){let be=Uh(E,_,SC(i));const t=e(n,{bold:y,color:Sm(be),children:o});let h;if(a[26]!==t)h=e(s,{"aria-hidden":!0,flexWrap:"wrap",height:1,width:2,children:t}),a[26]=t,a[27]=h;else h=a[27];r=h;break Ie}}a[20]=k,a[21]=o,a[22]=m.warning,a[23]=i,a[24]=y,a[25]=r}else y=a[24],r=a[25];if(r!==bn)return r;let K=i>0.5?"warning":l;let t;if(a[28]!==y||a[29]!==K||a[30]!==o)t=e(s,{"aria-hidden":!0,flexWrap:"wrap",height:1,width:2,children:e(n,{bold:y,color:K,children:o})}),a[28]=y,a[29]=K,a[30]=o,a[31]=t;else t=a[31];return t}let r;if(a[32]!==l||a[33]!==o)r=e(s,{"aria-hidden":!0,flexWrap:"wrap",height:1,width:2,children:e(n,{color:l,children:o})}),a[32]=l,a[33]=o,a[34]=r;else r=a[34];return r}
export {bie};
