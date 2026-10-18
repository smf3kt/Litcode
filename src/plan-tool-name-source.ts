// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W183-permission-destinations.md.
// Modules:
//   chunk-g9z2s3cs.js sha256 550cc54ca410aa21fddc03375576e7371031bbb7ee852494337fd6d9c0a2ee0b
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Yv,JWn } from './plan-glob-source.js';
const Ks=()=>{throw new Error('Virtual plan descriptor has no MCP identity');};


// chunk-g9z2s3cs.js Gp [2177,2260) 83 units sha256 b81b862adc679979455fe488d38c0b01eb363c9b768513f4d803c237ab429158
function Gp(e){return e.mcpInfo?Ks(e.mcpInfo.serverName,e.mcpInfo.toolName):e.name}

// chunk-g9z2s3cs.js go [774,920) 146 units sha256 92e3ad8db1cde2c9fb1347b62c002a4a33398ee8ef8c1eeae75d6e3cac1d0231
function go(e){let n=e.split("__"),[r,t,...s]=n;if(r!=="mcp"||!t)return null;let o=s.length>0?s.join("__"):void 0;return{serverName:t,toolName:o}}

// chunk-g9z2s3cs.js wAo [2890,3158) 268 units sha256 b7f58e363695765d151416874934d9fd5adf97d6019423a9dec77af7ccdf9f8e
function wAo(e){let n=go(e);if(n===null)return()=>!1;let r=n.toolName===void 0||n.toolName==="*",t=n.toolName!==void 0&&Yv(n.toolName)?n.toolName:void 0,s;return(o)=>o!==null&&n.serverName===o.serverName&&(r||o.toolName!==void 0&&t!==void 0&&(s??=JWn(t))(o.toolName))}


export { Gp, go, wAo };
