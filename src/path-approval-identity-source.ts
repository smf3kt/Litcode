// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
import * as S from 'node:fs';
import * as g from 'node:path';
import * as et from 'node:path';
import { homedir as Hn, homedir as it } from 'node:os';
import { readFileSync as hn } from 'node:fs';
function createPathIdentity({ ie, qpt }) {
// chunk-886tf6ja.js W [7507,7544), UTF-16; sha256 8439c063340ce5b84a3647299d7b288005264d912e9522120edf677792960d6f
function W(n){return E(n)==="ENOENT"}
// chunk-886tf6ja.js E [4814,4913), UTF-16; sha256 a84ab0a2488aed5689416393c679dde4e7f4b29aa980e121bd56b25ab3e7b5e4
function E(n){if(n&&typeof n==="object"&&"code"in n&&typeof n.code==="string")return n.code;return}
const { On, Bn, gy, el, WN, aw, oie, ree, GN, fa, qa, QPe, GS, qO, qP, cl } = (() => {
const Rt = S.statSync;
// chunk-ae84tp6z.js Ge [5355,5381), UTF-16; sha256 19b806bd3a5d4fe86648ae7621ec8e85d8be7064bd1d0fa8af9c627de5f30f90
function Ge(t,e){return t}
// chunk-ae84tp6z.js On [7395,7436), UTF-16; sha256 fce11281169388623aca1324f3dc87f2e80b286ecb465abcb5398ad79bfbb34d
function On(t){return t.normalize("NFC")}
// chunk-ae84tp6z.js Bn [7436,7484), UTF-16; sha256 0cb9af02d0d6dd6042509d464440b555e562472c866d5a91df344df552b4b3e6
function Bn(t){return/^[\\/]{2}/.test(t)||zN(t)}
// chunk-ae84tp6z.js gy [7484,7538), UTF-16; sha256 c51162af798d9c4b68b815f9fa74c808e627110322dba41cab4a72dc0c32d83e
function gy(t){return/(^|[\\/])\.\.([\\/]|$)/.test(t)}
// chunk-ae84tp6z.js VO [7624,7807), UTF-16; sha256 3412d664a3ef5b886375c35d4f6a7aa4e1d4f9d7e4fd6d8ba44d06343de14ded
function VO(t){if(/^[\\/]{2}[?.][\\/](?!unc[\\/])/i.test(t))return null;return t.match(/^[\\/]{2}(?:[?.][\\/]unc[\\/])?([^\\/]+)/i)?.[1]?.replace(/[A-Z]/g,(e)=>e.toLowerCase())??null}
// chunk-ae84tp6z.js el [7807,7869), UTF-16; sha256 8b6d244ab5cf027e64ab4aeb8db9a2780cb217739b1baaa7045fe38b465a8b27
function el(t){return/(^|[\\/])\.{1,2}[. ]*([\\/]|$)/.test(t)}
// chunk-ae84tp6z.js _6n [7943,8055), UTF-16; sha256 aea1fccd8248a8173a722da442c14fbd2b6e83627dc01c57a38d26eed7f1bb2d
function _6n(t,e="darwin"){return e==="win32"?/(^|[\\/])\.{1,2}([\\/]|$)/.test(t):/(^|\/)\.{1,2}(\/|$)/.test(t)}
// chunk-ae84tp6z.js WN [8055,8084), UTF-16; sha256 22e7ccd12fa952f6cf46f79299b5c282550b72f29b1321cbfbb6615b13a8f264
function WN(t){return _6n(t)}
// chunk-ae84tp6z.js uC [8084,8134), UTF-16; sha256 f924aaf43a746fd584d7e2411af04f3b7aab632118bba465e7d59bc5a493e56c
function uC(t){return/^[\\/]{2}[?.][\\/]/.test(t)}
// chunk-ae84tp6z.js aw [8134,8430), UTF-16; sha256 e0d33d95aae667fdb6f15e90160445fae5a79a513a859b4bb356bf49673e09cf
function aw(t){if(!/\/\.(?:vol|file|nofollow|resolve)(?:\/|$)/i.test(t))return!1;if(!t.startsWith("/"))return!1;let e=[];for(let n of t.split("/")){if(n===""||n===".")continue;if(n===".."){e.pop();continue}if(e.push(n),e.length===1&&/^\.(?:vol|file|nofollow|resolve)$/i.test(n))return!0}return!1}
// chunk-ae84tp6z.js oie [8516,8635), UTF-16; sha256 83373760f0a852756e02a68fd0c79b38ee1ad361083ebe1a43ae75265248070f
function oie(t,e){if(!Bn(t))return!1;if(uC(t)||zN(t))return!0;if(el(t))return!0;let n=VO(t);return n===null||n!==VO(e)}
// chunk-ae84tp6z.js C [8635,8745), UTF-16; sha256 645391b17f19980122f8148f31cfbcbc96e838705a529383cd05ec110f0ab2ff
function C(t){return t.length===2&&YR(t[0])==="net"||t.length===3&&YR(t[0])==="network"&&YR(t[1])==="servers"}
// chunk-ae84tp6z.js ree [8745,8931), UTF-16; sha256 36dbeebf453a2eef58e53e88c9378c0c7e9e436885a6d6e41a61c52366cbd9c8
function ree(t){if(!t.startsWith("/"))return null;let e=[];for(let n of t.split("/")){if(n===""||n===".")continue;if(n===".."){e.pop();continue}if(e.push(n),C(e))return O(n)}return null}
// chunk-ae84tp6z.js O [8931,8993), UTF-16; sha256 443bd881d31a570896faf8d59ab272557d909cc9c1519a045f67c79cb6a0f510
function O(t){return t.replace(/[A-Z]/g,(e)=>e.toLowerCase())}
// chunk-ae84tp6z.js YR [8993,9108), UTF-16; sha256 d104be4ed5b5a98f9b2ddaf558be293b37142fd509816691c5e40c2756145af5
function YR(t){return t.replace(/[\u200c-\u200f\u202a-\u202e\u206a-\u206f\ufeff]/g,"").toUpperCase().toLowerCase()}
// chunk-ae84tp6z.js GN [9676,9783), UTF-16; sha256 14fa5d333067565d1db3d71256756ee6073d55107d4bc7ac1a6afc677f089623
function GN(t,e){if(aw(t))return!0;if(fa(t)){let n=ree(t);if(n===null||n!==ree(e))return!0}return iIr(t,e)}
// chunk-ae84tp6z.js iIr [9978,10249), UTF-16; sha256 30ca6d4c29ad1a245dee607f52f78be2c6b3301c8da045c7006fbc63a70ba041
function iIr(t,e,n="darwin",r=n==="darwin"&&Ft()){if(n!=="darwin"||!BH(t,n,r))return!1;let o=nt(e,n,r).complete[0]??null,{complete:i,partial:s}=nt(t,n,r);if(i.length===0&&s.length===0)return!0;if(o===null)return!0;return i.some((a)=>a!==o)||s.some((a)=>!o.startsWith(a))}
// chunk-ae84tp6z.js J [10253,10295), UTF-16; sha256 27eac924ef691a39b43e53d67c5d15c60a7c9edece0faeb41fdc810cffe2e198
var J=Ge({value:void 0},(t)=>{t.value=void 0});
// chunk-ae84tp6z.js Ft [10296,10618), UTF-16; sha256 2ebfab6c637c3b605724772dd06455aa0d05f17b79908c44b7f88053fee1dc0a
function Ft(t=Dt){let e=t===Dt;if(e&&J.value!==void 0)return J.value;let n;try{let r=!1;try{r=t.readAutoMaster().split(`
`).some((o)=>{let i=o.replace(/#.*$/,"").trim().split(/\s+/);return i.length>=2&&i[0].toLowerCase()==="/home"})}catch(o){if(!W(o))throw o}n=r||t.homeIsOwnMount()}catch{return!0}if(e)J.value=n;return n}
// chunk-ae84tp6z.js Dt [10622,10786), UTF-16; sha256 e2d3911c6e00987a25d71a52213847aabf870ab89c4bb330da245685ec534650
var Dt={readAutoMaster:()=>hn("/etc/auto_master","utf8"),homeIsOwnMount:()=>{let t;try{t=Rt("/home")}catch(e){if(W(e))return!0;throw e}return t.dev!==Rt("/Users").dev}};
// chunk-ae84tp6z.js xn [10787,10791), UTF-16; sha256 0253cb79469d7479dc45e472b28386fc1381868b8fa7121192e06e6a245897c7
var xn=6;
// chunk-ae84tp6z.js nt [10792,11361), UTF-16; sha256 cd5f15e3e923946b9db47b092b64716f37bb2b573eb5aacff6bc3663f9867d13
function nt(t,e,n){let r=[],o=[];if(!t.startsWith("/"))return{complete:r,partial:o};let i=[];for(let s of t.split("/")){if(s===""||s===".")continue;if(s===".."){i.pop();continue}if(i.push(s),i.length>xn)continue;let a="/"+i.join("/"),u=(e==="darwin"?gj(a):a).split("/").filter((w)=>w!==""),h=u[0]?.toLowerCase();if(h==="network"){if(u.length===1)o.push("/network/");else if(u.length===2)o.push(`/network/${O(u[1])}/`);else if(u.length===3)r.push(`/network/${O(u[1])}/${O(u[2])}`)}else if(n&&h==="home"&&u.length===2)r.push(`/home/${u[1]}`)}return{complete:r,partial:o}}
// chunk-ae84tp6z.js fa [11361,11389), UTF-16; sha256 26d0cf49ce2baf85f5d1cc4a5c5a7e6144949e4adcffb829f71d4412cb139919
function fa(t){return qa(t)}
// chunk-ae84tp6z.js qa [11779,11815), UTF-16; sha256 20f934ed9febf3c4b094be4afff897291ac3164913af3d1e9c1332f49d28a260
function qa(t){return QPe(t)!==null}
// chunk-ae84tp6z.js Bt [11819,11826), UTF-16; sha256 5ee6cf59406fd9e8376bb8e361a166ee93e21a4b59d5b683e58541806bd566fa
var Bt=1024;
// chunk-ae84tp6z.js Gt [11827,11834), UTF-16; sha256 fbcad8bae54d05fbbe41b20ae1b3a3c1d88258ed6cd07edbf1e9ec0c72fe1bdd
var Gt=4096;
// chunk-ae84tp6z.js I [11835,11844), UTF-16; sha256 7768764948caa247cd09b42a5b58a539baa502ef417d251873fe4f6ec07fe9cb
var I=new Map;
// chunk-ae84tp6z.js k [11845,11854), UTF-16; sha256 6b7fa8f6f2e917e558e4237eef30e28aa4124f9f11ae0bc2d28e0fb79eba5f3b
var k=new Map;
// chunk-ae84tp6z.js QPe [11855,12015), UTF-16; sha256 db0ca5399d41f0cc1dd882c3b72a0e80344d195dffb1021235b9344cbd0c4460
function QPe(t){if(!t.startsWith("/"))return null;if(t.length>Gt)return Lt(t);let e=I.get(t);if(e===void 0){if(e=Lt(t),I.size>=Bt)I.clear();I.set(t,e)}return e}
// chunk-ae84tp6z.js Lt [12015,12176), UTF-16; sha256 8316fff200862d351d23d68c54da443a4639a67d379ea07582d7e05a4bfcc885
function Lt(t){let e=[];for(let n of t.split("/")){if(n===""||n===".")continue;if(n===".."){e.pop();continue}if(e.push(n),C(e))return"/"+e.join("/")}return null}
// chunk-ae84tp6z.js GS [12414,12612), UTF-16; sha256 0b4dad4616331a2b2c940812e1736d099e67a10e639ddcf38c92770294b9afff
function GS(t){if(!t.startsWith("/"))return!1;let e=[];for(let n of t.split("/")){if(n===""||n===".")continue;if(n===".."){e.pop();continue}e.push(n)}return e.length===1&&e[0].toLowerCase()==="net"}
// chunk-ae84tp6z.js qO [12612,12768), UTF-16; sha256 0b2b40c15fee71b9a3da6cddf82dccbd0d7f4d4e1860d55010e6fc9953130e01
function qO(t){if(!t.startsWith("/"))return!1;if(t.length>Gt)return Mt(t);let e=k.get(t);if(e===void 0){if(e=Mt(t),k.size>=Bt)k.clear();k.set(t,e)}return e}
// chunk-ae84tp6z.js Mt [12768,12953), UTF-16; sha256 ae2d793b23f969646b4a45d68a6d706ba3e8bbdab116510b2c01ec848ffb6f7d
function Mt(t){let e=[];for(let n of t.split("/")){if(n===""||n===".")continue;if(n===".."){e.pop();continue}if(e.push(n),e.length===1&&e[0].toLowerCase()==="network")return!0}return!1}
// chunk-ae84tp6z.js qP [12953,12981), UTF-16; sha256 294c1dcd6267030db307e8fee78d4336f860dee7b0e0420ef48ced9a2820175e
function qP(t){return qO(t)}
// chunk-ae84tp6z.js BH [13491,13839), UTF-16; sha256 34503954476be1fdab7aeb1652a7a498ee4e27eba29da8a561c2e57360c7a5aa
function BH(t,e="darwin",n=e==="darwin"&&Ft()){if(e!=="darwin")return!1;if(qO(t)||aw(t))return!0;if(!t.startsWith("/"))return!1;let{complete:r,partial:o}=nt(t,e,n);if(o.length>0)return!0;if(r.some((s)=>s.startsWith("/network/")))return!0;let i=r.filter((s)=>s.startsWith("/home/"));if(i.length>0){let s=bn();if(i.some((a)=>a!==s))return!0}return!1}
// chunk-ae84tp6z.js bn [13839,13955), UTF-16; sha256 49044bdd69f5d149fed2cb565e0dec2b5fff75a2e4622050295ba259ab38ed74
function bn(){let t;try{t=it()}catch{return null}let e=/^\/home\/([^/]+)/.exec(gj(t));return e?`/home/${e[1]}`:null}
// chunk-ae84tp6z.js cl [14409,14536), UTF-16; sha256 7d5cfe6ffc00fb0d35b727501d4af71bdbdcca224486eed1932b5eb575bdcdad
function cl(t){let e=/^[\\/]{2}wsl(?:\$|\.localhost)[\\/]([^\\/]*)/i.exec(t);return e!==null&&!/^\.{0,2}[. ]*$/.test(e[1]??"")}
// chunk-ae84tp6z.js vn [17010,17177), UTF-16; sha256 073c3e1fdb62938dcf3cd950e3d42dc16502b6c5f0680ea89b3ea1f6d1e03f8e
var vn=["usr/local","usr/libexec/cups","usr/share/snmp","AppleInternal","Applications","Library","Users","Volumes","cores","home","media","mnt","opt","pkg","private","sw"];
// chunk-ae84tp6z.js gj [17178,17469), UTF-16; sha256 3140459ae66bcfcc09faa6aaabf6cc79bd2c1c9c859f5ed459edf2721a622226
function gj(t){let e=t.split("/");if(e.length<5||e[0]!==""||N(e[1]??"")!=="system"||N(e[2]??"")!=="volumes"||N(e[3]??"")!=="data")return t;let n=e.slice(4);for(let r of vn){let o=r.split("/");if(n.length<o.length)continue;if(o.every((i,s)=>N(n[s]??"")===N(i)))return"/"+n.join("/")}return t}
// chunk-ae84tp6z.js N [17469,17520), UTF-16; sha256 77e8e855ffba278b862af2b32d96fda169532f705053761e3b2c31a70041c67e
function N(t){return t.toUpperCase().toLowerCase()}
// chunk-ae84tp6z.js zN [22769,22836), UTF-16; sha256 d605d6e55755cd8073fdecac05d2793f41769c534f0d8d09b358d5b45e3eb8e9
function zN(t){return zt.test(t)||t.includes("??")&&zt.test(Xt(t))}
// chunk-ae84tp6z.js zt [22840,22860), UTF-16; sha256 8699acd2d4e62d0d650d84f0010c7ac989f4331e0b329c9c77abd47f8accd00e
var zt=/^[\\/]\?\?[\\/]/;
// chunk-ae84tp6z.js Xt [22861,22916), UTF-16; sha256 c66fb84c6fa92680c8f30c8ee39c603d3873fa9d70759c96ae066815745c60bc
function Xt(t){return et.win32?et.win32.normalize(t):t}
return { On, Bn, gy, el, WN, aw, oie, ree, GN, fa, qa, QPe, GS, qO, qP, cl };
})();
// chunk-gyf58rwf.js de [60574,60582), UTF-16; sha256 95236c15845d0328409705470e733f2eed69242fd2f0db016b11a35f74b514dd
var de=/\/+/;
// chunk-gyf58rwf.js UMt [60583,60770), UTF-16; sha256 8718a0b9ec663ea46d436140703d581de1bd655f40e13c1e4697ea9916b8e94c
function UMt(e,n){let r=(u)=>u.split(de).filter(Boolean),s=g.resolve(e),i=g.resolve(n),o=r(s),a=r(i);return g.parse(s).root===g.parse(i).root&&o.length<a.length&&o.every((u,l)=>u===a[l])}
// chunk-gyf58rwf.js Mn [60770,60919), UTF-16; sha256 608170af86a271bafa6a0d6d77060f7a5ea4b18ce7667a744cd54567934173e4
function Mn(e){let n="";for(let s of e.split(/([\\/]+)/)){if(s==="."||s==="..")break;n+=s}let r=n.replace(/(?<=[^\\/])[\\/]+$/,"");return r===""?e:r}
// chunk-gyf58rwf.js mi [60919,61042), UTF-16; sha256 46aa6dbd842699b2db1bc9ab9ae8e30b1b77203dcd7f3621a3bdee1b2a835a17
function mi(e){if(e.startsWith("\\\\"))return Mn(e);let n=e.replace(/^\/+/,"/"),r=QPe(n);if(r!==null)return r;return Mn(e)}
// chunk-gyf58rwf.js yi [61046,61051), UTF-16; sha256 56e713088f2b3ce5a1594a50206926a4b000ca4f9f8bc91c0451d06a81a31ac2
var yi=mi;
// chunk-gyf58rwf.js Fe [61052,61223), UTF-16; sha256 0c86808f4f46df7ae40d37a1b1883f988e7ba2ffb88e0679eea6f968e22461bb
function Fe(e,n,r){let s=el(e);if(n.length===0||s||n.some((i)=>i==="."||i==="..")){if(r!==void 0&&(n.length>0||s))r(g.join(e,...n));return s?yi(e):e}return g.join(e,...n)}
// chunk-gyf58rwf.js Lh [61227,61255), UTF-16; sha256 089e19bec9c819ef87291f4b99e98d242decd8b6d102a8ac0aec4b35dd714e15
var Lh="\x00unverified-ancestry";
// chunk-gyf58rwf.js C8e [61256,61282), UTF-16; sha256 47d76abc6cc0b242111999d627322b9ba811745412125ce7ca596adc1bbca9d0
var C8e="\x00opaque-link-text";
// chunk-gyf58rwf.js At [61283,61366), UTF-16; sha256 7e6283eafecba7663574fef791d6f3ac2c03d7d389235d58f5ce969ad0321d77
function At(e){return gy(g.isAbsolute(e)?e:e.replace(/^(?:\.\.(?:[\\/]+|$))+/,""))}
// chunk-gyf58rwf.js kzn [61366,61626), UTF-16; sha256 46671e4425bea4cc7adee4f45068a5be306bf18d6f6cd341c517d0ed3e1b9326
function kzn(e,n=!1){return e.includes("\uFFFD")||At(e)||n&&(/^(?:[A-Za-z]:(?![\\/])|[\\/](?![\\/]))/.test(e)||/^[\\/]{2}\?[\\/]/.test(e)&&!/^[\\/]{2}\?[\\/](?:[A-Za-z]:[\\/]|UNC[\\/])/i.test(e)||e.split(/[\\/]/).some((r)=>r!=="."&&r!==".."&&/[. ]$/.test(r)))}
// chunk-gyf58rwf.js Un [61780,62014), UTF-16; sha256 0d89c53c11eb79df9f2745c5633df2518c7922dc3942bb273da4410e82645f43
function Un(e,n,r=!1,s=!1,i=!1){if(n?.unreadableAncestry!=="unverified")return;let o=e!==void 0&&typeof e==="object"&&"errno"in e?e.errno:void 0;if(o==="ENOENT"||o==="ENOTDIR")return;if(o==="ENAMETOOLONG"&&!r&&!s&&!i)return;return Lh}
// chunk-gyf58rwf.js re [62014,62042), UTF-16; sha256 72ecfcd58c3dddae03c4f16b231561c1de8b46ee99d3c5df02a4e2507b88451a
function re(e){return qO(e)}
// chunk-gyf58rwf.js De [62042,62125), UTF-16; sha256 915ae1d073822f82f8879256b2b962dcd1993b142d91db59c9d7fdb5a10b1738
function De(e,n){return n!==void 0&&n.some((r)=>qO(r)&&!GN(e,r)&&(Rt(e,r)||fa(e)))}
// chunk-gyf58rwf.js Wn [62125,62189), UTF-16; sha256 671ef8fe4f63123e9a62064038b1347a0dfdd5bcf0264a1507340508a15b1210
function Wn(e,n){return n!==void 0&&n.some((r)=>qO(r)&&Rt(r,e))}
// chunk-gyf58rwf.js Rt [62189,62313), UTF-16; sha256 c9a68a56fcbf2e7f4793aa39f0c0c768332c679378b0dba411c2f9ca8a05cb49
function Rt(e,n){let r=(o)=>o.length>1?o.replace(/\/+$/,""):o,[s,i]=[r(e),r(n)];return s===i||s.startsWith(i==="/"?i:i+"/")}
// chunk-gyf58rwf.js fe [62313,62371), UTF-16; sha256 9f3d865f89a92161309e47a054da9a3e23e9881c7a06f47923f520cb1ef311fc
function fe(e,n){return n===void 0||n.every((r)=>GN(e,r))}
// chunk-gyf58rwf.js $e [62371,62430), UTF-16; sha256 ff78353bf85ba3af5a24acd5b9974da96f83d0d86f93de0f20090ac68c06d865
function $e(e,n){return n===void 0||n.every((r)=>oie(e,r))}
// chunk-gyf58rwf.js Kn [62430,62571), UTF-16; sha256 325a1a48201a8e845aa7384c570f130d49230937c46b75b35b8d161f2cc711e2
function Kn(e,n,r){let s=fa(e)?QPe(e):null;if(s===null||!fe(s,n))return;let i=g.join(e);if(fa(i)&&ree(i)===ree(s))return i;return Fe(e,[],r)}
// chunk-gyf58rwf.js zn [62571,62690), UTF-16; sha256 f4f0579e856971c6ea2feaaf0bfb8f756a5055550ddbc2e7068b1848afad09f5
function zn(e){if(e?.anchors!==void 0&&e.anchors.length>0)return e.anchors;return e?.anchor!==void 0?[e.anchor]:void 0}
// chunk-gyf58rwf.js ff [63574,63768), UTF-16; sha256 20c9f306ed64a4485c7ff5999d696b076f1274bd420087f8ef37720d2d5cbd2e
function ff(e,n,r){return Vn(He(n,r),(s)=>{if(s.kind==="lstat")return e.lstatSync(s.path);if(s.kind==="opendirNofollow")return e.openDirNoFollowSync(s.path),"ok";return e.readlinkSync(s.path)})}
// chunk-gyf58rwf.js Vn [64077,64192), UTF-16; sha256 4c91c385b2d2c9611e4835116c53f178704ee09824af208cf1b223c16256285b
function Vn(e,n){let r;for(;;){let s=e.next(r);if(s.done)return s.value;try{r=n(s.value)}catch(i){r={errno:E(i)}}}}
// chunk-gyf58rwf.js He [64745,67735), UTF-16; sha256 f5b2d609394aef906708efee3b3e14b62114c3cc9d71b20a34d9801675d83a0a
function*He(e,n){let r=zn(n);if(re(e)&&!De(e,r))return e;if(Bn(e)&&!cl(e)&&$e(e,r)||fa(e)&&fe(e,r))return;let s=g.resolve(e),i=g.parse(s).root,o=i,a=s.slice(i.length).split(de).filter(Boolean),u=0,l=a.length,c=!1,d=!1,p,m=64,h=()=>a.some((f)=>el(f)),w=()=>/[. ]$/.test(a[0]);while(a.length>0&&u<m){if(c&&el(a[0]))return Lh;let f=g.join(o,a[0]);if(fa(f)&&fe(f,r)||re(f)&&!(De(f,r)||Wn(f,r)))return Fe(f,a.slice(1),n?.onCollapsedLanding);if(aw(f)){if(n?.surfaceNetworkRaw===!0||n?.unreadableAncestry==="unverified")return Lh;return Fe(f,a.slice(1),n?.onCollapsedLanding)}let y=f!=="/dev/fd"&&Rt(f,"/dev/fd");if(y&&g.dirname(f)==="/dev/fd"&&a.some((T,R)=>R>0&&(T===".."||T==="."))){a.shift();while(a[0]==="."&&a.length>1)a.shift();o=f;continue}let b=y?{errno:"ENOENT"}:yield{kind:"lstat",path:f};if(b===void 0||typeof b==="string"||"errno"in b){if(typeof b==="object"&&"errno"in b&&b.errno!==void 0&&b.errno!=="ENOENT"&&b.errno!=="ENOTDIR"&&b.errno!=="ENAMETOOLONG"){if(typeof(yield{kind:"opendirNofollow",path:f})==="string"){d=!0,a.shift(),o=f;continue}}if(n?.launchAncestry&&!d&&typeof b==="object"&&"errno"in b&&(b.errno==="EPERM"||b.errno==="EACCES")&&UMt(f,n.launchAncestry)){c=!0,a.shift(),o=f;continue}if(typeof b==="object"&&"errno"in b&&(b.errno==="ENOENT"||b.errno==="ENOTDIR"))n?.onOutcome?.({kind:"absent",at:o,remaining:[...a],fromLinkTarget:a.length>l,...b.errno==="ENOTDIR"&&{notAFolder:!0}});return Un(b,n,u>0,h(),w())}let v=b;if(d=!0,!v.isSymbolicLink()){a.shift(),o=f;continue}u++;let k=f+"\x00"+a.join("\x00");if((p??=new Set).has(k))return;p.add(k);let F=yield{kind:"readlink",path:f};if(typeof F!=="string")return Un(F,n,u>0,h(),w());let I=F;if(n?.literalLinkText==="opaque"&&kzn(I))return C8e;if(!g.isAbsolute(I)){let T=I.split(de).filter(Boolean);if(n?.surfaceNetworkRaw===!0){let R=Kn((o.endsWith(g.sep)?o:o+g.sep)+[...T,...a.slice(1)].join(g.sep),r,n?.onCollapsedLanding);if(R!==void 0)return R}a.shift(),n?.onHop?.({composed:g.resolve(o,I,...a),leaf:a.length===0,text:I}),l=Math.min(l,a.length),a=[...T,...a];continue}let A=I;if(n?.surfaceNetworkRaw===!0&&a.length>1&&GS(A)){let T=Kn([A,...a.slice(1)].join(g.sep),r,n?.onCollapsedLanding);if(T!==void 0)return T}if(Bn(A)&&!cl(A)&&$e(A,r)||fa(A)&&fe(A,r)||re(A)&&!(De(A,r)||a.length>1&&Wn(A,r)))return a.shift(),Fe(A,a,n?.onCollapsedLanding);if(n?.surfaceNetworkRaw===!0&&el(A)&&(Bn(A)||qa(A)||qO(A)||GS(A)))return a.shift(),a.length===0?A:A+g.sep+a.join(g.sep);a.shift();let P=g.parse(A).root||g.sep,O=g.parse(f).root,H=/^[\\/]$/.test(P)&&O!==""&&!/^[\\/]$/.test(O);if(H&&(n?.surfaceNetworkRaw===!0||n?.unreadableAncestry==="unverified"))return Lh;n?.onHop?.({composed:a.length===0?A:g.resolve(A,...a),leaf:a.length===0,text:I}),o=H?O:P,d=!1,l=Math.min(l,a.length),a=[...A.slice(P.length).split(de).filter(Boolean),...a]}if(a.length>0&&n?.literalLinkText==="opaque")return C8e;if(a.length>0)return Lh;if(u>0&&GS(o))return o;if(re(o)&&!De(o,r))return o;if(a.length===0)n?.onOutcome?.({kind:"resolved",path:o});return}
// chunk-gyf58rwf.js yo [67735,68107), UTF-16; sha256 6a48399c8ac4a89449aa35e690b5bcebe37ad3b25a7169b620e8f45981270c85
function yo(e,n){if(Bn(n)&&!cl(n)||fa(n)||qP(n))return{resolvedPath:n,isSymlink:!1,isCanonical:!1};let r=ff(e,n);if(r===Lh)return{resolvedPath:n,isSymlink:!1,isCanonical:!1};if(r!==void 0)return{resolvedPath:r,isSymlink:!0,isCanonical:!1};try{let s=FZ(e,n);return{resolvedPath:s,isSymlink:s!==n,isCanonical:!0}}catch(s){return{resolvedPath:n,isSymlink:!1,isCanonical:!1}}}
// chunk-gyf58rwf.js ywe [68107,68463), UTF-16; sha256 62543881bd598d6d3e2193d132de58115430f7d3e03e172f13feb49b257534cf
function ywe(e){let n=qpt();if(n===null)return null;try{let r=g.resolve(n),s=g.resolve(e.cwd()),i=g.parse(r).root;if(i!==g.parse(s).root)return null;let o=r.slice(i.length).split(de).filter(Boolean),a=s.slice(i.length).split(de).filter(Boolean),u=0;while(u<o.length&&u<a.length&&o[u]===a[u])u++;return u>0?g.join(i,...o.slice(0,u)):null}catch{return null}}
// chunk-gyf58rwf.js FZ [68463,68860), UTF-16; sha256 2d42f63d6e79b6dabef32cbbbc7cee1f373b46d5066e984e53db4290c451a2dd
function FZ(e,n){try{return e.realpathSync(n)}catch(r){let s=E(r);if(s!=="EPERM"&&s!=="EACCES")throw r;let i,o=ywe(e);if(ff(e,n,{unreadableAncestry:"unverified",surfaceNetworkRaw:!0,launchAncestry:o,onOutcome:(u)=>{i=u}})!==void 0||i===void 0)throw r;if(i.kind==="absent")throw Object.assign(Error("ENOENT: no such file or directory"),{code:"ENOENT",syscall:"realpath",path:n});return On(i.path)}}
// chunk-gyf58rwf.js di [73816,73857), UTF-16; sha256 fec809eaee2184257d224f88e43c96f566e0cc831b0d17a5a3f2ab797003a2a2
function di(e){return qn(e,"permission")}
// chunk-gyf58rwf.js qn [74330,74593), UTF-16; sha256 de62d64fc998d5185d1f19258cf0044e102846d82dbe1099e77ca888a7b51724
function qn(e,n){let r=ie();return Vn(er(e,n),(s)=>{switch(s.kind){case"lstat":return r.lstatSync(s.path);case"opendirNofollow":return r.openDirNoFollowSync(s.path),"ok";case"readlink":return r.readlinkSync(s.path);case"realpath":return r.realpathSync(s.path)}})}
// chunk-gyf58rwf.js er [74593,76645), UTF-16; sha256 dfed801c2172c4e6f1c6d5bc9c8ea09bc89edb912a7b8e5e5f9b365bedcefcdd
function*er(e,n){let r=e;if(r==="~")r=Hn().normalize("NFC");else if(r.startsWith("~/"))r=g.join(Hn().normalize("NFC"),r.slice(2));let s=new Set([r]),i=(R,L=!1)=>({unresolved:!1,requested:r,spellings:Array.from(s),landing:R,leafIsSymlink:L});if(Bn(r)&&!cl(r)||fa(r)||qP(r))return i(r);let o=ie(),a=ywe(o),u,l,c=!1,d=!1,p=!1,m=!1,h=[],w=new Set,f=(R)=>{let L=g.resolve(R);if(!w.has(L))w.add(L),h.push(R)},y=r,b,v=function*(R){let L;for(;;){let B=R.next(L);if(B.done)return B.value;let V=B.value;if(y=V.path,V.kind==="readlink")d=!0;else b=void 0;if(L=yield V,typeof L==="object"&&"errno"in L)if(V.kind==="readlink")p=!0;else b=L.errno,m||=V.kind==="opendirNofollow"&&L.errno==="ELOOP"}},k=yield*v(He(r,{unreadableAncestry:"unverified",launchAncestry:a,...!1,onCollapsedLanding:(R)=>{u=R},onOutcome:(R)=>{l=R},onHop:({composed:R,leaf:L,text:B})=>{if(L)s.add(R),c=!0;if(n==="screen"&&At(B))f(R)}})),F=n==="permission"&&!d&&(b==="ENAMETOOLONG"||(b==="EACCES"||b==="EPERM")),I=()=>{let R=On(r);return s.add(R),i(R)},A=()=>F?I():{unresolved:!0,requested:r,spellings:Array.from(s),stoppedAt:y,leafIsSymlink:c,reason:d||m?"past-a-link":"unexamined"},ee=8,P=function*(){for(let R=0;R<h.length;R++){if(R>=ee)return!1;let L=h[R];if(Bn(L)&&!cl(L)||fa(L)||qP(L)){s.add(L);continue}let B=yield*v(He(L,{unreadableAncestry:"unverified",launchAncestry:a,onHop:({composed:V,text:se})=>{if(At(se))f(V)}}));if(B===Lh||p)return!1;if(B!==void 0)s.add(B)}return!0};if(k===Lh||k===C8e)return A();if(k!==void 0){if(n==="screen"&&!(yield*P()))return A();if(u!==void 0)s.add(u);return s.delete(k),s.add(k),i(k,c)}if(l===void 0){if(n==="screen"&&!p)return(yield*P())?I():A();return A()}if(l.kind==="absent"&&(n==="screen"?l.remaining.some((R)=>el(R)):d&&l.remaining.some((R)=>WN(R))))return A();let O=l.kind==="absent"?l.at:l.path,H=l.kind==="absent"?l.remaining.join(g.sep):"",z=On(H===""?O:g.join(O,H));if(d||O!==g.parse(O).root)s.add(z);let T=xi(yield{kind:"realpath",path:O},O,H);if(T!==void 0&&T!==z)s.delete(T),s.add(T);if(n==="screen"&&!(yield*P()))return A();return i(z,c)}
// chunk-gyf58rwf.js xi [76645,76729), UTF-16; sha256 7b1e00dde5ffd11c36815f846c0f053dc555a690e01d1202e6ca9646af0c712f
function xi(e,n,r){if(typeof e!=="string"||e===n)return;return r===""?e:g.join(e,r)}
// chunk-gyf58rwf.js wpt [76729,76820), UTF-16; sha256 cd2ad6ae44d48e67d6ddf4e3f8ed29bfb6cea551a11847f8fb1c85d878a5dd7d
function wpt(e){return{unresolved:!1,requested:e,spellings:[e],landing:e,leafIsSymlink:!1}}
// chunk-gyf58rwf.js _o [76820,76853), UTF-16; sha256 720b8e8c214d21cd8f6ca5d29fa5c6782640aa9df5c169799617058e70fa2c95
function _o(e){return hxr(di(e))}
// chunk-gyf58rwf.js hxr [76853,77042), UTF-16; sha256 dd2eb23c982a21b0950d0c5c51bd97cbea32d73eb7a5885d6d0396958c965820
function hxr(e){if(!e.unresolved)return e.spellings;let{resolvedPath:n,isCanonical:r,isSymlink:s}=yo(ie(),e.requested);return(r||s)&&!e.spellings.includes(n)?[...e.spellings,n]:e.spellings}
// chunk-ae84tp6z.js tl [11681,11730), UTF-16; sha256 a1ef7566d730b862d332c82c4c742d5856c8edf590571e100039461e32205a71
function tl(t){return Bn(t)||fa(t)||qP(t)||aw(t)}
// chunk-8pet3bvp.js Vut [3464,3525), UTF-16; sha256 7ea0f6b644fc0dc677717cb7e355edc647a0761fbd2ff903b896ad8ca5fa0086
function Vut(e,n){return n==="windows"&&Bn(e)&&!cl(e)||fa(e)}
return { yo, di, _o, ywe, UMt, tl, Vut, ff };
}
export { createPathIdentity };
