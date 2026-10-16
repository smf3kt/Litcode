// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-3cynezh1.js sha256 c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The settings merge layer: the lodash `mergeWith` a settings read folds its sources with, and
// the customizer `Y3` that decides what "merge" means per key — `modelPicker` normalizes, array
// fields replace (`fallbackModel`) or concatenate-and-dedupe, `extraKnownMarketplaces` and
// `managedMcpServers` take a one-level override, and every other key falls through to lodash.
// The closure is 49 lodash-merge statements plus `CHt`/`Y3`/`ic`, 52 statements and 4,033 units,
// all in chunk-3cynezh1.js at measured ranges (the 60k-line chunk whose top-level map cannot be
// walked reliably — the W45-51 limitation).
//
// Every helper the merge internals close over is already in the product: the dedupe `D` and the
// plain-object test `L` from ./plugin-chain-source.js and ./plugin-chain-store-carry-source.js,
// the lodash internals from ./plugin-chain-lodash-internals-source.js (whose plan this package
// extends with `Lxr`, the `baseEach` the merge walks collections with, and with the exports the
// closure reads), and the memoize/internals helpers from ./plugin-chain-memoize-source.js and
// ./plugin-chain-lodash-memoize-source.js (whose plan this package extends with `e1e`/`don`/`e8e`).
//
// Port: the bundle wraps this lodash module in CommonJS, so the preamble below reads the module
// namespace object as `Rn` (declared by the copied statement at [340392,340402)) and a second
// module reference the minifier left free as `Cn`. `Cn` has no declaration anywhere in the chunk,
// so the bundle takes the same false arm an ESM copy does: `fl`, `qm` and `hl` stay undefined and
// `yl` — the safe-allocation helper — is undefined with them. The declaration below makes that
// free name explicit rather than inventing a branch. Recorded in the W45-55 package record.
import { D } from './plugin-chain-source.js';
import { L } from './plugin-chain-store-carry-source.js';
import { A1e, D8e, L8e, Lxr, U8e, YMt, Zon, k1e, nsn, osn, pG, wwe, zZ, zw } from './plugin-chain-lodash-internals-source.js';
import { Hwe, TDt, _U, aA, nie } from './plugin-chain-memoize-source.js';
import { don, e8e, e1e } from './plugin-chain-lodash-memoize-source.js';
var Cn = undefined;

// chunk-3cynezh1.js declares Xm (80 units) [340302,340382) 80 units sha256 b7078bd8e7791af927b53e2c1cbd8deccc496a28c750e5ff0e3bd5909d48bdb7
function Xm(e,n,s){if(s!==void 0&&!Hwe(e[n],s)||s===void 0&&!(n in e))zZ(e,n,s)}

// chunk-3cynezh1.js declares Ht (10 units) [340382,340392) 10 units sha256 9c803ffba3c0b30dc1baaa435e31d45e7900ed19a1cdaf7cd658d9f8158b2848
var Ht=Xm;

// chunk-3cynezh1.js declares Rn (10 units) [340392,340402) 10 units sha256 a26efa93178dbe8496c03539bbb252ab04666d3aa7e4cd918a4fd5ad6979fc45
var Rn={};

// chunk-3cynezh1.js declares _l,fl,qm,hl,yl (172 units) [340426,340598) 172 units sha256 359e0786ca5e4d4270e12dc79a0fedd6aab60b3810c761457779c05fa4098c09
var _l=typeof Rn=="object"&&Rn&&!Rn.nodeType&&Rn,fl=_l&&typeof Cn=="object"&&Cn&&!Cn.nodeType&&Cn,qm=fl&&fl.exports===_l,hl=qm?_U.Buffer:void 0,yl=hl?hl.allocUnsafe:void 0;

// chunk-3cynezh1.js declares Zm (105 units) [340598,340703) 105 units sha256 5a27773d45deabed6ec0be99e110c1802a3144a918409239a15c66421564f088
function Zm(e,n){if(n)return e.slice();var s=e.length,r=yl?yl(s):new e.constructor(s);return e.copy(r),r}

