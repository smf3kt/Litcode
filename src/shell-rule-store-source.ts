// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
import { uNe } from "./plan-deny-source.js";
import { Gp } from "./plan-tool-name-source.js";
import { xX } from "./shell-rule-matcher-source.js";
export function createShellRuleStore(U0) {
const ki = { name: "Bash" };
// chunk-nkb63p1y.js Bc [8783,8835), UTF-16; sha256 a0a301a46498d64c16201d148a5f319a5690160a2017beb4197aefefef6f37c7
function Bc(e){return uNe(e.alwaysDenyRules,"deny")}
// chunk-nkb63p1y.js xm [8835,8885), UTF-16; sha256 0c6d6ac28d005a894b2518692038be4ebfde937f57142cbdd0cca65ec10faeca
function xm(e){return uNe(e.alwaysAskRules,"ask")}
// chunk-nkb63p1y.js Gre [14183,14224), UTF-16; sha256 0e14e8e58793debce4a450a2e4606930101d30f6087d7f2f5257569cf71cab24
function Gre(e,n,o){return zM(e,Gp(n),o)}
// chunk-nkb63p1y.js zM [14224,14359), UTF-16; sha256 9b3a17c83ea8704f6cc694bb20219f12878cfe854041e714f1fefe5fa5236a8f
function zM(e,n,o){let t=new Map;for(let r of B_e(e,n,o))if(r.ruleValue.ruleContent!==void 0)t.set(r.ruleValue.ruleContent,r);return t}
// chunk-nkb63p1y.js B_e [14359,14598), UTF-16; sha256 c28aa2bec5fcd3f49bd26d04131e5ab535f3e140a390f16b8ee052a9d048ee61
function B_e(e,n,o){let t=[];switch(o){case"allow":t=U0(e);break;case"deny":t=Bc(e);break;case"ask":t=xm(e);break}let r=[];for(let s of t)if(s.ruleValue.toolName===n&&s.ruleValue.ruleContent!==void 0&&s.ruleBehavior===o)r.push(s);return r}
// chunk-sfn1dbxq.js dA [3207029,3207522), UTF-16; sha256 9109eaa354ba9e36b652456662b656fcc1a410db2ab444fa6efeb7da9b4bb3ef
function dA(e,n,r,{skipCompoundCheck:s=!1,astCommand:h,compoundBareAssignmentNames:y=[]}={}){let b=Gre(n,ki,"deny"),w=xX(e,b,r,{stripAllEnvVars:!0,skipCompoundCheck:!0,astCommand:h,ruleBehavior:"deny"}),M=Gre(n,ki,"ask"),z=xX(e,M,r,{stripAllEnvVars:!0,skipCompoundCheck:!0,astCommand:h,ruleBehavior:"ask"}),V=Gre(n,ki,"allow"),X=xX(e,V,r,{skipCompoundCheck:s,ruleBehavior:"allow",astCommand:h,compoundBareAssignmentNames:y});return{matchingDenyRules:w,matchingAskRules:z,matchingAllowRules:X}}
return { Gre, dA };
}
