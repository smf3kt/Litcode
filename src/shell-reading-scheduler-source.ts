// @ts-nocheck
// Exact recovered statements. See research/ports/W385-declaration-prefix-preflight.md.
import { pyr } from "./shell-analyser-source.js";
import { DTr, jwe } from "./shell-reading-merge-source.js";
// chunk-sfn1dbxq.js rfn [3252331,3252731), UTF-16; sha256 6b95a8942458ff1b1188c44c4aa197642c29578c7f88f6ffdd960bf58965139d
var rfn={"too-complex":!0,semantics:!0,"multi-cd":!0,"shell-operators":!0,"cd-git-compound":!0,"process-substitution":!0,"cd-compound-write":!1,"cd-compound-read":!1,"cd-compound-redirect":!1,"dangerous-path":!1,"flag-validation":!1,"cd-multi-positional":!1,"shell-expansion":!1,"net-redirect":!1,"sed-dangerous":!1,"no-rule-match":!1,"ask-rule":!1,"working-dir":!1,"safety-check":!1,"other-untagged":!1};
// chunk-a60ee1ne.js VW [4691,5003), UTF-16; sha256 3d607c8b197353a1d5c1eb7d919aa664c78998d42ff3e111fe77a0c9e958b80f
function VW(e){let o=`${e}; under the read block (permissions.blockReadsOutsideWorkingDirectories) a command the shell parser cannot analyze asks the person`;return{behavior:"ask",message:o,decisionReason:{type:"safetyCheck",reason:o,classifierApprovable:!1,circuitBreaker:"outsideReadsBlocked"},suggestions:[]}}
export function createReadingScheduler(O3e, de, isReadBlockExempt, OAn) {
const Cy = isReadBlockExempt;
const Tv = () => true;
// chunk-sfn1dbxq.js sfn [3252890,3253132), UTF-16; sha256 fd055389fe0fc6f6e0f3eb949bd38eb864ddb53322fc5237784e6564c40a7587
function sfn(e,n,r){if(e.behavior!=="ask")return e;let s=e.decisionReason;if(s?.type!=="other"||s.bashMissKind===void 0||!rfn[s.bashMissKind])return e;if(r.blockReadsOutsideWorkingDirectories===!0&&!(Cy(n)&&Tv()))return VW(s.reason);return e}
// chunk-sfn1dbxq.js ior.signature [3253708,3253736), UTF-16; sha256 5f9e05a6352633ecee80f762df1e8e8794b172db09d0902e04135446b6419655
async function ior(e,n,r,s){
// chunk-sfn1dbxq.js ior.initial [3253736,3253829), UTF-16; sha256 61d8ee048fdbe47db9e266ea362e57ba8a23de0fa140f92a2ebf2deba96ec5f4
let h={},y=await O3e(e,n,r,void 0,void 0,void 0,(w,M)=>{h.names=w,h.operands=M}),b=s?.(y)??y;
// chunk-sfn1dbxq.js ior.readings [3253829,3254209), UTF-16; sha256 7dae00eb2875c9d5e33d1e25315261968a3c7256c921066970416e7a4fc3731b
if(h.names!==void 0){let{readings:w,exhaustive:M}=pyr(h.names,h.operands),z=[];for(let X of w){let he=await OAn(()=>O3e(e,n,r,void 0,void 0,X));z.push(s?.(he)??he)}let V=sfn(DTr(b,z,M),e,de(n));if(V===b||V.behavior!=="ask"||!jwe(V))b=V;else if(b.behavior!=="passthrough")b={behavior:"passthrough",message:V.message,...V.decisionReason!==void 0&&{decisionReason:V.decisionReason}}}
// chunk-sfn1dbxq.js ior.return [3254342,3254351), UTF-16; sha256 ac8483f34f268857ab414bb21da87d28292535288f115dabcb1d7318c57340ca
return b}
return ior;
}