// chunk-3cynezh1.js declares Kt (10 units) [340703,340713) 10 units sha256 7689edfb583646cfa8f8536d30232c1d87b5875933ad028332f66b07357bbc6c
var Kt=Zm;

// chunk-3cynezh1.js declares Qm (89 units) [340713,340802) 89 units sha256 1fe06800c462ff83bb48e38f522cd5fd9f75b84ecd193486d01bc2cc5bfe0dcc
function Qm(e){var n=new e.constructor(e.byteLength);return new Zon(n).set(new Zon(e)),n}

// chunk-3cynezh1.js declares Et (10 units) [340802,340812) 10 units sha256 22bb13c0789ea70301cacca64263f9a539f3396e8acfa4e6aaa4e78437e7df75
var Et=Qm;

// chunk-3cynezh1.js declares ef (97 units) [340812,340909) 97 units sha256 483f2f46a6ab207e418ab9b9bdc7e8bdbf2621948207c22c387707dd810ab489
function ef(e,n){var s=n?Et(e.buffer):e.buffer;return new e.constructor(s,e.byteOffset,e.length)}

// chunk-3cynezh1.js declares Tn (10 units) [340909,340919) 10 units sha256 723369829b790c1e7b0da140053dafad1e6ccbe8f8e0b0f1cb621440d499ba83
var Tn=ef;

// chunk-3cynezh1.js declares tf (84 units) [340919,341003) 84 units sha256 bf3f7e4ffe5053c03868e6902a7da54b1552e853859fe1d09d0f19b51cd11107
function tf(e,n){var s=-1,r=e.length;n||(n=Array(r));while(++s<r)n[s]=e[s];return n}

// chunk-3cynezh1.js declares Pn (10 units) [341003,341013) 10 units sha256 eb93765080048320ef97250104ab45b4284377465d523a174fc44fa793313845
var Pn=tf;

// chunk-3cynezh1.js declares Sl,nf,bl (170 units) [341013,341183) 170 units sha256 92a70bc08262aa323e614e09367d4cf49dedb7f652f06858e9c89967125d06f8
var Sl=Object.create,nf=function(){function e(){}return function(n){if(!aA(n))return{};if(Sl)return Sl(n);e.prototype=n;var s=new e;return e.prototype=void 0,s}}(),bl=nf;

// chunk-3cynezh1.js declares of (78 units) [341183,341261) 78 units sha256 7ab942b617fed090b4bdb57b1e79591e7be7ff67f8523a0c088c4d54ad0c9b2f
function of(e){return typeof e.constructor=="function"&&!YMt(e)?bl(don(e)):{}}

// chunk-3cynezh1.js declares xn (10 units) [341261,341271) 10 units sha256 de5d1eb0b27760678be57efd16243ef6d41310a85993d49fab7212a7410dbb33
var xn=of;

// chunk-3cynezh1.js declares sf (36 units) [341271,341307) 36 units sha256 2f9c025523f64a90d3d703beeab31f364ee6630f3fffe7afe20ac580b267c3a0
function sf(e){return pG(e)&&wwe(e)}

// chunk-3cynezh1.js declares El (10 units) [341307,341317) 10 units sha256 b9b337bba1516861fa3663caba7d0e6f769e772230b1ee4c537ef461c23ded4c
var El=sf;

// chunk-3cynezh1.js declares rf,af,df,wl,cf,uf (122 units) [341317,341439) 122 units sha256 ea67b9e804ac61400048996cc97f2727e381cebf1fb357141d589c2691afa88f
var rf="[object Object]",af=Function.prototype,df=Object.prototype,wl=af.toString,cf=df.hasOwnProperty,uf=wl.call(Object);

