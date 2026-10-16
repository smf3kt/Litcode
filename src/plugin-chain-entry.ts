// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Nl, zd, yyt, $be, mlt, kyt } from './plugin-chain-host.js';
import { TDe } from './plugin-chain-host-call-source.js';
import { He, aP, sIt, QPt } from './plugin-chain-source.js';
import { iOn, P0, jDe, aJ } from './plugin-chain-records.js';

// chunk-sfn1dbxq.js chain module from a site and a core [459384,459472) 88 units sha256 a8384b7c216f6a52114ebca334b1f7d45a23ba84625b2f55abac7be0d7d3b07c
var Mm=(e,n)=>({site:zd[e],core:{name:"core",isCore:!0,budgetMs:0,run:async(r)=>n(r)}});

// chunk-sfn1dbxq.js prompt.edit rewrite [460409,460606) 197 units sha256 7ebc2586c6b266771da93795a89165599ddaa5719ac45f77a170d9a72459c7a7
function cze(e){let n=Math.max(0,Math.min(e.start,e.text.length)),r=Math.max(n,Math.min(e.end,e.text.length));return{text:e.text.slice(0,n)+e.inputText+e.text.slice(r),cursor:n+e.inputText.length}}

// chunk-sfn1dbxq.js chain payload builders [448345,449264) 919 units sha256 d399d147bdfeee7912fecda9e686023bcb59ebe9e97723da6ccc0d11c6da7521
var tht={"tool.call":(e)=>({...e,tool_use_id:e.tool_use_id??`toolu_${UVn().replace(/-/g,"")}`}),"tool.check":(e)=>e,"tool.describe":(e)=>e,"command.run":(e)=>e,"command.describe":(e)=>e,"config.set":(e)=>e,"config.describe":(e)=>e,"telemetry.log":nre,"telemetry.mark":(e)=>e,"prompt.submit":(e)=>e,"prompt.fill":(e)=>e,"prompt.edit":(e)=>e,"prompt.autocomplete":(e)=>e,"prompt.suggest":(e)=>e,"prompt.section":(e)=>e,"prompt.context":(e)=>e,"prompt.attachment":(e)=>e,"prompt.mention":(e)=>e,"prompt.compose":(e)=>e,"agent.offer":(e)=>e,"agent.spawn":(e)=>e,"skill.prompt":(e)=>e,"attribution.text":(e)=>e,"session.start":(e)=>e,"session.receive":(e)=>e,"session.append":(e)=>e,"session.send":(e)=>e,"session.compact":(e)=>e,"session.attach":(e)=>e,"session.detach":(e)=>e,"session.measure":(e)=>e,"session.end":(e)=>e,"turn.start":(e)=>e,"turn.step":(e)=>e,"turn.complete":(e)=>e,"ui.scroll":(e)=>e,"ui.focus":(e)=>e};

// chunk-sfn1dbxq.js post-processing set [480686,480772) 86 units sha256 613f62d5c9acebbdd86a4099213c6d9ebbe7517f3c55f4a1a63c2733311c8dbe
var _yt=new Set(["config.describe","command.describe","tool.describe","agent.offer"]);

// chunk-sfn1dbxq.js supported chain set [480865,480953) 88 units sha256 5fd48d29d06e7f302428a9ed739d309769b042de1ba81d3048dc3f6006d8dcd9
var Syt=new Set(Object.keys(QPt).filter(mlt).filter((e)=>!kyt.has(e)&&QPt[e]!==void 0));

// chunk-sfn1dbxq.js managed handler merge [448143,448245) 102 units sha256 95aedb54a15c1910d8c013dd1aa3127c4190b3a5091e043aa0c9ed1c55093950
function Zoe(e,n,r){let s=r===void 0?[]:[r];return e===void 0||n.length===0?[...n,...s]:[e,...n,...s]}

// chunk-sfn1dbxq.js handlers inserted at the engine seat [3071708,3071816) 108 units sha256 be2a62cb64d617086f88bcfa0e0ce2364888971967a2e236ad1747af69ca02fa
function Kdn(e,n){let r=e.findIndex((s)=>s.answersForEngine===!0);return e.toSpliced(r===-1?e.length:r,0,n)}

// chunk-sfn1dbxq.js chain entry [3071816,3072765) 949 units sha256 c1551f02f6e43c2a1a9ceb7136e3afcb7c32c87f1a076b82f45e4eb74766fc20
var ga=(e,n)=>(r)=>{let s=Syt.has(e)&&!n.withoutModuleHandlers,h=tht[e](r),y=s?iOn({event:e,e:h,origin:n.origin,only:n.only},n.signal):void 0;if(y!==void 0)return y.then(()=>ga(e,n)(r));let b=sIt(),w=b?void 0:n.core?.[e]??yyt()[e];if(w===void 0&&!b)return Promise.reject(new He(`$.${e}: no core at the bottom of the chain (the site did not install one and the call supplied none)`));let M=$be()[e],z=n.withoutModuleHandlers?[]:P0(e,n.origin,{only:n.only,...M.pinnedKeys!==void 0&&{pinned:{keys:M.pinnedKeys,e:h}}}),V=b?void 0:n.managed?.[e],X=b?n.withheldCore?.[e]:void 0,he=b?n.withheldFloor?.[e]?.(h):void 0,_e=X===void 0?z:Kdn(z,X),ke=Zoe(V,_e,w),Se=V!==void 0&&z.length===0&&M.pinnedKeys!==void 0&&!n.withoutModuleHandlers&&jDe(e,n.origin,{only:n.only}).length>0,Re=aP({e:h,handlers:Se?[V,...ke]:ke,site:M,signal:n.signal,cutAt:n.cutAt,origin:aJ(n.origin),trace:n.trace,...he!==void 0&&{bottom:he}});return _yt.has(e)?Re.then((Ae)=>TDe(Ae)):Re};

// chunk-sfn1dbxq.js tool-use id source [448245,448283) 38 units sha256 b780887a855b4101ff3271bf2896ea4b9a14c244d443e19b5d0053e7efba77c4
import{randomUUID as UVn}from"crypto";

// chunk-sfn1dbxq.js telemetry payload default route [448283,448345) 62 units sha256 126b7c75d95786e7acb2d7495baaf937bc3ad35342b704f916724ebf0df548b4
var nre=(e)=>e.to==="collector"?e:{...e,to:e.to??"anthropic"};


export { ga, tht, _yt, Syt, Zoe, Kdn, Mm, cze, nre, UVn };
