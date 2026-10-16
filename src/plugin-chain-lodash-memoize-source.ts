// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-t2x9eyac.js sha256 50d1cb53fc75bae8856145272fd5f9d400d86282f3581a827a98dfd86eda6dad
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// One module of the lodash stack the classic sites read: the memoize `Eo` the classic settle builds
// on. Every helper it closes over lives in the internals copy of the same stack.
import { $8e, Cxr, KMt, L8e, Pxr, Rxr, T1e, YMt, qMt, uU, wwe, xxr, zZ, zpe, zse } from './plugin-chain-lodash-internals-source.js';
import { Hwe, aA } from './plugin-chain-memoize-source.js';

// chunk-t2x9eyac.js declares v, d [768,810) 42 units sha256 04d522d8841669a901ac50e660948a684214e409083c7b21f49b14cdd954da74
var v=Object.prototype,d=v.hasOwnProperty;

// chunk-t2x9eyac.js declares g [810,900) 90 units sha256 04a6d5f57a6fc57de9208a971b1f239f0103b7c37f4572555cc6a6b7f9cd1ff5
function g(r,t,e){var o=r[t];if(!(d.call(r,t)&&Hwe(o,e))||e===void 0&&!(t in r))zZ(r,t,e)}

// chunk-t2x9eyac.js declares e8e [900,910) 10 units sha256 2f60ef06a00e0d9be267ae9ea423036ae9de65476a82d074a655226f3bf279bd
var e8e=g;

// chunk-t2x9eyac.js declares P [910,1205) 295 units sha256 9a393efb0199fa02f7ab2e9e03df6c392a6d490862c1e520e4608152484c78f9
function P(r,t,e,o){if(!aA(r))return r;t=zpe(t,r);var i=-1,m=t.length,s=m-1,n=r;while(n!=null&&++i<m){var f=zse(t[i]),a=e;if(f==="__proto__"||f==="constructor"||f==="prototype")return r;if(i!=s){var p=n[f];if(a=o?o(p,f,n):void 0,a===void 0)a=aA(p)?p:L8e(t[i+1])?[]:{}}e8e(n,f,a),n=n[f]}return r}

// chunk-t2x9eyac.js declares u [1205,1213) 8 units sha256 068e497f2342ab97055195061be4026c97fdf6b00e3c2497d17c2f4b532ff688
var u=P;

// chunk-t2x9eyac.js declares x [1213,1326) 113 units sha256 6b33ef896202e1fba879e89165d60e76687f3f3ec3b0df0c217027b8926ad31b
function x(r,t,e){var o=-1,i=t.length,m={};while(++o<i){var s=t[o],n=$8e(r,s);if(e(n,s))u(m,zpe(s,r),n)}return m}

// chunk-t2x9eyac.js declares vRr [1326,1336) 10 units sha256 c665b373780ef51bed6f2674ac1a0db0294a677bf2d47428aa21c25f67fb171d
var vRr=x;

// chunk-t2x9eyac.js declares O, don [1336,1382) 46 units sha256 c334906a6d181a3527d6b4ba016c54cf4d613fc93a19e103dc7e07b4011446b7
var O=Pxr(Object.getPrototypeOf,Object),don=O;

// chunk-t2x9eyac.js declares I, h, kRr [1382,1494) 112 units sha256 390b68bb9d86ebd47c0448114d9ab68a66a4cc9d11010fe24c86f9e379fdd00f
var I=Object.getOwnPropertySymbols,h=!I?Rxr:function(r){var t=[];while(r)qMt(t,KMt(r)),r=don(r);return t},kRr=h;

// chunk-t2x9eyac.js declares K [1494,1570) 76 units sha256 6551147189b0e15082db30e0a7b0b9a41ed3658b97f88ad14646081f2e20a4b4
function K(r){var t=[];if(r!=null)for(var e in Object(r))t.push(e);return t}

// chunk-t2x9eyac.js declares l [1570,1578) 8 units sha256 b0bf0301ea5eb7d88c095951da1db908b9d45eaf502ef6dd42b6ca0c0dd68766
var l=K;

// chunk-t2x9eyac.js declares c, A [1578,1620) 42 units sha256 5d72feb045c3bfc8e3ba30ba1052f0fb9abb71577dbd1b8e61a1c0f08caaff4a
var c=Object.prototype,A=c.hasOwnProperty;

// chunk-t2x9eyac.js declares S [1620,1750) 130 units sha256 de8788dff2901407473cd38a6854aa923b5e7c6cf10d4154ef4b04c3fed9eca1
function S(r){if(!aA(r))return l(r);var t=YMt(r),e=[];for(var o in r)if(!(o=="constructor"&&(t||!A.call(r,o))))e.push(o);return e}

// chunk-t2x9eyac.js declares y [1750,1758) 8 units sha256 2304a0c384b512e1ae0067c74b96affb45de6bde79d821428441bbc476503526
var y=S;

// chunk-t2x9eyac.js declares w [1758,1801) 43 units sha256 b88d2d8e4271a254eab9373fb0e00d3fb310bbcfc15c943ac3ec6c21212d10ce
function w(r){return wwe(r)?xxr(r,!0):y(r)}

// chunk-t2x9eyac.js declares e1e [1801,1811) 10 units sha256 e41453ff9454c4970cba6a46912fbf8a20e63c44a16c9957bcead95a563e6384
var e1e=w;

// chunk-t2x9eyac.js declares b [1811,1847) 36 units sha256 a96b583af6852ae10327bfdf4361aaa2968ff2765ea7f28d28f6969f19f19cb3
function b(r){return Cxr(r,e1e,kRr)}

// chunk-t2x9eyac.js declares uon [1847,1857) 10 units sha256 94608bcfc82527e9386c32d2649431b038fb985f446a7d5732e969a1ab11598e
var uon=b;

// chunk-t2x9eyac.js declares _ [1857,1990) 133 units sha256 3d5dcd0131c1b3dbb4970b2ed6210454000849d181a39ef628651119ee3b6e2c
function _(r,t){if(r==null)return{};var e=T1e(uon(r),function(o){return[o]});return t=uU(t),vRr(r,e,function(o,i){return t(o,i[0])})}

// chunk-t2x9eyac.js declares Eo [1990,1999) 9 units sha256 65bd6d1a3ddcf103adab20c47c5a28068209993917f9a03c847241747021935d
var Eo=_;


export { Eo, e1e, don, e8e };