// chunk-3cynezh1.js declares pf (186 units) [341439,341625) 186 units sha256 55e4879ecbaa7d7ac4f9d281426ed33da838789ce6e56c29972f07904822d829
function pf(e){if(!pG(e)||nie(e)!=rf)return!1;var n=don(e);if(n===null)return!0;var s=cf.call(n,"constructor")&&n.constructor;return typeof s=="function"&&s instanceof s&&wl.call(s)==uf}

// chunk-3cynezh1.js declares Zue (11 units) [341625,341636) 11 units sha256 a0304a8dd50c9ec25031f5998ff7a43e13aa8ca743d2553bdc5e9803eca70f9e
var Zue=pf;

// chunk-3cynezh1.js declares gf (108 units) [341636,341744) 108 units sha256 bd4159d7ae70d3c59650c6e17b60d38308df8108dd534a83f75f45a8f9dee455
function gf(e,n){if(n==="constructor"&&typeof e[n]==="function")return;if(n=="__proto__")return;return e[n]}

// chunk-3cynezh1.js declares jt (10 units) [341744,341754) 10 units sha256 e1449993c32f2988aa59bd342798b34d3be1763ea6c64d94296f8971b5e49a80
var jt=gf;

// chunk-3cynezh1.js declares mf (175 units) [341754,341929) 175 units sha256 1d4f855f7d767f96c9c201b5d3b1f6bab5695acf1d97641bb27146eaf37d7aab
function mf(e,n,s,r){var i=!s;s||(s={});var d=-1,c=n.length;while(++d<c){var g=n[d],m=r?r(s[g],e[g],g,s,e):void 0;if(m===void 0)m=e[g];if(i)zZ(s,g,m);else e8e(s,g,m)}return s}

// chunk-3cynezh1.js declares Ie (10 units) [341929,341939) 10 units sha256 267dfbf116900cf6cf1ccda9a70f4abe0734e0b6f779beeaa5c8d952a6d19da6
var Ie=mf;

// chunk-3cynezh1.js declares hf (35 units) [341939,341974) 35 units sha256 262d8d1991ad5fcb8c8c402ea60c00252487ba986bd5dcf6b6b2918ab139baa8
function hf(e){return Ie(e,e1e(e))}

// chunk-3cynezh1.js declares kl (10 units) [341974,341984) 10 units sha256 f1ddd7fcfdae49f2497b105ded18d7cefe8912f628642827ccc28d835be67774
var kl=hf;

// chunk-3cynezh1.js declares yf (429 units) [341984,342413) 429 units sha256 8b8655d9bfd68426488d447a7da53d8cc9377168248daa3aab6d8fdda01b9ded
function yf(e,n,s,r,i,d,c){var g=jt(e,s),m=jt(n,s),f=c.get(m);if(f){Ht(e,s,f);return}var h=d?d(g,m,s+"",e,n,c):void 0,y=h===void 0;if(y){var S=zw(m),b=!S&&A1e(m),k=!S&&!b&&nsn(m);if(h=m,S||b||k)if(zw(g))h=g;else if(El(g))h=Pn(g);else if(b)y=!1,h=Kt(m,!0);else if(k)y=!1,h=Tn(m,!0);else h=[];else if(Zue(m)||D8e(m)){if(h=g,D8e(g))h=kl(g);else if(!aA(g)||TDt(g))h=xn(m)}else y=!1}if(y)c.set(m,h),i(h,m,r,d,c),c.delete(m);Ht(e,s,h)}

// chunk-3cynezh1.js declares vl (10 units) [342413,342423) 10 units sha256 228088c023652db9926d87ac49bcc12a2ce522939bdcc941eb36b4d5a45b921c
var vl=yf;

// chunk-3cynezh1.js declares Al (181 units) [342423,342604) 181 units sha256 5f4c7756069dec2f23a3ace75fdbf4384d4343e0dc406f82969cb5ff74269704
function Al(e,n,s,r,i){if(e===n)return;Lxr(n,function(d,c){if(i||(i=new k1e),aA(d))vl(e,n,c,s,Al,r,i);else{var g=r?r(jt(e,c),d,c+"",e,n,i):void 0;if(g===void 0)g=d;Ht(e,c,g)}},e1e)}

