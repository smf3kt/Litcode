// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-886tf6ja.js sha256 593e2ed1380725f871cb3ad6b60ab6fb270bd985462dd6ee3bf5128e003fd30b
//   chunk-1t033v1j.js sha256 07eb5f690bc8609b43708ba2a3d6b2f17bfee11bc493f965342ba8fe7e84cc6e
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The atomic file writer (W45-50): the write the plugin store publishes its files through — the
// temp file, the rename, the in-place refusal and the retry policy around them. Every block is the
// module's own text, located by the needle the module spells it with; the closure is the module's
// own statements for this entry (32 of 33 in chunk-1t033v1j.js) plus the one error class the
// refusal is raised in, copied from chunk-886tf6ja.js. Three names come from outside: `E` (an
// error's code) from ./plugin-chain-fs-source.ts, `Q` (the abortable wait the retry schedule waits
// on, chunk-yjc18bey.js, exported by that chunk and already copied by W45-22)
// from ./plugin-chain-stream-source.ts, and the node builtins, bound to the names the source uses.
import { constants as a } from 'fs';
import { lstat as I, open as L, rename as K, stat as Pe, unlink as v, writeFile as oe } from 'fs/promises';
import { basename as ve, join as xe } from 'path';
import { randomBytes as Te } from 'crypto';
import { E } from './plugin-chain-fs-source.js';
import { Q } from './plugin-chain-stream-source.js';

// chunk-886tf6ja.js declares x, the telemetry-safe error the in-place refusal is raised in: its message, the telemetry message and an error class [3714,3869) 155 units sha256 a81f9ebab5cdb43a220ea79df1f1ab0ee748fc1f93a4bc60daa5437638899645
class x extends Error{telemetryMessage;errorClass;constructor(n,e,t){super(n);this.name="TelemetrySafeError",this.telemetryMessage=e??n,this.errorClass=t}}

// chunk-1t033v1j.js declares te, the flag the in-place feature gate reads [2493,2503) 10 units sha256 9e09e06c5b8d7186d5e85c04cddd63b14b276ee0a182bf763def22a986684512
var te=!1;

// chunk-1t033v1j.js declares ne, the gate's reader of that flag [2524,2548) 24 units sha256 05d2029c479be22d9a6bd77a5cabf876917e1c216f146a0ef2caaf54ac54a78b
function ne(){return te}

// chunk-1t033v1j.js declares be, the second half of the gate: whether in-place writes are served here [2926,2949) 23 units sha256 824bbb41fd0526aba516e860c5eef8e939145a5bac194629836b3f261ae901e2
function be(){return!1}

// chunk-1t033v1j.js declares $Rr, the gate itself: in-place writes are refused unless both halves allow them [2949,3009) 60 units sha256 10824c6c2a057d4444612bba86129a34a6e9381188c68487b2ccb6a2ae590490
function $Rr({served:e}){if(!ne())return!1;return e?!1:be()}

// chunk-1t033v1j.js declares rU and ST, the staging directory's name and the errors a rename retries on (EXDEV, EPERM, EEXIST, EBUSY) [3009,3076) 67 units sha256 155d21cff38fbbf74d52442eb95135d8aff5631eb6a383cfb85f7ade12927834
var rU=".cc-writes",ST=new Set(["EXDEV","EPERM","EEXIST","EBUSY"]);

// chunk-1t033v1j.js declares GGn, the gate asked for the unserved case [3076,3115) 39 units sha256 989526e675204cf2658b141f74e3a5f3ac816c03c837dc6be546cb63759bf77d
function GGn(){return $Rr({served:!1})}

// chunk-1t033v1j.js declares pTo, the text of the in-place refusal: the file has other names on disk [3115,3366) 251 units sha256 c06e80679255f6b3975279ea65f0512989c348e2db2c66da0f3067301e70f6bb
function pTo(e,t){return`Could not rewrite ${e} in place: this file has other names on disk (it is hard-linked, ${t} names in all), and writing it in place would change the file under every one of those names. Remove the extra links, then try again.`}

// chunk-1t033v1j.js declares ae, the refusal as the telemetry-safe error the writer raises [3366,3511) 145 units sha256 fdde5b9dbb732a30b5d93fd97c07b85760414164f1b5f20dd3932838618aeedb
function ae(e,t){return Object.assign(new x(pTo(e,t),"in-place write refused: the target has other names (a hard link)"),{code:"EMLINK",path:e})}

// chunk-1t033v1j.js declares UR, the temp file's name: the target plus `.tmp.` and four random hex bytes [3554,3611) 57 units sha256 92fb88a0a704f3f7e08682538809dbfc23a6dfd48b7dfb81b59d71720197f361
function UR(e){return`${e}.tmp.${Te(4).toString("hex")}`}

