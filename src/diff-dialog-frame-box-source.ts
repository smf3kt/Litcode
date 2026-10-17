// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-h26phfc2.js sha256 1b48814a9bfc2f0af73eeae96ec1ab540ad25e51c0f042beef0255089e86d4fd
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { w, b, Xe as e, Xe as r, s } from './plugin-chain-react-hooks.js';
import { nl } from './diff-dialog-tabs-source.js';
import { Ol } from './diff-dialog-detail-source.js';

// chunk-h26phfc2.js Jw/QP/xG padding constants and es: the dialog border, straight through when no viewport is mounted, otherwise the bordered column with its padding and divider [849,1339) 490 units sha256 52ca5b5c9fd85a587fb5dfe1a15ef3d344ff2f905feec9050ce6f5d7d4b6a620
var Jw=2,QP=1,xG=2;function es(d){let c=w(9),{children:t,color:i}=d;if(nl()){let o;if(c[0]!==t)o=e(s,{flexDirection:"column",paddingX:QP,flexShrink:0,children:t}),c[0]=t,c[1]=o;else o=c[1];return o}let o;if(c[2]!==i)o=e(Ol,{color:i}),c[2]=i,c[3]=o;else o=c[3];let n;if(c[4]!==t)n=e(s,{flexDirection:"column",paddingX:Jw,children:t}),c[4]=t,c[5]=n;else n=c[5];let l;if(c[6]!==o||c[7]!==n)l=r(s,{flexDirection:"column",paddingTop:1,children:[o,n]}),c[6]=o,c[7]=n,c[8]=l;else l=c[8];return l}



export { es, Jw, QP, xG };
