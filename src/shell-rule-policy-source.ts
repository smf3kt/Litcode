// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
export function createShellRulePolicy(dA, Rl, TVt) {
const ki = { name: "Bash" };
// chunk-sfn1dbxq.js Uwe [3208987,3209628), UTF-16; sha256 96464519e0179423b7f6fe0a37d5b55646672bf94b0dc77d5f0c425335df8cc4
var Uwe=(e,n)=>{let r=e.command.trim(),{matchingDenyRules:s,matchingAskRules:h,matchingAllowRules:y}=dA(e,n,"exact");if(s[0]!==void 0)return{behavior:"deny",message:`Permission to use ${ki.name} with command ${r} has been denied.`,decisionReason:{type:"rule",rule:s[0]}};if(h[0]!==void 0)return{behavior:"ask",message:Rl(ki.name),decisionReason:{type:"rule",rule:h[0]}};if(y[0]!==void 0)return{behavior:"allow",updatedInput:e,decisionReason:{type:"rule",rule:y[0]}};let b={type:"other",reason:"This command requires approval",bashMissKind:"no-rule-match"};return{behavior:"passthrough",message:Rl(ki.name,b),decisionReason:b,suggestions:TVt(r)}};
// chunk-sfn1dbxq.js Vcn [3229056,3229494), UTF-16; sha256 16419b315837b18be00558bd9805c02a6c8a6e8bf4a45540f971e06fd7f8c689
function Vcn(e,n){let{matchingDenyRules:r,matchingAskRules:s}=dA(e,n,"prefix");if(r[0]!==void 0)return{behavior:"deny",message:`Permission to use ${ki.name} with command ${e.command} has been denied.`,decisionReason:{type:"rule",rule:r[0]}};let h=Uwe(e,n);if(h.behavior==="deny")return h;if(s[0]!==void 0)return{behavior:"ask",message:Rl(ki.name),decisionReason:{type:"rule",rule:s[0]}};if(h.behavior!=="passthrough")return h;return null}
// chunk-sfn1dbxq.js GTr [3251642,3252147), UTF-16; sha256 873c3f9b0f90dfa4115a3c420a35215b02b0c8c3f23d66fef352fc326399ee0c
function GTr(e,n,r){let s=Vcn(e,n);if(s?.behavior==="deny")return s;for(let h of r){let y=dA({...e,command:h.text},n,"prefix",{astCommand:h}).matchingDenyRules[0];if(y!==void 0)return{behavior:"deny",message:`Permission to use ${ki.name} with command ${e.command} has been denied.`,decisionReason:{type:"rule",rule:y}}}if(s?.behavior==="allow"){if((s.decisionReason?.type==="rule"?s.decisionReason.rule.ruleValue.ruleContent:void 0)===e.command.trim())return s}if(s?.behavior==="ask")return s;return null}
return { Uwe, Vcn, GTr };
}
