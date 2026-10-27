// @ts-nocheck
// Source declarations. See research/ports/W365-unified-agent-messaging.md.
import type { AgentRosterSource } from './agent-messaging-host.js';
// chunk-yn0pfn70.js rn [9654,10354), UTF-16; sha256 6567ad158917bc1a7893b1a0a17cc9c2e1ac0619e0771a4a5a46492ebb35ff04
function rn(e,t){if(e<60000){if(e===0)return"0s";if(e<1)return`${(e/1000).toFixed(1)}s`;return`${Math.floor(e/1000).toString()}s`}let r=Math.floor(e/86400000),n=Math.floor(e%86400000/3600000),s=Math.floor(e%3600000/60000),o=Math.round(e%60000/1000);if(o===60)o=0,s++;if(s===60)s=0,n++;if(n===24)n=0,r++;let c=t?.hideTrailingZeros;if(t?.mostSignificantOnly){if(r>0)return`${r}d`;if(n>0)return`${n}h`;if(s>0)return`${s}m`;return`${o}s`}if(r>0){if(c&&n===0&&s===0)return`${r}d`;if(c&&s===0)return`${r}d ${n}h`;return`${r}d ${n}h ${s}m`}if(n>0){if(c&&s===0&&o===0)return`${n}h`;if(c&&o===0)return`${n}h ${s}m`;return`${n}h ${s}m ${o}s`}if(s>0){if(c&&o===0)return`${s}m`;return`${s}m ${o}s`}return`${o}s`}
export function createAgentRoster(printed: (value: { name: string; ref: string }) => string): AgentRosterSource {
const Cbe = printed;
// chunk-w9kaj2q7.js W [7739,7744), UTF-16; sha256 e017d4ffd3df2fb85149956c83f1fe98c3bf78c9292adf8f97fad7525d4786f7
var W=100;
// chunk-w9kaj2q7.js F [7745,7750), UTF-16; sha256 720ffd00672c013d79e736b60d445014489760425ec0e8eab181febea9916dc0
var F=100;
// chunk-w9kaj2q7.js Z [7751,7756), UTF-16; sha256 ca8f0c21cdd6d6a07fc3bf7e7fead324a14e2d7ab10cbdfead5b61f1ebe747e6
var Z=100;
// chunk-w9kaj2q7.js ee [7757,7772), UTF-16; sha256 053a8d13e3f827f65e0c6980f47f03f38172fe3851495677cacbf8a1b5a3d5f2
var ee=315360000000;
// chunk-w9kaj2q7.js A [7672,7735), UTF-16; sha256 92076c156d73d2b0ef379a9b8ff057041c2783bd812b670df9c272592c66d2ce
function A(e,t,i=t.length){return`${e} (${i}):
${t.join(`
`)}`}
// chunk-w9kaj2q7.js L [8108,8392), UTF-16; sha256 d321aafaa623c384fe784e39b1c94d83386ece42fd08ff1eccc915b5bf95aeac
function L(e,t){let i={...e.shown},s=[e.printed];for(let n of t){if(typeof n==="string"){s.push(n);continue}let r=n===void 0?void 0:("type"in n)?n.type:n.status;if(n!==void 0&&r!==void 0)i["type"in n?"type":"status"]=r,s.push(n.text??r)}return{agent:i,line:`  ${s.join("  \xB7  ")}`}}
// chunk-w9kaj2q7.js R [8392,8532), UTF-16; sha256 1479bafd2894220c025c495658286cfdb8082847183ab3410a1952f78b618191
function R(e,t,i){if(e)return{shown:{name:e.name,ref:e.ref},printed:Cbe(e)};return t===null?{shown:{},printed:i}:{shown:{name:t},printed:t}}
// chunk-w9kaj2q7.js C [8532,8703), UTF-16; sha256 f6a950e3f416e5a5274e810cf9e6ca09e079ec296dcd5cf849182c19e975fe54
function C(e,t,i,s=i.length){let n=i.map((r)=>r.line);if(s>i.length)n.push(`  (\u2026 ${s-i.length} more not shown)`);return{kind:e,total:s,rows:i,notes:[],text:A(t,n,s)}}
// chunk-w9kaj2q7.js te [8703,9025), UTF-16; sha256 7dfe245513407304e7a47bb1c4313fcb3fd89baad4233a7915af80acfe17c7d8
function te(e,t){let i=Date.now();return C("subagents","Subagents",e.map((s)=>{let n=s.name?t.get(`subagent\x00${s.agentId}`):void 0;return L(n?{shown:{name:n.name,ref:n.ref,id:s.agentId},printed:Cbe(n)}:{shown:{id:s.agentId},printed:s.agentId},[{type:s.agentType},{status:s.status},`started ${T(i-s.startTime)} ago`])}))}
// chunk-w9kaj2q7.js T [15008,15072), UTF-16; sha256 1a6912380f16b1950e6dad9c128e8292355654f94ed432418167105b4c41e13c
function T(e){return rn(Math.max(0,e),{mostSignificantOnly:!0})}
return { subagents: te, row: L, candidate: R, section: C, age: T };
}
