// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The notification bar's ledger core (W45-27): the time bookkeeping behind the host's toast
// method. `aLs` is one tick — it ages the toasts through `PWt`, hands the leftover time to `CWt`
// (which loses what no waiting toast can hold, over `a3`), lays the kept toasts out with `AWt`/
// `OWt`/`MWt` and returns `{ledger, texts, lost}`; `RWt`/`IWt`/`RYr` are the ledger shape, `Fpe`
// the managed-first order, `EWt` one toast's lent time, `cLs` the merge with freshly queued
// toasts, `dLs` the next tick's delay, `pLs`/`u1e` the text a plugin changed, `iLs` the
// cut-short test and `uLs` the lost-time line.
import { t } from './plugin-chain-host.js';

// chunk-sfn1dbxq.js declares a3, the 50 ms of untold time a toast may hold before the bar loses it [1691480,1691490) 10 units sha256 711a944567344f7296917f11e189f7d47d3606db22c31a99de50d99897213b00
var a3=50;

// chunk-sfn1dbxq.js declares Fpe (the managed-first order the bar lays toasts out in) and EWt (one toast's lent time: what it was shown for, and what it lent another) [1691764,1691998) 234 units sha256 51d3ac32dfe5e473387156890e61d238b92a696986ac8170de69ee114f9ae096
var Fpe=(e)=>[...e.filter((n)=>n.isManaged),...e.filter((n)=>!n.isManaged)];function EWt(e,n,r){let s=e.key===n.key,h=e.key===(n.shown??n.key),y=Number(s&&!h)-Number(h&&!s);return{...e,leftMs:e.leftMs-Number(h)*r,lentMs:e.lentMs+y*r}}

// chunk-sfn1dbxq.js declares RWt (a laid-out ledger: toasts, the tick's `at`, the running slot) and CWt (which toasts keep their time and which are lost once the waiting ones cannot hold it) [1691998,1692401) 403 units sha256 bc75b004353886958f01e731fc878922d60ad76dc33940f9fd6c16065585d14f
var RWt=(e,n,r)=>({toasts:e.map((s)=>({...s,wasShown:s.wasShown||s.key===n?.shown})),at:r,slot:n});function CWt(e,n){let r=e.map((s,h)=>{let y=Math.min(s.leftMs,Math.max(0,e.slice(0,h+1).reduce((b,w)=>b+w.leftMs,-n)));return{...s,leftMs:s.leftMs-y,untoldMs:s.untoldMs+y}});return{kept:r.map((s)=>s.untoldMs>a3?{...s,untoldMs:0}:s),lost:r.filter((s)=>s.untoldMs>a3).map((s)=>({...s,leftMs:s.untoldMs}))}}

// chunk-sfn1dbxq.js declares RYr, the empty frozen ledger a bar starts from [1692401,1692468) 67 units sha256 7949637db7e14006b5208091f069857169cb44e50c94414748fd0b51782f0ff0
var RYr=Object.freeze({toasts:Object.freeze([]),at:0,slot:void 0});

// chunk-sfn1dbxq.js declares iLs, whether a toast was shown to its plugin, or is the managed toast now cut short [1692581,1692719) 138 units sha256 8e8b8c55bfe667f6eac41420090a2d3048c32bc809bf71f45cfb4b14bdfb4938
function iLs(e,n,r){let s=e.toasts.filter((y)=>y.leftMs>0),h=Fpe(s).at(0)?.key===n;return e.toasts.some((y)=>y.key===n&&y.wasShown)||r&&h}

// chunk-sfn1dbxq.js declares AWt, the toasts the next ledger keeps: those still running, plus every key the queue still holds [1692909,1693009) 100 units sha256 9fbc173bb826c14173a01c67c3ceec72611f4327712eea255aa07e47c445fbef
var AWt=(e,n,r)=>e.flatMap((s)=>n.filter((h)=>h.key===s.key).filter((h)=>h.leftMs>0||r.has(h.key)));

// chunk-sfn1dbxq.js declares PWt, one tick's aging: the slot's elapsed time lent away, and every toast the queue no longer holds cut to zero unless a3 of time is left [1693009,1693411) 402 units sha256 b82156cb6a4d631b93d9df77f475052bf19c153c2ee6664779289fef42456747
function PWt(e,n,r){let s=new Set([n.current,...n.waiting].map((w)=>w?.key)),h=e.slot,y=Math.max(0,Math.min(r,h?.endsAt??0)-e.at),b=h?.key!==n.current?.key;return e.toasts.map((w)=>h===void 0?w:EWt(w,h,y)).map((w,M)=>{let z=s.has(w.key),V=z&&!(b&&w.leftMs!==e.toasts[M]?.leftMs),X=z?w.leftMs:Math.min(w.leftMs,w.lentMs),he=X<=(V?0:a3);return{...w,leftMs:he?0:X}}).filter((w)=>w.leftMs>0||s.has(w.key))}

