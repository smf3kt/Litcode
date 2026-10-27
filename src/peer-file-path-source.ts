// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W363-peer-file-path-source-plan.json.
// Modules:
//   chunk-886tf6ja.js sha256 593e2ed1380725f871cb3ad6b60ab6fb270bd985462dd6ee3bf5128e003fd30b
//   chunk-ae84tp6z.js sha256 901937cc8e68c765b7dddc4875578a6b1759f5e9a2535bee85829bea8ace200f
//   chunk-bf3z2ftn.js sha256 1c4ed6b761e5ced6000d4a7c4c43b970eb1d35c37015a35c3ac825b5739478b3
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { readFileSync as hn, statSync as Rt } from 'node:fs';
import { homedir as it } from 'node:os';
import * as et from 'node:path';

// chunk-886tf6ja.js E [4814,4913) 99 units sha256 a84ab0a2488aed5689416393c679dde4e7f4b29aa980e121bd56b25ab3e7b5e4
function E(n){if(n&&typeof n==="object"&&"code"in n&&typeof n.code==="string")return n.code;return}

// chunk-886tf6ja.js W [7507,7544) 37 units sha256 8439c063340ce5b84a3647299d7b288005264d912e9522120edf677792960d6f
function W(n){return E(n)==="ENOENT"}

// chunk-ae84tp6z.js Ge [5355,5381) 26 units sha256 19b806bd3a5d4fe86648ae7621ec8e85d8be7064bd1d0fa8af9c627de5f30f90
function Ge(t,e){return t}

// chunk-ae84tp6z.js Bn [7436,7484) 48 units sha256 0cb9af02d0d6dd6042509d464440b555e562472c866d5a91df344df552b4b3e6
function Bn(t){return/^[\\/]{2}/.test(t)||zN(t)}

// chunk-ae84tp6z.js uC [8084,8134) 50 units sha256 f924aaf43a746fd584d7e2411af04f3b7aab632118bba465e7d59bc5a493e56c
function uC(t){return/^[\\/]{2}[?.][\\/]/.test(t)}

// chunk-ae84tp6z.js aw [8134,8430) 296 units sha256 e0d33d95aae667fdb6f15e90160445fae5a79a513a859b4bb356bf49673e09cf
function aw(t){if(!/\/\.(?:vol|file|nofollow|resolve)(?:\/|$)/i.test(t))return!1;if(!t.startsWith("/"))return!1;let e=[];for(let n of t.split("/")){if(n===""||n===".")continue;if(n===".."){e.pop();continue}if(e.push(n),e.length===1&&/^\.(?:vol|file|nofollow|resolve)$/i.test(n))return!0}return!1}

// chunk-ae84tp6z.js oIr [8430,8516) 86 units sha256 b61f05ab7e02acd5c2250073b49f5ec9946bde7fe48a8df968244652226c1ec0
function oIr(t){return/^[\\/](GLOBAL\?\?|GLOBALROOT|DosDevices|Device)[\\/]/i.test(t)}

// chunk-ae84tp6z.js C [8635,8745) 110 units sha256 645391b17f19980122f8148f31cfbcbc96e838705a529383cd05ec110f0ab2ff
function C(t){return t.length===2&&YR(t[0])==="net"||t.length===3&&YR(t[0])==="network"&&YR(t[1])==="servers"}

// chunk-ae84tp6z.js O [8931,8993) 62 units sha256 443bd881d31a570896faf8d59ab272557d909cc9c1519a045f67c79cb6a0f510
function O(t){return t.replace(/[A-Z]/g,(e)=>e.toLowerCase())}

// chunk-ae84tp6z.js YR [8993,9108) 115 units sha256 d104be4ed5b5a98f9b2ddaf558be293b37142fd509816691c5e40c2756145af5
function YR(t){return t.replace(/[\u200c-\u200f\u202a-\u202e\u206a-\u206f\ufeff]/g,"").toUpperCase().toLowerCase()}

// chunk-ae84tp6z.js J [10249,10296) 47 units sha256 49d07d2104b47250c64386614cc7ee7f3def8280f38b0f334178240d5d240727
var J=Ge({value:void 0},(t)=>{t.value=void 0});

