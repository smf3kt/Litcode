// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
//   chunk-tvdq3hrk.js sha256 d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The `$.ui.toast` floor and the admission policy behind it (W45-26): the table entry's `check`
// validates `timeoutMs` through `yro` against `F2e`, its `run` is `Kxo` — `Vyt`'s gate around a
// `session.toast(plugin, text, timeoutMs)` write. `sI`/`gLs` build and read the `plugin-toast-*`
// keys, `DWt`/`ACn` decide which waiting toast gives way once a plugin holds 50, `hLs` is the
// admission decision, `mLs` reports a give-way, `AQo` notes a stacking once per plugin, and
// `sLs` splits a queue into its current and waiting toasts.
import { BDe } from './plugin-chain-records.js';
import { CK, HM, Vyt, uMe } from './plugin-chain-ui-source.js';
import { t } from './plugin-chain-host.js';

// chunk-sfn1dbxq.js declares sI (the plugin a `plugin-toast-<plugin>:<id>` key names) and sLs (a queue split into its current toast, its waiting ones and whether the bar is hidden) [1691234,1691480) 246 units sha256 8bc4cc3fa439d55395713a3e508a2f98611b9e51de95f962809855d8c4307f72
var sI=(e)=>e?.match(/^plugin-toast-[^:]*:(.*)$/s)?.[1];function sLs(e,n,r){let[s,...h]=[e.current,...e.queue].map((y)=>y!==null&&sI(y.key)!==void 0?{key:y.key,ms:y.timeoutMs??r}:void 0);return{current:s,waiting:h.flatMap((y)=>y??[]),isHidden:n}}

// chunk-sfn1dbxq.js declares ACn, the waiting toasts one plugin may hold, and DWt, which names the toast that gives way when it holds that many [1695123,1695224) 101 units sha256 d93ae9e732596fcd7505998f5043496e943947fb60b6527425cd24f6769ab6b5
var ACn=50;function DWt(e,n){let r=e.filter((s)=>sI(s.key)===n);return r.length<ACn?void 0:r[0]?.key}

// chunk-sfn1dbxq.js declares AQo (a notice once per plugin and environment), fLs (the priority every plugin toast carries), Sqt (the default timeout), mLs (the give-way report), gLs (the toast key) and hLs (the admission decision: waiting, gives way, cut short) [1695323,1696041) 718 units sha256 e0ccdc6fffd9643a0f898bd8f6207d9b232241caeb07bbe4a7464b986592dffe
function AQo(e,n,r){let s=[e,uMe(n)].join(" ");if(!HM.has(s))HM.add(s),r()}var fLs="immediate";var Sqt=4000;function mLs({key:e,plugin:n,isCutShort:r}){if(e===void 0)return;if(t(`$.ui.toast (${n}): ${e} gave way, `+(r?"cut short":"unseen")),!r)CK({key:["toast gave way",uMe(n)].join(" "),lead:n,text:"$.ui.toast: a toast that waits to be shown gives way to the plugin's newer ones, unseen"})}var gLs=(e,n)=>`plugin-toast-${n}:${e}`;function hLs(e,n){if(e.isHeld)return{isWaiting:!1,givesWay:DWt(e.queue,n),isCutShort:!1};let r=sI(e.current?.key),s=r===n,h=r!==void 0&&!s||e.queue.some((w)=>sI(w.key)!==void 0),y=!h&&s,b=y?e.current:e.queue.findLast((w)=>sI(w.key)===n);return{isWaiting:h,givesWay:b?.key,isCutShort:y}}

// chunk-sfn1dbxq.js declares Kxo, the ui.toast floor: Vyt's gate around `session.toast(plugin, BDe(text), timeoutMs)` [1696157,1696266) 109 units sha256 c5fac0f5b31819862714bddf45fd438e08681c835bbbb17ad8a7d77d097af666
var Kxo=({text:e,timeoutMs:n},r)=>Vyt({event:"$.ui.toast",pluginName:r,text:e,run:(s)=>s.toast(r,BDe(e),n)});

// chunk-tvdq3hrk.js declares yro, the whole-number-in-range check the entry's timeoutMs validation uses [10862,10939) 77 units sha256 897f790f224883810a6f89e5b189d7cf0e1c0a9893fb7933c64fc731d4fe960d
function yro(e,r){return typeof e==="number"&&Number.isInteger(e)&&e>0&&e<=r}

// chunk-sfn1dbxq.js declares F2e, the timeoutMs upper bound the entry names in its refusal [2343390,2343404) 14 units sha256 c6cb802db1bb56b388b7e1f3776fab37ed2803af79655ab70975376380fecb52
var F2e=60000;


export { sI, sLs, ACn, DWt, AQo, fLs, Sqt, mLs, gLs, hLs, Kxo, yro, F2e };
