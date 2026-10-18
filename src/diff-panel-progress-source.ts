// @ts-nocheck
// Exact source bodies, copied verbatim. Provenance: ./diff-panel-progress-source-blocks.json.
// Modules:
//   chunk-fa626f29.js sha256 763b38096458e635d9287ed2de76d0582c01411968fb91a37ae6c95aaedf3536
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { w, Xe as e, Xe as r, n, earlyReturn as bn } from './plugin-chain-react-hooks.js';
import { vi } from './tui-render-host.js';
var Nx={hasGeometricShapesInkBleedBug:()=>false};

// chunk-fa626f29.js IT progress bar and glyph geometry [896,2048) 1152 units sha256 87e49d81b5f23fc510bd47bd28b43b4a838d591932b06c0ec4c1e603fde0326b
var s=[" ","\u258F","\u258E","\u258D","\u258C","\u258B","\u258A","\u2589","\u2588"],I={fill:"\u25B0",empty:"\u25B1"},E={fill:"\u2588",empty:"\u2591"},_=()=>Nx.hasGeometricShapesInkBleedBug()?E:I,g=(a)=>Math.min(1,Math.max(0,a)),k=(a,t)=>{let o=Math.floor(a*t),l=[vi(s.at(-1),o)];if(o<t){let i=a*t-o,p=Math.floor(i*(s.length-1));l.push(s[p]);let m=t-o-1;if(m>0)l.push(s[0].repeat(m))}return l.join("")};function IT(a){let T=w(17),{ratio:t,width:o,fillColor:l,emptyColor:i,variant:p}=a,m=p===void 0?"block":p,f,c,h,u,y,P;if(T[0]!==i||T[1]!==l||T[2]!==t||T[3]!==m||T[4]!==o){P=bn;z:{let b=g(t);if(m==="pill"){let{fill:x,empty:A}=_();let B=Math.round(b*o);P=r(n,{children:[e(n,{color:l,children:vi(x,B)}),e(n,{color:i,dimColor:i===void 0,children:vi(A,o-B)})]});break z}f=n;c=l;h=i;u=`${Math.round(b*100)}%`;y=k(b,o)}T[0]=i,T[1]=l,T[2]=t,T[3]=m,T[4]=o,T[5]=f,T[6]=c,T[7]=h,T[8]=u,T[9]=y,T[10]=P}else f=T[5],c=T[6],h=T[7],u=T[8],y=T[9],P=T[10];if(P!==bn)return P;let G;if(T[11]!==f||T[12]!==c||T[13]!==h||T[14]!==u||T[15]!==y)G=e(f,{color:c,backgroundColor:h,"aria-label":u,children:y}),T[11]=f,T[12]=c,T[13]=h,T[14]=u,T[15]=y,T[16]=G;else G=T[16];return G}


export { IT };