// chunk-sfn1dbxq.js declares MWt, the key-to-text map of the toasts the ledger laid out [1693411,1693504) 93 units sha256 e07cc84b0a9c78458fee80ef9c8f51ed022c8b5921ae3b6bdc400350fdc6cfb1
var MWt=(e,n)=>new Map(e.flatMap((r,s)=>{let h=n[s];return h===void 0?[]:[[r.key,h.text]]}));

// chunk-sfn1dbxq.js declares IWt, the running slot: the current toast's key, when its time ends, and which toast is being shown [1693504,1693578) 74 units sha256 f7a5171a171d6e0345b0117cb67dcb9be030e456ac3b9432ae0efe3a00fb4d6b
function IWt(e,n,r){return e===void 0?void 0:{key:e.key,endsAt:n,shown:r}}

// chunk-sfn1dbxq.js declares OWt, which laid-out toast is shown at each of the queue's own start times [1693578,1693754) 176 units sha256 730f3d3cc9d20501271fec68648208ece5163eb9d89547fa74d3e445737bcd43
function OWt(e,n){let r=e.map((s,h)=>e.slice(0,h+1).reduce((y,b)=>y+b.leftMs,0));return n.map((s,h)=>{let y=n.slice(0,h).reduce((b,w)=>b+w,0);return e[r.findIndex((b)=>b>y)]})}

// chunk-sfn1dbxq.js declares aLs, the tick: age the ledger, hand the queue's time to CWt, lay out what is kept, and return {ledger, texts, lost} [1693754,1694273) 519 units sha256 c072c149489b79f5ebac889c4235e153f7b34d071f85c817175f8b40295d2295
function aLs(e,n,r){let{current:s}=n,y=s!==void 0&&e.slot?.key===s.key?e.slot?.endsAt??r:r+(s?.ms??0),b=PWt(e,n,r),w=new Set(b.map((Se)=>Se.key)),M=[s,...n.waiting].flatMap((Se)=>Se??[]),z=new Set(M.map((Se)=>Se.key)),V=M.filter((Se)=>w.has(Se.key)),X=V.map((Se)=>Se===s?Math.max(0,y-r):Se.ms),he=CWt(Fpe(b),X.reduce((Se,Re)=>Se+Re,0)),_e=OWt(he.kept.filter((Se)=>Se.leftMs>0),X),ke=s===void 0||n.isHidden||!w.has(s.key);return{ledger:RWt(AWt(b,he.kept,z),IWt(s,y,ke?void 0:_e[0]?.key),r),texts:MWt(V,_e),lost:he.lost}}

// chunk-sfn1dbxq.js declares cLs, the merge of the queued toasts with the ledger's stale ones (which keep their remaining time ahead of them) [1694442,1694593) 151 units sha256 10e180d1b64d89f88bb96df2c2c96373a2af0129f7cc664568aad40f50c31858
function cLs(e,n){let r=new Set(n.toasts.map((y)=>y.key)),s=e.toasts.filter((y)=>!r.has(y.key));return s.length===0?n:{...e,toasts:[...s,...n.toasts]}}

// chunk-sfn1dbxq.js declares dLs, the delay to the next tick: the shown toast's end while it has time left [1694593,1694731) 138 units sha256 72d94ba09a8a1d46efbdda581dddca7beaec62284585991e9a20909da2c51965
function dLs(e){let n=e.toasts.find((s)=>s.key===e.slot?.shown);return n!==void 0&&e.at+n.leftMs<(e.slot?.endsAt??0)?e.at+n.leftMs:void 0}

// chunk-sfn1dbxq.js declares uLs, the line a toast logs when the bar had no time left to give it [1694731,1694871) 140 units sha256 7c1009dab4dde019720cc37fbd5ac37beb7dd52337e2c5f684961bcfacc1e2d6
var uLs=(e)=>t(`$.ui.toast (${e.plugin}): ${e.key} lost ${e.leftMs} ms of its time, the notification bar having no toast time left for it`);

// chunk-sfn1dbxq.js declares u1e, an entry with the text a plugin changed since it was queued [1694871,1694966) 95 units sha256 ca79171b60c9c7d4eb834bdd41f649e1fa296547f8a93551c0467e94b70b0e41
function u1e(e,n){let r=n.get(e.key);return r!==void 0&&"text"in e&&e.text!==r?{...e,text:r}:e}

// chunk-sfn1dbxq.js declares pLs, the queue-state refresh: the same state back when no text changed [1694966,1695123) 157 units sha256 cedeb4ca0867c72f8c602ed56e08ff00103b001fc285849b56265a3f72f4e442
function pLs(e,n){let{current:r,queue:s}=e,h=r===null?null:u1e(r,n),y=s.map((w)=>u1e(w,n));return h===r&&y.every((w,M)=>w===s[M])?e:{...e,current:h,queue:y}}


export { a3, Fpe, EWt, RWt, CWt, RYr, iLs, AWt, PWt, MWt, IWt, OWt, aLs, cLs, dLs, uLs, u1e, pLs };
