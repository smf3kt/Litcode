// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W183-permission-destinations.md.
// Modules:
//   chunk-nkb63p1y.js sha256 cb746f58859c7e9d52383597ff3a5c08bea091d17746697e713d379408504e5c
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Un } from './permission-rule-source.js';
import { _Z,qW,Yv,JWn } from './plan-glob-source.js';
import { go,wAo,Gp } from './plan-tool-name-source.js';
import { permissionSources } from './permission-state.js';
const ws=permissionSources.filter(s=>['userSettings','projectSettings','localSettings','flagSettings','policySettings'].includes(s)), Z=new Set(), ne=new Map(), Be='Bash', dp=()=>false;
let H1;

// chunk-nkb63p1y.js zo [10178,10298) 120 units sha256 a1f190db93e3090b59b8ebcf03521d9b9a06e927f7886e283c6dc667f31615e1
function zo(e,n,o){if(jre(n))return null;let t;return(o??Bc(e)).find((r)=>S(n,r,e,void 0,t??=R(n,e.toolAliases)))||null}

// chunk-nkb63p1y.js jre [7969,8017) 48 units sha256 8f755da99b20f59d4e770e10241907234a2c841c76f5d77bb40531bdedffc760
function jre(e){return!e.mcpInfo&&Z.has(e.name)}

// chunk-nkb63p1y.js Bc [8783,8835) 52 units sha256 a0a301a46498d64c16201d148a5f319a5690160a2017beb4197aefefef6f37c7
function Bc(e){return uNe(e.alwaysDenyRules,"deny")}

// chunk-nkb63p1y.js uNe [8631,8783) 152 units sha256 34a2ff7561ec887a793a04dff4c73b3d5d288dc459af2e61f3c705f7cfadec43
function uNe(e,n){let o=[];for(let t of H1){let r=e[t];if(r===void 0)continue;for(let s of r)o.push({source:t,ruleBehavior:n,ruleValue:Un(s)})}return o}

// chunk-nkb63p1y.js H1 [7750,7841) 91 units sha256 ee5220389e2c49c9bc7900c75349fed44a88da1eb45f65f48e431c52ec25044f
H1=[...ws,"cliArg","command","session","toolsNarrowing","mcpServerPolicy","hostCredential"]

// chunk-nkb63p1y.js S [10712,10931) 219 units sha256 f6c734b43d2f902e16e099ab0b531ff08deaac5c00372020e3a44d4f4f4307c2
function S(e,n,o,t,r){if(n.ruleValue.ruleContent===void 0)return qx(o,e,n,t,r);let{name:s,aliasSources:l}=r??R(e,o.toolAliases),i=n.ruleValue.toolName===s,u=T(n);return l().some((m)=>m!==s&&(u&&y(n,m)||i&&y(H(m,n),m)))}

// chunk-nkb63p1y.js qx [9783,10178) 395 units sha256 e16a13d3edc8c8e14ddde92366116327e7fe0c810bd5eac5edad6dd63ea0abe8
function qx(e,n,o,t=O(o),r){let s={proxyExpansion:T(o),globMatching:!0,toolAliases:e.toolAliases};if(P(n,o,s,t,r))return!0;if(("aliasSkillToolNames"in n?n.aliasSkillToolNames:void 0)?.some((u)=>P({name:u},o,s,t)))return!0;let i="packagingAliasSkillToolNames"in n?n.packagingAliasSkillToolNames:void 0;if(i===void 0||Yv(o.ruleValue.toolName)&&!dp())return!1;return i.some((u)=>P({name:u},o,s,t))}

// chunk-nkb63p1y.js P [8969,9414) 445 units sha256 e9d3b92f226a163c4d22a3401987c0c501415f663c167f2d1f273dc4ff2a9e7f
function P(e,n,{proxyExpansion:o=!1,globMatching:t=!1,toolAliases:r}={},s=O(n),l=R(e,r)){let i=l.name;if(n.ruleValue.toolName===i)return!0;let u="familyParentToolName"in e?e.familyParentToolName:void 0;if(u!==void 0&&e.mcpInfo===void 0&&n.ruleValue.toolName===u)return!0;if(o&&_Z(n.ruleValue.toolName,r).includes(i))return!0;let{matchesGlob:m}=s;if(t&&m!==void 0&&(m(i)||o&&l.aliasSources().some(m)))return!0;return s.coversMcpTool(l.mcpInfo())}

// chunk-nkb63p1y.js O [9414,9548) 134 units sha256 c2b9037d744463056be8c4d28b4a8bbc5cd463d0f5804b2712e5cfff585ad4ae
function O({ruleValue:{toolName:e}}){let n,o;return{matchesGlob:Yv(e)?(t)=>(n??=JWn(e))(t):void 0,coversMcpTool:(t)=>(o??=wAo(e))(t)}}

// chunk-nkb63p1y.js R [9548,9657) 109 units sha256 7125bcaa477214eb4ca09e04af3e3580a223fbf6684a2785cb5d75411b45ddba
function R(e,n){let o=Gp(e),t,r;return{name:o,mcpInfo:()=>r===void 0?r=go(o):r,aliasSources:()=>t??=qW(o,n)}}

// chunk-nkb63p1y.js T [9713,9783) 70 units sha256 c3038037438a39723a2ea401f783cbbc8604da963ace82619f5989f9f5b7d625
function T(e){return e.source!=="cliArg"&&e.source!=="toolsNarrowing"}

// chunk-nkb63p1y.js y [10539,10712) 173 units sha256 37a37b4fed3d1ea451c4d7e154cd4005645a36f1c240a4c192359119ab3f19fb
function y({ruleBehavior:e,ruleValue:{toolName:n,ruleContent:o}},t){if(o===void 0||e==="allow")return!1;return n===Be?t===Be&&Hco(o):ee(o)&&(ne.get(n)?.[e]??[]).includes(t)}

// chunk-nkb63p1y.js H [10931,10998) 67 units sha256 5fc1df4129f7d2db3f3fb51ec2ada712034da37595a23c3f921ac8dccf415e45
function H(e,n){return{...n,ruleValue:{...n.ruleValue,toolName:e}}}

// chunk-nkb63p1y.js Hco [10298,10339) 41 units sha256 490227677b0aba6eea42bba9aad2cb5802b79394aa68e04daa6ca81edc14ee50
function Hco(e){return/^[\s*]+$/.test(e)}

// chunk-nkb63p1y.js ee [10339,10444) 105 units sha256 4a04677c3f79ea3c3333d6ef131ea6aa29bae9e44e1c48163ec97500c145a8ce
function ee(e){return e.startsWith("//")&&/^\/(?:\*\*\/)?\*+(?:\/\*\*)?$/.test(e.replace(/\/{2,}/g,"/"))}


export { zo, uNe };
