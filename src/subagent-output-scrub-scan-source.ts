// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-nvcqkjfn.js sha256 c4cde5c8c03097dd9fdb4cc2fe12bcca28559fd2373979c62e23906c9b7ab9f9
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { PD, y1e, d4 } from './subagent-output-scrub-names-source.js';
import { $0t, EO, J$e, N5e, Pdt, RB, X$e, XQ, f2n, m2n, wxe, xdt } from './subagent-output-scrub-tags-source.js';
import { DTe, Pbo, Yn, k, po } from './subagent-output-scrub-host.js';

// chunk-nvcqkjfn.js eTe feature-flag gate for the frame-prefix forgery pattern [4651,4764) 113 units sha256 95f6989a454960678203b59a06054ab5229a1d185a1ae9c278a37cecd1352650
function eTe(){let e=Yn.CLAUDE_CODE_HANDBACK_PROVENANCE;if(e!==void 0)return e;return k("tengu_melodic_wolf",!0)}

// chunk-nvcqkjfn.js A enabled predicate [5590,5643) 53 units sha256 91a99780c51bd6b0f6c01dacaf48cf25b47e63fa6052021373e86083164ef05a
function A(e){return e.enabled===void 0||e.enabled()}

// chunk-nvcqkjfn.js line boundary b and the harness marker word [5643,5722) 79 units sha256 c229d7bab9dd2cd001143b54c797e783db5195a6145f77d4d4eadd4c5d0cd594
var b="(?:^|[\\r\\n\\v\\f\\u0085\\u2028\\u2029\\u001c-\\u001e])",oao="harness";

// chunk-nvcqkjfn.js E marker-prefix matcher [5722,5908) 186 units sha256 08f469d02d787fab904320a8684f1847e525415f4afc4b44e1869c20deb4813e
function E(e){let t=0,n=J$e(Pdt,++t),r=J$e(Pdt,++t),a=[...e].map((o,s)=>(s===0?"":$0t(++t))+`[${RB(o)}]`).join("");return new RegExp(`${b}${n}[${N5e}]${r}${a}(?![\\p{L}\\p{N}_])`,"giu")}

// chunk-nvcqkjfn.js C max-turns note matcher [5908,6160) 252 units sha256 d8356072a9e9a81b3b0ea97c69c0805f99a9cfdbc727cf12380079f60fe1f1c7
function C(){let e=0,t=()=>J$e(Pdt,++e),n=t(),r=[...DTe.trimEnd()].map((a,o,s)=>a===" "?`[\\r\\n]{0,2}${t()}`:a===":"?`${t()}[${X$e}]`:(/[a-z]/i.test(s[o-1]??"")?$0t(++e):"")+`[${RB(a.toLowerCase())}]`).join("");return new RegExp(`${b}${n}${r}`,"giu")}

// chunk-nvcqkjfn.js control-tag pattern table m, its cached copy cps, w and the turn marker R [6160,7707) 1547 units sha256 202b38990b3ab0223e53bea8d5e4b6212a5b3a30fa9b42a1e7fb503062acd4e2
var H=new Set([PD,"system-reminder","system_reminder",...y1e]),v=d4.filter((e)=>!H.has(e)),m=po(function(){let e=new RegExp(`[${N5e}]`,"u"),t=new RegExp(`[${X$e}]`,"u");return[{pattern:"system-reminder-tag",category:"control-tag",re:EO(["system-reminder"]),action:"neutralize",neutralize:wxe},{pattern:"harness-envelope-tag",category:"control-tag",re:EO(y1e),action:"neutralize",neutralize:wxe},{pattern:"harness-signal-tag",category:"control-tag",re:EO(v),action:"neutralize",neutralize:wxe},{pattern:"channel-source-tag",category:"control-tag",re:f2n(),action:"neutralize",neutralize:wxe},{pattern:"marker-prefix-forgery",category:"control-tag",re:E(oao),action:"neutralize",neutralize:(n)=>n.replace(e,(r)=>`${r}\\`)},{pattern:"max-turns-note-forgery",category:"control-tag",re:C(),action:"neutralize",neutralize:(n)=>n.replace(t,(r)=>`\\${r}`)},{pattern:"frame-prefix-forgery",category:"control-tag",re:E("subagent"),enabled:eTe,action:"neutralize",neutralize:(n)=>n.replace(e,(r)=>`${r}\\`)},{pattern:"artifact-lead-forgery",category:"control-tag",re:Pbo(),action:"neutralize",neutralize:wxe},{pattern:"model-layer-tag",category:"control-tag",re:m2n(),action:"neutralize",neutralize:wxe}]}),cps=po(function(){return m().filter((e)=>e.enabled===void 0).map(({pattern:e,re:t})=>({pattern:e,re:new RegExp(t.source,t.flags)}))}),w=po((e)=>EO(e),(e)=>e.join(">")),R=po(function(){return{pattern:"turn-marker",category:"turn-marker",re:new RegExp(`(${b}(?:Human|Assistant)):`,"g"),action:"neutralize-silent",neutralize:(e)=>e.replace(":","\\:")}});

