// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W183-permission-destinations.md.
// Modules:
//   chunk-fh503bhf.js sha256 b56435649f8c950fc45ba1d820716cfcf2fd1bfbd302d9f50acaba8e66ec8470
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { zr, $m, Aq, zo, i0, fp, mu, xk, CF, zg, ty, t, i, d, pe } from './plan-resume-host.js';
let R;

// chunk-fh503bhf.js f [1260,1289) 29 units sha256 c0aafed613421529adf273e2403612ee69c5347c7fc821ae1e320756298d0b27
function f(){return zr(R,!0)}

// chunk-fh503bhf.js R [1236,1259) 23 units sha256 afec5f70f1ef72569f5f8de01a0a2ccd9088f9bf9fe1763ff91005c9632128b1
R="tengu_tranquil_fern"

// chunk-fh503bhf.js g [1518,1616) 98 units sha256 3ccf402feaad1c54de2280066bc7e6b183072fb06c311fc5abff0ca95bd5539c
function g(e){if(e===void 0||e===null)return"absent";return typeof e==="string"&&$m(e)||"invalid"}

// chunk-fh503bhf.js P [1616,1673) 57 units sha256 423ea71049e08ca37c48d5ee1107f7ee8f686da0c07255ae960c1a4ce103cbc3
function P(e){return{...i0(e.mode,"plan",e),mode:"plan"}}

// chunk-fh503bhf.js _ [1749,1818) 69 units sha256 2357b1fa626191d000b1885c3ebd9ca57985b9be8d57861bd76703567b2bb877
function _(e){return f()&&e.mode!=="plan"&&Aq.isEnabled()&&!zo(e,Aq)}

// chunk-fh503bhf.js H9n [3071,4014) 943 units sha256 584920b8ff172d7060f04ca7fea8e29db91a54d5ce5a4d3844461943cc95caf4
function H9n(e){let n=`<${fp}>/plan</${fp}>`,o=new Set,s=new Set,r=x(e),a=!1,l=()=>a?"none":"open";for(let M=e.length-1;M>=0;M--){let u=e[M];if(u.type==="attachment"){let p=u.attachment.type;if(p==="plan_mode"||p==="plan_mode_reentry")return l();if(p==="plan_mode_exit")return"exited"}else if(u.type==="assistant"&&Array.isArray(u.message.content)){let p=u.message.content;for(let c=p.length-1;c>=0;c--){let m=p[c];if(m.type!=="tool_use")continue;if(m.name===mu&&s.has(m.id)&&!o.has(m.id)&&!r.has(m.id))return"exited";if(m.name===xk&&s.has(m.id)&&(!o.has(m.id)||r.has(m.id)))return l()}}else if(u.type==="user"&&CF(u)){let p=u.message.content;if(Array.isArray(p)){for(let c of p)if(c.type==="tool_result")(c.is_error||y(u,c.content)?o:s).add(c.tool_use_id)}}else if(u.type==="user"){if(zg(u)?.trimStart().startsWith(n))return l();if(u.permissionMode==="plan")return l();if(u.permissionMode!==void 0&&!u.isMeta&&ty(u.origin))a=!0}}return"none"}

// chunk-fh503bhf.js x [4014,4254) 240 units sha256 a4a96571aab4cde385a196d2f46945ba1e5d906ee47b2d0991dc798909adec94
function x(e){let n=new Set,o=new Set;for(let s of e){if(s.type!=="assistant"||!Array.isArray(s.message.content))continue;for(let r of s.message.content){if(r.type!=="tool_use")continue;if(n.has(r.id))o.add(r.id);else n.add(r.id)}}return o}

// chunk-fh503bhf.js y [4254,4455) 201 units sha256 209e9be29a498dffc2a9ea696affc2ca5f9d06dbbd16c478443932214ebd35a3
function y(e,n){let o=e.toolUseResult;if(o!==null&&typeof o==="object"&&o.awaitingLeaderApproval===!0)return!0;return typeof n==="string"&&n.startsWith("Your plan has been submitted to the team lead")}

// chunk-fh503bhf.js LBs [4967,5545) 578 units sha256 656c2551c1a29071c45831b1b8990f7f7904a82aa8faa47e02fc7d3e5d858366
function LBs(e,{storedPermissionMode:n,messages:o,forkSession:s,startupModePinned:r,lane:a}){let l=S$r();if(l.trustedMode=e.mode,l.recordedMode=g(n),!r&&!s&&_(e)){if(l.recordedMode==="plan"){if(l.recordTranscriptState=H9n(o),l.recordTranscriptState!=="exited")l.source="stored"}else if((l.recordedMode==="absent"||l.recordedMode==="invalid")&&H9n(o)==="open")l.transcriptOpen=!0,l.source="transcript"}if(E$r(l,{lane:a,hadExternal:!1,hadInternal:!1}),l.source==="none")return;return t(`[planModeResume] re-entering plan mode on resume (source: ${l.source}, was ${e.mode})`),P(e)}

// chunk-fh503bhf.js S$r [1289,1367) 78 units sha256 790c696da3cf0da80cd023a8d79aef336be8801892661e1407d1b52ba595392f
function S$r(){return{source:"none",trustedMode:void 0,recordedMode:"absent"}}

// chunk-fh503bhf.js E$r [5545,5968) 423 units sha256 ea9b42b676b302c615a749e0ced222595955b4eb43ce9593477153e61d26eca9
function E$r(e,{lane:n,hadExternal:o,hadInternal:s}){let r=e.source==="none"?e.trustedMode:"plan";i("tengu_worker_permission_mode_restore",{source:d(e.source),lane:d(n),trusted_mode:pe(e.trustedMode),recorded_mode:d(e.recordedMode),target_mode:pe(r),had_external:o,had_internal:s,guard_enabled:f(),...e.recordTranscriptState&&{record_transcript_state:d(e.recordTranscriptState)},...e.transcriptOpen&&{transcript_open:!0}})}


export { LBs, H9n };
