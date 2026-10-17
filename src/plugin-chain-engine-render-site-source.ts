// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Slt } from './plugin-chain-matchers.js';
import { L, er, b3 } from './plugin-chain-source.js';
import { re } from './plugin-chain-sites-source.js';
import { j3e } from './plugin-chain-render-keys.js';
import { iD, eIt } from './plugin-chain-engine-budget-source.js';
import { tIt } from './plugin-chain-host-call-source.js';

// chunk-nyce03br.js unwrap the dispatch answer [7275,7339) 64 units sha256 e7424e29ef3c6a32da84a48bce60397d41473420f74c06a9e550259ae5f333ab
var ilt=(e)=>tIt(e,{copies:new Map,nodes:0,depth:0,isKeyed:!0});

// chunk-nyce03br.js the permission component [44236,44263) 27 units sha256 792e6149e14582dad9ae778a02a983ae1e8beaea6d7cbfea3ff09896b1a378df
var So="PermissionRequest";

// chunk-nyce03br.js render envelope keys [44263,44317) 54 units sha256 4e791d495e13021546afc14731f593f26efed247b74b10df7db08fd7966cf608
var on=["surface","component","requestId","viewport"];

// chunk-nyce03br.js envelope check [44317,44342) 25 units sha256 166e0fbf7a59c01328ba0bd715e37768a71ee98e794a48d963eb7df5ac2a687a
var rn=(e,t)=>re(on,e,t);

// chunk-nyce03br.js object/null/missing kinds [43725,43763) 38 units sha256 9a9da2a87743be72b8295ad227e2c71a77daa163790cf6dd773b6d835ebbe8b9
var ve=["an object","null","missing"];

// chunk-nyce03br.js component prop specs [43763,44236) 473 units sha256 97fd31282ae81812469f306e90d7ab6d02c91cdaa3e28311cad8466e588d7d79
var tn={AskUserQuestion:{metadataSource:["a string","missing"]},UserMessage:{onScreen:ve},AssistantMessage:{isSummary:["a boolean","missing"],onScreen:ve},ToolUse:{input:tt,output:tt,onScreen:ve},ToolResult:{output:tt,onScreen:ve},ToolGroup:{onScreen:ve},CommandOutput:{onScreen:ve},Spinner:{message:["a string","null"],suffix:["a string","missing"]},TurnDuration:{onScreen:ve},InfoNotice:{command:["a string","null"],onScreen:ve},PromptHint:{tail:["a string","missing"]}};

// chunk-nyce03br.js any-kind marker [42756,42774) 18 units sha256 fa398af15993e8835b5fc7964ecc437c000e90ffae50b3b435c3622e26ec808a
var tt="any kind";

// chunk-nyce03br.js kind name [86978,87140) 162 units sha256 071e9610ea65f201514471aff8dd7b8903033978ab16533ac08e7eee5b9eb2df
function $t(e){if(Array.isArray(e))return"an array";if(e===null)return"null";if(e===void 0)return"missing";return typeof e==="object"?"an object":`a ${typeof e}`}

// chunk-nyce03br.js UserMessage prop names [90267,90312) 45 units sha256 f6f1d44969932bbccbf945aa03a89af15a95d6fa8ab3b561ee6d34110696fc7a
var wn=["origin","isExpanded","task","from"];

// chunk-nyce03br.js tool call id [42774,42865) 91 units sha256 f0260d2d10dc68c504a1bf7037a844a613221bc65bb0235e2b9318da893e804c
function Zr(e){let t=L(e)?e.tool_use_id:null;return t===void 0||typeof t==="string"?t:null}

// chunk-nyce03br.js tool call list [42865,42925) 60 units sha256 d4c91ab5493e0ca9aa968b0f6ab7ec2af54dda6995740f43e2dc6e48a8380603
function Eo(e){return Array.isArray(e)?iD(e).map(Zr):void 0}

// chunk-nyce03br.js a prop's character cost [43275,43324) 49 units sha256 c18e5d943a00deb8c6f3e18b7762d2c660d6e66786db723c91648b79d1f03da6
var bo=(e,t)=>eIt(e).reduce((o,r)=>o+Wbr(r,t),0);

