// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Xe as e, s, n, N, R, Z, w, b } from './plugin-chain-react-hooks.js';
import * as Sc from './plugin-chain-press-button.js';
import { KH } from './plugin-chain-press-button-host.js';
import { TIe } from './plugin-chain-press-dispatch-source.js';
import { ddn } from './plugin-chain-input-field-source.js';
import { S3n } from './plugin-chain-select-field-source.js';
import { F4 } from './plugin-chain-above-prompt-source.js';

// chunk-24k7d6mw.js wheel handler factory [443631,443771) 140 units sha256 0ae921809cb9b477469c74a1298f0582ed2a3cca1fe8a6a5e8018ca14120b065
var wFe=(h)=>(T)=>{let M=h.current?.cachedLayout;return T.col!==void 0&&T.row!==void 0&&M!==void 0?{column:T.col-M.x,row:T.row-M.y}:void 0};

// chunk-24k7d6mw.js held top/bottom [443771,443978) 207 units sha256 7b203869def0355b4be47e3cf3cf19db5b10c433f34c91d39ba2a93501c7c7d4
function j1(h,T){let{held:M,index:L,content:ee}=h;if(M===null||L===null||M.index!==L||ee===null)return-1;let we=F4(M.node,ee),Te=M.node.yogaNode?.getComputedHeight()??0;return we<0?-1:we+(T==="bottom"?Te:0)}

// chunk-24k7d6mw.js element key bounds walk [443978,444350) 372 units sha256 c56e05bebfd1aae5b0bba10945a71f10c593082cb05e5fbf0c51c24c7a2193fb
function kFe(h,T,M){let L=[h];for(let ee=L.pop();ee;ee=L.pop()){let{elementKey:he,elementPlugin:we}=ee.attributes;if(ee!==h&&he===T&&(we===void 0||we===M)){let Me=F4(ee,h),Le=ee.yogaNode?.getComputedHeight()??0;return Me<0?void 0:{top:Me,bottom:Me+Le}}for(let Me=ee.childNodes.length-1;Me>=0;Me-=1){let Le=ee.childNodes[Me];if(Le&&Le.nodeName!=="#text")L.push(Le)}}return}

// chunk-24k7d6mw.js content wrapper component [444675,444845) 170 units sha256 b357488b6f25ae9b319b177d3ebcf93f9155ab6114209a91b96d4bdd0d8bf825
var TFe=(h)=>e(s,{ref:h.content,marginTop:-h.offset,flexDirection:"column",flexShrink:0,marginRight:h.keptColumns,children:e(ddn,{value:h.columns,children:h.children})});

// chunk-24k7d6mw.js props merge [444923,444956) 33 units sha256 51a725765a53540545059b266e531434ed4b842180e847b370a9c6d44769bce7
var xFe=(h,T)=>({...h,...T});N();

// chunk-24k7d6mw.js floor clamp [444956,444994) 38 units sha256 8f2735d1cec0cdc4e384a041e6508945742a031a90707440fcbabef62c619173
var W1=(h)=>Math.max(0,Math.floor(h));

// chunk-24k7d6mw.js raised offset wrapper [446991,447122) 131 units sha256 3cee1570439cd3cbe7e798de72348ea082fa827bdc883d83ab7434a951a7f7b3
function PFe(h,T){let{offset:M,raised:L}=T;return Z(()=>({...h,props:{...h.props,scroll:{...h.props.scroll,offset:M}}}),[h,L])}N();

// chunk-24k7d6mw.js toggle label component [447619,448084) 465 units sha256 481f4b862bb8f6995859a79d6991dc695f48321ba037b1babe7e978df36820ed
function OI(h){let he=w(7),{label:T,onAction:M,isHeld:L}=h,ee=R(null),we;if(he[0]===b)we=()=>Sc.releaseInkFocus(ee.current),he[0]=we;else we=he[0];let Te;if(he[1]!==L||he[2]!==T)Te=(Me)=>{let Le=Me.hovered||L===!0;return e(n,{dimColor:!Le,inverse:Le,children:T})},he[1]=L,he[2]=T,he[3]=Te;else Te=he[3];let He;if(he[4]!==M||he[5]!==Te)He=e(s,{ref:ee,onClick:we,children:e(KH,{tabIndex:-1,onAction:M,children:Te})}),he[4]=M,he[5]=Te,he[6]=He;else He=he[6];return He}

