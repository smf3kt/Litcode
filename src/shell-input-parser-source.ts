// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
export function createPermissionInputParser(k, Ke, c, failure = {}) {
const { Ye, au, Uxr, WWn } = failure;
// chunk-sfn1dbxq.js Zwe [3355651,3356264), UTF-16; sha256 95e29a86fccb34d21a6068f2a631fba82b957a75beca62b96f3bfe365873fc1a
function Zwe(e,n,r){try{return{parsedInput:e.inputSchema.parse(n),keysSetAside:!1}}catch(s){let h=s?.issues,y=(Array.isArray(h)?h:[]).filter((M)=>M?.code==="unrecognized_keys"&&Array.isArray(M.keys)&&Array.isArray(M.path));if(y.length===0||!k("tengu_tidy_eclipse",!0)||Dpn(e,n,r)!==void 0)throw s;let b={...n},w=new Set([b]);for(let M of y){let z=b;for(let V of M.path){let X=z[V];if(typeof X!=="object"||X===null){z=void 0;break}if(!w.has(X)){let he=Array.isArray(X)?[...X]:{...X};w.add(he),z[V]=he}z=z[V]}if(z!==void 0)for(let V of M.keys)delete z[V]}return{parsedInput:e.inputSchema.parse(b),keysSetAside:!0}}}
// chunk-sfn1dbxq.js Dpn [3356264,3356656), UTF-16; sha256 c411ec0717a0567eb8860d6c9d5b114c2d8138a54b9782b66c6d16a0282777b4
function Dpn(e,n,r){if(e.permissionCheckFailureDecision===void 0)return;try{return e.permissionCheckFailureDecision(n,r)}catch(s){if(!Ke(s))c(s);return{behavior:"deny",message:`The ${e.name} permission check failed and its fail-closed posture could not be determined. The call is denied.`,decisionReason:{type:"other",reason:"permission check crashed; tool declares a fail-closed posture"}}}}
// chunk-sfn1dbxq.js G9e [3356656,3357036), UTF-16; sha256 3e06559b01a9db5a1fc95428f172eba9af21fddd44740214891b111df71b58d2
function G9e(e,n,r,s){if(e instanceof Ye||e instanceof au)throw e;if(Ke(e)&&s.abortController.signal.aborted)throw new Ye;if(Uxr(e))return{behavior:"deny",message:`The ${n.name} permission check needs a working directory, and this session has none, so the call is denied. A retry is denied the same way.`,decisionReason:{type:"other",reason:WWn}};if(!Ke(e))c(e);return Dpn(n,r,s)}
return { Zwe, Dpn, G9e };
}
