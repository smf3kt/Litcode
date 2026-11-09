// @ts-nocheck
// Copied recovered state machine; the typed contract below bounds the host seams.
// Original sample is never imported. See W385 #43 reactive compaction port.
import type Anthropic from '@anthropic-ai/sdk';

export type CompactionRecord = {
  type: 'user' | 'assistant'; uuid: string;
  message: Anthropic.MessageParam & { id?: string };
  isMeta?: boolean; isVirtual?: boolean;
};
export type CompactionAttempt =
  | { ok: true; summaryText: string; messages: Anthropic.Message[]; totalUsage: Anthropic.Usage; forkAssistantMessageCount: number }
  | { ok: false; reason: 'prompt_too_long'; tokenGap?: number; viaCreditsBoundary?: boolean }
  | { ok: false; reason: 'media_too_large' | 'aborted' }
  | { ok: false; reason: 'error'; detail: string; errorKind?: string; status?: number; isTimeout?: boolean };
export type CompactionOptions = {
  signal: AbortSignal; allowFallback?: boolean; initialTokenGap?: number;
  apiAttemptsLeft?: { count: number };
  summarize: (records: CompactionRecord[], mode: { stripMedia: boolean; headTruncated: boolean }) => Promise<CompactionAttempt>;
};
export type CompactionResult =
  | { ok: true; result: { summaryMessages: Anthropic.Message[]; summaryText: string; messagesToPreserve: CompactionRecord[];
      attempt: number; totalUsage: Anthropic.Usage; forkAssistantMessageCount: number;
      groupsPreserved: number; totalGroups: number; splitKind: 'round' | 'summarize_all'; headTruncations: number } }
  | { ok: false; reason: 'too_few_groups' | 'exhausted' | 'aborted' | 'error' | 'media_unstrippable';
      attempts: number; totalGroups: number; detail?: string; splitKind?: 'summarize_all'; headTruncations?: number };

