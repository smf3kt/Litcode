// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-vew7ssxx.js sha256 ce2d686ede9289202e527ee56f06d3dfec2da22ae3ae301cf4ada6c158dd8994
//   chunk-f7x3yeg4.js sha256 130b182b2a3b0637c3894917f00b96f593b73e16913f474ed37ae37287b7240f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { w, b, Xe as e, Xe as r, s, n } from './plugin-chain-react-hooks.js';
import { ia, nt } from './diff-dialog-spinner-anim-source.js';
import { HIe } from './diff-dialog-spinner-frames-source.js';
import { bg, Wo } from './diff-dialog-spinner-host.js';

// chunk-vew7ssxx.js Mr: a spinner symbol followed by the message and an optional dim subtitle [2002,2510) 508 units sha256 5765fd3a7b69fe2839d4335d7ccb0c9e1e320b8cedba5c464157ae881e0af928
function Mr(a){let i=w(10),{message:f,bold:t,dimColor:S,subtitle:m}=a,d=t===void 0?!1:t,u=S===void 0?!1:S,x;if(i[0]===b)x=e(ui,{}),i[0]=x;else x=i[0];let l;if(i[1]!==d||i[2]!==u||i[3]!==f)l=r(s,{flexDirection:"row",children:[x,r(n,{bold:d,dimColor:u,children:[" ",f]})]}),i[1]=d,i[2]=u,i[3]=f,i[4]=l;else l=i[4];let c;if(i[5]!==m)c=m&&e(n,{dimColor:!0,children:m}),i[5]=m,i[6]=c;else c=i[6];let p;if(i[7]!==l||i[8]!==c)p=r(s,{flexDirection:"column",children:[l,c]}),i[7]=l,i[8]=c,i[9]=p;else p=i[9];return p}

// chunk-f7x3yeg4.js ui: the spinner — a static dot under reduced motion or a screen reader, otherwise the frame at the 120 ms quantum [26148,26747) 599 units sha256 d4f107d9829f0fc844a867c08b6002319bf906c23da20a25ccae0a4f457a8be8
function ui(){let c=w(9),l=nt(),t=bg(Wo(mr))||l,[m,o]=ia(t?null:120);if(t){let g;if(c[0]===b)g=e(n,{color:"text",children:"\u25CF"}),c[0]=g;else g=c[0];let h;if(c[1]!==m)h=e(s,{ref:m,"aria-hidden":!0,flexWrap:"wrap",height:1,width:2,children:g}),c[1]=m,c[2]=h;else h=c[2];return h}let g;if(c[3]===b)g=HIe(),c[3]=g;else g=c[3];let C=g,B=Math.floor(o/120)%C.length;const h=C[B];let _;if(c[4]!==h)_=e(n,{color:"text",children:h}),c[4]=h,c[5]=_;else _=c[5];let E;if(c[6]!==m||c[7]!==_)E=e(s,{ref:m,"aria-hidden":!0,flexWrap:"wrap",height:1,width:2,children:_}),c[6]=m,c[7]=_,c[8]=E;else E=c[8];return E}

// chunk-f7x3yeg4.js mr: the reduced-motion selector the spinner feeds to the app-state reader [20212,20266) 54 units sha256 f100014bae50f521d4f20bb470b8d4c132a3c09672437605069787d5ffc59542
function mr(L){return L.settings.prefersReducedMotion}


export { Mr, ui, mr };
