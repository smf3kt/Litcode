// @ts-nocheck
// Source declarations. See research/ports/W365-unified-agent-messaging.md.
import { Rbe, ase } from './agent-address-source.js';
import type { AgentResolverHost, AgentResolverSource } from './agent-messaging-host.js';
// chunk-3qabb19b.js D [883,919), UTF-16; sha256 e08913e4ba564b11551e01e87af4d4ba5f0fde1d9cce2dc2407afcc87d3df2bb
function D(n){return[...new Set(n)]}
// chunk-3cynezh1.js K3 [348992,349242), UTF-16; sha256 afdbdf41ea1842538139f0537add258c8a4423aac67e922bcc835ae29b80bc7e
function K3(e,n,s){let i=new Set,d=[];for(let c of n){if(i.has(c))continue;if(i.add(c),Math.abs(c.length-e.length)>2)continue;let g=fZ(e,c,2);if(g<=2)d.push({name:c,distance:g})}return d.sort((c,g)=>c.distance-g.distance).slice(0,s).map((c)=>c.name)}
// chunk-3cynezh1.js fZ [349439,350004), UTF-16; sha256 819ca300ef3d402a3154347dbfcd636b49321c54739a3f7fb6bddf4d74751a9c
function fZ(e,n,s){if(e===n)return 0;let r=e.length,i=n.length,d=s+1;if(Math.abs(r-i)>s)return d;let c=new Int32Array(i+2).fill(d),g=new Int32Array(i+2).fill(d),m=new Int32Array(i+2).fill(d);for(let f=0;f<=Math.min(i,s);f++)g[f]=f;for(let f=1;f<=r;f++){let h=Math.max(1,f-s),y=Math.min(i,f+s);m[h-1]=h===1?Math.min(f,d):d;let S=m[h-1];for(let b=h;b<=y;b++){let k=Math.min(g[b]+1,m[b-1]+1,g[b-1]+(e[f-1]===n[b-1]?0:1),d);if(f>1&&b>1&&e[f-1]===n[b-2]&&e[f-2]===n[b-1])k=Math.min(k,c[b-2]+1);m[b]=k,S=Math.min(S,k)}if(m[y+1]=d,S>s)return d;[c,g,m]=[g,m,c]}return g[i]}
// chunk-nfna65jh.js bo [639,663), UTF-16; sha256 78a86fc4d78894eea1c5407765e1530fc581480e4d48984b081b369cb67a1a67
function bo(t){return t}
// chunk-cnq34fr6.js ar [4450,4506), UTF-16; sha256 d03ae7b1e423702ce4b865fb899ecd0d50c6e7fceb3ce68559afe40e4aa70f02
function ar(e){return e.replace(/^(?:session|cse)_/,"")}
// chunk-j8hqhz0c.js Pn [42501,42589), UTF-16; sha256 c24ef572ad04a3a12132288890cd7af5a75b919fc62fd8cc1474b63c4fd7bd02
function Pn(e){return typeof e==="object"&&e!==null&&"type"in e&&e.type==="local_agent"}
// chunk-sfn1dbxq.js Ulr [4241087,4241240), UTF-16; sha256 4132bd28a7c75933649f21d86869cdc7829ce1a5d12cfbbb39b239f6c2872482
function Ulr(e){if(typeof e!=="object"||e===null||!("type"in e)||!("agentType"in e))return!1;return e.type==="local_agent"&&e.agentType==="main-session"}
export function createAgentResolver(host: AgentResolverHost): AgentResolverSource {
const Qr = host.names.key, odt = host.names.choose, sV = host.names.parseRef, fD = host.names.reserved;
const B8 = () => false, ndt = value => value.startsWith("sid:"), w0t = value => `sid:${value}`, ntn = value => value.stableId ?? value.id;
const JE = value => host.isChildId(value) ? value : null;
const f = () => {}, g = () => {}, m = () => {};
// chunk-n2jtmdcb.js pe [17846,17850), UTF-16; sha256 2b9355c2de17a7393415fa468d2b5ab8790b183083478e5dfcf68864f5e266ba
var pe=3;
// chunk-n2jtmdcb.js ge [17851,17858), UTF-16; sha256 0cd93fc938e4a4ed95fa5260b710200e9a2bf6f1c4d9478574db1687d39d9dc4
var ge=5000;
// chunk-n2jtmdcb.js Ee [11760,11884), UTF-16; sha256 9855c649a186ffb8c0d514c6d386db33a050013cb7e774f83215d365acbd325e
function Ee(e,n,i){let s=A(e,n);if(s!=="cloud"&&s!=="remote-control")return;let o=e[n];return i.has(ar(o.id))?o.name:void 0}
// chunk-n2jtmdcb.js Ue [11884,12054), UTF-16; sha256 78a54d2da2c74ef51897d7637004ab96934d1cb0aeb442c97ad802d13ff714ac
function Ue(e,n){let i=n[0];if(i===void 0||i.length<3)return n;let s=Object.keys(e).filter((o)=>o!==i&&o.startsWith(i)&&!n.includes(o));return s.length===0?n:[...n,...s]}
// chunk-n2jtmdcb.js N [12054,12172), UTF-16; sha256 cebd0165a99d66ea808a2df9e5e716e32702ddc98794cdccee923cac75c74477
function N(e,n,i){for(let s of Ue(e,n)){let o=Ee(e,s,i);if(o!==void 0)return{pinnedIdentityClaimedLocally:o}}return{}}
// chunk-n2jtmdcb.js A [12172,12368), UTF-16; sha256 95883575639641aa285a20faace732b8890ce409d02856c92576ee29e748f0fb
function A(e,n){let i=Object.hasOwn(e,n)?e[n]:void 0;if(i===void 0)return;if(JE(i.id)!==null)return"agent";if(i.id.startsWith("cse_"))return"cloud";return ar(i.id)!==i.id?"remote-control":"local"}
// chunk-n2jtmdcb.js O [12865,13100), UTF-16; sha256 1339ee13ef4b1cd12b3f5e280df5e878a0b359e5d1ef1b92d8a0656e3384bd24
function O(e){return{...e.cloudUnavailable&&{cloudUnavailable:e.cloudUnavailable},...e.bridgeUnavailable&&{bridgeUnavailable:e.bridgeUnavailable},...e.localUnavailable&&{localUnavailable:!0},...e.searchTruncated&&{searchTruncated:!0}}}
// chunk-n2jtmdcb.js ue [13100,13825), UTF-16; sha256 a8230a65194e062b678f668dbbc6215ce6ed5be2716f4ddd4452ca5ef64909e0
function ue(e,n,i,s,o){let a=odt(e.byName,n,i);if(a){if(a.kind==="ambiguous"){let r=e.byName.get(n),d=ve(s.sendMessagePins,n,r,i,o);if(d)return ke(d,r,s,n,e,o);let l=N(s.sendMessagePins,[n],o.localClaimedRemoteBodies),c=r[0],u=A(s.sendMessagePins,n);if(r.length===1&&(c.kind==="session"||c.kind==="cloud-session"||c.kind==="bridge-session")&&!o.cloudUnavailable&&o.bridgeSettled&&!o.bridgeUnavailable&&!o.localUnavailable&&l.pinnedIdentityClaimedLocally===void 0&&u!=="agent"&&!c.derivedName){let b=j(c,s);if(b.kind==="local-session"||b.kind==="cloud-session")return{...b,exactUnique:!0,...u!==void 0&&{previouslyPinned:!0},...J(b,n,e,o,s.sendMessagePins)}}return{...B(r,"exact"),...O(o),...l}}return j(a.candidate,s)}return}
// chunk-n2jtmdcb.js De [13825,15473), UTF-16; sha256 d951475603c628e15330257211802179dcdf5a0da4b19c2d53215151e364e50d
function De(e,n,i,s){if(n.length>=3){let o=[...e.byName.keys()].filter((a)=>a.startsWith(n));if(o.length===1){let a=odt(e.byName,o[0]),r=A(i.sendMessagePins,n),d=N(i.sendMessagePins,[n],s.localClaimedRemoteBodies).pinnedIdentityClaimedLocally!==void 0;if(r!==void 0&&r!=="agent"||d){let l=e.byName.get(o[0]);return f("send_message_prefix_match",r!==void 0&&r!=="agent"?"typed_name_pinned":"prefix_of_claimed_pin"),{...B(a.kind==="one"?[a.candidate]:l,"prefix"),...O(s),...N(i.sendMessagePins,[n,o[0]],s.localClaimedRemoteBodies)}}if(a.kind==="ambiguous"){let l=e.byName.get(o[0]),c=ve(i.sendMessagePins,o[0],l,void 0,s,!0);if(c)return g("send_message_prefix_match",{input_len:n.length,index_size:e.candidates.length,pinned:1}),ke(c,l,i,o[0],e,s);if(l.length===1)f("send_message_prefix_match","confirm_required");else m("send_message_prefix_match","ambiguous_name");return{...B(l,"prefix"),...O(s),...N(i.sendMessagePins,[n,o[0]],s.localClaimedRemoteBodies)}}if(s.cloudUnavailable||s.bridgeUnavailable||s.localUnavailable)return f("send_message_prefix_match",s.cloudUnavailable||s.bridgeUnavailable?"remote_unsearched":"local_unsearched"),{...B([a.candidate],"prefix"),...O(s),...N(i.sendMessagePins,[n,o[0]],s.localClaimedRemoteBodies)};return g("send_message_prefix_match",{input_len:n.length,index_size:e.candidates.length,...s.searchTruncated&&{search_truncated:!0}}),j(a.candidate,i)}if(o.length>1)return m("send_message_prefix_match","ambiguous_prefix"),{...O(s),...N(i.sendMessagePins,[n,...o],s.localClaimedRemoteBodies),...B(o.flatMap((a)=>{let r=e.byName.get(a),d=odt(e.byName,a);return d?.kind==="one"?[d.candidate]:r}),"prefix")}}return}
// chunk-n2jtmdcb.js me [15473,15597), UTF-16; sha256 da0d520076ffb6a4ce84417b755ce1fdc7e029b857bad0a5c5e1bc4ab21f3a7a
function me(e,n,i){let s=e.byName.get(n)??[],o=odt(e.byName,n);return(o?.kind==="one"?[o.candidate]:s).find((r)=>r.ref===i)}
// chunk-n2jtmdcb.js X [16762,17074), UTF-16; sha256 9ade777b914e7a1d16c2d92d4c1f53fde13d418fd7b1442b0c76886218998d3f
function X(e,n,i){let s=e.tasks[n];if(Pn(s)&&!Ulr(s)){if(s.status==="running")return{kind:"agent-live",agentId:n,agentName:i};if(s.stoppedByUser)return{kind:"agent-stopped-by-user",agentName:i};return{kind:"agent-stopped",agentId:n,status:s.status,agentName:i}}return{kind:"agent-evicted",agentId:n,agentName:i}}
// chunk-n2jtmdcb.js j [17074,17842), UTF-16; sha256 d356da58f11902fda5cdf3b1661b12ff41e08c39d065b0128cb4ff22ec53b5d4
function j(e,n){switch(e.kind){case"main":return{kind:"main"};case"teammate":return{kind:"mailbox",recipientName:e.name,memberAgentId:e.id,memberIdentitySource:e.where==="in-process"?"team-context":"roster"};case"subagent":return X(n,bo(e.id),e.name);case"session":return{kind:"local-session",sock:e.sock,pinId:ntn(e),...e.claimedSessionIds!==void 0&&{claimedSessionIds:e.claimedSessionIds},displayName:e.name,...e.hostSessionId!==void 0&&{hostSessionId:e.hostSessionId}};case"cloud-session":case"bridge-session":return{kind:"cloud-session",via:e.where==="cloud"?"cloud":"remote-control",refKind:e.kind,sessionId:e.id,displayName:e.name,...e.offline&&{offline:!0},...e.reportsInbound&&{reportsInbound:!0},...e.inboundReportUnavailable&&{inboundReportUnavailable:!0}}}}
// chunk-n2jtmdcb.js B [17859,17952), UTF-16; sha256 2ec16af88a8394bf1ab55b25953128d4a3f8530510f20220694170303ace811c
function B(e,n){return{kind:"ambiguous",candidates:e.slice(0,pe),total:e.length,matchedBy:n}}
// chunk-n2jtmdcb.js be [17952,18489), UTF-16; sha256 a52725a36497717f68f4c0268aefc3a92b3d08c7d799ac260fcf648ece1a2159
function be(e,n,i,s){if(!B8())return{};let o=n.filter((c)=>_5e(c)&&c.sessionId!==void 0&&c.formerNames?.some((u)=>u.sessionId===c.sessionId&&Qr(u.name)===e));if(o.length!==1)return{};let a=o[0];if(n.filter((c)=>_5e(c)&&ase(c.sock,a.sock)).length!==1)return{};let d=i.candidates.find((c)=>c.kind==="session"&&c.sock!==void 0&&Rbe(c.sock,a.sock));if(d===void 0||sV(d.name)!==null||fD(d.name)||(i.byName.get(Qr(d.name))?.length??0)!==1)return{};let l=Object.hasOwn(s,e)?s[e]:void 0;if(l!==void 0&&l.id!==ntn(d))return{};return{renamedTo:d}}
// chunk-n2jtmdcb.js U [18489,18661), UTF-16; sha256 240826ee7a9875c95e05bece76f1a4656aeac03f109a5bc037d04c57cfdaea1a
function U(e,n,i){let s=i?n.candidates.filter(i):n.candidates,o=D(s.map((r)=>Qr(r.name)));return{kind:"not-found",closest:K3(e,o,pe).map((r)=>s.find((d)=>Qr(d.name)===r))}}
// chunk-n2jtmdcb.js ve [18661,19377), UTF-16; sha256 37f3958ce706af4b310e2ec2baeefca43eda50495a24fc5b549e08b8535fdda6
function ve(e,n,i,s,o,a=!1){let r=Object.hasOwn(e,n)?e[n]:void 0;if(r===void 0)return;let d=A(e,n);if(d==="agent")return;let l=d!=="local";if(l&&o.localClaimedRemoteBodies.has(ar(r.id)))return;if(d==="cloud"&&o.cloudUnavailable||d==="remote-control"&&o.bridgeUnavailable||d==="local"&&o.localUnavailable||a&&(o.cloudUnavailable||o.bridgeUnavailable||o.localUnavailable))return;let c=i.filter((b)=>(l?b.kind==="cloud-session"||b.kind==="bridge-session":b.kind==="session")&&b.where!=="in-process"),u=c.find((b)=>ntn(b)===r.id)??c.find((b)=>Re(r,b));if(u===void 0){if(!(l&&o.searchTruncated))f("send_message_pin","stale");return}if(s!==void 0&&u.name!==s&&i.some((b)=>b.name===s))return;return g("send_message_pin"),u}
// chunk-n2jtmdcb.js ke [19377,19797), UTF-16; sha256 526a47c2c09b9574376706965cdaeea0c54d039e51a796a3ad0d14ffaaacf03f
function ke(e,n,i,s,o,a){let r=j(e,i);if(r.kind!=="local-session"&&r.kind!=="cloud-session")return r;let d=Object.hasOwn(i.sendMessagePins,s)?i.sendMessagePins[s]:void 0,c=r.kind==="local-session"&&d!==void 0&&d.id!==r.pinId&&d.sock!==void 0&&Rbe(d.sock,r.sock)&&ndt(d.id)&&!ndt(r.pinId)?{...r,pinId:d.id,identityContested:!0}:r;return{...c,...n.length>1&&{sameNamedSiblings:n.length-1},...J(c,s,o,a,i.sendMessagePins)}}
// chunk-n2jtmdcb.js ye [19797,19997), UTF-16; sha256 e88647ed4d225bf8d1d0ffe90823c305b496b0a46e1f2535e1e9df9b63590535
function ye(e,n,i){let s=new Set([...n.sessions.map((o)=>ar(o.id)),...(i??[]).map((o)=>ar(o.id))]);return new Set(e.flatMap((o)=>o.bridgeSessionId!==void 0&&s.has(ar(o.bridgeSessionId))?[o.sock]:[]))}
// chunk-n2jtmdcb.js Re [19997,20216), UTF-16; sha256 ce80a50ea66fda06a117538d95728ba7ddd8851d4789fec0915e84d21c3ee7db
function Re(e,n){if(ntn(n)===e.id)return!0;if(e.sock===void 0||n.kind!=="session"||n.sock===void 0||!Rbe(n.sock,e.sock))return!1;return!ndt(e.id)||n.stableId===void 0&&(n.claimedSessionIds??[]).some((i)=>w0t(i)===e.id)}
// chunk-n2jtmdcb.js J [20216,20653), UTF-16; sha256 051f26a2b249a6569388699830a65ceab5867ede3c3e4c67260ea9d02dfcd0b9
function J(e,n,i,s,o){let a=Object.hasOwn(o,n)?o[n]:void 0;return{...e.kind==="local-session"&&a?.sock!==void 0&&a.id===e.pinId&&!Rbe(a.sock,e.sock)&&{restartedSincePin:!0},...e.kind==="local-session"&&s.socksMirroredRemotely.has(e.sock)&&{alsoListedRemotely:!0},...[...i.remoteNamesClaimedLocally.get(n)??[]].some((r)=>e.kind!=="local-session"||r!==e.sock)&&{remoteNamesakeClaimedLocally:!0},...s.searchTruncated&&{searchTruncated:!0}}}
return { exact: ue, prefix: De, byRef: me, route: j, child: X, missing: U };
}
