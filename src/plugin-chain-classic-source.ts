// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
//   chunk-a60ee1ne.js sha256 fe5d3ed9cb5d16b40ded156d060aeed714dc3a382405609422688756f0707ee1
//   chunk-3cynezh1.js sha256 c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3
//   chunk-m4qpskd4.js sha256 730cbd0e42d685bf16a3b53c020b479670597d6bef6db2ab594049eea3e782ae
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The shared rules these sites close over are already copied verbatim into ./plugin-chain-source.ts
// from the same chunks; importing them keeps one copy of each body. `re` lives in the sites copy.
import { B, C, L, Me, er, m$ } from './plugin-chain-source.js';
import { at, re } from './plugin-chain-sites-source.js';

// chunk-nyce03br.js Ie: whether every present element passes a test [6591,6678) 87 units sha256 d4438e969d8d3fb54339365d12c9940cb82effb66c1e58d003cd4421241bb0a8
function Ie(e,t){let o=B(e);for(let r=0;r<o;r+=1)if(r in e&&!t(e[r]))return!1;return!0}

// chunk-nyce03br.js g$: the text-list copy the context rules share [16391,16555) 164 units sha256 7c990c586cf5fbd2316d3ed4bbc2fecacfeea91cdd4755de817b799d13a7bec3
function g$(e){if(!Array.isArray(e))return;let t=B(e),o=[];for(let r=0;r<t;r+=1){let n=e[r];if(!(Object.hasOwn(e,r)&&typeof n==="string"))return;o.push(n)}return o}

// chunk-nyce03br.js rlt: whether a value is a text list [16555,16583) 28 units sha256 1feada2a36879e875c31fde9314ec8ef0d436c833eb0dd7710ac36736b527762
var rlt=(e)=>g$(e)!==void 0;

// chunk-nyce03br.js se: the `{ value }` site builder the value events are generated with [25533,25619) 86 units sha256 db9ef8bf1ca9ec94b8c283c4d1688cfa530e8cda6437cca143cfb1f2f20ed5af
var se=(e)=>({event:e,check:C((t)=>Me(t,"{ value }",(o)=>Object.hasOwn(o,"value")))});

// chunk-nyce03br.js co: the name-list to site-table fold [25838,25893) 55 units sha256 317a4ed808b7164ef29738f7e58bea6afaa5c60b5bf3f2754631a68275ed64ff
var co=(e,t)=>Object.fromEntries(e.map((o)=>[o,t(o)]));

// chunk-nyce03br.js Mr: the classic event envelope's pinned fields [28437,28615) 178 units sha256 0dfaac55f01ded6bda1f03c816278163fa6e5a4ca7f751755a62a707a50be1c8
var Mr=["hook_event_name","session_id","transcript_path","cwd","scratchpad_dir","prompt_id","permission_mode","agent_id","agent_type","served_call","caller_session_id","effort"];

// chunk-nyce03br.js jr: the classic argument check, built on re [28615,28640) 25 units sha256 d0a4b71b7826c25707634f7242d4f1b33ad015dd4e021b4372691ae072fa31ca
var jr=(e,t)=>re(Mr,e,t);

// chunk-nyce03br.js Fr: the updatedPermissions check the decision check reads [28640,29566) 926 units sha256 1fc1f3c80f1b6a9498ab41059b55bdc8902b58d8d9f4bce2e361eeed986df12c
function Fr(e){if(!L(e))return"an updatedPermissions entry that is not an object";if(!(typeof e.destination==="string"&&["userSettings","projectSettings","localSettings","session","cliArg"].includes(e.destination)))return"an updatedPermissions entry with an unknown destination";switch(e.type){case"addRules":case"replaceRules":case"removeRules":return(e.behavior==="allow"||e.behavior==="deny"||e.behavior==="ask")&&Array.isArray(e.rules)&&Ie(e.rules,(r)=>L(r)&&typeof r.toolName==="string"&&(r.ruleContent===void 0||typeof r.ruleContent==="string"))?void 0:`an updatedPermissions ${e.type} without rules and a behavior`;case"setMode":return[...CH,zW].includes(e.mode)?void 0:"an updatedPermissions setMode with an unknown mode";case"addDirectories":case"removeDirectories":return rlt(e.directories)?void 0:`an updatedPermissions ${e.type} without directories`;default:return"an updatedPermissions entry of an unknown type"}}

// chunk-nyce03br.js Lr: the permission decision check [29566,30208) 642 units sha256 fb84c533dc14ed8a8cd841cf9e94a1cd60ca509562edd74276397818287f8d09
function Lr(e){let t=e===void 0;if(!L(e))return t?void 0:"a decision that is not an object";let o=e;if(o.behavior==="deny")return(o.message===void 0||typeof o.message==="string")&&(o.interrupt===void 0||typeof o.interrupt==="boolean")?void 0:"a deny decision whose message or interrupt has the wrong type";if(o.behavior!=="allow")return"a decision whose behavior is not allow or deny";if(!(o.updatedInput===void 0||L(o.updatedInput)))return"an allow decision whose updatedInput is not an object";let{updatedPermissions:n}=o,s=Array.isArray(n);return s||n===void 0?at(s?n:[],Fr)?.[1]:"an allow decision whose updatedPermissions is not a list"}

