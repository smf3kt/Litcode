// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
//   chunk-t175a0ke.js sha256 743ee68151cc52a1f5f56c3651071b4c6a0ab41f84954ddbea0c145fef56e0e8
//   chunk-tvdq3hrk.js sha256 d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5
//   chunk-ed7zyzrn.js sha256 4754249b16c2900a23735b1a90afb10583cde0e9c816f3d46b2c13c33fbfc2c7
//   chunk-zf8k2z6n.js sha256 d3477e51bfc1e8466543153a59429d8dd473c35ab45b6b137ae0df67ad70c5fa
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The render-key layer is copied verbatim from the extracted bundle; these imports are the
// product seams it reads: the React seam's store hook, the shared source base (the store
// factory, its key builder and the JSON id), the render-version stores the notify fold already
// carries, the hooks-registry query, the loaded-module gate, the registry itself, the matcher
// library, and the one hash helper the memo table uses.
import { createHash as r } from 'node:crypto';
import { qt } from './plugin-chain-react-hooks.js';
import { Ge, bs, er } from './plugin-chain-source.js';
import { OL, jf, Rc, Of } from './plugin-chain-notify-fold-source.js';
import { jDe, kro } from './plugin-chain-records.js';
import { Jl } from './plugin-chain-relay-source.js';
import { it } from './plugin-chain-host.js';
import { b } from './plugin-chain-matchers.js';

// chunk-n3ykh62m.js `vA` — the render event name, `ui.render` [230241,230260) 19 units sha256 77249665e984ef6a39d5e60a301ec6cf33fa1839ed1fe1c5fa57dab9e8d72424
var vA="ui.render";

// chunk-n3ykh62m.js `rur`/`WPn`/`SVe` — match a loading module by event and component, the modules that hook the event, and their names [230295,230559) 264 units sha256 40ab9a29233eeec30f631cb52c08eda08b7983377a465fe3b774c7672fb027e4
var rur=(e,n)=>Array.isArray(e)?e.some((r)=>rur(r,n)):blt(e,"surface",n.surface)&&blt(e,"component",n.component)&&blt(e,"requestId",n.requestId);var WPn=(e)=>it().loadedModules.filter((n)=>n.hooks(vA)&&rur(n.matcherFor(vA),e));var SVe=(e)=>WPn(e).map((n)=>n.name);

// chunk-n3ykh62m.js `GPn` — the hooks that hook the render event and match one component [231248,231336) 88 units sha256 acc68cb656cfad998edf6e40de9f9b4f88fe754536feb33130744216d1d91aa2
var GPn=(e,n)=>jDe(vA,n,{e}).filter((r)=>blt(r.matcherFor(vA),"component",e.component));

// chunk-n3ykh62m.js `sur`/`iur` — whether props hold a position or offset, and whether a drawn value draws anything (a Box/Text/Link, recursively) [238618,238917) 299 units sha256 81447d13a8ddd473d3e8a15be0ffe34cd8add7dc43a8797fda915120bb6bb409
function sur(e){return e!==void 0&&Object.keys(e).some((n)=>n==="position"||olt.has(n))}function iur(e){if(typeof e==="string"||e.type==="engine")return!1;if(!(e.type==="Box"||e.type==="Text"||e.type==="Link"))return!1;return e.type==="Box"&&(sur(e.props)||sur(e.hover))||(e.children??[]).some(iur)}

// chunk-n3ykh62m.js `wc` — bump one store key [271971,272059) 88 units sha256 66a9275891aba4545713d41996bd2057435dbaa8d5a98bb3b1b60aa79ef48f8e
function wc(e){OL().setState((n)=>{let r=new Map(n);return r.set(e,(n.get(e)??0)+1),r})}

// chunk-n3ykh62m.js `kc`/`wH`/`kH`/`xc` — the live-key suffix and the steady/live key choice [272105,272197) 92 units sha256 8b6cf12ac21f0aca600b5c3497b85f493cd88bcd61d9e9736eda463e9ca5cb7f
var kc=" live";var wH=(e)=>e.endsWith(kc);var kH=(e)=>e+kc;var xc=(e,n)=>n==="live"?kH(e):e;

// chunk-n3ykh62m.js `Rb` — whether a store key is a version key [272964,272991) 27 units sha256 c7a7918dec7ed26f16f60777e88f0830ffec5e17f644fe92a5b3b4cf52cd58ee
var Rb=(e)=>e.endsWith(Rc);

// chunk-n3ykh62m.js `oIn` — the viewport store key, `ui.render viewport` [273333,273358) 25 units sha256 045541a9e6504dc03472ad29eabbfde73a7bb330cd05092496059e4c83ac259e
var oIn=`${vA} viewport`;

// chunk-n3ykh62m.js `Tc` — the render version: the event counter and every key’s version, or the whole visible map when the key list is absent [273378,273603) 225 units sha256 a75e563131a89889c458a141f2bcc5741313581a0bc90d4af01521fde226a8bd
function Tc(e,n,r="steady"){if(n===void 0){let h="";for(let[y,b]of e)if(y!==oIn&&!wH(y)&&!Rb(y))h+=`${y}\x00${b}\x00`;return h}let s=String(e.get(vA)??0);for(let h of n){let y=e.get(xc(h,r))??0;s+=`\x00${h}\x00${y}`}return s}

