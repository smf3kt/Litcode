// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The three site leaves whose dependencies are all inside the product (W45-65): the Client, the
// Markdown with its pressable-link list check, and the Link with the href encoder beside it.
//
// Three blocks, 2,785 units, 7 statements of chunk-n3ykh62m.js. Every name they reach is imported
// rather than copied: `L` from the chain-runner copy, `cN`/`cQt`/`sQt` from the W45-64 style-prop
// copy, `QT` from the W45-58 blit copy, `EVe`/`XPn`/`QAe`/`ace`/`IL` from the W45-62 leaf-problem
// copy, `wVe`/`xAt`/`ZAe` from the W45-63 site-leaf copy, and `hf` from the W45-42 host-call copy —
// the name this package was waiting on since W45-63.
import { L } from './plugin-chain-source.js';
import { cN, cQt, sQt } from './plugin-chain-style-props-source.js';
import { QT } from './plugin-chain-ui-blit-source.js';
import { ace, EVe, IL, QAe, XPn } from './plugin-chain-raster-sites-source.js';
import { wVe, xAt, ZAe } from './plugin-chain-site-leaves-source.js';
import { hf } from './plugin-chain-host-call-source.js';

// chunk-n3ykh62m.js `Mto`, the Client leaf: key and module, a prop-bag that goes through the value budget, three numbers that go through the prop rules, a required stamp, and no children [235982,236808) 826 units sha256 c47ff34f4ca813a45f59f228e1920be7241acfc82401957a3c946f189abc2759
function Mto(e){let{props:n,client:r}=e;if(!(L(n)&&typeof n.key==="string"&&n.key!==""&&typeof n.module==="string"&&n.module!==""&&QAe(n,["key","module","props","width","height","flexGrow"])))return"Client props must be { key, module }, both non-empty strings, and any of props, width, height, flexGrow";let{key:h}=n,y=XPn(["key","module"],n);if(y!==void 0)return`Client "${h}" ${y}`;let w=n.props!==void 0?cQt(n.props):void 0;if(w!==void 0)return`Client "${h}" props ${w}`;for(let T of["width","height","flexGrow"]){let P=n[T];if(P===void 0)continue;let z=typeof P==="number"||typeof P==="string"?sQt(T,P):"must be a number or a string";if(z!==void 0)return`Client "${h}" ${T} ${z}`}if(!EVe(r))return`Client "${h}" is not stamped by a plugin of this chain`;return e.children===void 0?void 0:`Client "${h}" takes no children`}

// chunk-n3ykh62m.js `Lrt` (2048) and `pur` (256), the Link href and pressable-link limits, then `zto`, the pressable-links list check, and `Vto`, the Markdown leaf that calls it [247312,248693) 1381 units sha256 275e4505b5fea33c9a032c1326a99fa4ad7c906e6f1b89366ecf735f243bf78c
var Lrt=2048;var pur=256;function zto(e){if(e===void 0)return;if(!Array.isArray(e))return`pressableLinks is ${cN(e)}, not a list of hrefs`;if(e.length>pur)return`pressableLinks names more than ${pur} links`;for(let n of e){if(typeof n!=="string"||n==="")return`pressableLinks holds ${cN(n)}, not an href`;if(n.length>Lrt)return`pressableLinks holds an href longer than ${Lrt} characters`;if(QT(n))return"pressableLinks holds an href with a control character"}return}function Vto(e){let{props:n,press:r,children:s}=e;if(!(L(n)&&QAe(n,["key","text","dimColor","pressableLinks"])))return"Markdown props must be { text }, a string, key a string, dimColor a boolean and pressableLinks a list of hrefs";if(s!==void 0)return"Markdown takes no children";let{key:y,text:b,dimColor:w,pressableLinks:R}=n;if(typeof b!=="string")return"Markdown text must be a string";if((y===void 0?void 0:xAt(y))!==void 0)return`Markdown key "${IL(y)}" is not a usable address`;let P=y===void 0?"Markdown":`Markdown "${IL(y)}"`,M=ace("text",b)??zto(R);if(M!==void 0)return`${P} ${M}`;if(w!==void 0&&typeof w!=="boolean")return`${P} dimColor is a boolean or absent`;if(r===void 0)return R!==void 0?`${P} names pressableLinks but answers no press (onLinkPress)`:void 0;let z=wVe(r);if(z!==void 0)return`${P} ${z}`;return y!==void 0?void 0:"Markdown answers its links (onLinkPress) but has no key, its address"}

// chunk-n3ykh62m.js `Nrt`, the href encoder that repairs lone surrogates before percent-encoding, and `sno`, the Link leaf that measures the href as written and as encoded [260226,260804) 578 units sha256 5811eb034475059a1280ca6422a02e7b46e95ca83041c0a8ce3c7fa56989dd9d
var Nrt=(e)=>e.replace(/[^ -~]/gu,(n)=>encodeURIComponent(hf(n)));function sno(e){let{props:n}=e;if(!L(n))return"Link props must be { href }";let{href:r,label:s,...h}=n,[y]=Object.keys(h);if(y!==void 0)return`Link prop "${y}" is not allowed`;if(ZAe(r)&&(r.length>Lrt||Nrt(r).length>Lrt))return`Link href longer than ${Lrt} characters as written`;if(s!==void 0&&typeof s!=="string")return"Link label must be a string";if(s?.trim()==="")return"Link label is blank (leave it out to draw the URL)";return QT(s??"")?"Link label holds a control character (an escape sequence)":void 0}


export { Mto, Lrt, pur, zto, Vto, Nrt, sno };