// chunk-1t033v1j.js declares se, ce, ke, URr and Ae: the retry counts, the per-attempt delays, the long backoff and the shared counter the delays are taken from [3784,3898) 114 units sha256 5dd0e29d98d9bf332d1ac451a2896b358af203fea5a631b2be191e15ecd2b060
var se=4,ce=50,ke=Array.from({length:se-1},()=>ce),URr=[100,500,2000],Ae=new Int32Array(new SharedArrayBuffer(4));

// chunk-1t033v1j.js declares le, whether a failed attempt may be retried [3936,3969) 33 units sha256 671af774ef345ed780f26a616fc3446a46f36007415f8637749426d1cf7e9a09
function le(e,t,n=se-1){return!1}

// chunk-1t033v1j.js declares ue, the mode bit a symlink is recognised by [3969,3980) 11 units sha256 70ad6f1ebafc1cf82d376ebc98af3384ad28b83f722e5682a30304ed6e9cefd2
var ue=128;

// chunk-1t033v1j.js declares Ce, whether the path is a symlink, answered from its own mode [3980,4054) 74 units sha256 fa2a8bd5934138685acbb3a63dc4451dab33e212d49e35e099cd0dfd1905c312
async function Ce(e){try{return((await I(e)).mode&ue)===0}catch{return!1}}

// chunk-1t033v1j.js declares TD, the retry loop: it runs an attempt, waits the schedule's delay and gives up after the last one [4054,4240) 186 units sha256 c3784d499d6c42d1debdad66fe993d783cb6b28537e780672bc8574737377eb5
async function TD(e,t,n=ke){let r=!1;for(let o=0;;o++)try{return await e(),r}catch(i){if(le(i,o,n.length)){if(o===0&&t!==void 0&&await Ce(t))throw i;r=!0,await Q(n[o]);continue}throw i}}

// chunk-1t033v1j.js declares ss, the retrying rename [4240,4285) 45 units sha256 09ee275f5369b4800a0ef35e4e6624684ce2e835d07f7f08584db49a9e19c1a6
function ss(e,t,n=K){return TD(()=>n(e,t),t)}

// chunk-1t033v1j.js declares COs, fe and Mse: the errors a write retries on (ENOSPC, EIO, EDQUOT, EFBIG), the 64 MiB bound and the open flag [4539,4619) 80 units sha256 c4817e8917ecef630f5ded039f6ab52bf853a381c40c15517d097690c568f7ab
var COs=new Set(["ENOSPC","EIO","EDQUOT","EFBIG"]),fe=67108864,Mse=a.O_NONBLOCK;

// chunk-1t033v1j.js declares de, whether an in-place write is possible for this path on this platform [4619,4691) 72 units sha256 eeb9e07a983cb18e83757ec6c6e4e0261453462b7770cbe6c1d55eb8d737dbba
async function de(e,t,n="darwin"){return(await We(e,t,n)).kind==="pass"}

// chunk-1t033v1j.js declares We, the platform probe de is built on: what the path's ownership and kind say on darwin [4691,4905) 214 units sha256 814b92a095f7ff2951adb069f7932e75a6a3c11de7f1503c7cff7a8801cabd97
async function We(e,t,n="darwin"){if(n!=="win32")return{kind:"pass"};try{return{kind:(await I(e)).isFile()?"pass":"refuse"}}catch(r){if(E(r)==="ENOENT")return{kind:t?"pass":"refuse"};return{kind:"failed",error:r}}}

// chunk-1t033v1j.js declares Me, the snapshot of the file as it is on disk, taken before the write [5018,5452) 434 units sha256 5eb80d068920ab782d8d2153867c2dd3ccffa3deb5e1354743832c0143a57e83
async function Me(e,t=!1){if(!t&&!await de(e,!0))return{kind:"unavailable"};let n;try{n=await L(e,a.O_RDONLY|(t?0:a.O_NOFOLLOW)|Mse)}catch(r){return E(r)==="ENOENT"?{kind:"absent"}:{kind:"unavailable"}}try{let r=await n.stat();if(!r.isFile()||r.size>fe)return{kind:"unavailable"};return{kind:"snapshot",bytes:new Uint8Array(await n.readFile()),mode:r.mode&4095}}catch{return{kind:"unavailable"}}finally{await n.close().catch(()=>{})}}

