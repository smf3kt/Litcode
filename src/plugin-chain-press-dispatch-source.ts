// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { t } from './plugin-chain-host.js';
import { l, aP } from './plugin-chain-source.js';
import { P0 } from './plugin-chain-records.js';
import { AK, Yl } from './plugin-chain-press.js';
import { zd } from './plugin-chain-press-sites.js';
import { mxn } from './plugin-chain-press-url-source.js';

// chunk-n3ykh62m.js `Rf` — normalize an href for comparison [227274,227380) 106 units sha256 92c16e558727150c7aa94c336014fdf583bae7891de903717d538a77f9603fd5
function Rf(e){let r=/^www\./i.test(e)?`http://${e}`:mxn(e)??e;try{return new URL(r).href}catch{return r}}

// chunk-n3ykh62m.js `nur` — whether a link is one the drawing declared pressable [227380,227463) 83 units sha256 d3b58f21f4858e98e284deb2432a9ca2b63530ee6abcf8ffa11fe7ec5581017b
function nur(e,n){if(n===void 0)return!0;let r=Rf(e);return n.some((s)=>Rf(s)===r)}

// chunk-n3ykh62m.js `E_` — the ui.press argument [227463,227607) 144 units sha256 e9cb79b5082c5837c1a017b7e1ee550535e992e7595e73aa48693725ce07cb5c
var E_=(e,n,r)=>({plugin:e.plugin,element:e.element,component:e.component,requestId:e.requestId,surface:n,...r!==void 0&&{link:{href:r.href}}});

// chunk-n3ykh62m.js `Tf` — the ui.press site [227607,227629) 22 units sha256 335d93e0a3fe522f9c91b6db20b845ab7fdcc271517b20b3295510b28ba0db65
var Tf=zd["ui.press"];

// chunk-n3ykh62m.js `BPn` — dispatch one held press [229414,230142) 728 units sha256 5121d23fd321b3ffad999fe029b54b62e56b5cc49fa30968fdf0d6afa5af14c2
async function BPn({plugin:e,handle:n,element:r,surface:s,link:h}){let y=AK.heldPress(e,n,r),b=h===void 0?"Button":"Markdown";if(!(y!==void 0&&y.tag===b)){t(`ui.press: no ${b} of ${e} is held under handle ${n}${r!==void 0&&r!==""?" and the key the press names":""}; nothing ran`);return}if(h!==void 0&&!nur(h.href,y.pressableLinks)){t(`ui.press: the Markdown ${e} holds under handle ${n} names that link none of its own; nothing ran`);return}let T=E_(y,s,h),P=performance.now(),M=await aP({e:T,handlers:[...P0("ui.press"),Yl(y,"ui.press",(N)=>({element:N.element}))],site:Tf}),z=h===void 0?"":" (a link)";return t(`ui.press ${e}/${T.element}${z} in ${T.component} from ${s}: settled in ${(performance.now()-P).toFixed(1)}ms`),M}

// chunk-kjfwbh4w.js `TIe` — pressFromTerminal [24200,24313) 113 units sha256 0fd2acc3664734c7e8877c2fe6a325002e4a95623232f6c5bba3c4481a8d25aa
var TIe=(o,i)=>void Ohe(`ui.press ${o.plugin}`,BPn({plugin:o.plugin,handle:o.handle,surface:"terminal",link:i}));

// chunk-sfn1dbxq.js `Ohe` — settle a dispatch quietly, logging a rejection [2336117,2336190) 73 units sha256 eed33b01d62c60b95c38a36dbb82bf0e8ba41a4c142aa4a95f7823b458c7a463
var Ohe=(e,n)=>n.catch((r)=>{t(`${e}: ${l(r)}`,{level:"error"});return});


export { Rf, nur, E_, Tf, BPn, TIe, Ohe };