// chunk-3cynezh1.js declares Cl (10 units) [342604,342614) 10 units sha256 4a090ca430ba03a46b501e81e61423142690467dc81d205cd4a622bde6e8802a
var Cl=Al;

// chunk-3cynezh1.js declares _f (182 units) [342614,342796) 182 units sha256 b2f23a8ecdc3092693d0db64c117c758de0b3c71d2d4723509cfe7e8e655d810
function _f(e,n,s){switch(s.length){case 0:return e.call(n);case 1:return e.call(n,s[0]);case 2:return e.call(n,s[0],s[1]);case 3:return e.call(n,s[0],s[1],s[2])}return e.apply(n,s)}

// chunk-3cynezh1.js declares Rl (10 units) [342796,342806) 10 units sha256 95725e3e61136dd70d7c5ba0159fa6eae10a6bfd5abf5b8c1f5d89b324acb59c
var Rl=_f;

// chunk-3cynezh1.js declares Ol (16 units) [342806,342822) 16 units sha256 1b54adc5ba1376969155744ebdec9e8099e784aa1ee4b9faaa300b9e20dc0021
var Ol=Math.max;

// chunk-3cynezh1.js declares Sf (219 units) [342822,343041) 219 units sha256 2c569cef9b300b6bd70111045dbd237ccb3c2fa49cbb61c46f9d52377c2e0638
function Sf(e,n,s){return n=Ol(n===void 0?e.length-1:n,0),function(){var r=arguments,i=-1,d=Ol(r.length-n,0),c=Array(d);while(++i<d)c[i]=r[n+i];i=-1;var g=Array(n+1);while(++i<n)g[i]=r[i];return g[n]=s(c),Rl(e,this,g)}}

// chunk-3cynezh1.js declares Mn (10 units) [343041,343051) 10 units sha256 471eb4a927026718fcf418bd68587833e636de8ec096cce83ea43c3b64cc212b
var Mn=Sf;

// chunk-3cynezh1.js declares bf (43 units) [343051,343094) 43 units sha256 8429cf6e3e43ed2f988a789a77dd0b62e2bdf475ee8768a398b2596ec77fe32a
function bf(e){return function(){return e}}

// chunk-3cynezh1.js declares Tl (10 units) [343094,343104) 10 units sha256 7d28c6b53941b74b5dccd050fc618ce951a978de06e093c3ce3b96c0cfe99d4c
var Tl=bf;

// chunk-3cynezh1.js declares Ef,Pl (118 units) [343104,343222) 118 units sha256 a8842c6b7871dd3e626b9d397de7482e6813f9ed9718ac02e6c449f68fa0cc0c
var Ef=!osn?U8e:function(e,n){return osn(e,"toString",{configurable:!0,enumerable:!1,value:Tl(n),writable:!0})},Pl=Ef;

// chunk-3cynezh1.js declares wf,kf,vf (29 units) [343222,343251) 29 units sha256 f639cb8e5da3746c114c057e51c5548c1b3b000e97c8f5cf17c89317cea5c56d
var wf=800,kf=16,vf=Date.now;

// chunk-3cynezh1.js declares Af (153 units) [343251,343404) 153 units sha256 d60645d68a93694334e8a7bd6900de9db8070fc7ddd70fcfe9a75c0d0148d463
function Af(e){var n=0,s=0;return function(){var r=vf(),i=kf-(r-s);if(s=r,i>0){if(++n>=wf)return arguments[0]}else n=0;return e.apply(void 0,arguments)}}

// chunk-3cynezh1.js declares Dl (10 units) [343404,343414) 10 units sha256 7c4ab4a3b0df4d00ca814912a5ce983756d53ef90e470b77245d813345017ac8
var Dl=Af;

// chunk-3cynezh1.js declares Cf,Ln (20 units) [343414,343434) 20 units sha256 e3f323fe8492dc4d67bb811abd54239fe11c77695e85df6e22f609411036eefd
var Cf=Dl(Pl),Ln=Cf;