// chunk-nyce03br.js $r: the permissionDecision check the classic family shares [30208,30374) 166 units sha256 ea3caac0924e87eebf4805ff2b874dd5cac7767ad17f630fca758155a95f61f5
function $r(e){let{permissionDecision:t}=e;return t===void 0||t==="allow"||t==="deny"||t==="ask"?Lr(e.decision):"a permissionDecision that is not allow, deny or ask"}

// chunk-nyce03br.js Dr: the wrong-type sweep over the classic event fields [30374,30750) 376 units sha256 ff0aa2725cb49c71d168fd714782d428615b0ffc3d01aa6349d13c52fe980bc5
var Dr=(e)=>[...["block","stopReason","sessionTitle","initialUserMessage","displayContent","permissionDecisionReason","worktreePath"].filter((t)=>e[t]!==void 0&&typeof e[t]!=="string"),...["preventContinuation","suppressOriginalPrompt","reloadSkills","retry"].filter((t)=>e[t]!==void 0&&e[t]!==!0),...["additionalContext","watchPaths"].filter((t)=>e[t]!==void 0&&!rlt(e[t]))];

// chunk-nyce03br.js Ur: the classic result check [30750,30837) 87 units sha256 ca4603756a7b60979a4311db50ed2e15e32d9664f631b1ca396e2bb795f11995
function Ur(e){let t=Dr(e);return t.length>0?`${t.join(", ")} of the wrong type`:$r(e)}

// chunk-nyce03br.js Bbr: the classic site builder [30837,30898) 61 units sha256 47abafbd0e456d078b3fe5cfeed772c7f0f72e4f6d84fd7d33ab582edb612a0e
function Bbr(e){return{event:e,check:C(Ur),checkArgument:jr}}

// chunk-a60ee1ne.js CH, y, BE and zW: the permission modes and the manual mode name the classic family checks against [678,782) 104 units sha256 7540cca910bd816d3edf3ddeb497546f43905243477cfff3cf6f2801961333cc
var CH=["acceptEdits","auto","bypassPermissions","default","dontAsk","plan"],y=[...CH],BE=y,zW="manual";

// chunk-3cynezh1.js xp: the classic hook event names, the list both spreads are generated from [74700,75328) 628 units sha256 a43278ee93db36bed8ab2c9056289dddc9f5f122faccbdc98f8cd77eae2f7911
var xp=["PreToolUse","PostToolUse","PostToolUseFailure","PostToolBatch","Notification","UserPromptSubmit","UserPromptExpansion","SessionStart","SessionEnd","Stop","StopFailure","SubagentStart","SubagentStop","PreCompact","PostCompact","PreModelSwitch","PostModelSwitch","PermissionRequest","PermissionDenied","Setup","TeammateIdle","TaskCreated","TaskCompleted","Elicitation","ElicitationResult","ConfigChange","WorktreeCreate","WorktreeRemove","InstructionsLoaded","CwdChanged","FileChanged","DirectoryAdded","MessageDisplay"],Uxs=["clear","resume","logout","prompt_input_exit","other"],AO="__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__";

// chunk-m4qpskd4.js Ewr: the classic event names' source [45815,45826) 11 units sha256 bdf3f785cc9b9a9d563e27923f30f20dffcb3d613ba8d82df5cf25b1376c85d7
var Ewr=xp;

// chunk-m4qpskd4.js ao: those names prefixed `classic.` [45826,45862) 36 units sha256 e85ec26d2509c416992260e2cb2b377a2dc9277fccf8e321d0c65a5195f29839
var ao=Ewr.map((e)=>`classic.${e}`);

// chunk-m4qpskd4.js Q$n: the 63 value events the se builder generates sites for [45862,46732) 870 units sha256 9d6bcec52f70116b3b03431e19174c5978c212f4cdf9733d17e54070ca200ebf
var Q$n=["model.complete","model.classify","model.fork","audio.play","audio.speak","mcp.call","mcp.connect","session.cwd","session.root","session.model","session.turns","session.id","session.messages","session.repo","session.surface","session.surfaces","session.authorize","session.usage","session.version","turn.abort","prompt.read","flag.value","tool.list","tool.register","command.list","command.register","config.list","agent.list","agent.register","ui.toast","ui.status","ui.log","ui.notice","ui.invalidate","ui.open","ui.close","ui.panes","ui.selection","ui.copy","ui.notify","ui.blit","fs.read","fs.write","fs.list","fs.exists","fs.stat","fs.ancestors","store.get","store.set","store.delete","store.keys","state.get","state.set","clock.now","clock.sleep","clock.after","clock.every","http.fetch","process.run","process.spawn","settings.read","env.get","env.set"];

// chunk-m4qpskd4.js HFs: the classic events the Bbr builder generates sites for, PreToolUse excluded [47457,47506) 49 units sha256 f41827acd69d7af630499eaa13efea75a7b9641b50966afe90d91bfeb8200918
var HFs=ao.filter((e)=>e!=="classic.PreToolUse");


export { se, co, Mr, jr, Lr, $r, Dr, Ur, Bbr, Ie, g$, rlt, Fr, Ewr, ao, Q$n, HFs, CH, zW, xp };
