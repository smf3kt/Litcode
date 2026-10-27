// @ts-nocheck
// Source declarations. See research/ports/W365-unified-agent-messaging.md.
import path from 'node:path';
import { createHash } from 'node:crypto';
import { xh, Jbo, mD, gy, sAr, xbe } from './agent-address-source.js';
import type { AgentNameHost, AgentNameSource } from './agent-messaging-host.js';
const ln = (() => { const r = createHash, kn = text => text;
// chunk-zf8k2z6n.js at [675,890), UTF-16; sha256 3c7a61171818d4b7501cb11b311233accff55ba92898b1112e203ca7953a0b4e
function at(e){if(typeof e!=="string"&&!ArrayBuffer.isView(e))throw Object.assign(TypeError("sha256Hex: the data is neither text nor bytes"),{code:"ERR_INVALID_ARG_TYPE"});return r("sha256").update(e).digest("hex")}
// chunk-rzybc39t.js ln [709,753), UTF-16; sha256 191a56f7d3b0def8865a1d4833f863eb1e76514a47db67232479ff7869fc9587
function ln(r){return kn(at(r).slice(0,12))}
return ln;
})();
const JE = (() => {
// chunk-nfna65jh.js r [817,833), UTF-16; sha256 c282e91c98f25bc7cf76cf592e9f374e182a221c3b822500ca993e5b031b6f04
var r="[\\w-]{1,63}";
// chunk-nfna65jh.js u [913,954), UTF-16; sha256 2d5cc208ef437f6c2332ac281c0d9e7abd5ed15017cfc71cab7b49b715ab5426
var u=new RegExp(`^a(?:${r}-)?[0-9a-f]{16}$`);
// chunk-nfna65jh.js JE [955,994), UTF-16; sha256 084964a79b1f15028a99de24521819179df4de687948d7d554837a2512ee45ac
function JE(t){return u.test(t)?t:null}
return JE;
})();
// chunk-3qabb19b.js D [883,919), UTF-16; sha256 e08913e4ba564b11551e01e87af4d4ba5f0fde1d9cce2dc2407afcc87d3df2bb
function D(n){return[...new Set(n)]}
// chunk-64ag51qf.js AP [2305,2311), UTF-16; sha256 0670d9424100596fb7274600d00739ca5b4d820a8945f97156f30585e1aad640
var AP=200;
// chunk-64ag51qf.js ca [2489,2503), UTF-16; sha256 dacef36cd9b0f1031836999b4cf190f0b561eb962d3f6239066009351eee72ce
var ca="team-lead";
// chunk-64ag51qf.js mxe [2504,2514), UTF-16; sha256 3cee492b1b8d2ce3296827c114e451fc13b32b964a686937650d4db201bb7a72
var mxe="user";
// chunk-64ag51qf.js adt [2515,2527), UTF-16; sha256 238cfd922c9a34d1c3da5655eb03eb494e5aecf67eb2475d38da0e142c289b29
var adt="system";
export function createAgentNames(host: AgentNameHost): AgentNameSource {
const Ae = path.basename, ke = path.resolve, K = host.sessionId, Xe = host.sessionId;
const B8 = () => false, $l = () => undefined, L$ = (name, team) => `${name}@${team}`;
const Re = () => host.socket() === undefined ? [] : [host.socket()];
const ar = value => value.replace(/^(?:session|cse)_/, "");
// chunk-m7864yc0.js Og [3727,3736), UTF-16; sha256 be1a0d189ecfe5eeebd391cd7d2422e7589937ae1850712dc832a76cd5bbd4ad
var Og="main";
// chunk-m7864yc0.js ee [8594,8603), UTF-16; sha256 a30ab7690d83c57c4df181098f3f425173d444e5039c631e44befa11642d1550
var ee="sid:";
// chunk-m7864yc0.js w0t [8604,8638), UTF-16; sha256 983a8fc55db8a4299e700e30de6d6e1bd13850f91a51a628e70fb723cafe9a3a
function w0t(e){return`${ee}${e}`}
// chunk-m7864yc0.js ndt [8638,8678), UTF-16; sha256 9e1ab87aec92a3b51d596f6777370fad8f4966551d33f7613a586cec8d335351
function ndt(e){return e.startsWith(ee)}
// chunk-m7864yc0.js _5e [8678,8713), UTF-16; sha256 2d9ee9ed35b00f71eca5b96d5407161a4bf7f3d8e5aab8556b100d6318ce008c
function _5e(e){return!ndt(e.sock)}
// chunk-m7864yc0.js Qr [9012,9152), UTF-16; sha256 50580aceccb71749c78f9ef5cd0511cc251b5e4df8b798f5c6208334a1378ee5
function Qr(e){return e.normalize("NFKC").replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu,(n)=>/\s/.test(n)?n:"").trim().toLowerCase().replace(/\s+/g,"-")}
// chunk-m7864yc0.js S5e [9192,9242), UTF-16; sha256 b69f78f0b53b1ec24253d7abf1cf3638c273b71f19b4cf0d46d3742aa65f4431
function S5e(e){return typeof e!=="string"||fD(e)}
// chunk-m7864yc0.js VQ [9306,9434), UTF-16; sha256 5ac9680fc60f8baa4e1e455c638576ebc6adc5da3e9c9aecaf01557fd3b85fbd
function VQ(e){let n=e.teamContext;if(n?.leadAgentId&&n.isLeader!==!1)return n.leadAgentId;let r=$l(n);return r?L$(ca,r):void 0}
// chunk-m7864yc0.js rdt [9242,9306), UTF-16; sha256 3f52f6b675d15ffaa5edb1af04bf4023c5f105a4558dbcd144f53c9e0ef4d4f4
function rdt(e,n){return e.name===ca&&n!==void 0&&e.agentId===n}
// chunk-m7864yc0.js fD [9505,9586), UTF-16; sha256 6830eb5a064a4bdee486c171813cedcac53bb2933be80a45a923f9adbebe2802
function fD(e){let n=Qr(e);return n===Og||n===ca||n===mxe||n===adt||JE(n)!==null}
// chunk-m7864yc0.js N [9590,9593), UTF-16; sha256 6441e244ae39181268c2a2e4f7b3258337f72d004df2ad11b55194c3cd15a4a8
var N=6;
// chunk-m7864yc0.js zbo [9594,9600), UTF-16; sha256 c04f5c5fb3b6c047f822605563cd32d0fd83ff1a0bae9f2774ee53fca66f8a1d
var zbo=12;
// chunk-m7864yc0.js pxe [9601,9628), UTF-16; sha256 5b9cb1d250eddfbea85f929037c074a48cd2ee5c880f71065cbde4abcf3b66e2
var pxe=`[0-9a-f]{${N},${zbo}}`;
// chunk-m7864yc0.js Te [9629,9673), UTF-16; sha256 2db76e6434a6a97ca37732abd8f0dce13167174bb9bdbf99bee5030fc875861b
var Te=new RegExp(`^(.*\\S)\\s*\\[(${pxe})\\]$`);
// chunk-m7864yc0.js sV [9674,9748), UTF-16; sha256 2a11963e5823f31410893a238ff09d19fae6a2896f9cbe8019e416bc15c7fd65
function sV(e){let n=Te.exec(e.trim());return n?{name:n[1],ref:n[2]}:null}
// chunk-m7864yc0.js _e [13548,13553), UTF-16; sha256 9f7e498adecc0e14cacf2d5c644a1f3cf32b7f8beb125f0a076453a3b13c9195
var _e=AP;
// chunk-m7864yc0.js xue [13554,13750), UTF-16; sha256 a3ebc032f42fcb39b6c24250a1dc17d280844cd5cf97b6c1a3876051f9e21d94
function xue(e){if(typeof e!=="string")return null;return[...e.replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu,(r)=>/\s/.test(r)?r:"").replace(/\s+/g," ").trim()].slice(0,_e).join("").trim()||"untitled session"}
// chunk-m7864yc0.js fxe [13829,13897), UTF-16; sha256 4b95bff3620cced40d15c4fd1a00cf88bfe9f78cf2cfc0f99415f17758251b50
function fxe(e){let n=xue(e);return n!==null&&!E0t(n)&&mD(n)?n:null}
// chunk-m7864yc0.js ttn [13897,13963), UTF-16; sha256 bbb141d25490d1eb553ec27db516a24f85f5f2c95211bdd99ec56f9c49c13955
function ttn(e){let n=xue(e);return n!==null&&F(n)&&!fD(n)?n:null}
// chunk-m7864yc0.js F [13963,14025), UTF-16; sha256 32a3f76914c41bc4a57e086c2a8adbab4f87c7013dd7871df840140701a6d985
function F(e){return!E0t(e)&&mD(e)&&!e.includes("@")&&e!=="*"}
// chunk-m7864yc0.js E0t [14025,14123), UTF-16; sha256 8092b0129a64e97e2a137b83bafa091d3a787429c96e1e1ab0e90e2e1e35c9fe
function E0t(e){let n=Qr(e);return xh(e).scheme!=="other"||xh(n).scheme!=="other"||Jbo(e)||Jbo(n)}
// chunk-m7864yc0.js ntn [14579,14619), UTF-16; sha256 3262953daa6e2d7dee285024e7b2ed0bfedd76b87bbdda76612f8235b7492d4f
function ntn(e){return e.stableId??e.id}
// chunk-m7864yc0.js ne [14452,14532), UTF-16; sha256 d7a60db32e8df2ec429518457881fb35e2a9672f90274a8ed86c3bd8fb0f6191
function ne(e,n){let r=0;while(r<e.length&&r<n.length&&e[r]===n[r])r++;return r}
// chunk-m7864yc0.js R [14532,14579), UTF-16; sha256 65378af83cbc460463982668fbbdde768b697d756a2e84a10e7cd1dfb50bc781
function R(e,n){return String(ln(`${e}:${n}`))}
// chunk-m7864yc0.js xe [14123,14452), UTF-16; sha256 ca7734bf10c0dbdf1b5407f429b6b5a14771fb792d0b7ecb017496332bfffd24
function xe(e){let n=e.map((a)=>R(a.kind,ntn(a))),r=Re().map((a)=>R("session",a)),i=D([...n,...r]).sort(),d=new Map;for(let a=0;a<i.length;a++){let c=i[a],g=Math.max(a>0?ne(c,i[a-1]):0,a+1<i.length?ne(c,i[a+1]):0);d.set(c,Math.min(c.length,Math.max(N,g+1)))}return e.map((a,c)=>{let g=n[c];return{...a,ref:g.slice(0,d.get(g))}})}
// chunk-m7864yc0.js XA [4892,4994), UTF-16; sha256 70d9fd8a6d2cbd3fd9dfae48bf08ed94c4540ce838715ab46c87030d408d2ad5
function XA(e){let n=xbe(e);if(n!==void 0)return`\\\\.\\pipe\\${sAr(n)}`;if(gy(e))return;return ke(e)}
// chunk-m7864yc0.js Zkr [8746,8884), UTF-16; sha256 aa4b573d9083a537f300e18e7ad7e45ecbf28e7a84d30f3c11bb78ac8e44da08
function Zkr(e){let n=typeof e==="string"?e.trim():"",r=xue(n);return!n||!r||r==="untitled session"&&n.toLowerCase()!=="untitled session"}
// chunk-m7864yc0.js M$e [8884,8964), UTF-16; sha256 de7ca1866de05bf85614a8fbec1bd5858977c8eb757626b60f2953ba0c5580ee
function M$e(e){return e.environmentKind!==void 0&&e.environmentKind!=="bridge"}
// chunk-m7864yc0.js eAr [8964,9012), UTF-16; sha256 72cd20cd977a4d07f90b6df8eccc0798e9d2bd062223864d7c11a4d7533126f1
function eAr(e){return!M$e(e)&&e.connected===!1}
// chunk-m7864yc0.js re [14848,15244), UTF-16; sha256 4876680acbb44d4a5124bec65223e44cd1a010f43692c31ca66c717f08273a60
function re(e){let n=[];for(let i of e){let d=n.filter((c)=>c.records.some((g)=>ase(g.sock,i.sock))),a={records:[],claims:new Set};for(let c of d){a.records.push(...c.records);for(let g of c.claims)a.claims.add(g)}if(a.records.push(i),i.sessionId!==void 0)a.claims.add(i.sessionId);n=n.filter((c)=>!d.includes(c)),n.push(a)}let r=new Map;for(let i of n)for(let d of i.records)r.set(d,i);return r}
// chunk-m7864yc0.js se [15244,15496), UTF-16; sha256 a81cd9e1312c0d7a6b6c65998f1730f37e44b2eaa3fc83865c735edef48290bc
function se(e,n,r){let i=new Set([e]),d=new Set;for(let a of n){if(a.sessionId===void 0)continue;if(i.has(a.sessionId))d.add(a.sessionId);i.add(a.sessionId)}for(let a of new Set(r.values()))if(a.records.length>1)for(let c of a.claims)d.add(c);return d}
// chunk-m7864yc0.js rtn [15832,15936), UTF-16; sha256 9d908b49dfd66121a41595d31bf278d95cf555806c40a730fec463bb78ed8c4c
function rtn(e,n){let r=ar(n);return e.some((i)=>i.bridgeSessionId!==void 0&&ar(i.bridgeSessionId)===r)}
// chunk-m7864yc0.js v0t [15739,15832), UTF-16; sha256 610f675cf773b397109c519ff0d4e6677e82c157fb1bf535b5467929775e14a3
function v0t(e){return new Set(e.flatMap((n)=>n.bridgeSessionId?[ar(n.bridgeSessionId)]:[]))}
// chunk-m7864yc0.js Cbe [12896,12941), UTF-16; sha256 dd853f4eab54cabda6b1183ca3e9b17bdfa940555c28450dcf73a4449c5f6d54
function Cbe(e){return`${e.name} [${e.ref}]`}
// chunk-m7864yc0.js odt [12684,12896), UTF-16; sha256 4b05a682dbd2f1bec624cb0f7ad8dbb8df4599dadadd7cb51dd51c6de46ea20f
function odt(e,n,r){let i=e.get(n);if(!i||i.length===0)return;let d=r===void 0?[]:i.filter((g)=>g.name===r),c=(d.length>0?d:i)[0];if(c.where==="in-process")return{kind:"one",candidate:c};return{kind:"ambiguous"}}
// chunk-m7864yc0.js iV [9748,12684), UTF-16; sha256 e4c569175a773002c2d8b21c54b2bf7f185c79eb54576aceb99d03652535ca81
function iV(e,n){let r=[];r.push({name:Og,id:Xe(),kind:"main",where:"in-process",lastActive:void 0,sock:void 0});let i=new Set;for(let[s,f]of Object.entries(e.teamContext?.teammates??{}))i.add(s),r.push({name:f.name,id:s,kind:"teammate",where:"in-process",lastActive:void 0,sock:void 0});for(let[s,f]of e.agentNameRegistry){let b=e.tasks[f],I=b?.type==="local_agent"?b:void 0;r.push({name:s,id:f,kind:"subagent",where:"in-process",lastActive:I?.startTime,sock:void 0})}for(let s of n.teamFile?.members??[]){if(i.has(s.agentId))continue;i.add(s.agentId),r.push({name:s.name,id:s.agentId,kind:"teammate",where:"this-machine",lastActive:void 0,sock:void 0})}let d=B8(),a=n.sessions.filter(_5e),c=d?re(a):void 0,g=d?se(K(),a,c):void 0;for(let s of a){let f=c?.get(s)?.claims;r.push({name:s.name||Ae(s.cwd),id:s.sock,kind:"session",where:"this-machine",lastActive:s.statusUpdatedAt,sock:s.sock,...f!==void 0&&f.size>0&&{claimedSessionIds:[...f].sort()},...d&&s.sessionId!==void 0&&!g.has(s.sessionId)&&{stableId:w0t(s.sessionId)},...d&&s.nameSource==="derived"&&{derivedName:!0},...s.hostSessionId!==void 0&&{hostSessionId:s.hostSessionId}})}let k=new Map;for(let s of n.sessions)if(s.bridgeSessionId!==void 0){let f=ar(s.bridgeSessionId);k.set(f,[...k.get(f)??[],s.sock])}let S=[];for(let s of n.cloud??[]){if(rtn(n.sessions,s.id)){S.push({rawName:s.title||"untitled",socks:k.get(ar(s.id))??[]});continue}r.push({name:s.title||"untitled",id:s.id,kind:"cloud-session",...Zkr(s.title)&&{derivedName:!0},...s.acceptsPeerMessages===!0&&{reportsInbound:!0},where:s.remoteControl?"remote":"cloud",lastActive:s.lastActive,sock:void 0,...s.offline&&{offline:!0}})}let m=new Set((n.cloud??[]).map((s)=>ar(s.id))),h=v0t(n.sessions);for(let s of n.bridge??[]){let f=ar(s.id);if(m.has(f))continue;if(h.has(f)){S.push({rawName:s.title||"untitled",socks:k.get(f)??[]});continue}let b=Date.parse(s.updated_at);r.push({name:s.title||"untitled",id:s.id,kind:"bridge-session",...Zkr(s.title)&&{derivedName:!0},...s.acceptsPeerMessages===!0&&{reportsInbound:!0},...s.inboundReportUnavailable&&{inboundReportUnavailable:!0},where:M$e(s)?"cloud":"remote",lastActive:Number.isNaN(b)?void 0:b,sock:void 0,...eAr(s)&&{offline:!0}})}let y=VQ(e),E=r.flatMap((s)=>{let f=xue(s.name);if(f===null||!F(f))return[];let b=s.kind==="main"||s.kind==="teammate"&&rdt({name:s.name,agentId:s.id},y),I=(s.kind==="session"||s.kind==="cloud-session"||s.kind==="bridge-session")&&Qr(f)===Og;return b||I||!S5e(f)?[{...s,name:f}]:[]}),w=new Set,T=xe(E.filter((s)=>{if(s.kind!=="session")return!0;let f=`${Qr(s.name)}\x00${XA(s.id)??s.id}`;if(w.has(f))return!1;return w.add(f),!0})),M=new Map;for(let s of T){let f=Qr(s.name),b=M.get(f);if(b)b.push(s);else M.set(f,[s])}let P=new Map;for(let{rawName:s,socks:f}of S){let b=xue(s);if(b===null||!F(b))continue;let I=Qr(b),L=P.get(I)??new Set;for(let ie of f)L.add(ie);P.set(I,L)}return{candidates:T,byName:M,remoteNamesClaimedLocally:P}}
// chunk-m7864yc0.js w5e [15636,15679), UTF-16; sha256 436b75216c3de2a365782f678da4cd063d9fac386dffed37a96310d81d0555bb
function w5e(e,n){return R(e,n).slice(0,N)}
return { index: iV, key: Qr, clean: xue, display: fxe, printed: Cbe, parseRef: sV, choose: odt, ref: w5e, canonical: XA, reserved: fD, valid: F };
}