// chunk-1t033v1j.js declares Ye, the in-place write: the one path that writes the target without a rename [5452,5821) 369 units sha256 7d4c47792edf5f8c913a37358fe915ca309272bc5eb999a7b0fce092f75073cb
async function Ye(e,t,n=!1){if(!n&&!await de(e,!0))return!1;let r;try{r=await L(e,a.O_WRONLY|a.O_CREAT|a.O_TRUNC|(n?0:a.O_NOFOLLOW)|Mse,t.mode)}catch{return!1}try{if(!(await r.stat()).isFile())return await r.close().catch(()=>{}),!1;return await r.writeFile(t.bytes),await r.chmod(t.mode).catch(()=>{}),await r.close(),!0}catch{return await r.close().catch(()=>{}),!1}}

// chunk-1t033v1j.js declares F, the failure annotated with what the write was about to publish [5821,6196) 375 units sha256 1e7c303e5f3bcf8a49ccd19444b6c955cfa51749e0f2763b17b7089b97e3f900
function F(e,t,n){try{if(e instanceof Error)e.message=`${e.message}; ${t!==void 0?`new contents preserved at ${t}; `:""}${n==="restored"?"original target restored":n==="removed"?"partial target removed":n==="untouched"?"target untouched":"target left partial \u2014 treat contents as torn"}`,Object.assign(e,{...t!==void 0&&{preservedTmp:t},targetOutcome:n})}catch{}return e}

// chunk-1t033v1j.js declares i1e, whether an error says the operation is unsupported here (EINVAL, ENOTSUP, EPERM, ENOSYS) [6196,6285) 89 units sha256 d1bc7d4160fbb1e02ad98b8a3e5a0707eb1aff803aef340d5767e4ce2fe50152
function i1e(e){let t=E(e);return t==="EINVAL"||t==="ENOTSUP"||t==="EPERM"||t==="ENOSYS"}

// chunk-1t033v1j.js declares VGn, the error a refused beforePublish raises: nothing was written [6285,6442) 157 units sha256 bb0c65e55838e72bdd8dec37e68275c09d1cc92052bf69f434a82a540f4d254a
class VGn extends Error{target;constructor(e){super("beforePublish refused the write; nothing was published");this.target=e;this.name="PublishRefusedError"}}

// chunk-1t033v1j.js declares De, the staging directory: validated when given, the target itself otherwise [6442,6719) 277 units sha256 377b738559a761b27ad314bc7d785f7655d49b3a3bb043a81845274c58276ff0
async function De(e,t){if(t===void 0)return e;try{await(await L(t,a.O_RDONLY|a.O_DIRECTORY|a.O_NOFOLLOW)).close()}catch(n){switch(E(n)){case"ENOENT":case"ELOOP":case"ENOTDIR":return e;case"EACCES":case"EPERM":if(await Ue(t))return e;throw n;default:throw n}}return xe(t,ve(e))}

// chunk-1t033v1j.js declares Ue, whether the file is owned by this process's uid [6719,6835) 116 units sha256 73165c1a2adaf1828b595a073325b9d8f23cdb29382671b328668f55fb475874
async function Ue(e){let t=process.getuid?.();if(t===void 0)return!1;try{return(await I(e)).uid!==t}catch{return!1}}

// chunk-1t033v1j.js declares C, the attempts a taken temp name is given [6835,6843) 8 units sha256 f0f1cde3974b3307cb41b91aa58ec288744d81eb969c69423cc3c3272eb54fb4
var C=3;

// chunk-1t033v1j.js declares me, whether the name already exists [6843,6961) 118 units sha256 0045925ea88eeb23aada0ac04e7ebeef4914a9783faff5096533db69e8384cd9
async function me(e,t){if(t!=="win32")return!1;try{return await I(e),!0}catch(n){return E(n)==="ENOENT"?!1:{cause:n}}}

// chunk-1t033v1j.js declares W, the error an exclusive create raises when the name is taken [6961,7136) 175 units sha256 0691cd48a4cc4537d6b601f69e0ef4751a5ebe5f64263f4cb9b4208e62fe87ad
function W(e,t){return Object.assign(Error("EEXIST: name already taken (exclusive create)",typeof t==="object"?{cause:t.cause}:void 0),{code:"EEXIST",syscall:"lstat",path:e})}

// chunk-1t033v1j.js declares j, the temp name taken by exclusive create, retried while the name is taken [7136,7320) 184 units sha256 2cc3e6b33416cff80bc08f8105b3bfa91593ff2661223c1e4ce692c83a9c81b4
async function j(e,t,n){for(let r=1;;r++){let o=UR(e),i=await me(o,t);if(i!==!1){if(r<C)continue;throw W(o,i)}try{return await n(o)}catch(s){if(E(s)==="EEXIST"&&r<C)continue;throw s}}}