// chunk-ae84tp6z.js Ft [10296,10618) 322 units sha256 2ebfab6c637c3b605724772dd06455aa0d05f17b79908c44b7f88053fee1dc0a
function Ft(t=Dt){let e=t===Dt;if(e&&J.value!==void 0)return J.value;let n;try{let r=!1;try{r=t.readAutoMaster().split(`
`).some((o)=>{let i=o.replace(/#.*$/,"").trim().split(/\s+/);return i.length>=2&&i[0].toLowerCase()==="/home"})}catch(o){if(!W(o))throw o}n=r||t.homeIsOwnMount()}catch{return!0}if(e)J.value=n;return n}

// chunk-ae84tp6z.js Dt/xn [10618,10792) 174 units sha256 34499fe50f4db0848d91e8f8e5526ce26da215d3996f57f7fc2a9a9c35a582cf
var Dt={readAutoMaster:()=>hn("/etc/auto_master","utf8"),homeIsOwnMount:()=>{let t;try{t=Rt("/home")}catch(e){if(W(e))return!0;throw e}return t.dev!==Rt("/Users").dev}},xn=6;

// chunk-ae84tp6z.js nt [10792,11361) 569 units sha256 cd5f15e3e923946b9db47b092b64716f37bb2b573eb5aacff6bc3663f9867d13
function nt(t,e,n){let r=[],o=[];if(!t.startsWith("/"))return{complete:r,partial:o};let i=[];for(let s of t.split("/")){if(s===""||s===".")continue;if(s===".."){i.pop();continue}if(i.push(s),i.length>xn)continue;let a="/"+i.join("/"),u=(e==="darwin"?gj(a):a).split("/").filter((w)=>w!==""),h=u[0]?.toLowerCase();if(h==="network"){if(u.length===1)o.push("/network/");else if(u.length===2)o.push(`/network/${O(u[1])}/`);else if(u.length===3)r.push(`/network/${O(u[1])}/${O(u[2])}`)}else if(n&&h==="home"&&u.length===2)r.push(`/home/${u[1]}`)}return{complete:r,partial:o}}

// chunk-ae84tp6z.js fa [11361,11389) 28 units sha256 26d0cf49ce2baf85f5d1cc4a5c5a7e6144949e4adcffb829f71d4412cb139919
function fa(t){return qa(t)}

// chunk-ae84tp6z.js Jy [11730,11779) 49 units sha256 fbc188c8577afb69c8644ab7d7fe1a73a053168d1b53df1e515e13d20ddafa1c
function Jy(t){return fa(t)||qP(t)||GS(t)||aw(t)}

// chunk-ae84tp6z.js qa [11779,11815) 36 units sha256 20f934ed9febf3c4b094be4afff897291ac3164913af3d1e9c1332f49d28a260
function qa(t){return QPe(t)!==null}

// chunk-ae84tp6z.js Bt/Gt/I/k [11815,11855) 40 units sha256 5cd509e8813f7a905d1be88428656187308f5572d555377e1a79a07b47fe9fd7
var Bt=1024,Gt=4096,I=new Map,k=new Map;

// chunk-ae84tp6z.js QPe [11855,12015) 160 units sha256 db0ca5399d41f0cc1dd882c3b72a0e80344d195dffb1021235b9344cbd0c4460
function QPe(t){if(!t.startsWith("/"))return null;if(t.length>Gt)return Lt(t);let e=I.get(t);if(e===void 0){if(e=Lt(t),I.size>=Bt)I.clear();I.set(t,e)}return e}

// chunk-ae84tp6z.js Lt [12015,12176) 161 units sha256 8316fff200862d351d23d68c54da443a4639a67d379ea07582d7e05a4bfcc885
function Lt(t){let e=[];for(let n of t.split("/")){if(n===""||n===".")continue;if(n===".."){e.pop();continue}if(e.push(n),C(e))return"/"+e.join("/")}return null}

// chunk-ae84tp6z.js GS [12414,12612) 198 units sha256 0b4dad4616331a2b2c940812e1736d099e67a10e639ddcf38c92770294b9afff
function GS(t){if(!t.startsWith("/"))return!1;let e=[];for(let n of t.split("/")){if(n===""||n===".")continue;if(n===".."){e.pop();continue}e.push(n)}return e.length===1&&e[0].toLowerCase()==="net"}

// chunk-ae84tp6z.js qO [12612,12768) 156 units sha256 0b2b40c15fee71b9a3da6cddf82dccbd0d7f4d4e1860d55010e6fc9953130e01
function qO(t){if(!t.startsWith("/"))return!1;if(t.length>Gt)return Mt(t);let e=k.get(t);if(e===void 0){if(e=Mt(t),k.size>=Bt)k.clear();k.set(t,e)}return e}

// chunk-ae84tp6z.js Mt [12768,12953) 185 units sha256 ae2d793b23f969646b4a45d68a6d706ba3e8bbdab116510b2c01ec848ffb6f7d
function Mt(t){let e=[];for(let n of t.split("/")){if(n===""||n===".")continue;if(n===".."){e.pop();continue}if(e.push(n),e.length===1&&e[0].toLowerCase()==="network")return!0}return!1}

// chunk-ae84tp6z.js qP [12953,12981) 28 units sha256 294c1dcd6267030db307e8fee78d4336f860dee7b0e0420ef48ced9a2820175e
function qP(t){return qO(t)}

// chunk-ae84tp6z.js BH [13491,13839) 348 units sha256 34503954476be1fdab7aeb1652a7a498ee4e27eba29da8a561c2e57360c7a5aa
function BH(t,e="darwin",n=e==="darwin"&&Ft()){if(e!=="darwin")return!1;if(qO(t)||aw(t))return!0;if(!t.startsWith("/"))return!1;let{complete:r,partial:o}=nt(t,e,n);if(o.length>0)return!0;if(r.some((s)=>s.startsWith("/network/")))return!0;let i=r.filter((s)=>s.startsWith("/home/"));if(i.length>0){let s=bn();if(i.some((a)=>a!==s))return!0}return!1}

// chunk-ae84tp6z.js bn [13839,13955) 116 units sha256 49044bdd69f5d149fed2cb565e0dec2b5fff75a2e4622050295ba259ab38ed74
function bn(){let t;try{t=it()}catch{return null}let e=/^\/home\/([^/]+)/.exec(gj(t));return e?`/home/${e[1]}`:null}

// chunk-ae84tp6z.js gin [13992,14064) 72 units sha256 9f6fe24e2da1324ebf080d4262ba8ee48f7d8aca93a4d4b14c6ccfb2aecbe4e9
function gin(t){return ks(t)||qa(t)||GS(t)||uC(t)||zN(t)||oIr(t)||aw(t)}

// chunk-ae84tp6z.js cl [14409,14536) 127 units sha256 7d5cfe6ffc00fb0d35b727501d4af71bdbdcca224486eed1932b5eb575bdcdad
function cl(t){let e=/^[\\/]{2}wsl(?:\$|\.localhost)[\\/]([^\\/]*)/i.exec(t);return e!==null&&!/^\.{0,2}[. ]*$/.test(e[1]??"")}

// chunk-ae84tp6z.js ks [14536,14572) 36 units sha256 7df9415f6ab855cfbd6c3e9a005632343faf183c6c8bab1d947a536623ec6b62
function ks(t){return Bn(t)&&!cl(t)}

// chunk-ae84tp6z.js vn [17006,17178) 172 units sha256 d5516f5541bfd6b616c6d197da06e94cf5bfb1242238a7f007905f97e0777176
var vn=["usr/local","usr/libexec/cups","usr/share/snmp","AppleInternal","Applications","Library","Users","Volumes","cores","home","media","mnt","opt","pkg","private","sw"];

// chunk-ae84tp6z.js gj [17178,17469) 291 units sha256 3140459ae66bcfcc09faa6aaabf6cc79bd2c1c9c859f5ed459edf2721a622226
function gj(t){let e=t.split("/");if(e.length<5||e[0]!==""||N(e[1]??"")!=="system"||N(e[2]??"")!=="volumes"||N(e[3]??"")!=="data")return t;let n=e.slice(4);for(let r of vn){let o=r.split("/");if(n.length<o.length)continue;if(o.every((i,s)=>N(n[s]??"")===N(i)))return"/"+n.join("/")}return t}

// chunk-ae84tp6z.js N [17469,17520) 51 units sha256 77e8e855ffba278b862af2b32d96fda169532f705053761e3b2c31a70041c67e
function N(t){return t.toUpperCase().toLowerCase()}

// chunk-ae84tp6z.js zN [22769,22836) 67 units sha256 d605d6e55755cd8073fdecac05d2793f41769c534f0d8d09b358d5b45e3eb8e9
function zN(t){return zt.test(t)||t.includes("??")&&zt.test(Xt(t))}

// chunk-ae84tp6z.js zt [22836,22861) 25 units sha256 8b68dda0adc5783173149a1075e35d52617263cf6cbc25bfac86edb046a1d428
var zt=/^[\\/]\?\?[\\/]/;

// chunk-ae84tp6z.js Xt [22861,22916) 55 units sha256 c66fb84c6fa92680c8f30c8ee39c603d3873fa9d70759c96ae066815745c60bc
function Xt(t){return et.win32?et.win32.normalize(t):t}

// chunk-bf3z2ftn.js yCo [6300,6350) 50 units sha256 70d6727361d26d0bcb72d707010d82ee75f63cb260ad311db6e614131bccab1d
function yCo(e,n="darwin"){return gin(e)||BH(e,n)}


export { Bn, yCo, Jy };