// chunk-nyce03br.js one character's cost [5093,5183) 90 units sha256 b1e6951f924975e78f817564499434210006b4d437dfc18eda8829e1c412ac92
function Wbr(e,t){if(!t.test(e))return 0;let o=0;for(let r of e)o+=t.test(r)?1:0;return o}

// chunk-nyce03br.js whether a prop grew [43324,43356) 32 units sha256 df6c2a62a0164a14c2c3382f00b36b8cf5989b59ba0ce2c075cabdbe21fb0769
var Ft=(e,t,o)=>bo(e,o)>bo(t,o);

// chunk-nyce03br.js escape pattern [5322,5363) 41 units sha256 14cb82e91457836aae9e6a1f6d1c0cd3cf3b1d3641ed1245f0432b568e30dcf2
var Gbr=new RegExp(`[${b3.escape}]`,"u");

// chunk-nyce03br.js placeholder pattern [5411,5457) 46 units sha256 a9bbbcc6ae8445da8066e1eabf1e8c551e50247ae8f8f736f6beb099df7e61d1
var Vbr=new RegExp(`[${b3.placeholder}]`,"u");

// chunk-nyce03br.js lone-surrogate pattern [5363,5411) 48 units sha256 6bca6ab7009c963415491289f15b829472db7bd24331b5720b04598d7f5e7097
var zbr=new RegExp(`[${b3.loneSurrogate}]`,"u");

// chunk-nyce03br.js prop validator en [43356,43725) 369 units sha256 716eada5cd9aee86da1ba2c37161603d8d1e4335909782dba766be5113616518
function en(e,t){let o=t.props,r=Object.keys(e).find((n)=>e[n]!==o[n]&&er(e[n])!==er(o[n])&&(Ft(e[n],o[n],Gbr)||Ft(e[n],o[n],Vbr)||Ft(e[n],o[n],zbr)));if(r===void 0)return;return`a props.${r} with a control character (an escape sequence the terminal would honour, an image placeholder, or an unpaired surrogate half out of reach); a rewrite the engine draws adds none`}

// chunk-nyce03br.js prop validator Tn [90312,90596) 284 units sha256 8f86edd6bc903b21af0be51520fa54361b95fed5caeed5b84e0917c2091d8fd5
function Tn(e,t){if(t.component!=="UserMessage")return;let o=wn.find((r)=>er(e[r])!==er(t.props[r]));if(o===void 0)return;return`a props.${o} other than the engine drew (the row names its message's origin, sender and task and how the view draws it; a rewrite changes the text alone)`}

// chunk-nyce03br.js prop validator bn [90833,91090) 257 units sha256 6cc6716400bb4172a58884cc3a02a037e5569678b9a6704a6264d869b393e4e7
function bn(e,t){return(t.component==="ToolUse"||t.component==="ToolResult"||t.component==="ToolProgress")&&e.tool_use_id!==t.props.tool_use_id?"a props.tool_use_id other than the engine drew (the id names the call; a rewrite changes the row alone)":void 0}

// chunk-nyce03br.js prop validator hn [89856,90040) 184 units sha256 c020fa75ea23268208f4dc601ed68cbf3fc5abfc6d85bb8abd7bccf0c1a5f20d
function hn(e,t){return t.component==="ToolProgress"&&e.kind!==t.props.kind?"a props.kind other than the engine drew (the kind names the row; a rewrite changes its text alone)":void 0}

// chunk-nyce03br.js prop validator nn [44484,44811) 327 units sha256 f459a8c006dead04e776692be4d14bfe6494cadc669dbe5db7542b13e24996aa
function nn(e,t){let r=t.component==="ToolGroup"?Eo(t.props.calls)??[]:void 0,n=Eo(e.calls);return r!==void 0&&(n===void 0||n.length!==r.length||n.some((i,p)=>i===null||i!==r[p]))?"props.calls whose tool_use_ids are not the ones the engine drew (each call keeps the id tool.call carried; the group's calls are its own)":void 0}

