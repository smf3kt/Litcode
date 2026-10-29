// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
// chunk-a60ee1ne.js trn [987,2081), UTF-16; sha256 bcea04ab0ec456871ed26a8df522be053dfa6f4e6d5ed496cfa34a2f30ba4c0f
var trn={dangerousRemoval:{bypassImmune:!0,classifierRouted:!0,autoModeDeny:!0,hostPersonOnly:!1,localProjectionOnly:!1,servedUnplaceable:!1},backgroundOperator:{bypassImmune:!1,classifierRouted:!0,autoModeDeny:!1,hostPersonOnly:!1,localProjectionOnly:!1,servedUnplaceable:!1},suspiciousWindowsPath:{bypassImmune:!1,classifierRouted:!0,autoModeDeny:!1,hostPersonOnly:!1,localProjectionOnly:!1,servedUnplaceable:!1},isolatePeerMachines:{bypassImmune:!0,classifierRouted:!1,autoModeDeny:!1,hostPersonOnly:!1,localProjectionOnly:!1,servedUnplaceable:!1},restrictedMode:{bypassImmune:!0,classifierRouted:!1,autoModeDeny:!1,hostPersonOnly:!1,localProjectionOnly:!1,servedUnplaceable:!1},outsideReadsBlocked:{bypassImmune:!0,classifierRouted:!1,autoModeDeny:!1,hostPersonOnly:!1,localProjectionOnly:!1,servedUnplaceable:!1},claudeSettingsFile:{bypassImmune:!1,classifierRouted:!1,autoModeDeny:!1,hostPersonOnly:!0,localProjectionOnly:!1,servedUnplaceable:!1},internalHardDeny:{bypassImmune:!1,classifierRouted:!1,autoModeDeny:!1,hostPersonOnly:!1,localProjectionOnly:!1,servedUnplaceable:!0},...{},...{}};
// chunk-a60ee1ne.js X3 [2082,2146), UTF-16; sha256 e4bc2210e56e5e98f252379ddec398122d4228adb29354ff0ef01d0adcbc6c41
function X3(e){return d(e).some((o)=>trn[o]?.bypassImmune===!0)}
// chunk-a60ee1ne.js d [2216,2303), UTF-16; sha256 98e0d1b4d1f81a482043bad16d6c61820441e40018bf1ecd7d85dd912a94cecb
function d(e){return[...e.circuitBreaker!==void 0?[e.circuitBreaker]:[],...e.also??[]]}
// chunk-sfn1dbxq.js ize [609639,609790), UTF-16; sha256 ef323ba2c52fa0c791c34596bf3b7d0c7ce961cd6309bc3f2b561e49f4767f93
function ize(e){if(e?.type==="rule")return!0;if(e?.type==="subcommandResults")return[...e.reasons.values()].every((n)=>ize(n.decisionReason));return!1}
// chunk-sfn1dbxq.js jwe [3234078,3234326), UTF-16; sha256 63a4609d828d83bf1b42cdef634371e3ade51a139db7a4b0b1b11cd40619f2e6
function jwe(e){if(e.behavior!=="ask"||m0(e))return!1;let n=e.decisionReason;if(n===void 0||n.type==="other")return!0;return n.type==="subcommandResults"&&[...n.reasons.values()].every((r)=>r.behavior==="allow"||r.behavior==="passthrough"||jwe(r))}
// chunk-sfn1dbxq.js Lcn [3234326,3234534), UTF-16; sha256 bb4863a870d1a305713a718402494ccd6ffeb416fc6fffe8516ebf6e524fa45b
function Lcn(e){switch(e.behavior){case"allow":return ize(e.decisionReason)?0:1;case"passthrough":return 2;case"ask":if(jwe(e))return 3;return m0(e)||Dl(e.decisionReason,X3)!==void 0?5:4;case"deny":return 6}}
// chunk-sfn1dbxq.js DTr [3234534,3234967), UTF-16; sha256 4cd43add5ae5c4a4fa3fce37f72b422df59e20dc9729f497ed8af5abeb780133
function DTr(e,n,r){let s=[e,...n].find((b)=>b.behavior==="deny");if(s!==void 0)return s;if(e.behavior==="ask"&&!jwe(e))return e;let h=e;for(let b of n)if(Lcn(b)>Lcn(h))h=b;if(r||h.behavior==="ask")return h;let y={type:"other",reason:"Variables set in front of a declaration in this command can't all be checked before it runs",bashMissKind:"too-complex"};return{behavior:"ask",decisionReason:y,message:Rl(ki.name,y),suggestions:[]}}
// chunk-sfn1dbxq.js utt [3354561,3354764), UTF-16; sha256 9df48f931bd97a80ebabcb0c61588d71b1d4360c469091883853b9777c7ef160
function utt(e){if(e?.type==="rule"&&e.rule.ruleBehavior==="ask")return!0;if(e?.type==="subcommandResults"){for(let n of e.reasons.values())if(n.behavior==="ask"&&utt(n.decisionReason))return!0}return!1}
// chunk-sfn1dbxq.js m0 [3354764,3354848), UTF-16; sha256 6324bb3421c6c7918306a6ddf1120988b8af6009ff98e5088f64975aff637e80
function m0(e){return utt(e.decisionReason)||e.matchedAskRule?.ruleBehavior==="ask"}
// chunk-sfn1dbxq.js Dl [3365554,3365753), UTF-16; sha256 dd4494b95f3937871f93053b5afb1e9b7ff44e6c5770f9fed1cfc4820601cab1
function Dl(e,n=()=>!0){if(!e)return;if(e.type==="safetyCheck")return n(e)?e:void 0;if(e.type==="subcommandResults")for(let r of e.reasons.values()){let s=Dl(r.decisionReason,n);if(s)return s}return}
const ki = { name: "Bash" };
const Rl = (_name, reason) => reason.reason;
export { DTr, jwe };
