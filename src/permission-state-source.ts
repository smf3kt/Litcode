// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-2bcyxj9q.js sha256 fac54023446990731332f837b388955e357036b2797a11f93150648afb45f7e0
//   chunk-z6p21rxk.js sha256 2e9c002da378e738a825dbd5c30f9a6341a9cf2c1d7022d4e1bbec2dfacf72dd
//   chunk-qpxbyxy2.js sha256 f9f559cdc5ed22076ae8e4c42bef7f772add2a23150edfe1175e740e1784c4fd
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
const c={Task:'Agent',KillShell:'TaskStop',KillBash:'TaskStop',ListPeers:'ListAgents',Brief:'SendUserMessage',ListMcpResources:'ListMcpResourcesTool',ReadMcpResource:'ReadMcpResourceTool',ReadMcpResourceDir:'ReadMcpResourceDirTool'};
const Mr={allow:'alwaysAllowRules',deny:'alwaysDenyRules',ask:'alwaysAskRules'};
const t=()=>{},Jt=()=>{},_=JSON.stringify;

// chunk-2bcyxj9q.js sf destination reducer [195269,197020) 1751 units sha256 1cd6700b739a38fcbe978df3d852f9e3a6857e74133d2053398d1a6c0b4491b0
function sf(e,n,r){switch(n.type){case"setMode":if(n.mode==="bypassPermissions"&&!e.isBypassPermissionsModeAvailable)return t("Ignoring permission update: setMode 'bypassPermissions' rejected \u2014 mode is not available (disableBypassPermissionsMode set, or session not launched in bypassPermissions mode)"),e;return Jt(r,`Applying permission update: Setting mode to '${n.mode}'`),{...e,mode:n.mode};case"addRules":{let s=n.rules.map((y)=>_n(y));Jt(r,`Applying permission update: Adding ${n.rules.length} ${n.behavior} rule(s) to destination '${n.destination}': ${_(s)}`);let h=Mr[n.behavior];return{...e,[h]:{...e[h],[n.destination]:[...e[h][n.destination]||[],...s]}}}case"replaceRules":{let s=n.rules.map((y)=>_n(y));Jt(r,`Replacing all ${n.behavior} rules for destination '${n.destination}' with ${n.rules.length} rule(s): ${_(s)}`);let h=Mr[n.behavior];return{...e,[h]:{...e[h],[n.destination]:s}}}case"addDirectories":return Jt(r,`Applying permission update: Adding ${n.directories.length} director${n.directories.length===1?"y":"ies"} with destination '${n.destination}': ${_(n.directories)}`),wco(e,n.directories,n.destination);case"removeRules":{let s=n.rules.map((P)=>_n(P));Jt(r,`Applying permission update: Removing ${n.rules.length} ${n.behavior} rule(s) from source '${n.destination}': ${_(s)}`);let h=Mr[n.behavior],y=e[h][n.destination]||[],w=new Set(s),b=y.filter((P)=>!w.has(P));return{...e,[h]:{...e[h],[n.destination]:b}}}case"removeDirectories":{Jt(r,`Applying permission update: Removing ${n.directories.length} director${n.directories.length===1?"y":"ies"}: ${_(n.directories)}`);let s=new Map(e.additionalWorkingDirectories);for(let h of n.directories)s.delete(h);return{...e,additionalWorkingDirectories:s}}default:return e}}

// chunk-2bcyxj9q.js wco directory source map [194801,194953) 152 units sha256 f91989c895d3717673c15007750bebcef07d0f6f855ed47b044c0852338cdbca
function wco(e,n,r){let s=new Map(e.additionalWorkingDirectories);for(let h of n)s.set(h,{path:h,source:r});return{...e,additionalWorkingDirectories:s}}

// chunk-z6p21rxk.js h rule content escaping [2027,2118) 91 units sha256 23c214fc12bc847c7f89cc62fc1f78cac028a1bee50b0750beca68e707dad62a
function h(e){return e.replaceAll("\\","\\\\").replaceAll("(","\\(").replaceAll(")","\\)")}

// chunk-z6p21rxk.js Un parse and _n serialize [2573,3340) 767 units sha256 773ffd6e40ce7fb4b2b0657fc540aeae8d370b4fd61532f90387680eda376015
function vAo(e){return kAo(e).replaceAll("\\\\","\\")}function kAo(e){return e.replaceAll("\\(","(").replaceAll("\\)",")")}function hpe(e){if(typeof e==="string"&&!e.includes("(")&&!e.includes(")"))return{kind:"bare"};let t=C(e,"("),n=x(e,")");if(t===-1&&n===-1)return{kind:"bare"};let r=e.substring(0,t);if(t===-1||n<=t||n!==e.length-1||/[()]/.test(r))return{kind:"malformed"};return{kind:"call",toolName:r,rawContent:e.substring(t+1,n)}}function Un(e){let t=hpe(e);if(t.kind!=="call"||!t.toolName)return{toolName:Bl(e)};if(t.rawContent===""||t.rawContent==="*")return{toolName:Bl(t.toolName)};let n=vAo(t.rawContent);return{toolName:Bl(t.toolName),ruleContent:n}}function _n(e){if(!e.ruleContent)return e.toolName;let t=h(e.ruleContent);return`${e.toolName}(${t})`}

// chunk-z6p21rxk.js C x escaped delimiters [4292,4557) 265 units sha256 c49bcc01871ca52be9b2e164f1e13e6f3ee217ded1ccaa70746d918180e388a2
function C(e,t){for(let n=0;n<e.length;n++)if(e[n]===t){let r=0,o=n-1;while(o>=0&&e[o]==="\\")r++,o--;if(r%2===0)return n}return-1}function x(e,t){for(let n=e.length-1;n>=0;n--)if(e[n]===t){let r=0,o=n-1;while(o>=0&&e[o]==="\\")r++,o--;if(r%2===0)return n}return-1}

// chunk-z6p21rxk.js Bl historical alias normalization [893,941) 48 units sha256 6032e57bff0f57b8b30abcd932dcbc20ca81091c29af39cab4be93178e7ee22c
function Bl(e){return Object.hasOwn(c,e)?c[e]:e}

// chunk-qpxbyxy2.js Hh per-path write queue [849,1269) 420 units sha256 c7752822ee51b620c806b9c209298c4ab62078287da281750b8400eb622667f3
var n=5;function Hh(){let r=new Map;return{run(e,i){let t=(r.get(e)??Promise.resolve()).then(()=>i()),s=t.then(()=>{},()=>{});return r.set(e,s),s.then(()=>{if(r.get(e)===s)r.delete(e)}),t},has(e){return r.has(e)},get size(){return r.size},async settle(){await Promise.all([...r.values()])},async drain(){for(let e=0;e<n;e++){let i=[...r.values()];if(i.length===0)return;await Promise.all(i)}},clearForTest(){r.clear()}}}


export { sf, wco, Un, _n, Hh };
