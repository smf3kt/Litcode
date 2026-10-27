// @ts-nocheck
// Exact identity bodies. See research/ports/W364-peer-idle.md.
import type { PeerIdleIdentity, PeerIdleIdentityHost } from './peer-idle-identity.js';
export function createPeerIdleIdentity(host: PeerIdleIdentityHost): PeerIdleIdentity {
const dt = host.run, Ul = host.readStartToken;
// chunk-3sda67c1.js Bjn [3812,4384), UTF-16; sha256 25611b3c85c200ac97a77f3e56120946cda7cc37943092275b5a63abc36ebaf6
async function Bjn(e,n=10){let r=`pid=${String(e)}; for i in $(seq 1 ${n}); do ppid=$(ps -o ppid= -p $pid 2>/dev/null | tr -d ' '); if [ -z "$ppid" ]; then echo FAIL; exit 0; fi; if [ "$ppid" = "0" ] || [ "$ppid" = "1" ]; then echo END; exit 0; fi; echo $ppid; pid=$ppid; done`,i=await dt("sh",["-c",r],{timeout:3000}),s=(i.stdout??"").trim().split(`
`).filter(Boolean);return{ancestors:s.filter((o)=>o!=="END"&&o!=="FAIL").map((o)=>parseInt(o,10)).filter((o)=>!isNaN(o)),readFailed:i.code!==0||s.at(-1)==="FAIL",truncated:i.code===0&&s.at(-1)!=="END"&&s.at(-1)!=="FAIL"}}
// chunk-bt8cr7rw.js Me [2573,2579), UTF-16; sha256 df5094f2a1bc1a8c22f5a1c95c550b1221259b791ebf3b713a4e66976e3577a6
var Me=500;

// chunk-bt8cr7rw.js Pe [2580,2585), UTF-16; sha256 8908e3b8446ebf81cddee6dcbd048ded0206bc70c983550bdef7b4d770917ef9
var Pe=32;

// chunk-bt8cr7rw.js he [2586,2862), UTF-16; sha256 a5eee3b9b778081336fe4e3cb0684f01e45ba2d0bc1b89ded4057971e67f8f59
class he{verdicts=new Map;lookup(e){let n=this.verdicts.get(e);if(n!==void 0)this.verdicts.delete(e),this.verdicts.set(e,n);return n}remember(e,n){if(this.verdicts.size>=Me){let i=this.verdicts.keys().next().value;if(i!==void 0)this.verdicts.delete(i)}this.verdicts.set(e,n)}}

// chunk-bt8cr7rw.js Ne [2887,3256), UTF-16; sha256 ed2b71ee33cdae688e819b2a61e691592321699d664dfa60c927198ed39d00f0
var Ne={readAncestors:async(e)=>{let{ancestors:n,readFailed:i,truncated:r}=await Bjn(e);if(r&&!i&&!n.includes(process.pid))({ancestors:n,readFailed:i,truncated:r}=await Bjn(e,Pe));if(!n.includes(process.pid)){if(i)throw Error("ancestry walk failed");if(r)throw Error("ancestry walk truncated (maxDepth) above the prefix")}return n},readStartToken:(e)=>Ul(e,{skipCache:!0})};
const cache = new he(), Fe = { of: () => cache }, B = () => ({ host: undefined });
// chunk-bt8cr7rw.js Le [3257,3343), UTF-16; sha256 1e5a2fd0b747dd5c0b95d8ae2b6509367f6890d63099f4eee97e3dadf39ca16c
function Le(e,n=process.pid){if(n===1)return!1;return Array.isArray(e)&&e.includes(n)}

// chunk-bt8cr7rw.js Ke [3343,3844), UTF-16; sha256 e197fd064c9c0599a7534537d356cc1b428ae4096d769c0acdaef86042a79fed
async function Ke(e,n=Ne){if(e===void 0||!Number.isInteger(e)||e<=0)return"no-evidence";let i;try{i=await n.readStartToken(e)}catch{i=void 0}if(i===void 0)return"no-evidence";let r=`${e}:${i}`,u=Fe.of(B().host),s=u.lookup(r);if(s!==void 0)return s?"self":"not-self";let p;try{p=await n.readAncestors(e)}catch{return"no-evidence"}let _;try{_=await n.readStartToken(e)}catch{_=void 0}if(_!==i)return"no-evidence";let w=process.pid!==1&&p.includes(process.pid);return u.remember(r,w),w?"self":"not-self"}

// chunk-bt8cr7rw.js ye [3844,4195), UTF-16; sha256 44e5cebe91d1036a9379ae627e0f692d847f686765f66b769aae690ff6cde750
async function ye(e){let n=e.selfPid??process.pid;if(e.selfSentAncestry!==void 0&&n!==1)return Le(e.selfSentAncestry,n);if(!e.needsVerdict)return!1;if(n===1||e.platform==="windows")return e.childTokenPresented;if(e.platform!=="macos")return!1;let i=await(e.verdictOf??Ke)(e.verifiedPeerPid);return i==="self"||i==="no-evidence"&&e.childTokenPresented}

return ye;
}