export function reactiveCompact(records: CompactionRecord[], options: CompactionOptions): Promise<CompactionResult> {
  // MC/cache/telemetry adapters: host records already contain rendered attachments.
  const t=()=>{}, i=()=>{}, pe=value=>value, d=value=>value, S=value=>value;
  const L=value=>value!==null&&typeof value==='object'&&!Array.isArray(value), _=JSON.stringify;
  const j8=()=>undefined, uF=()=>undefined, Ptt=()=>undefined;
  const WSs=()=>options.allowFallback??true;
  const foreignAttachment=()=>{throw Error('Compaction requires normalized host message records');};
  const Tur=foreignAttachment, Mce=foreignAttachment, sOe=foreignAttachment;
  const xe=({content,isMeta})=>({type:'user',uuid:'compaction-retry-marker',isMeta,message:{role:'user',content}});
  const Ndr=async(rows,_context,_instructions,stripMedia,_kind,_thinking,_advisor,headTruncated)=>{
    if(options.apiAttemptsLeft)options.apiAttemptsLeft.count--;
    return options.summarize(stripMedia?cSe(rows):rows,{stripMedia,headTruncated});
  };
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; lSe [2512462,2517851), UTF-16.
async function lSe(e,n,r){let s=Gtt(e),h=j8(e),y=uF(e),b=s.length,w=Ptt(e);if(b<2)return t("Reactive compact: fewer than 2 groups, nothing to compact",{level:"info"}),{ok:!1,reason:"too_few_groups",attempts:0,totalGroups:b};let M=r?.allowFallback!==!1&&WSs(),z=n.toolUseContext.abortController.signal,V=1,X=0,he=void 0,_e,ke=!1,Se=!1,Re=void 0,Ae=null,Pe=!1,Me,$e;if(r?.initialTokenGap!==void 0&&b>3){_e=s.map((Je)=>og(Je));let Ve=r.initialTokenGap-(_e[b-1]??0);if(Ve>0){let Je=Dnn(_e,b-1,Ve);V=1+Je,he={mode:"seeded",step:Je,tokenGap:r.initialTokenGap}}}while(!0){if(z.aborted)return{ok:!1,reason:"aborted",attempts:X,totalGroups:b,...Ae!==null&&{splitKind:"summarize_all",headTruncations:Ae.headTruncations}};if(n.toolUseContext.compactionApiAttemptsLeft?.count===0)return{ok:!1,reason:"exhausted",attempts:X,totalGroups:b};let Ve,Je;if(Ae===null){let Wt=Math.max(0,b-V);if(Ve=s.slice(0,Wt).flat(),!Ve.some((Vt)=>Vt.type==="assistant")&&!(Pe&&Wt===1)){if(!M)return t("Reactive compact: no assistant messages in summarize set, bailing",{level:"info"}),sSe(Se,X),{ok:!1,reason:Inn(X),attempts:X,totalGroups:b};let{toSummarize:Vt,toKeep:qt}=Wdr(s.flat()),on=[];if(Re?.tokenGap!==void 0){let bn=_e??=s.map((an)=>og(an));on.push(Re.tokenGap+bn.slice(Re.summarizeEnd).reduce((an,nn)=>an+nn,0))}if(r?.initialTokenGap!==void 0)on.push(r.initialTokenGap);if(Me!==void 0)on.push(Me+og(qt));if($e!==void 0){let bn=_e??=s.map((an)=>og(an));on.push($e+bn.slice(1).reduce((an,nn)=>an+nn,0))}let Tn;if(on.length>0){let bn=Math.max(...on)-og(qt);if(bn>0)Tn={tokenGap:bn}}else if(Re!==void 0)Tn={tokenGap:void 0};if(Tn?.tokenGap!==void 0&&Wt===1&&Mnn(s,Math.max(...on))){Pe=!0,t(`Reactive compact: round ladder exhausted, summarizing the opening round alone first (keeping ${b-1}/${b} groups); head drop if that yields no summary`,{level:"info"});continue}let Mn=Tn===void 0?TYe(Vt,[]):TYe(iSe(Vt,Tn.tokenGap,ke),qt);if(Mn===null)return t("Reactive compact: nothing substantive fits in a summarize request, giving up",{level:"info"}),sSe(Se,X),{ok:!1,reason:Inn(X),attempts:X,totalGroups:b,splitKind:"summarize_all",headTruncations:0};Ae={toSummarize:Mn,toKeep:qt,headTruncations:Tn===void 0?0:1},he=void 0,t(`Reactive compact: round ladder exhausted, last resort (keeping ${qt.length} trailing messages, head truncations so far: ${Ae.headTruncations})`,{level:"info"});continue}Je=s.slice(Wt).flat()}else Ve=Ae.toSummarize,Je=Ae.toKeep;let nt=Ae===null?"round":"summarize_all",ut=Ae?.headTruncations??0,Ze=Ae===null?V:0;X++,i("tengu_reactive_compact_attempt",{attempt:X,groupsToSummarize:Ae===null?b-V:b,groupsToPreserve:Ze,messagesToSummarize:Ve.length,strippedMedia:ke,stepMode:pe(he?.mode),stepSize:he?.step,tokenGap:he?.tokenGap,splitKind:d(nt),headTruncations:ut});let pt=await Ndr(Ve,n,r?.customInstructions,ke,r?.compactionRequestKind,h,y,ut>0,r?.skipMessageCacheMarkers??!1,w,r?.onResponseLength),Rt=Pe&&Ae===null?Udr(pt,ke):void 0;if(Rt!==void 0){V=b,t(`Reactive compact: attempt ${X} sent the opening round alone and ${Rt}; discarding that outcome, the last resort drops the round from its input instead`,{level:"info"});continue}if(pt.ok){if(Se)i("tengu_compact_credits_clamp_rescue",{outcome:S("ok"),attempts:X});return{ok:!0,result:{summaryMessages:pt.messages,summaryText:pt.summaryText,messagesToPreserve:Je,attempt:X,totalUsage:pt.totalUsage,forkAssistantMessageCount:pt.forkAssistantMessageCount,promptArm:pt.promptArm,scopeWarned:pt.scopeWarned,groupsPreserved:Ze,totalGroups:b,splitKind:nt,headTruncations:ut}}}let Et=Ae===null?{}:{splitKind:nt,headTruncations:ut};switch(pt.reason){case"aborted":return{ok:!1,reason:"aborted",attempts:X,totalGroups:b,...Et};case"error":return sSe(Se,X),{ok:!1,reason:"error",attempts:X,totalGroups:b,detail:pt.detail,errorKind:pt.errorKind,status:pt.status,isTimeout:pt.isTimeout,...pt.isDlpDenied&&{isDlpDenied:!0},...Et};case"media_too_large":if(!ke){ke=!0,X--,t("Reactive compact: summarize hit media-size error, retrying stripped",{level:"info"});continue}return{ok:!1,reason:"media_unstrippable",attempts:X,totalGroups:b,...Et};case"prompt_too_long":break}if(pt.viaCreditsBoundary)Se=!0;if(Ae!==null){if(!Pe&&Ae.headTruncations===0&&pt.tokenGap!==void 0&&Mnn(s,pt.tokenGap+og(Ae.toKeep))){Pe=!0,Me=pt.tokenGap,Ae=null,V=b-1,t(`Reactive compact: attempt ${X} hit prompt-too-long on the last resort (gap=${pt.tokenGap}), summarizing the opening round alone first (keeping ${b-1}/${b} groups); head drop if that yields no summary`,{level:"info"});continue}let Wt=Ae.headTruncations<U8?TYe(iSe(Ae.toSummarize,pt.tokenGap,ke),Ae.toKeep):null;if(!Wt)return t(`Reactive compact: last-resort request still too long after ${Ae.headTruncations} head truncations, giving up`,{level:"info"}),sSe(Se,X),{ok:!1,reason:"exhausted",attempts:X,totalGroups:b,splitKind:nt,headTruncations:ut};Ae={...Ae,toSummarize:Wt,headTruncations:Ae.headTruncations+1},t(`Reactive compact: attempt ${X} hit prompt-too-long on the last resort (gap=${pt.tokenGap??"?"}), truncating head (${Ae.headTruncations}/${U8})`,{level:"info"});continue}let Ut=b-V;if(Pe)$e=pt.tokenGap;else Re={tokenGap:pt.tokenGap,summarizeEnd:Ut};_e??=s.map((Wt)=>og(Wt));let Pt=Fdr(pt.tokenGap,_e,Ut);he={...Pt,tokenGap:pt.tokenGap},V+=Pt.step,t(`Reactive compact: attempt ${X} hit prompt-too-long (gap=${pt.tokenGap??"?"} \u2192 ${Pt.mode} step ${Pt.step}), next preserves ${V}/${b}`,{level:"info"})}}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; Fdr [2511138,2511252), UTF-16.
function Fdr(e,n,r){if(e===void 0)return{mode:"gap_unparseable",step:1};return{mode:"gap_guided",step:Dnn(n,r,e)}}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; Dnn [2511003,2511138), UTF-16.
function Dnn(e,n,r){let s=0,h=0;for(let y=n-1;y>=0;y--)if(s+=e[y],h++,s>=r)break;if(h>=n-1)return Math.max(1,Math.floor(n/2));return h}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; Wdr [2512017,2512310), UTF-16.
function Wdr(e){let n=Math.max(e.findLastIndex(Fnn),e.findLastIndex((s)=>s.type==="user"&&s.isVirtual!==!0&&N_(s))),r=e.findLastIndex((s,h)=>h>n&&s.type==="user"&&!s.isMeta&&s.isVirtual!==!0&&!AF(s)&&!N_(s));return r===-1?{toSummarize:e,toKeep:[]}:{toSummarize:e.slice(0,r),toKeep:e.slice(r)}}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; TYe [2511531,2511590), UTF-16.
function TYe(e,n){return e!==null&&$nn([...e,...n])?e:null}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; iSe [2562455,2562863), UTF-16.
function iSe(e,n,r){let s=e[0]?.type==="user"&&e[0].isMeta&&e[0].message.content===con?e.slice(1):e,h=w1(s);if(h.length<2)return null;let y;if(n!==void 0){let w=0;y=0;for(let M of h)if(w+=og(r?cSe(M):M),y++,w>=n)break}else y=Math.max(1,Math.floor(h.length*0.2));if(y=Math.min(y,h.length-1),y<1)return null;let b=h.slice(y).flat();if(b[0]?.type==="assistant")return[xe({content:con,isMeta:!0}),...b];return b}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; Mnn [2511590,2511735), UTF-16.
function Mnn(e,n){let r=e[0]??[],s=e[1]?.[0],h=og(r),y=20000+EYe*RYe+CYe;return $nn(r)&&!(s?.type==="assistant"&&Qae(s))&&h-Math.ceil(h/10)>=n+y}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; Udr [2511735,2512017), UTF-16.
function Udr(e,n){if(e.ok)return Cnn(e.summaryText)?void 0:"its reply has no <summary> block";switch(e.reason){case"error":return`it failed (${e.errorKind})`;case"media_too_large":return n?"it hit a media-size error even stripped":void 0;case"aborted":case"prompt_too_long":return}}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; Inn [2512310,2512366), UTF-16.
function Inn(e){return e>0?"exhausted":"too_few_groups"}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; sSe [2512366,2512462), UTF-16.
function sSe(e,n){if(e)i("tengu_compact_credits_clamp_rescue",{outcome:S("failed"),attempts:n})}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; Gtt [2487029,2487103), UTF-16.
function Gtt(e){let n=ri(e).filter((r)=>r.type!=="progress");return w1(n)}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; w1 [2486762,2487029), UTF-16.
function w1(e){let n=[],r=[],s;for(let h of e){if(K0(h)){r.push(h);continue}if(h.type==="assistant"&&h.message.id!==s&&!h.resumedFromIncompleteThinking&&r.length>0)n.push(r),r=[h];else r.push(h);if(h.type==="assistant")s=h.message.id}if(r.length>0)n.push(r);return n}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; ri [4505466,4505523), UTF-16.
function ri(e,n){let r=WMe(e);return r===-1?e:e.slice(r)}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; WMe [4505378,4505466), UTF-16.
function WMe(e){for(let n=e.length-1;n>=0;n--){let r=e[n];if(r&&Go(r))return n}return-1}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; Go [4505234,4505307), UTF-16.
function Go(e){return e?.type==="system"&&e.subtype==="compact_boundary"}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; $nn [2511387,2511531), UTF-16.
function $nn(e){if(e.some($dr))return!0;let n=e.filter((r)=>r.type==="user"&&!r.isMeta&&r.isVirtual!==!0&&!AF(r));return n.length>0&&og(n)>=Bdr}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; $dr [2511336,2511374), UTF-16.
function $dr(e){return Fnn(e)&&!AF(e)}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; Fnn [2511252,2511336), UTF-16.
function Fnn(e){return e.type==="assistant"&&!e.isApiErrorMessage&&e.isVirtual!==!0}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; N_ [4422125,4422267), UTF-16.
function N_(e){if(e.type!=="user")return!1;let n=e.message.content;if(typeof n==="string")return!1;return n.some((r)=>r.type==="tool_result")}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; AF [4374554,4374745), UTF-16.
function AF(e){return e.type!=="progress"&&e.type!=="attachment"&&e.type!=="system"&&Array.isArray(e.message.content)&&e.message.content[0]?.type==="text"&&BMe.has(e.message.content[0].text)}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; Qae [880251,880413), UTF-16.
function Qae(e){if(!e.isApiErrorMessage)return!1;let n=e.message.content;if(!Array.isArray(n))return!1;return n.some((r)=>r.type==="text"&&r.text.startsWith(gF))}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; Cnn [2504627,2504678), UTF-16.
function Cnn(e){return Enn.test(e.replace(vnn,""))}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; cSe [2559970,2560704), UTF-16.
function cSe(e){return e.map((n)=>{if(n.type==="attachment"){let y=Tur(n.attachment);return y===n.attachment?n:Mce(n,y)}if(n.type!=="user")return n;let r=n.message.content;if(!Array.isArray(r))return n;let s=!1,h=r.flatMap((y)=>{if(!Pc(y))return[y];if(y.type==="image")return s=!0,[{type:"text",text:"[image]"}];if(y.type==="document")return s=!0,[{type:"text",text:"[document]"}];if(y.type==="tool_result"&&Array.isArray(y.content)){let b=!1,w=y.content.map((M)=>{if(!Pc(M))return M;if(M.type==="image")return b=!0,{type:"text",text:"[image]"};if(M.type==="document")return b=!0,{type:"text",text:"[document]"};return M});if(b)return s=!0,[{...y,content:w}]}return[y]});if(!s)return n;return{...n,message:{...n.message,content:h}}})}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; og [422319,422380), UTF-16.
function og(e,n){let r=0;for(let s of e)r+=oVn(s,n);return r}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; oVn [422380,422689), UTF-16.
function oVn(e,n){if((e.type==="assistant"||e.type==="user"||e.type==="api_system")&&e.message?.content)return k6(e.message?.content,n);if(e.type==="attachment"&&e.attachment){let r=sOe({uuid:e.uuid,attachment:e.attachment,rendered:e.rendered}),s=0;for(let h of r)s+=k6(h.message.content,n);return s}return 0}
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; uE [4361351,4361581), UTF-16.
var uE="The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.";
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; Bdr [2511378,2511386), UTF-16.
var Bdr=1000;
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; U8 [2562347,2562351), UTF-16.
var U8=3;
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; con [2562352,2562411), UTF-16.
var con="[earlier conversation truncated for compaction retry]";
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; EYe [2559348,2559353), UTF-16.
var EYe=5;
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; RYe [2559364,2559372), UTF-16.
var RYe=5000;
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; CYe [2559382,2559391), UTF-16.
var CYe=25000;
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; Enn [2504456,2504492), UTF-16.
var Enn=/<summary>([\s\S]*?)<\/summary>/;
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; vnn [2504419,2504455), UTF-16.
var vnn=/<analysis>[\s\S]*?<\/analysis>/;
// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; gF [880227,880250), UTF-16.
var gF="Prompt is too long";
// chunk-hwpb27as.js SHA-256 c5f6d5b8fb187a14de3db7aebcb5615a3632aa34a0e174c54d38607e7c5ead8e; k6 [4374,4518), UTF-16.
function k6(e,n){if(!e)return 0;if(typeof e==="string")return Td(e,n);if(!Array.isArray(e))return 0;let s=0;for(let r of e)s+=ELn(r,n);return s}
// chunk-hwpb27as.js SHA-256 c5f6d5b8fb187a14de3db7aebcb5615a3632aa34a0e174c54d38607e7c5ead8e; Td [4137,4218), UTF-16.
function Td(e,n=4){if(typeof e!=="string")return 0;return Math.round(e.length/n)}
// chunk-hwpb27as.js SHA-256 c5f6d5b8fb187a14de3db7aebcb5615a3632aa34a0e174c54d38607e7c5ead8e; ELn [4518,5303), UTF-16.
function ELn(e,n){if(typeof e==="string")return Td(e,n);if(!Pc(e))return 0;if(e.type==="text")return Td(e.text,n);if(e.type==="document"&&"source"in e&&typeof e.source==="object"&&e.source!==null){let s=e.source;if(s.type==="text"){let r=e.title?.split(".").pop()?.toLowerCase()??"",h=bo(r);return Td(s.data,n===void 0?h:Math.min(n,h))}if(s.type==="content"){if(typeof s.content==="string")return Td(s.content,n);if(Array.isArray(s.content))return k6(s.content.filter((r)=>typeof r==="object"&&r!==null),n)}}if(e.type==="image"||e.type==="document")return 2000;if(e.type==="tool_result")return k6(e.content,n);if(e.type==="tool_use")return Td(e.name+_(e.input??{}),n);if(e.type==="thinking")return Td(e.thinking,n);if(e.type==="redacted_thinking")return Td(e.data,n);return Td(_(e),n)}
// chunk-hwpb27as.js SHA-256 c5f6d5b8fb187a14de3db7aebcb5615a3632aa34a0e174c54d38607e7c5ead8e; bo [4218,4305), UTF-16.
function bo(e){switch(e){case"json":case"jsonl":case"jsonc":return 2;default:return 4}}
// chunk-hwpb27as.js SHA-256 c5f6d5b8fb187a14de3db7aebcb5615a3632aa34a0e174c54d38607e7c5ead8e; Pc [4110,4137), UTF-16.
function Pc(e){return L(e)}
// chunk-08y6bv7r.js SHA-256 2b88e13fa78be922b842ad142e0b7ed1eb415009911237a89927ca9d408d7bbc; K0 [2508,2587), UTF-16.
function K0(e){return(e.type==="user"||e.type==="assistant")&&e.isVirtual===!0}
// chunk-phm7wwmz.js SHA-256 40e46cb899d8e325ee27e23dca0b298833a9b246ca314a282f860e768e6baf12; Ow [5750,5784), UTF-16.
var Ow="[Request interrupted by user]";
// chunk-phm7wwmz.js SHA-256 40e46cb899d8e325ee27e23dca0b298833a9b246ca314a282f860e768e6baf12; Mu [5785,5832), UTF-16.
var Mu="[Request interrupted by user for tool use]";
// chunk-phm7wwmz.js SHA-256 40e46cb899d8e325ee27e23dca0b298833a9b246ca314a282f860e768e6baf12; Vv [6449,6580), UTF-16.
var Vv="The user doesn't want to take this action right now. STOP what you are doing and wait for the user to tell you how to proceed.";
// chunk-r2vtj1kh.js SHA-256 2b13302b83beea3fe54e83316b9d855c43e2298af6d0041b009cec563bbc1515; I$ [164376,164403), UTF-16.
var I$="No response requested.";

// chunk-sfn1dbxq.js SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da; BMe [4374191,4374220), UTF-16.
var BMe=new Set([Ow,Mu,Vv,uE,I$]);
  return lSe(records,{toolUseContext:{abortController:{signal:options.signal},compactionApiAttemptsLeft:options.apiAttemptsLeft}},
    {allowFallback:options.allowFallback,initialTokenGap:options.initialTokenGap});
}

