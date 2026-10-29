// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
import { fTr, w6, Yx } from "./shell-command-clamp-source.js";
import { _ } from "./plugin-chain-store-carry-source.js";
// chunk-a60ee1ne.js k9e [2961,3027), UTF-16; sha256 73120637375673bf02fb33d6dc2eee0fb2182e685cf85d26d83bac296a806d8c
var k9e="Auto-allowed with sandbox (autoAllowBashIfSandboxed enabled)";
// chunk-a60ee1ne.js PHt [5499,5557), UTF-16; sha256 df7ad12bc7cb0f11083fc15e70704b37c438685803524dcad0df1dde1cd3c57f
var PHt="bashCommandClamp: no clamp rule matches this command";
// chunk-sfn1dbxq.js ofn [3252147,3252327), UTF-16; sha256 a0e985439ce2989e12e411968ad0359ab9b37636115eb5a85a304365247e8440
function ofn(e){for(let n of e.children){if(!n)continue;if(n.type==="ERROR")return!0;if(n.type==="&"){if(e.type!=="binary_expression")return!0;continue}if(ofn(n))return!0}return!1}
export function createShellVectorPolicy(D3e, de, sfn, $cn, dO, Rl) {
const ki = { name: "Bash" };
// chunk-sfn1dbxq.js O3e [3254351,3255656), UTF-16; sha256 5e40fb332b89fb73b852edee56618b4533615bc35aa61f7d296be1fc666075d5
async function O3e(e,n,r,s,h,y,b){let w=de(n).bashCommandClamps;if(w!==void 0&&w.length>0){let X=await fTr(e,w);if(X!==null)return dO("tengu_bash_command_clamp_denied",{groupCount:w.length}),{behavior:"deny",message:`Permission to use ${ki.name} with command ${e.command.trim()} has been denied: this agent's Bash use is clamped to a fixed set of command forms (per-spawn bashCommandClamp), and `+(X.kind==="unverifiable"?"the command has structure the clamp cannot verify "+"(substitution, control flow, or an undecomposable compound) \u2014 "+"no clamp rule can admit it. Issue plain commands matching the clamped forms.":`the span ${_(X.span)} matches none of them. Allowed forms: ${X.group.join(", ")}`),decisionReason:{type:"other",reason:PHt}}}let M=sfn(await D3e(e,n,r,s,h,y,b),e,de(n));if(M.behavior!=="allow"||!e.command.includes("&"))return $cn(M,e,de(n));if(M.decisionReason?.type==="other"&&M.decisionReason.reason===k9e)return M;let z=await w6(e.command);if(z&&z!==Yx&&!ofn(z))return M;let V={type:"safetyCheck",reason:"This command uses the `&` background operator, which defers execution past approval-time safety checks. Approve only if you trust it.",classifierApprovable:!1,circuitBreaker:"backgroundOperator"};return $cn({behavior:"ask",decisionReason:V,message:Rl(ki.name,V)},e,de(n))}
return O3e;
}
