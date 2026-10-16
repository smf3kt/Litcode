// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
//   chunk-m4qpskd4.js sha256 730cbd0e42d685bf16a3b53c020b479670597d6bef6db2ab594049eea3e782ae
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The dispatcher reads the host seam (the log, the two-segment name predicate), the runner copy (the
// overridden-answer chain, the raise application, the object test, the error class and the
// override-dispatcher getter), the classic copy (the value-event catalog), the loader copy (the
// withholding labels), the clock copy (is this a clock call), the ui copy (the plugin label and the
// dropped-call record) and the host-call copy (the funnel and the two tables it reads). What is below
// is the fresh half: the dispatcher, its five refusal rules, its two scan rules and the small name
// lists and predicates they read.
import { t } from './plugin-chain-host.js';
import { Z$n } from './plugin-chain-host.js';
import { Aws, He, L, swr } from './plugin-chain-source.js';
import { Q$n } from './plugin-chain-classic-source.js';
import { D5t } from './plugin-chain-loader-source.js';
import { xme } from './plugin-chain-clock-env-source.js';
import { CK, uMe } from './plugin-chain-ui-source.js';
import { Cme, Hze, TDe } from './plugin-chain-host-call-source.js';

// chunk-sfn1dbxq.js `R3` — the first segment of a dotted name, which is what the refusal log keys on [1837694,1837732) 38 units sha256 d0450a836f803521e91f0310945376028d0ce35f3fe9840cf17f421b0936671d
var R3=(e)=>e.slice(0,e.indexOf("."));

// chunk-sfn1dbxq.js `HGt` — the sentence a withheld call is refused with, logged once per plugin and first segment [1837732,1838166) 434 units sha256 b4b304151eefd0d15bde54684994ccfc54beddbbf4e4c49e0cfdd34238c128e3
function HGt(e,{plugin:n,spelling:r,by:s}){let h=rho(r,s),y=`${n}:${R3(r)}`;if(!e.refusalsLogged.has(y)){e.refusalsLogged.add(y);let b=e.knownArgs.get(n),w=b?D5t(b):n;t(`hooks module ${w}: ${h} (withheld at engine.create; the call reached the host past $'s stub: through a table a step captured from next(e), or through a $ built before the withholding); later calls on $.${R3(r)} are refused without a line`,{level:"warn"})}return h}

// chunk-sfn1dbxq.js `UGt` — whether another hooks module that crashed while withholding also holds this first segment [1838166,1838257) 91 units sha256 41977c5f81da21571cac04bc95a3a7720690286fe76f7120daddabf48d208727
function UGt(e,n,r){for(let[s,h]of e.crashedWithholders)if(s!==n&&h.has(r))return s;return}

// chunk-sfn1dbxq.js `jGt` — the plugin a call is withheld by: the staged holder first, then the staged-before one, then the live set, then a crashed module [1838257,1838526) 269 units sha256 bd51573dba64a2d1c1204c4179046a695bf3a8f731606e798adfe42c8416ba48
function jGt(e,n,r){let{staged:s,stagedBefore:h,building:y}=e,b=n.environmentId!==void 0&&y?.some((w)=>w.environmentId===n.environmentId)===!0;return(b?s?.refuser(n.plugin,r):void 0)??(b?h?.refuser(n.plugin,r):void 0)??e.withheld.refuser(n.plugin,r)??UGt(e,n.plugin,r)}

// chunk-sfn1dbxq.js `kme` — whether the caller’s hooks module declares this call at all (the host rule over the scan) [1838526,1838826) 300 units sha256 7ce23f448df4804e59c20e74fc229b86071280634c61e7576ca50d67696d35de
function kme(e,n){if(!e)return"no hooks module of that name is loaded, so there is no scan to allow it (host rule)";let r=e.calls.includes(n),s=e.calls.length===0;return r?void 0:"its hooks module does not call it (host rule; the scan lists "+(s?"no calls":e.calls.map((h)=>`$.${h}`).join(", "))+")"}

// chunk-sfn1dbxq.js `Sme` — the four gates a `$` call passes before anything runs: the scan, the withholding, the unadmitted module behind the call, and the clock exemption [1838826,1839344) 518 units sha256 0dfc457f009fb621c671a272cd0c0a8e8320fd0ba100afae059a84df4d487330
function Sme(e,{spelling:n,caller:r,isClock:s}){let h=e.state.knownArgs.get(r.plugin),y=kme(h?.scan,n);if(h===void 0||y!==void 0)throw new He(`${r.plugin}: $.${n} refused: ${y}`);let b=jGt(e.state,r,R3(n));if(b!==void 0)throw new He(HGt(e.state,{plugin:r.plugin,spelling:n,by:b}));if([...r.callers??[],r.environmentId].some((M)=>M!==void 0&&e.state.unadmitted.has(M))&&!s)throw new He(`${r.plugin}: $.${n} refused: a hooks module behind the call is not admitted (plugin.register runs once the set is built)`);return h}

// chunk-sfn1dbxq.js `nzt` — the scan rule for `env.get`/`env.set`: the variable name the call passes must be one the module’s scan lists [1844394,1844768) 374 units sha256 95de0ff7970c6dda2042360baff269532e46605f25518c58ad3a98c19e8ce69f
function nzt(e,n,r){if(!tEs(n))return;let s=xme(r),h=n==="env.get";if(s===void 0)return`it carries no variable name a $.${n}("<name>") call passes`;let y=(h?e.env?.reads:e.env?.writes)??[];return y.includes(s)?void 0:`its hooks module does not name ${s} in a $.${n}("<name>") call (host rule; the scan lists ${h?"reads":"writes"} of ${y.length===0?"nothing":y.join(", ")})`}

// chunk-sfn1dbxq.js `H2e` — the notice a refused-but-droppable call leaves: the text beside the record the `$` table reads [2345040,2345175) 135 units sha256 5fea2d41836952c39331282fcf536464ad5fa400bee200ada0654e0806e63cbc
function H2e(e,n,r){let s=`$.${n} dropped: ${r}`;t(`${e}: ${s}`,{level:"warn"}),CK({key:["dropped",uMe(e),n].join(" "),lead:e,text:s})}

// chunk-sfn1dbxq.js `kJt` — the spelling a call is refused under: an `interface.call` is named by its name and method [2355306,2355414) 108 units sha256 8cf713d2b028c157a6e6e9ba73a5cfaa2c5c4d3f3672ce15b92a6a1608bbfcd4
function kJt(e,n){if(e==="interface.call"){let r=n;return`${String(r?.name)}.${String(r?.method)}`}return e}

// chunk-sfn1dbxq.js `Xqo` — the argument copy a state-carrying call is handed, so a hook cannot reach the object the plugin still holds [2355414,2355576) 162 units sha256 28af536f00339e130e7383eb05146a2bd4c0e88466c5c40da67279b7920095d8
function Xqo(e){if(!L(e))return e;let n={};for(let r of Object.keys(e))Object.defineProperty(n,r,{value:e[r],enumerable:!0,writable:!0,configurable:!0});return n}

// chunk-sfn1dbxq.js `Qqo` — the scan rule for `state.get`/`state.set`: the `{plugin, key}` a call passes must be one the module’s scan lists [2355576,2356082) 506 units sha256 8905ea0e48d6861af1caf60826a7de259c43b33d201913213cc55d89022b66ce
function Qqo(e,n,r){if(!nUn(n))return;let s=L(r)?r.plugin:void 0,h=L(r)?r.key:void 0;if(typeof s!=="string"||typeof h!=="string")return`it carries no reference a $.${n}({ plugin, key }) call passes`;let y=n==="state.get",b=(y?e.state?.reads:e.state?.writes)??[],w=b.some((z)=>z.plugin===s&&z.key===h),M=b.map(ylt).join(", ")||"nothing";return w?void 0:`its hooks module does not refer to ${ylt({plugin:s,key:h})} in a $.${n}({ plugin, key }) call (host rule; the scan lists ${y?"reads":"writes"} of ${M})`}

// chunk-sfn1dbxq.js `G2e` — the dispatcher itself: copy the arguments for a state call, run the four gates, the host check and its droppable notice, then raise, stamp and run — through the funnel for an event the catalog holds, through `interface.call`’s own road, or straight into the call table [2356082,2356850) 768 units sha256 2bf2c7f10629383b2bb6eba56f4adef43762d3365a7c4ccf2c620aed1d01fa80
async function G2e(e,{op:n,args:r,caller:s}){let h=e.ops[n],y=nUn(n)?Xqo(r):r,b=Cme.has(n)?TDe(y):y,w=kJt(n,b),M=Sme(e,{spelling:w,caller:s,isClock:oRe(n)}),{scan:z}=M,V={...s,admitted:M},X=nzt(z,n,b)??Qqo(z,n,b);if(X!==void 0)throw new He(`${V.plugin}: $.${w} refused: ${X}`);let he=h.check?.(b,V);if(he!==void 0&&iIt(n))H2e(V.plugin,w,he);if(he!==void 0)throw new He(`${V.plugin}: ${w}: ${he} (host check)`);let ke=h.raise?.(V),Se=ke?Aws(ke,b):b,Re=h.stamp?h.stamp(Se,V):Se;if(n==="interface.call"&&Z$n(w)){let Me=b,$e=e.ops["interface.call"];return Hze({event:w,args:Me.args[0]??{},caller:V,bottom:{run:(Ve)=>$e.run({...Me,args:[Ve]},V)}})}let Pe=swr();return Pe?Pe({op:n,args:Re,caller:V},ke,z):tho(n)?Hze({event:n,args:Re,caller:V,bottom:h,raise:ke}):h.run(Re,V)}

// chunk-m4qpskd4.js `tho` — whether the call goes through the funnel at all: the catalog’s own value events do [47535,47564) 29 units sha256 2ec24474498badadd2e42603afb5362ec9b40036cdd4177fdaf508e055de4042
var tho=(e)=>Q$n.includes(e);

// chunk-m4qpskd4.js `Xt` — the two names the environment scan covers; the runner copy declares its own `Xt` that is a different value, so this statement is copied rather than the name imported [51989,52018) 29 units sha256 30cd830cbe5f4e056e949682e0fba87bd8e184c421675956ef4044f881d31ff2
var Xt=["env.get","env.set"];

// chunk-m4qpskd4.js `tEs` — whether this call is one the environment scan reads [52018,52046) 28 units sha256 1c80f0f1981228ed2bf94a7f6720d14fd50cd849802d8a84122397bd3386773c
var tEs=(e)=>Xt.includes(e);

// chunk-m4qpskd4.js `Kt` and `nUn` — the two names the state scan covers, and the test over them [52046,52107) 61 units sha256 c1eed3e4d3035a4a7a9c59f960aee8509f6e34741ad9c6d98ea3da1cbb740aea
var Kt=["state.get","state.set"];var nUn=(e)=>Kt.includes(e);

// chunk-m4qpskd4.js `Yo` — a name written as itself when it is plain and as JSON otherwise; the relay copy’s same-named helper is a different statement, so this one is copied [52107,52160) 53 units sha256 7743c98138ada988555ce5b127f05a38a7b6ffb975e5e85260cdf620a3422cc8
var Yo=(e)=>/^[\w$@-]+$/.test(e)?e:JSON.stringify(e);

// chunk-m4qpskd4.js `ylt` — one `{plugin, key}` reference written the way the scan rule names it [52160,52204) 44 units sha256 97a1ab734f5aa893c93975e9f70f9c52848f84e3c64d916e943cf14a149a9e75
var ylt=(e)=>`${Yo(e.plugin)}.${Yo(e.key)}`;

// chunk-m4qpskd4.js `rho` — the sentence a call is refused with when the plugin that owned it was removed [52373,52425) 52 units sha256 0176cd5beae259c7c6c0c8bde7b7417ce29486b2e5406aebdef71de1d2421501
var rho=(e,o)=>`$.${e}: removed by plugin \`${o}\``;

// chunk-nyce03br.js `oRe` — the four clock calls, which are the exemption the unadmitted gate carries [159794,159880) 86 units sha256 3a84a59fa42b1297809617fb663ab5c07440fe2fa8dad049b3620d0a1098016b
var oRe=(e)=>e==="clock.now"||e==="clock.sleep"||e==="clock.after"||e==="clock.every";

// chunk-nyce03br.js `Hp` and `iIt` — the calls whose refusal is a dropped call rather than a thrown one, and the test over them [160097,160194) 97 units sha256 8058a16e50554b9fd7f75a86ec901d6ecd32942171155e343f271e6ac4eae389
var Hp=["ui.log","ui.notice","ui.invalidate","ui.toast","ui.status"];var iIt=(e)=>Hp.includes(e);


export { R3, HGt, UGt, jGt, kme, Sme, nzt, H2e, kJt, Xqo, Qqo, G2e, tho, Xt, tEs, Kt, nUn, Yo, ylt, rho, oRe, Hp, iIt };
