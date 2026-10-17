// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-js2bhabe.js sha256 f196bcf7599a185ad08c73d32ce68b25130ce9db48d781138b1899a3f6e786de
//   chunk-z7whhrje.js sha256 3dca9fb572e08c43b779dd32b44d21858a177e021557bacb2a126e4ed268a3ac
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
//   chunk-wz8v981w.js sha256 c7add42e02a826600b00d2f4b850e50d8eaf2672df33b515fa5f914ee3801323
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { R, Ae } from "./plugin-chain-react-hooks.js";
import { Gfe, Lo, w_, ce, wR, ten, DOt, lbe } from "./plugin-chain-wheel-glue-host.js";
import { fe } from "./plugin-chain-settings-store.js";
import { terminalEnvironment as uq } from "./plugin-chain-terminal-environment.js";
import { pbt, fbt } from "./plugin-chain-wheel-acceleration-source.js";
import { t } from "./plugin-chain-host.js";

// chunk-js2bhabe.js lSe the legacy keys and hs the settings read with source precedence [777,1499) 722 units sha256 03c90abf38f3d5c55f4521f2ed4826d6fb7b456e8f8263165bea97254d0915dd
var lSe=["theme","editorMode","verbose","preferredNotifChannel","autoCompactEnabled","autoScrollEnabled","fileCheckpointingEnabled","showTurnDuration","showMessageTimestamps","terminalProgressBarEnabled","todoFeatureEnabled","teammateMode","remoteControlAtStartup","autoUploadSessions","inputNeededNotifEnabled","agentPushNotifEnabled"];function hs(n,i){let o=Lo(),r=o.includes("userSettings")&&w_();for(let e=o.length-1;e>=0;e--){let t=o[e];if(t==="projectSettings"&&r)continue;let s=fe(t)?.[n];if(s!==void 0)return{value:s,source:t}}if(lSe.includes(n)){let e=n,t=ce()[e];if(t!==void 0&&t!==wR[e]){let s=ten(e)?DOt(e,t):lbe(e,t);if(s!==void 0)return{value:s,source:"legacyGlobalConfig"}}}return{value:i,source:"default"}}

// chunk-z7whhrje.js mLr the jbBugConfirmed environment check [9339,9540) 201 units sha256 f47f7b68f07cb935907019b736ee5f3ae9bb8c1399408a9de7cb4891fb6b9e79
function mLr(r){if(r.bugConfirmed)return!0;if(process.env.INTELLIJ_TERMINAL_COMMAND_BLOCKS_REWORKED!==void 0||process.env.INTELLIJ_TERMINAL_COMMAND_BLOCKS!==void 0)return r.bugConfirmed=!0,!0;return!1}

// chunk-24k7d6mw.js gbt the wheel acceleration state announcement and factory call [126204,126611) 407 units sha256 41a265b321acdf484c32d7c0dc3a80cdc0cc3a2fff8f227bc1343a8803528f8f
function gbt(h){let T=uq(),M=hs("wheelScrollAccelerationEnabled",!0).value;return t(`wheel accel: ${T.useDecayCurve?"decay":"window (native)"} \xB7 base=${T.base} \xB7 platform=${T.platform} \xB7 TERM_PROGRAM=${T.termProgram}${T.wheelFlood?" \xB7 wheelFlood":""}${T.jediTerm?" \xB7 jediTerm":""}${mLr(h)?" \xB7 jbBugConfirmed":""}${M?"":" \xB7 accelDisabled"}`),fbt(T.useDecayCurve,T.base,T.wheelFlood,M,h)}

// chunk-24k7d6mw.js AZ the wheel state hook [126611,126843) 232 units sha256 80eec85b0e84642f42fc17f9373c5e09cd21acd79448f9772445fd208f8f4c7f
function AZ(){let h=R(null),T=R(null),{internal_jediTermInput:M}=QO();return(L,ee)=>{if(uq()!==T.current)T.current=uq(),h.current=null;h.current??=gbt(M),h.current.base=uq().base;let he=h.current;return{rows:pbt(he,L,ee),state:he}}}

// chunk-wz8v981w.js QO the internal jediTerm input context reader [1438,1463) 25 units sha256 8283159965298e4ce8b87528db1b3e9b88874c228a5c81ec3512b29319786dc7
var Ee=()=>Ae(Gfe),QO=Ee;

// chunk-24k7d6mw.js CFe the wheel event dispatch [444563,444675) 112 units sha256 b3bc8d050f4922664e91b5a534c60be6c4d07f8e15b2b5bd02b91b7f4bf77b1a
var CFe=(h,T,M)=>(L)=>{let ee=L.deltaY<0?-1:1;h.scrollBy(ee*T(ee),M(L)),L.preventDefault(),L.stopPropagation()};

// chunk-24k7d6mw.js _Fe the wheel handler factory [444845,444923) 78 units sha256 23987b1f2ac032d8a71bf32b4cd2228888158a644bd1d368e6f21074caf7fe7d
function _Fe(h,T){let M=AZ();return CFe(h,(L)=>M(L,performance.now()).rows,T)}


export { hs, mLr, gbt, AZ, CFe, QO, _Fe };
