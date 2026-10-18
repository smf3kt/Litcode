// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-z6p21rxk.js sha256 2e9c002da378e738a825dbd5c30f9a6341a9cf2c1d7022d4e1bbec2dfacf72dd
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.

// chunk-z6p21rxk.js tool aliases [662,941) 279 units sha256 86a9c4fb25d00a4a5d553f86cc1e1635d6edb66c5b44efff9f6acace081ccdfa
var c={Task:"Agent",KillShell:"TaskStop",KillBash:"TaskStop",ListPeers:"ListAgents",Brief:"SendUserMessage",ListMcpResources:"ListMcpResourcesTool",ReadMcpResource:"ReadMcpResourceTool",ReadMcpResourceDir:"ReadMcpResourceDirTool"};function Bl(e){return Object.hasOwn(c,e)?c[e]:e}

// chunk-z6p21rxk.js escape rule content [2027,2118) 91 units sha256 23c214fc12bc847c7f89cc62fc1f78cac028a1bee50b0750beca68e707dad62a
function h(e){return e.replaceAll("\\","\\\\").replaceAll("(","\\(").replaceAll(")","\\)")}

// chunk-z6p21rxk.js parse and serialize rule [2573,3340) 767 units sha256 773ffd6e40ce7fb4b2b0657fc540aeae8d370b4fd61532f90387680eda376015
function vAo(e){return kAo(e).replaceAll("\\\\","\\")}function kAo(e){return e.replaceAll("\\(","(").replaceAll("\\)",")")}function hpe(e){if(typeof e==="string"&&!e.includes("(")&&!e.includes(")"))return{kind:"bare"};let t=C(e,"("),n=x(e,")");if(t===-1&&n===-1)return{kind:"bare"};let r=e.substring(0,t);if(t===-1||n<=t||n!==e.length-1||/[()]/.test(r))return{kind:"malformed"};return{kind:"call",toolName:r,rawContent:e.substring(t+1,n)}}function Un(e){let t=hpe(e);if(t.kind!=="call"||!t.toolName)return{toolName:Bl(e)};if(t.rawContent===""||t.rawContent==="*")return{toolName:Bl(t.toolName)};let n=vAo(t.rawContent);return{toolName:Bl(t.toolName),ruleContent:n}}function _n(e){if(!e.ruleContent)return e.toolName;let t=h(e.ruleContent);return`${e.toolName}(${t})`}

// chunk-z6p21rxk.js escaped bracket scanners [4292,4557) 265 units sha256 c49bcc01871ca52be9b2e164f1e13e6f3ee217ded1ccaa70746d918180e388a2
function C(e,t){for(let n=0;n<e.length;n++)if(e[n]===t){let r=0,o=n-1;while(o>=0&&e[o]==="\\")r++,o--;if(r%2===0)return n}return-1}function x(e,t){for(let n=e.length-1;n>=0;n--)if(e[n]===t){let r=0,o=n-1;while(o>=0&&e[o]==="\\")r++,o--;if(r%2===0)return n}return-1}


export { Un, _n, Bl };
