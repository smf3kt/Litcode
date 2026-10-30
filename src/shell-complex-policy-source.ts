// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
import { Yx, Vs } from "./shell-analyser-source.js";
import { Kg, Emr } from "./shell-rule-recheck-source.js";
import { TVt, kWn } from "./shell-rule-suggestions-source.js";
export function createShellComplexPolicy({ Vcn, Gre, dA, $3e, dO, d, pwe, Xcn, se, Uwe, jcn }) {
const ki = { name: "Bash" };
// chunk-sfn1dbxq.js MTr [3230062,3230922), UTF-16; sha256 bf08d08abf4d7f7554e3e4cbfd86fe6f9a08f6a36f8b70e7594f64e4542f5377
async function MTr(e,n,r,s,h,y,b,w){let M=Vcn(e,n);if(M?.behavior==="deny")return M;if(Gre(n,ki,"deny").size>0){let he=new Set([...Kg(e.command),...r&&r!==Yx?Emr(r):[]]);for(let _e of he){let ke=dA({...e,command:_e},n,"prefix").matchingDenyRules[0];if(ke!==void 0)return{behavior:"deny",message:`Permission to use ${ki.name} with command ${e.command} has been denied.`,decisionReason:{type:"rule",rule:ke}}}}let z=s?.();if(z)return z;let V=$3e(e.command,!1,h,y,w);if(V!==null)return dO("tengu_bash_dangerous_rm_too_complex",{kind:d("emptyVariable")}),pwe(V,!1);if(r&&r!==Yx){let he=await Xcn(r,se(),n,h,y,b,w);if(he!==null)return dO("tengu_bash_dangerous_rm_too_complex",{kind:d(he.kind)}),he.result}if(M===null||M.behavior!=="allow")return M;return(M.decisionReason?.type==="rule"?M.decisionReason.rule.ruleValue.ruleContent:void 0)===e.command.trim()?M:null}
// chunk-sfn1dbxq.js Mcn [3215589,3215898), UTF-16; sha256 1a888ccecce3c1c2741aae2689df0f334a6b031be3b28b36698043fd2ffc8b5a
async function Mcn(e,n,r,s,h,y,b=[],w){let M=Uwe(e,n);if(M.behavior==="deny"||M.behavior==="ask")return M;let z=jcn(e,n,s,h,y,b,void 0,w);if(z.behavior==="deny"||z.behavior==="ask")return z;if(z.behavior==="allow")return z;let V=r?.commandPrefix?aTr(r.commandPrefix):TVt(e.command);return{...z,suggestions:V}}
// chunk-sfn1dbxq.js aTr [3199022,3199060), UTF-16; sha256 bcee62b01076386271f56728a32e0ef06091687304fe47507aa70d5c35adfaee
function aTr(e){return kWn(ki.name,e)}
// chunk-sfn1dbxq.js RTr [3221802,3222145), UTF-16; sha256 358956357221afd4c0fbc15f2770c95318890fafb22a4b6309435933b515dec8
function RTr(e,n,r,s){let h=[],y=[];for(let b=0;b<e.length;b++){let w=e[b],M=n?.[b];if((w===`cd ${r}`&&P3e(r)||w===`cd ${s}`&&P3e(s))&&M!==void 0&&M.argv.length===2&&M.argv[0]==="cd"&&M.envVars.length===0&&M.redirects.length===0&&!/[*?[\]]/.test(M.argv[1])&&!Vs(M.argv[1]))continue;h.push(w),y.push(M)}return{subcommands:h,astCommandsByIdx:y}}
// chunk-sfn1dbxq.js P3e [3222145,3222203), UTF-16; sha256 f7238d25f24ba1ca1c5774a945d74117725800f3f050881326f79fa071495f27
function P3e(e){return!/[\s\\$`'"*?[\]{}<>|&;()]/.test(e)}
return { MTr, Mcn, RTr };
}
