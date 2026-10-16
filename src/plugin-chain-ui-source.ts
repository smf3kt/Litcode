// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
//   chunk-tvdq3hrk.js sha256 d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
//   chunk-qq2mgstr.js sha256 84f8f93155c8c7dcf287306959a002f20e09b31cfe97bd68e2ae14048f290e6f
//   chunk-r2vtj1kh.js sha256 2b13302b83beea3fe54e83316b9d855c43e2298af6d0041b009cec563bbc1515
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The ui.status and ui.log floors of the `$` call table (W45-24): `Vyt` gates every ui write on a
// bound session, `LWt` is the ui.status writer, `Pzo`/`Izo`/`$2e`/`Yb`/`kye` are the ui.log route
// and its too-long notice, and `lJt` is the adapter the table's status/toast runs share.
import { BDe, aCe, rOn, zz } from './plugin-chain-records.js';
import { bI } from './plugin-chain-loader-source.js';
import { Ge, He } from './plugin-chain-source.js';
import { it, t } from './plugin-chain-host.js';

// chunk-sfn1dbxq.js declares Vyt, the session gate every ui write passes: log the redacted text, then hand the bound session to the writer, or drop with `no session bound` [494176,494346) 170 units sha256 0e832099999a97ef0ef313684a9dcd8226b694dc40629f7d673fb50b51944373
function Vyt({event:e,pluginName:n,text:r,run:s}){let h=bI(),y=BDe(r);if(h===void 0){t(`${e} (${n}): no session bound; dropped: ${y}`);return}t(`${e} (${n}): ${y}`),s(h)}

// chunk-sfn1dbxq.js declares uMe, the notice key a plugin and its loaded environments share [1695224,1695323) 99 units sha256 abfedda1859904ebc45a7238e4b8d319b47d4b1e1dba77c7421fe13ee86aa7de
var uMe=(e)=>[e,...it().loadedModules.filter((n)=>n.name===e).map((n)=>n.environmentId)].join("#");

// chunk-sfn1dbxq.js declares LWt, the ui.status writer the table's ui.status entry runs; its text is `(cleared)` when it writes undefined [1696041,1696157) 116 units sha256 dc259b5792a1819250fc4df39ee4527e64e65687e00dee64626137a58470a223
var LWt=(e,n)=>Vyt({event:"$.ui.status",pluginName:n,text:e??"(cleared)",run:(r)=>r.status(n,e===void 0?e:BDe(e))});

// chunk-sfn1dbxq.js declares Pzo, the ui.log route to the debug log [2338444,2338505) 61 units sha256 c4be52e035d73080569790699ce5c6145580a60a02014010c290a247bafbdee9
function Pzo(e,n){t(`[${e}] $.ui.log (to debug): ${BDe(n)}`)}

// chunk-sfn1dbxq.js declares GCn, the ui.log subscriber mce writes through: bind the sink, flush what was held with the `again` state, and clear only this sink on unbind [2338505,2338661) 156 units sha256 f7dd0cfe1f54ee4921691bf99ed3857d863d822aa81388445ecb5aa588f246d0
function GCn(e){let n=it();n.uiLogSink=e;let r=n.pendingUiLog;n.pendingUiLog=[];for(let s of r)e(s,"again");return()=>{if(n.uiLogSink===e)n.uiLogSink=null}}

// chunk-sfn1dbxq.js declares Izo, the ui.log `to` check [2338661,2338792) 131 units sha256 b87f283c04aaacb555bec584d6af88311c058f740650f9d58e6f838601764be4
function Izo(e){return e===void 0||e==="transcript"||e==="debug"?void 0:`to is "transcript" or "debug" (got ${JSON.stringify(e)})`}

// chunk-sfn1dbxq.js declares kye, the text every cut notice carries [2343404,2343566) 162 units sha256 fd5f3b87fd13ab85d6b38d7618bd69ddfa57fcfb0d9e54b7ba45c885c669dc38
function kye({plugin:e,spelling:n,what:r,name:s,length:h,kept:y}){let b=`$.${n}: ${r}${s===void 0?"":` of ${s}`} (${h} characters) ${y}`;return t(`${e}: ${b}`),b}

// chunk-sfn1dbxq.js declares Yb, the one-time cut notice for a plugin [2343566,2343673) 107 units sha256 7f44ad0c7d097b991fd44a3d802edd49f9b1ea1cb8784134d66093fae3b1c00e
function Yb(e){let{plugin:n,spelling:r,what:s}=e;CK({key:["cut",uMe(n),r,s].join(" "),lead:n,text:kye(e)})}