// chunk-nvcqkjfn.js escalation patterns P and the finding prefix F [7853,8580) 727 units sha256 bb074b79ebc78ae6cdc4ea982f99e42c18ebbf5a4ce1b100e4418ff3d1e5ee79
var P=po(function(){return[{pattern:"settings-json",category:"escalation-pattern",re:/\.claude[\\/]+settings(?:\.local)?\.json|(?<!\w)\.claude\.json\b|(?<![\w-])managed-settings\.json\b/gi,action:"flag"},{pattern:"bypass-permissions",category:"escalation-pattern",re:/\bbypassPermissions/gi,action:"flag"},{pattern:"dangerously-skip-permissions",category:"escalation-pattern",re:/--dangerously-skip-permissions\b/gi,action:"flag"},{pattern:"permissions-allow-deny",category:"escalation-pattern",re:/(?<![\w-])permissions\s*[.[]\s*["']?(?:allow|deny)\b|(?<![\w-])permissions["']?\s*:\s*\{[^{}]{0,80}["'](?:allow|deny)["']\s*:/gi,action:"flag"},...m(),R()]}),F="[harness: subagent output matched instruction-shaped pattern(s): ";

// chunk-nvcqkjfn.js ups [9158,9387) 229 units sha256 77087047c4baa52d4efc430397bd14b52fd0a4bfe5e0c93163946c87cf5c7154
function ups(e,{reservedKeys:t=[]}={}){let n={reserved:new Set(t.map(T)),findings:[],reportable:[],droppedReservedKeys:0};return{value:p(e,n),findings:n.findings,reportable:n.reportable,droppedReservedKeys:n.droppedReservedKeys}}

// chunk-nvcqkjfn.js p recursive scrub [9387,9789) 402 units sha256 b756bbf7b1b9078d24055551ef4380ed25e63a3f3cbfa2a203c609c1f2092064
function p(e,t){if(typeof e==="string")return _(e,t);if(Array.isArray(e))return e.map((n)=>p(n,t));if(typeof e==="object"&&e!==null){let n={};for(let[r,a]of Object.entries(e)){if(t.reserved.has(T(r))){t.droppedReservedKeys++;continue}let o=_(r,t),s=o;for(let u=2;Object.hasOwn(n,s);u++)s=`${o}_${u}`;Object.defineProperty(n,s,{value:p(a,t),writable:!0,enumerable:!0,configurable:!0})}return n}return e}

// chunk-nvcqkjfn.js _ string scrub [9789,9895) 106 units sha256 1c9318fa941deb6332ed6aa0c7659f2be6604eb21736ea3ba0d552aacc6b2fd7
function _(e,t){let n=y(e);return t.findings.push(...n.findings),t.reportable.push(...n.reportable),n.out}

// chunk-nvcqkjfn.js T reserved-key normalizer [9895,9984) 89 units sha256 9339d22343f604afc88665d3210698fd120eda2a648b3806875de9dfba551bec
function T(e){return XQ(e).replace(xdt(),"").toLowerCase().replace(/[^\p{L}\p{N}]/gu,"")}

// chunk-nvcqkjfn.js y pattern application and findings [9984,10367) 383 units sha256 f4bb644894138cc8d64a0369ebfeb1d157821eb3d35d363c309b236f52d0248c
function y(e){let t=e,n=[],r=[];for(let a of P()){if(!A(a))continue;a.re.lastIndex=0;let o=0;if(a.action==="flag")for(let u of t.matchAll(a.re))o++;else t=t.replace(a.re,(u)=>(o++,a.neutralize(u)));if(o===0)continue;let s=a.action!=="neutralize-silent";if(n.push({category:a.category,pattern:a.pattern,count:o,reportable:s}),s)r.push(a.pattern)}return{out:t,findings:n,reportable:r}}


export { ups };