// chunk-nyce03br.js prop validator gn [89441,89656) 215 units sha256 f0fc9028d1100682041ec700fabd5d8421122d19e4a4c80091d7033fe8202827
function gn(e,t){return t.component==="CommandOutput"&&e.command!==t.props.command?"a props.command other than the engine drew (the name is the command that printed the row; a rewrite changes the row alone)":void 0}

// chunk-nyce03br.js prop validator xn [89656,89856) 200 units sha256 11b8ae452d2c7be73b7f7f9d013f1eeb26061519effa64b3c58d26efd89d03b9
function xn(e,t){return t.component==="Pane"&&e.placement!==t.props.placement?"a props.placement other than the surface drew (the surface places the pane; a rewrite changes the drawing alone)":void 0}

// chunk-nyce03br.js prop validator kn [90040,90267) 227 units sha256 a33b84847dd56d9b21747cf3cc65c00742cd21af8244d9e3e5786bfc80c8d086
function kn(e,t){return t.component==="AssistantMessage"&&e.isSummary!==t.props.isSummary?"a props.isSummary other than the engine drew (the row names its block as a summary or not; a rewrite changes the drawing alone)":void 0}

// chunk-nyce03br.js prop validator En [90596,90833) 237 units sha256 25f0f769d37b0e7fc79a8f7721aa938bc70d63bc7720d93d9b8548482338e1f0
function En(e,t){return(t.component==="Pane"||t.component==="AbovePrompt")&&er(e.view)!==er(t.props.view)?"a props.view other than the surface drew (the person chooses the transcript in view; a rewrite changes the drawing alone)":void 0}

// chunk-nyce03br.js prop validator yn [89170,89441) 271 units sha256 016d0e2724225541836ad4b2ac4351dd0955189b130758fc2dec909fb76ba33f
function yn(e,t){let o=Object.hasOwn(t.props,"onScreen")?t.props.onScreen:void 0;return j3e.has(t.component)&&er(e.onScreen)!==er(o)?"a props.onScreen other than the surface reported (the surface says what its viewport shows; a rewrite changes the drawing alone)":void 0}

// chunk-nyce03br.js component props check [91090,91576) 486 units sha256 1a34eccffad98f6d7b3cc5dee942c3975a348b440b93a86227a9b586080ebacc
function Sn(e,t){let o=e.props;if(!L(o))return"no { props } (an object)";let r=tn[t.component]??{};for(let[n,s]of Object.entries(r)){let i=$t(o[n]);if(s!==tt&&!s.includes(i))return`a props.${n} that is ${i}, not ${s.join(" or ")}`}for(let[n,s]of Object.entries(t.props)){if(s===void 0||Object.hasOwn(r,n))continue;let i=$t(s),p=$t(o[n]);if(p!==i)return`a props.${n} that is ${p}, not ${i}`}return en(o,t)??Tn(o,t)??bn(o,t)??hn(o,t)??nn(o,t)??gn(o,t)??xn(o,t)??kn(o,t)??En(o,t)??yn(o,t)}

// chunk-nyce03br.js site argument check [92104,92135) 31 units sha256 055c3213be5385d5422aecb1e9252468379e7a009ab7a5cc8dad4e9be8f129e0
var vn=(e,t)=>rn(e,t)??Sn(e,t);

// chunk-nyce03br.js the ui.render site descriptor [93643,93988) 345 units sha256 01e73169c60fd423f71b4cd10a8950f8c94effc6fedcb621852eb4ee254d5a0f
var ga={event:"ui.render",restoreArgument:(e)=>ilt(e),checkArgument:vn,checkMatcher:(e)=>Object.hasOwn(e,"component")&&Slt(e.component,So)?`${So} is drawn by the engine alone; its answer authorises an action. A plugin adds context with $.ui.notice`:void 0,check:(e)=>L(e)&&typeof e.type==="string"?void 0:"something that is not a tree element"};


export { ga, ilt, vn, Sn, So, on };