// chunk-sfn1dbxq.js declares $2e, which notices a text longer than the terminal's own limit [2343673,2343880) 207 units sha256 31508d1bb59b58332bdeadcf93a95c494ca7805b8dc7b358306ef37625717e2c
function $2e(e,n,r){if(r!==void 0&&r.length>N6)Yb({plugin:e,spelling:n,what:"a text",name:void 0,length:r.length,kept:`is drawn up to its first ${N6} on the terminal, its first ${rOn} on a remote surface`})}

// chunk-sfn1dbxq.js declares lJt, the adapter the ui.status and ui.toast runs share: writer, then the cut notice [2343880,2343965) 85 units sha256 98c33fddc4dbe328df1c301651c158ed673d99495529cb2063f59d2b7447817e
var lJt=(e,n)=>(r,s)=>(n(r,s.plugin),$2e(s.plugin,e,r.text),Promise.resolve(void 0));

// chunk-tvdq3hrk.js declares LVe, the string-text check the status and log entries share [13525,13587) 62 units sha256 89d4bc6e09239ab0874b1dbbc0df624cf279a576924d8d249d64bfde63433327
var LVe=(e)=>typeof e==="string"?void 0:"takes a string text";

// chunk-n3ykh62m.js declares HM, the notice set a reset clears [279020,279054) 34 units sha256 f79025fac442de47c429e04843b2f6312403dcc85d6ae1d330de6d9c4f5ad8ad
var HM=Ge(new Set,(e)=>e.clear());

// chunk-n3ykh62m.js declares CK, which notes a text once per key and only while notices are on [279149,279230) 81 units sha256 fc3d742ac9e03efb315cad8b1a98acb66b0942f6b17fda687b6503ab74319820
function CK({key:e,lead:n,text:r}){if(!aCe()||HM.has(e))return;HM.add(e),zz(n,r)}

// chunk-qq2mgstr.js declares N6, the terminal's own text limit [8807,8826) 19 units sha256 113bea5d84e0e581fd404ed9a6be2b584230c0ca278ee1fedc34644a59373e71
var N6=2000,un=253;

// chunk-sfn1dbxq.js declares u2t, the ui.selection floor: the selection the bound loader context holds, read through its own accessor and answered as a resolved promise [1869714,1869767) 53 units sha256 a32355eccd703bba9a5cbdee9fcea6f36a7337a4c1e7a4a152de70f62987261a
var u2t=()=>Promise.resolve(bI()?.selection?.read());

// chunk-r2vtj1kh.js declares the committed flag the notify floor reads first: the Na instance, the Ia singleton, and `wn()` — once the surface is committed no notification is attempted at all [150398,150468) 70 units sha256 d94d29d4b4db1d1e9c501bb730c30fa424bed95f7abd48ef2fa34019298419b5
class Na{committed=!1}var Ia=new Na;function wn(){return Ia.committed}

// chunk-sfn1dbxq.js declares the ui.notify floor: `Dzo` the check (a title, when given, is a string), `qQt` the channel answer mapped to `{isSent, reason|channel}` (an `error` channel throws the source's own He), `Nzo` the run (the committed gate, then the session's `notify`, then the log line), and `Fzo` the stamp that fills an absent title with the plugin name [2338792,2339663) 871 units sha256 ca139a6610be2eeaad487e79351d8e4c82c309b3727ebe3901961db18dd6198e
function Dzo(e){let n=e?.title,r=n===void 0||typeof n==="string";return LVe(e?.text)??(r?void 0:"title is a string, when given")}function qQt(e,n){switch(e){case"no_surface":return{isSent:!1,reason:"no-surface"};case"iterm2":case"iterm2_with_bell":case"kitty":case"ghostty":case"terminal_bell":return{isSent:!0,channel:e};case"disabled":return{isSent:!1,reason:"disabled"};case"none":case"no_method_available":return{isSent:!1,reason:"no-channel"};case"error":throw new He(`${n}: $.ui.notify: the channel's write failed`)}}async function Nzo(e,n){let r=wn(),s=qQt(r?"no_surface":await bI()?.notify?.({message:e.text,title:e.title||n.plugin,notificationType:"plugin_notification"},n.origin)??"no_surface",n.plugin);return t(`$.ui.notify (${n.plugin}): ${e.text.length} chars: `+(s.isSent?`sent by ${s.channel}`:s.reason)),s}var Fzo=(e,n)=>({...e,title:e.title||n.plugin});


export { Vyt, LWt, Pzo, GCn, Izo, kye, Yb, $2e, lJt, uMe, LVe, HM, CK, N6, u2t, Dzo, qQt, Nzo, Fzo, wn, Ia };
