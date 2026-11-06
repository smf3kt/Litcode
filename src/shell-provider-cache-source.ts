// @ts-nocheck
// Fixture-only source adapter; chunk-sfn1dbxq.js SHA-256
// 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da.
// Ranges below are UTF-16 offsets, left-closed and right-open.
export function createShellProviderCacheFixture({ eLs, W7r, zgn, t, l, c, mPe }) {
// nIr [3505033,3505154)
async function nIr(e){let n=await eLs(),r=await rIr(e);return{provider:await zgn(n,{pluginBinPaths:r}),pluginBinPaths:r}}
// rIr [3505154,3505304)
async function rIr(e){try{return await W7r(e)}catch(n){return t(`Shell snapshot: leaving plugin bin/ dirs off PATH: ${l(n)}`,{level:"warn"}),c(n),[]}}
// tLs [3505304,3505340)
function tLs(e){return ohn(mPe(),e)}
// ohn [3505340,3505402)
function ohn(e,n){return e.shellConfig??=nIr(n),e.shellConfig}
// Xgn [3505503,3505542)
var Xgn=Symbol("shell config pending");
// W8r [3505542,3506206)
async function W8r(e){let n=mPe(),r=n.shellConfig;if(r===null)return!1;let s=null,h="plugin bin/ PATH entries changed";try{let y=await Promise.race([r,Promise.resolve(Xgn)]);if(y===Xgn)h="its config was still being built";else if(await y.provider.isSnapshotUsable?.()===!1)h="its snapshot failed or is missing";else if(iIr(y.pluginBinPaths,await W7r(e)))s="plugin bin/ PATH entries unchanged"}catch{h="its config or the plugin bin/ read failed"}if(s!==null)return t(`Shell snapshot kept across plugin refresh: ${s}`),!1;if(n.shellConfig!==r)return!1;return n.shellConfig=null,t(`Shell snapshot dropped on plugin refresh (${h}); the next Bash exec rebuilds it`),!0}
// iIr [3506206,3506277)
function iIr(e,n){return e.length===n.length&&e.every((r,s)=>r===n[s])}
return { ohn, tLs, W8r };
}
