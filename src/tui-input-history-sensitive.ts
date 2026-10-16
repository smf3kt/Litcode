// @ts-nocheck
// Exact source bodies; provenance: research/ports/W44-history-copies.json.
var Qy=/hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9/_-]+/gi;
var Jy=[/\bBearer\s{1,512}(?=[A-Za-z0-9._~+/=-](?:[A-Za-z0-9._~+/=-]|%(?!20)[0-9A-Fa-f]{2}){15})(?:eyJ|(?=(?:[A-Za-z0-9._~+/=-]|%(?!20)[0-9A-Fa-f]{2}){0,64}[0-9=]))/i,/:\s{0,512}Basic\s{1,512}(?=[A-Za-z0-9+/=]{16})(?=[A-Za-z0-9+/=]{0,64}[0-9=])/i,/\bsk-(?=[A-Za-z0-9_-]{20})(?=[A-Za-z0-9_-]{0,64}[0-9])/];
var bCs=4096;
var ja=[[ct("sk-ant-","[A-Za-z0-9_-]",8,_r(8)),"<token>"],[ct("sk-(?:proj|svcacct|admin)-","[A-Za-z0-9_-]",20,_r(20)),"<token>"]];
var qa=["AKIA","ASIA","ABIA","ACCA","A3T[A-Z0-9]"];
var Zy=`(?:${qa.join("|")})`;
var Ga=[[new RegExp(`(^|[^A-Za-z0-9+])${Zy}[A-Z0-9]{16}(?![A-Za-z0-9+=])`,"g"),"$1<token>"]];
var Ba=[[ct("gh[opusr]_","[A-Za-z0-9]",20,He("[A-Za-z0-9]")),"<token>"],[/github_pat_[A-Za-z0-9_]{82,}/g,"<token>"],[/sq0(?:atp|csp)-[A-Za-z0-9_-]{22,}/g,"<token>"],[/(^|[^A-Za-z0-9+/])EAAA[A-Za-z0-9+/=%_-]{56,}/g,"$1<token>"],[ct("gl(?:pat|dt|rt|ft|soat|oas|agent|ptt|cbt|imt|ffct)-","[A-Za-z0-9_=-]",20,He("[A-Za-z0-9_=-]"),"(?:\\.[0-9a-z]{9})?"),"<token>"],[ct("(?:xox[abe-z](?:\\.xox[a-z])?|xapp|xwfp)-","[A-Za-z0-9+/=%_-]",10,"(?=[0-9])","",He("[A-Za-z0-9+/=%_-]"),"gi"),"<token>"],[new RegExp(`(?:\\bxox[cd]-[A-Za-z0-9+/=%_-]{10,}|xox[cd]-${He("[A-Za-z0-9+/=%_-]")}[A-Za-z0-9+/=%_-]{16,})`,"gi"),"<token>"],[Qy,"hooks.slack.com/<redacted>"]];
var tR=/\beyJ(?:[A-Za-z0-9_-]{256}|[A-Za-z0-9_-]{8,2048}\.[A-Za-z0-9_-]{10})/;
var Ha=[[/(^|[^A-Za-z0-9+_-])AIza[A-Za-z0-9_-]{35}(?![A-Za-z0-9+=_-])/g,"$1<token>"],[/(^|[^A-Za-z0-9+_-])GOCSPX-[A-Za-z0-9_-]{28}(?![A-Za-z0-9+=_-])/g,"$1<token>"]];
var Ka=[[/(^|[^A-Za-z0-9+_-])[sr]k_(?:live|test|prod)_(?=[A-Za-z0-9]{0,64}[0-9])[A-Za-z0-9]{24,}(?![A-Za-z0-9+=_-])/g,"$1<token>"]];
var sR=[...Jy,...[...ja,...Ga,...Ba,...Ha,...Ka].map(([e])=>new RegExp(e.source,e.flags.replaceAll("g",""))),tR];
function fbe(e){return sR.some((s)=>s.test(e))}
function ct(e,s,r,n,i="",c="",d="g"){let m=`${s}{${r},}${i}`;return new RegExp(`(?:\\b${e}${c}${m}|${e}${n}${m})`,d)}
function He(e){return`(?=${e}{0,64}[0-9])`}
function _r(e){return`(?=[A-Za-z0-9_-]{0,64}?(?=[A-Za-z0-9]{${e}})(?=[A-Za-z0-9]{0,64}[0-9])(?=[A-Za-z0-9]{0,64}[A-Za-z]))`}
export {bCs,fbe};