// chunk-n3ykh62m.js `$H` — suffix a drawing key with its version [273714,273791) 77 units sha256 344ba36e55de7b562d8814f6a20e5fc76f423bda9fd46997a79ac7f3bb26ec46
function $H(e,n,r){let s=n.get(jf(r));return s===void 0?e:`${e}\x00\x00${s}`}

// chunk-n3ykh62m.js `MF` — the render key: surface, component and request id [273934,273997) 63 units sha256 003356e9922f81e229412cba73c694e97e35d6b27982ccc061532457a02173e3
var MF=(e)=>`${e.surface}\x00${e.component}\x00${e.requestId}`;

// chunk-n3ykh62m.js `s_` — the registry’s plugin state [273997,274025) 28 units sha256 cdedf15b4f7eb535a9eb4fe5539863bb9038f3f5849f3fe7973724683f71eefa
var s_=()=>it().pluginState;

// chunk-n3ykh62m.js `hno`/`yno`/`mIn`/`kVe` — the memoized JSON id, the props key (viewport columns, fullscreen, props) and the render key with its version [284410,284770) 360 units sha256 7701701a7051a814a9416661298555e77391ff3548baf3cd5efcc0a0b7637179
function hno(){let e=new WeakMap;return(n)=>{let r=e.get(n);if(r!==void 0)return r;let s=at(er(n));return e.set(n,s),s}}var yno=hno();var mIn=(e)=>[e.viewport?.columns??"",e.viewport?.isFullscreen??"",yno(e.props)].join("\x00");var Nur=(e,n,r)=>e.settled!==void 0&&e.propsKey===n&&e.versions===OL()&&e.version===r;var kVe=(e,n)=>$H(Tc(e,SVe(n),Of(n)),e,MF(n));

// chunk-n3ykh62m.js `$ur` — the on-screen range a drawing reported, or null [284974,285279) 305 units sha256 56d57b080a1c4f8f11891730cb7f94939af8e9d6d6af8ed8790250c9291fe6ca
function $ur(e){let n=Object.hasOwn(e.props,"onScreen")?e.props.onScreen:void 0,r=typeof n==="object"?n:void 0,s=r&&"first"in r?r.first:null,h=r&&"last"in r?r.last:null,y=r&&"of"in r?r.of:null;return typeof s==="number"&&typeof h==="number"&&typeof y==="number"?{first:s,last:h,of:y}:n===null?null:void 0}

// chunk-n3ykh62m.js `Frt`/`LAt` — whether any loaded module hooks the render event, and whether one hooks it and matches this component [308406,308573) 167 units sha256 5d2546c2207a35db33ae6d233f57bd171a0bd100c8147aecd9246279d7f7ebe2
var Frt=(e)=>Jl(vA,e===void 0?void 0:{component:e});var LAt=(e)=>it().loadedModules.some((n)=>n.hooks(vA)&&blt(n.matcherFor(vA),"component",e.component)&&kro(n,vA,e));

// chunk-nyce03br.js `olt` — the offset prop names (top, left, right, bottom) [2766,2815) 49 units sha256 88c3633b9085741880764e6c932d63e4dc0369805da6d3dbf2f02d0b4d4d4b8b
var olt=new Set(["top","left","right","bottom"]);

// chunk-nyce03br.js `j3e` — the message types a site answers [6172,6303) 131 units sha256 63c9ea5ca919ca9fd6d6bb1cb2859f89203dd3deb231c0e7c88ff052ebcc4455
var j3e=new Set(["UserMessage","AssistantMessage","ToolUse","ToolResult","ToolGroup","CommandOutput","TurnDuration","InfoNotice"]);

// chunk-nyce03br.js `Ioe` — the engine sentinel the glue draws when a render failed [25632,25662) 30 units sha256 23c6112f555c9b5f112b7c21dd076f7f3675ff9dacf846d0ece1ba0fb3c3877a
var Ioe={type:"engine",ref:0};

// chunk-t175a0ke.js `Omt` — the static-frame store [961,976) 15 units sha256 502e08507f1ca178ee6c982cf17eb5cd5b65a6653fdd871d658f3c4d427d767d
var Omt=qt(!1);

// chunk-tvdq3hrk.js `l9` — the viewport store [7979,8014) 35 units sha256 8f5e96ecf9f3ab4e10ed7f8688dce0d024642012c83aafa9741ef77fe40b0880
var l9=Ge(bs(),(e)=>e.set(void 0));

// chunk-ed7zyzrn.js `blt` — one matcher field check [8524,8564) 40 units sha256 8636b6eec45222996eea7dc61cb21fb74824cb5c33f283a45017c68fcbf02930
var blt=(o,t,r)=>b(o,{field:t,value:r});

// chunk-zf8k2z6n.js `eA`/`at` — the sha256 shape and the sha256 id the props memo uses [651,891) 240 units sha256 56588a89aa5cb712ddae2cae10f46b0a8a906b457c8cc1221ae6d1be476be537
var eA=/^[0-9a-f]{64}$/;function at(e){if(typeof e!=="string"&&!ArrayBuffer.isView(e))throw Object.assign(TypeError("sha256Hex: the data is neither text nor bytes"),{code:"ERR_INVALID_ARG_TYPE"});return r("sha256").update(e).digest("hex")}



export { vA, rur, WPn, SVe, GPn, sur, iur, wc, kc, wH, kH, xc, Rb, oIn, Tc, $H, MF, s_, hno, yno, mIn, kVe, $ur, Frt, LAt, j3e, Ioe, Omt, l9, blt, eA, at, olt };