// chunk-1t033v1j.js declares RD, the write through a taken temp file [7320,7506) 186 units sha256 b7bc098f62c49450ccf1032dfebac221b8ac0462b7298950e8ddb554e5ea3b19
async function RD(e,t,n,r="darwin"){return j(e,r,async(o)=>{try{return await oe(o,t,{encoding:"utf8",mode:n,flag:"wx"}),o}catch(i){if(E(i)!=="EEXIST")await v(o).catch(()=>{});throw i}})}

// chunk-1t033v1j.js declares Be, the same write answering the open file handle it took [7710,7841) 131 units sha256 5cb9fe805c3996944060564a3ac790bfe7b6553bbe0c10422dfbec754ae987cc
async function Be(e,t,n="darwin"){return j(e,n,async(r)=>({fh:await L(r,n==="win32"?"wx":a.O_WRONLY|a.O_CREAT|a.O_EXCL,t),tmp:r}))}

// chunk-1t033v1j.js declares vn, the entry the store calls: a file, its contents, a mode and an optional rename [8106,8169) 63 units sha256 792ab29d2a4de57b92cf1c8f0bb0b4ac571dd00b2a71648bb856755e4b2ff2a7
async function vn(e,t,n,r){return Ope(e,t,{mode:n,renameFn:r})}

// chunk-1t033v1j.js declares Ope, the writer itself: the snapshot, the temp file, the beforePublish gate, the flush and the rename, with the in-place path taken only where it is allowed [8169,10336) 2167 units sha256 f64565adb195c5b3104008ddc669074379326e0c2f5987463779aafeb55f5e3b
async function Ope(e,t,n){let{mode:r,createMode:o,exactMode:i,flush:s,followSymlinks:f,inPlaceOnTempCreateRefused:c,stagingDir:S,renameFn:w,beforePublish:g}=n,P=r??o,k=()=>{if(g!==void 0&&!g())throw new VGn(e)},y=await De(e,S),A=f===!0?0:a.O_NOFOLLOW,m,T=!1,M=!1,G=async(p)=>{let l=await Me(e,f===!0),h=l.kind==="snapshot"?l:void 0;k();let u=await L(e,a.O_WRONLY|a.O_CREAT|A|Mse,i??P),N;try{N=await u.stat()}catch(_){throw await u.close().catch(()=>{}),T=p!==void 0,F(_,p,"untouched")}let d=N.isCharacterDevice();if(!N.isFile()&&!d)throw await u.close().catch(()=>{}),Object.assign(Error("refusing the in-place arm on a non-regular target"),{code:"ENXIO",path:e});if(!d&&N.nlink>1&&GGn())throw await u.close().catch(()=>{}),ae(e,N.nlink);if(g!==void 0&&!g()){if(await u.close().catch(()=>{}),l.kind==="absent"&&N.size===0&&!d)await v(e).catch(()=>{});throw new VGn(e)}let z=!1;try{if(!d)await u.truncate(0),z=!0;await u.writeFile(t,{encoding:"utf8"});let _=d?void 0:i??(l.kind!=="absent"?r:void 0);if(_!==void 0)await u.chmod(_).catch(()=>{});if(s===!0)try{await u.sync()}catch(Y){if(!i1e(Y))throw Y}await u.close()}catch(_){if(await u.close().catch(()=>{}),!z)throw T=p!==void 0,F(_,p,"untouched");T=p!==void 0;let Ee=h!==void 0&&await Ye(e,h,f===!0)?"restored":await v(e).then(()=>!0,(ye)=>E(ye)==="ENOENT")?"removed":"partial";throw F(_,p,Ee)}let q=p??m;if(q!==void 0)await v(q).catch(()=>{})};try{try{if(i!==void 0||s===!0){let l=await Be(y,i??P),h=l.fh;m=l.tmp;let u=!1,N;try{if(await h.writeFile(t,{encoding:"utf8"}),i!==void 0)try{await h.chmod(i)}catch(d){if(!i1e(d))throw d}if(s===!0)try{await h.sync()}catch(d){if(!i1e(d))throw d}}catch(d){u=!0,N=d}if(!u)M=!0;try{await h.close()}catch(d){if(!u)throw T=!0,F(d,m,"untouched")}if(u)throw N}else m=await RD(y,t,P),M=!0}catch(l){if(c!==!0)throw l;if(M)throw l;if(E(l)!=="EACCES")throw l;if(!await Pe(e).then(()=>!0,()=>!1))throw l;await G(void 0);return}if(m===void 0)throw Error("staging block exited without a staging file");let p=m;try{let l=w??K;await ss(p,e,(h,u)=>(k(),l(h,u)))}catch(l){let h=E(l);if(h===void 0||!ST.has(h))throw l;await G(p)}}catch(p){if(m!==void 0&&!T)await v(m).catch(()=>{});throw p}}


export { vn, Ope };