// chunk-24k7d6mw.js toggle icon flag [448084,448093) 9 units sha256 f28971609b4c7504c36b914fd3696ff70d6c8f86a482385c89d327bf404215f9
var b0=1;

// chunk-24k7d6mw.js collapse handle component [448093,448285) 192 units sha256 f965ddd3440b14d2b3a9776fdbbaf523501bbb8b1bbf9302405a0a1585d375a3
var bne=(h)=>{let T=w(2),M;if(T[0]!==h.onCollapse)M=e(s,{position:"absolute",top:0,right:b0,children:e(OI,{label:"[-]",onAction:h.onCollapse})}),T[0]=h.onCollapse,T[1]=M;else M=T[1];return M};

// chunk-24k7d6mw.js expanded header component [448295,448698) 403 units sha256 ce5e53289e1275f8926f99170267f8cce8c61243e8a4928e6b157b4231497634
var K1=(h)=>{let T=w(5),M;if(T[0]!==h.shortcut)M=(L)=>e(n,{dimColor:!0,inverse:L.hovered,wrap:"truncate-end",children:`\u25B8 plugin panel hidden \xB7 ${h.shortcut} or click to show`}),T[0]=h.shortcut,T[1]=M;else M=T[1];let ee;if(T[2]!==h.onExpand||T[3]!==M)ee=e(KH,{tabIndex:-1,flexShrink:0,alignSelf:"flex-start",onAction:h.onExpand,children:M}),T[2]=h.onExpand,T[3]=M,T[4]=ee;else ee=T[4];return ee};

// chunk-24k7d6mw.js focus index computation [449506,449633) 127 units sha256 6c932c6aac556cb483cdd0b1514fddc2d3b22eae25aa8f46e194bfa79de6a33e
function w0(h){let{focus:T,count:M}=h,L=M>0,ee=typeof T==="number",he=ee&&T+1<M?T+1:null;return ee?he:L?0:T===null?"band":null}

// chunk-24k7d6mw.js highlight rows [449633,449682) 49 units sha256 12e86433edf3c2306daeeb2e9175cb2ed36c9e8181315f1d50e578997223c47e
var z1=(h,T)=>h===null?0:S3n(T,h.highlight).rows;

// chunk-24k7d6mw.js more indicator text [449682,449785) 103 units sha256 2fcffc80a4bddbeeb7c8381f84ea810989760f9cd6e5822f5b24d89a2f6e893f
var Y1=(h,T)=>[h>0?`\u2191 ${h} more`:"",T>0?`\u2193 ${T} more`:""].filter((M)=>M!=="").join(" \xB7 ");

// chunk-24k7d6mw.js more indicator component [449785,450018) 233 units sha256 a248d2901c84d310f72ce2a0cc7544eaf3cd329dfdd3a45278b40976a76189fd
var J1=(h)=>{let T=w(5),M;if(T[0]!==h.above||T[1]!==h.below)M=Y1(h.above,h.below),T[0]=h.above,T[1]=h.below,T[2]=M;else M=T[2];let L;if(T[3]!==M)L=e(n,{dimColor:!0,wrap:"truncate-end",children:M}),T[3]=M,T[4]=L;else L=T[4];return L};

// chunk-24k7d6mw.js digit select [450018,450068) 50 units sha256 520ad3deaebf03df023260950d4ef239603082801a9b5edb215d6fb817b01a72
function Rne(h,T,M){if(h!==void 0&&T())M(),TIe(h)}


export { wFe, j1, kFe, TFe, xFe, W1, PFe, w0, z1, Y1, J1, Rne, bne, K1, OI, b0 };
