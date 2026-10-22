// @ts-nocheck
// Exact UTF-16 bodies and host bindings: research/ports/W289-background-footer.md.
var FS="\u25C7";
var ZA="\u25C6";
function F(n,e){let r=0;for(let t of n)r+=+!!e(t);return r}
// This host has no armed Artifact auto-react monitors.
const oae = () => false;
function Vg(e){if(e.status!=="running"&&e.status!=="pending")return!1;if("isBackgrounded"in e&&e.isBackgrounded===!1)return!1;return!0}
function Pt(e){return e.type==="monitor_ws"&&e.ambient===!0&&e.frameLive?.explicit!==!0}function TAe(e){return Pt(e)}
function Sjr(t){let r=t[0];if(!r)return null;let e=t.length;if(t.every((n)=>n.type===r.type))switch(r.type){case"local_bash":{let n=F(t,(s)=>s.type==="local_bash"&&s.kind==="monitor"),o=e-n,a=[];if(o>0)a.push(o===1?"1 shell":`${o} shells`);if(n>0)a.push(n===1?"1 monitor":`${n} monitors`);return a.join(", ")}case"in_process_teammate":{let n=new Set(t.map((o)=>o.type==="in_process_teammate"?o.identity.teamName:"")).size;return n===1?"1 team":`${n} teams`}case"local_agent":return e===1?"1 local agent":`${e} local agents`;case"remote_agent":{if(e===1&&r.isUltraplan)switch(r.ultraplanPhase){case"plan_ready":return`${ZA} ultraplan ready`;case"needs_input":return`${FS} ultraplan needs your input`;default:return`${FS} ultraplan`}if(t.every((n)=>n.type==="remote_agent"&&n.remoteTaskType==="remote-workflow"))return e===1?`${FS} 1 remote dynamic workflow`:`${FS} ${e} remote dynamic workflows`;return e===1?`${FS} 1 cloud session`:`${FS} ${e} cloud sessions`}case"local_workflow":return e===1?"1 background dynamic workflow":`${e} background dynamic workflows`;case"monitor_mcp":case"monitor_ws":{if(t.every(oae))return e===1?"1 Artifact comment monitor":`${e} Artifact comment monitors`;return e===1?"1 monitor":`${e} monitors`}case"mcp_task":return e===1?"1 MCP task":`${e} MCP tasks`;case"dream":return"dreaming";case"auto_mode_scan":return"auto-mode scan";case"local_memory_import":return r.windowsPlanned>0?`memory import ${r.windowsDone}/${r.windowsPlanned}`:"memory import";default:}return i(e)}function vyt(t,r){return r===0?Sjr(t):i(t.length+r)}function i(t){return`${t} background ${t===1?"task":"tasks"}`}
export { vyt, Vg, TAe };
