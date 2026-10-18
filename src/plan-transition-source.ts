// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W183-permission-destinations.md.
// Modules:
//   chunk-xv9wnb67.js sha256 93dd1a8c4bbe300b95d921b98e028525a8532fd0fc2809bf5d05b7b265e635e7
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { C$e,nre,tfe,AIo,BN,ap,ER,ND,O_,rnn,Bre,AAn,t,ws,jy,yn,df,Re } from './plan-transition-host.js';
import { jd } from './permission-reducer-source.js';
import { Un, _n } from './permission-rule-source.js';
import { uNe } from './plan-deny-source.js';


// chunk-xv9wnb67.js i0 [7974,8517) 543 units sha256 2a797477b5bc9560c94e9e5a4758b609aa9eaf180f9aa7b95609645692549c55
function i0(e,s,o,r){if(e===s)return o;if(o.startupModeDecidedByProactivityLevel!==void 0)o={...o,startupModeDecidedByProactivityLevel:void 0};if(C$e(void 0),nre({from:e,to:s,trigger:r}),tfe(e,s),AIo(e,s),e==="plan"&&s!=="plan")BN(!0);if(s==="plan"&&e!=="plan")return j_t(o);let n=e==="auto"||e==="plan"&&ap(),u=s==="auto";if(u&&!n){if(!O_())throw Error("Cannot transition to auto mode: gate is not enabled");ER(!0),o=nz(o)}else if(n&&!u)ER(!1),ND(!0),o=rge(o);if(e==="plan"&&s!=="plan"&&o.prePlanMode)return{...o,prePlanMode:void 0};return o}

// chunk-xv9wnb67.js j_t [26232,26576) 344 units sha256 089a1dfa7deb60230f80ff1193f631bc9593b768bddbeeb3c328a50f4a3376e2
function j_t(e){let s=e.mode;if(s==="plan")return e;if(s==="auto"){if(_Qn())return{...e,prePlanMode:"auto"};return ER(!1),ND(!0),{...rge(e),prePlanMode:"auto"}}if(s!=="bypassPermissions"){let o=jSn(e);if(o)return{...o,prePlanMode:s}}return t(`[prepareContextForPlanMode] plain plan entry, prePlanMode=${s}`,{level:"info"}),{...e,prePlanMode:s}}

// chunk-xv9wnb67.js _Qn [26140,26174) 34 units sha256 3555c0fc8a43fc5a9e6c3e8a620e85e927f56695df62cae6e22ef98e8b1a9bb3
function _Qn(){return O_()&&rnn()}

// chunk-xv9wnb67.js jSn [26174,26232) 58 units sha256 e1c922cbb3d626273693de73055e95655c56f5841e69018ab19c598ac663eb95
function jSn(e){if(!_Qn())return null;return ER(!0),nz(e)}

// chunk-xv9wnb67.js nz [5699,6188) 489 units sha256 54cd1e47239e921344465a59d31e316ae641689b7a50782541cf793192c4a22c
function nz(e){let s=uNe(e.alwaysAllowRules,"allow"),o=zKo(s,[]);if(o.length===0)return e.strippedDangerousRules!==void 0?e:{...e,strippedDangerousRules:{}};for(let n of o)t(`Ignoring dangerous permission ${n.ruleDisplay} from ${n.sourceDisplay} (bypasses classifier)`);let r={};for(let[n,u]of Object.entries(e.strippedDangerousRules??{}))if(u)r[n]=[...u];for(let n of o){let u=_n(n.ruleValue),c=r[n.source]??=[];if(!c.includes(u))c.push(u)}return{...gDs(e,o,!0),strippedDangerousRules:r}}

// chunk-xv9wnb67.js rge [7064,7388) 324 units sha256 1a9bf553283dc88cf58ed09c29ec5a6f0f7655bf1724465f0d49c163e68cdbaa
function rge(e){let s=e.strippedDangerousRules;if(!s)return e;let o=e;for(let[r,n]of Object.entries(s)){if(!n||n.length===0)continue;let u=r==="command"?n.filter((c)=>!AAn(c)):[...n];if(u.length===0)continue;o=jd(o,{type:"addRules",rules:u.map(Un),behavior:"allow",destination:r})}return{...o,strippedDangerousRules:void 0}}

// chunk-xv9wnb67.js zKo [3060,3602) 542 units sha256 5118b2a3b9c6fc8cac40dae96e925eab62b8575f4c59a0dc9d53fd2d345e0330
function zKo(e,s){let o=[];for(let r of e)if(r.ruleBehavior==="allow"&&Bre(r.ruleValue.toolName,r.ruleValue.ruleContent)){let n=r.ruleValue.ruleContent?`${r.ruleValue.toolName}(${r.ruleValue.ruleContent})`:`${r.ruleValue.toolName}(*)`;o.push({ruleValue:r.ruleValue,source:r.source,ruleDisplay:n,sourceDisplay:G(r.source)})}for(let r of s){let n=Un(r);if(Bre(n.toolName,n.ruleContent))o.push({ruleValue:n,source:"cliArg",ruleDisplay:n.ruleContent?`${n.toolName}(${n.ruleContent})`:`${n.toolName}(*)`,sourceDisplay:"--allowed-tools"})}return o}

// chunk-xv9wnb67.js gDs [5453,5699) 246 units sha256 d4bc045c2b39a55e105cd7270d70731a01c3e92dfda80f6930b95a2d4c9de5c2
function gDs(e,s,o=!1){let r=new Map;for(let u of s){if(!o&&!xe(u.source))continue;let c=u.source,p=r.get(c)||[];p.push(u.ruleValue),r.set(c,p)}let n=e;for(let[u,c]of r)n=jd(n,{type:"removeRules",rules:c,behavior:"allow",destination:u});return n}

// chunk-xv9wnb67.js G [2938,3060) 122 units sha256 b6f740fac3fe68d62d74f4f8684469933536f821e88e805dbd0e7cc6af596da1
function G(e){if(ws.includes(e)){let s=yn(e);if(s){let o=df(),r=o===null?s:Re(o,s);return r.length<s.length?r:s}}return e}

// chunk-xv9wnb67.js xe [5387,5453) 66 units sha256 a8bcb1b38703eae1975089b16d21967b6da8582fb8adc64c8ec58a40337c1d65
function xe(e){return jy.includes(e)||e==="session"||e==="cliArg"}


export { i0, nz, rge };
