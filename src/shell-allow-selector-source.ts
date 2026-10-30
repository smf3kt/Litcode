// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
import { Un } from "./permission-rule-source.js";
import { uNe } from "./plan-deny-source.js";
import { permissionSources } from "./permission-state.js";
const ws = permissionSources.filter(s => ["userSettings", "projectSettings", "localSettings", "flagSettings", "policySettings"].includes(s));
const H1 = [...ws, "cliArg", "command", "session", "toolsNarrowing", "mcpServerPolicy", "hostCredential"];
export function createShellAllowSelector(ap, Bre, HDn, Ure, confined) {
const a = { CLAUDE_CODE_EVAL_CONFINED: confined };
// chunk-r2vtj1kh.js ii [151745,151805), UTF-16; sha256 c8be77ab93cf152cb2c54a97adc7a8524cc2fcb13592d8a37281b20b63765975
function ii(e,s=!1){return e==="auto"||e==="plan"&&!s&&ap()}
// chunk-nkb63p1y.js K [1644,1675), UTF-16; sha256 d2982d9287d3f469b3e672ebb59575572479b3e97b090936f3334683af238613
var K=new Set(["session","cliArg"]);
// chunk-nkb63p1y.js E [2088,2128), UTF-16; sha256 dceb0cf32e10bcff730f09a1e72045ee95c52ec54fe408ef902e0229ce15c2a4
function E(e,n){return!K.has(e)&&Ure(n)}
// chunk-nkb63p1y.js U0 [8017,8631), UTF-16; sha256 40f9ef182c0e51527b0db06945a2c7273cbd283054719f204865492b531b56eb
function U0(e){if(ii(e.mode,e.servedCall===!0)){let t=a.CLAUDE_CODE_EVAL_CONFINED?{cliArg:e.alwaysAllowRules.cliArg}:e.alwaysAllowRules,r=[];for(let s of H1){let l=t[s];if(l===void 0)continue;for(let i of l){let u=Un(i);if(Bre(u.toolName,u.ruleContent))continue;if(HDn(u.toolName))continue;if(E(s,u.toolName))continue;r.push({source:s,ruleBehavior:"allow",ruleValue:u})}}return r}if(a.CLAUDE_CODE_EVAL_CONFINED)return uNe({cliArg:e.alwaysAllowRules.cliArg},"allow");let n=uNe(e.alwaysAllowRules,"allow"),o;for(let[t,r]of n.entries())if(E(r.source,r.ruleValue.toolName))o??=n.slice(0,t);else o?.push(r);return o??n}
return U0;
}