// chunk-3cynezh1.js declares Rf (45 units) [343434,343479) 45 units sha256 47dc1504e8dcdd04104f56709bf83de5be138fa4246b54045a3beb816833b1e4
function Rf(e,n){return Ln(Mn(e,n,U8e),e+"")}

// chunk-3cynezh1.js declares xl (10 units) [343479,343489) 10 units sha256 65d4ef921469282f1ac28401d90b134b224c20458dafe4c0103f24a005dd9820
var xl=Rf;

// chunk-3cynezh1.js declares Of (142 units) [343489,343631) 142 units sha256 a71460d7d8ef32d06fcd8ed2f2f89076a6ae09861e4dc9fa6207609df5a102a5
function Of(e,n,s){if(!aA(s))return!1;var r=typeof n;if(r=="number"?wwe(s)&&L8e(n,s.length):r=="string"&&(n in s))return Hwe(s[n],e);return!1}

// chunk-3cynezh1.js declares mCr (11 units) [343631,343642) 11 units sha256 f8ab126f8a68cc5d4017510be101571aaabcfa6c05d9048ee67bdf4f0e8153f1
var mCr=Of;

// chunk-3cynezh1.js declares Tf (252 units) [343642,343894) 252 units sha256 d7b4398da8e9802bf20ae819558a7fd518ea6cfa1be942486a15f4814e627cea
function Tf(e){return xl(function(n,s){var r=-1,i=s.length,d=i>1?s[i-1]:void 0,c=i>2?s[2]:void 0;if(d=e.length>3&&typeof d=="function"?(i--,d):void 0,c&&mCr(s[0],s[1],c))d=i<3?void 0:d,i=1;n=Object(n);while(++r<i){var g=s[r];if(g)e(n,g,r,d)}return n})}

// chunk-3cynezh1.js declares `Ml`, the assigner `Tf` is bound through, and `Pf`/`MB`: lodash `mergeWith` — the merge every settings source is folded with [343894,343904) 10 units sha256 dd6254d9b41976cb2357437e0a840adc05ebdb9a58a3b20aed3024dcaed25527
var Ml=Tf;

// chunk-3cynezh1.js declares Pf,MB (48 units) [343904,343952) 48 units sha256 525fe5b558016bf042034c3a74620235faa734a83cb871848b0f2416c62ac564
var Pf=Ml(function(e,n,s,r){Cl(e,n,s,r)}),MB=Pf;

// chunk-3cynezh1.js declares `CHt`, the one-level override the customizer uses for `extraKnownMarketplaces` and `managedMcpServers` [428230,428266) 36 units sha256 45f8d8c8241ba0a3cfca78061966bdcd366d832556469355a9c94ec25479866d
function CHt(e,n){return{...e,...n}}

// chunk-3cynezh1.js declares `Y3`, the settings merge customizer: `modelPicker` (normalized), array fields (`fallbackModel` replaces, the rest concatenate and dedupe), and the two map fields (one-level override) [428266,428518) 252 units sha256 9c4fb07c53fe67aeafe205cd52131998ef8a755b0ce87c928832370159369127
function Y3(e,n,s){if(s==="modelPicker"&&n!==void 0)return ic(n);if(Array.isArray(e)&&Array.isArray(n)){if(s==="fallbackModel")return n;return D([...e,...n])}if((s==="extraKnownMarketplaces"||s==="managedMcpServers")&&L(e)&&L(n))return CHt(e,n);return}

// chunk-3cynezh1.js declares `ic`, the `modelPicker` normalizer: the picker object spread with its `options` array elements spread in turn [428518,428637) 119 units sha256 48a291b3d6c4fc3f669c162de02ace3970321bd1839233c0827577acb2f945d2
function ic(e){if(!L(e))return e;let n=e.options;return{...e,...Array.isArray(n)&&{options:n.map((s)=>L(s)?{...s}:s)}}}


export { MB, Y3, CHt, ic };
