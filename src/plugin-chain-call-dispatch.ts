// The `$` call dispatcher (W45-70) — what a plugin's `$` method call passes before anything runs,
// and what happens to the call afterwards. The copied bodies live in
// ./plugin-chain-call-dispatch-source.ts; this module is the seam around them.
//
// Source, chunk-sfn1dbxq.js. The dispatcher itself:
//
//   async function G2e(e,{op:n,args:r,caller:s}){let h=e.ops[n],y=nUn(n)?Xqo(r):r,b=Cme.has(n)?TDe(y):y,w=kJt(n,b),M=Sme(e,{spelling:w,caller:s,isClock:oRe(n)}),{scan:z}=M,V={...s,admitted:M},X=nzt(z,n,b)??Qqo(z,n,b);if(X!==void 0)throw new He(`${V.plugin}: $.${w} refused: ${X}`);let he=h.check?.(b,V);if(he!==void 0&&iIt(n))H2e(V.plugin,w,he);if(he!==void 0)throw new He(`${V.plugin}: ${w}: ${he} (host check)`);let ke=h.raise?.(V),Se=ke?Aws(ke,b):b,Re=h.stamp?h.stamp(Se,V):Se;if(n==="interface.call"&&Z$n(w)){let Me=b,$e=e.ops["interface.call"];return Hze({event:w,args:Me.args[0]??{},caller:V,bottom:{run:(Ve)=>$e.run({...Me,args:[Ve]},V)}})}let Pe=swr();return Pe?Pe({op:n,args:Re,caller:V},ke,z):tho(n)?Hze({event:n,args:Re,caller:V,bottom:h,raise:ke}):h.run(Re,V)}
//
// [2356082,2356850) 768 units, chunk-sfn1dbxq.js. `G2e` — a plugin's `$.<name>(...)` call. It copies the arguments when the call carries state, runs the four gates below, the call table's own check and (for a call whose refusal is a dropped call rather than a thrown one) the notice that leaves the text beside the record, and then applies the entry's own `raise`, then its `stamp`, then its `run`. Three roads leave it: an event the catalog holds goes through the funnel `Hze` with the call table's entry as its floor, an `interface.call` for a two-segment name goes through the funnel with its own bottom, and everything else runs straight into the entry.

//
// The four gates a call passes before anything runs:
//
//   function Sme(e,{spelling:n,caller:r,isClock:s}){let h=e.state.knownArgs.get(r.plugin),y=kme(h?.scan,n);if(h===void 0||y!==void 0)throw new He(`${r.plugin}: $.${n} refused: ${y}`);let b=jGt(e.state,r,R3(n));if(b!==void 0)throw new He(HGt(e.state,{plugin:r.plugin,spelling:n,by:b}));if([...r.callers??[],r.environmentId].some((M)=>M!==void 0&&e.state.unadmitted.has(M))&&!s)throw new He(`${r.plugin}: $.${n} refused: a hooks module behind the call is not admitted (plugin.register runs once the set is built)`);return h}
//
// [1838826,1839344) 518 units, chunk-sfn1dbxq.js. `Sme` — the gate itself: the caller's hooks module must be loaded and its scan must list this call, the call must not be withheld, no hooks module behind the call may be unadmitted (a clock call is exempt), and the caller is handed back the module's known args. Every refusal is the plugin's own error text, so a refused call reads as the plugin's mistake rather than the host's.

//
//   function kme(e,n){if(!e)return"no hooks module of that name is loaded, so there is no scan to allow it (host rule)";let r=e.calls.includes(n),s=e.calls.length===0;return r?void 0:"its hooks module does not call it (host rule; the scan lists "+(s?"no calls":e.calls.map((h)=>`$.${h}`).join(", "))+")"}
//
// [1838526,1838826) 300 units, chunk-sfn1dbxq.js. `kme` — the scan rule: the module's scan must list this call. The refusal names the calls it does list, or says it lists none.

//
//   function jGt(e,n,r){let{staged:s,stagedBefore:h,building:y}=e,b=n.environmentId!==void 0&&y?.some((w)=>w.environmentId===n.environmentId)===!0;return(b?s?.refuser(n.plugin,r):void 0)??(b?h?.refuser(n.plugin,r):void 0)??e.withheld.refuser(n.plugin,r)??UGt(e,n.plugin,r)}
//
// [1838257,1838526) 269 units, chunk-sfn1dbxq.js. `jGt` — the plugin a call is withheld by: a holder staged for this environment first, then one staged before it, then the live withheld set, and last another hooks module that crashed while withholding the same first segment.

//
//   function UGt(e,n,r){for(let[s,h]of e.crashedWithholders)if(s!==n&&h.has(r))return s;return}
//
// [1838166,1838257) 91 units, chunk-sfn1dbxq.js. `UGt` — whether another hooks module that crashed while withholding also holds this first segment.

//
//   function HGt(e,{plugin:n,spelling:r,by:s}){let h=rho(r,s),y=`${n}:${R3(r)}`;if(!e.refusalsLogged.has(y)){e.refusalsLogged.add(y);let b=e.knownArgs.get(n),w=b?D5t(b):n;t(`hooks module ${w}: ${h} (withheld at engine.create; the call reached the host past $'s stub: through a table a step captured from next(e), or through a $ built before the withholding); later calls on $.${R3(r)} are refused without a line`,{level:"warn"})}return h}
//
// [1837732,1838166) 434 units, chunk-sfn1dbxq.js. `HGt` — the sentence a withheld call is refused with, and the rule that a plugin is told once per first segment: the module is named by its storage id when the registry knows it, so a plugin that was removed after withholding is named by what it was, not by what it is now.

//
//   var R3=(e)=>e.slice(0,e.indexOf("."));
//
// [1837694,1837732) 38 units, chunk-sfn1dbxq.js. `R3` — the first segment of a dotted name, which is the unit both the withholding log and the withheld set are keyed by.

//
// The two scan rules over what the module declared:
//
//   function nzt(e,n,r){if(!tEs(n))return;let s=xme(r),h=n==="env.get";if(s===void 0)return`it carries no variable name a $.${n}("<name>") call passes`;let y=(h?e.env?.reads:e.env?.writes)??[];return y.includes(s)?void 0:`its hooks module does not name ${s} in a $.${n}("<name>") call (host rule; the scan lists ${h?"reads":"writes"} of ${y.length===0?"nothing":y.join(", ")})`}
//
// [1844394,1844768) 374 units, chunk-sfn1dbxq.js. `nzt` — the environment rule: a `$.env.get("<name>")` or `$.env.set("<name>")` call must name a variable the scan lists, reads for a read and writes for a write. A call whose first argument is not an object with a string name is refused before the list is consulted, with its own sentence.

//
//   function Qqo(e,n,r){if(!nUn(n))return;let s=L(r)?r.plugin:void 0,h=L(r)?r.key:void 0;if(typeof s!=="string"||typeof h!=="string")return`it carries no reference a $.${n}({ plugin, key }) call passes`;let y=n==="state.get",b=(y?e.state?.reads:e.state?.writes)??[],w=b.some((z)=>z.plugin===s&&z.key===h),M=b.map(ylt).join(", ")||"nothing";return w?void 0:`its hooks module does not refer to ${ylt({plugin:s,key:h})} in a $.${n}({ plugin, key }) call (host rule; the scan lists ${y?"reads":"writes"} of ${M})`}
//
// [2355576,2356082) 506 units, chunk-sfn1dbxq.js. `Qqo` — the state rule: a `$.state.get({ plugin, key })` or `$.state.set({ plugin, key })` call must refer to a reference the scan lists, reads for a read and writes for a write. The refusal names the reference the call asked for and lists what the scan holds.

//
// The host check's droppable notice, the spelling a call is refused under, and the argument copy:
//
//   function H2e(e,n,r){let s=`$.${n} dropped: ${r}`;t(`${e}: ${s}`,{level:"warn"}),CK({key:["dropped",uMe(e),n].join(" "),lead:e,text:s})}
//
// [2345040,2345175) 135 units, chunk-sfn1dbxq.js. `H2e` — the notice a refused call leaves when its refusal is a dropped call rather than a thrown one: the sentence is logged and recorded, so the pane can say the call was dropped while the plugin is still told the same refusal.

//
//   function kJt(e,n){if(e==="interface.call"){let r=n;return`${String(r?.name)}.${String(r?.method)}`}return e}
//
// [2355306,2355414) 108 units, chunk-sfn1dbxq.js. `kJt` — the spelling a call is refused under: an `interface.call` is named by its own name and method, every other call by the name it was made with.

//
//   function Xqo(e){if(!L(e))return e;let n={};for(let r of Object.keys(e))Object.defineProperty(n,r,{value:e[r],enumerable:!0,writable:!0,configurable:!0});return n}
//
// [2355414,2355576) 162 units, chunk-sfn1dbxq.js. `Xqo` — the argument copy a call that carries a reference is handed, so a hook cannot reach the object the plugin still holds. A non-object argument is passed through as it is.

//
// The name lists and the small predicates under them, chunk-m4qpskd4.js unless said otherwise:
//
//   var Xt=["env.get","env.set"];
//
// [51989,52018) 29 units, chunk-m4qpskd4.js. `Xt` — the two names the environment scan rule covers. The runner copy declares its own `Xt` that is a different statement, so this one is copied rather than the name imported; the suite measures the difference.

//
//   var tEs=(e)=>Xt.includes(e);
//
// [52018,52046) 28 units, chunk-m4qpskd4.js. `tEs` — whether this call is one the environment scan reads.

//
//   var Kt=["state.get","state.set"];var nUn=(e)=>Kt.includes(e);
//
// [52046,52107) 61 units, chunk-m4qpskd4.js. `Kt` and `nUn` — the two names the state rule covers, and the test over them.

//
//   var Yo=(e)=>/^[\w$@-]+$/.test(e)?e:JSON.stringify(e);
//
// [52107,52160) 53 units, chunk-m4qpskd4.js. `Yo` — a name written as itself when it is plain and as JSON otherwise. The relay copy carries a same-named helper that is a different statement, so this one is copied here too.

//
//   var ylt=(e)=>`${Yo(e.plugin)}.${Yo(e.key)}`;
//
// [52160,52204) 44 units, chunk-m4qpskd4.js. `ylt` — one `{plugin, key}` reference written the way the state rule names it.

//
//   var rho=(e,o)=>`$.${e}: removed by plugin \`${o}\``;
//
// [52373,52425) 52 units, chunk-m4qpskd4.js. `rho` — the sentence a call is refused with when the plugin that owned it was removed.

//
//   var tho=(e)=>Q$n.includes(e);
//
// [47535,47564) 29 units, chunk-m4qpskd4.js. `tho` — whether the call goes through the funnel at all: the catalog's own value events do.

//
//   var oRe=(e)=>e==="clock.now"||e==="clock.sleep"||e==="clock.after"||e==="clock.every";
//
// [159794,159880) 86 units, chunk-nyce03br.js. `oRe` — the four clock calls, which are the exemption the unadmitted gate carries.

//
//   var Hp=["ui.log","ui.notice","ui.invalidate","ui.toast","ui.status"];var iIt=(e)=>Hp.includes(e);
//
// [160097,160194) 97 units, chunk-nyce03br.js. `Hp` and `iIt` — the calls whose refusal is a dropped call rather than a thrown one, and the test over them.

//
// What the dispatcher reads that is already carried: the log and the two-segment name predicate from the
// host seam, the overridden-answer chain (`Aws`), the object test, the error class and the
// override-dispatcher getter (`swr`) from the runner copy, the value-event catalog (`Q$n`) from the
// classic copy, the withholding labels (`D5t`) from the loader copy, the clock-call test's argument
// reader (`xme`) from the clock copy, the plugin label and the dropped record from the ui copy, and the
// funnel with its two tables from the host-call copy.
import type {
  PluginCallCaller, PluginCallChain, PluginCallHolder, PluginCallKnownArgs, PluginCallOp, PluginCallRef,
  PluginCallScan, PluginCallState,
} from './plugin-chain-registry-state.js';
import {
  G2e, H2e, HGt, Hp, iIt, jGt, kJt, Kt, kme, nUn, nzt, oRe, Qqo, R3, rho, Sme, tEs, tho, UGt, Xqo, Xt, ylt, Yo,
} from './plugin-chain-call-dispatch-source.js';

/** Source `Xt`: the two names the environment scan rule covers. */
export const ENV_CALLS: readonly string[] = Xt;
/** Source `Kt`: the two names the state scan rule covers. */
export const STATE_CALLS: readonly string[] = Kt;
/** Source `Hp`: the calls whose refusal is a dropped call rather than a thrown one. */
export const DROPPED_CALLS: readonly string[] = Hp;

/** Source `G2e`: a plugin's `$.<name>(...)` call, dispatched. The copied body is async, so the answer
 *  is always a promise — a refused call rejects rather than throwing at the call site. */
export function dispatchCall(
  chain: PluginCallChain,
  call: { op: string; args: unknown; caller: PluginCallCaller },
): Promise<unknown> {
  return G2e(chain, call) as Promise<unknown>;
}

/** Source `Sme`: the gate a call passes before anything runs, answering the caller's known args. */
export function admittedCall(state: PluginCallState, gate: { spelling: string; caller: PluginCallCaller; isClock: boolean }): unknown {
  return Sme({ state }, gate);
}

/** Source `kme`: whether the module's scan lists this call — nothing when it does, the refusal otherwise. */
export function scanAllowsCall(scan: PluginCallScan | undefined, name: string): string | undefined {
  return kme(scan, name);
}

/** Source `nzt`: the environment scan rule for one call's arguments. */
export function scanAllowsEnv(scan: PluginCallScan, op: string, args: unknown): string | undefined {
  return nzt(scan, op, args);
}

/** Source `Qqo`: the state scan rule for one call's arguments. */
export function scanAllowsState(scan: PluginCallScan, op: string, args: unknown): string | undefined {
  return Qqo(scan, op, args);
}

/** Source `jGt`: the plugin a call is withheld by, or nothing when it is not withheld. */
export function withheldBy(state: PluginCallState, caller: PluginCallCaller, first: string): string | undefined {
  return jGt(state, caller, first);
}

/** Source `UGt`: another hooks module that crashed while withholding this first segment. */
export function crashedHolder(state: PluginCallState, plugin: string, first: string): string | undefined {
  return UGt(state, plugin, first);
}

/** Source `HGt`: the sentence a withheld call is refused with, logged once per plugin and first segment. */
export function withheldSentence(
  state: PluginCallState,
  withheld: { plugin: string; spelling: string; by: string },
): string {
  return HGt(state, withheld);
}

/** Source `H2e`: the notice a refused call leaves when its refusal is a dropped call. */
export function droppedCallNotice(plugin: string, name: string, problem: string): void {
  H2e(plugin, name, problem);
}

/** Source `kJt`: the spelling a call is refused under. */
export function callSpelling(op: string, args: unknown): string {
  return kJt(op, args);
}

/** Source `Xqo`: the argument copy a call that carries a reference is handed. */
export function copyCallArgs<T>(args: T): T {
  return Xqo(args) as T;
}

/** Source `R3`: the first segment of a dotted name. */
export function firstSegment(name: string): string {
  return R3(name);
}

/** Source `rho`: the sentence for a call whose plugin was removed. */
export function removedByPlugin(name: string, plugin: string): string {
  return rho(name, plugin);
}

/** Source `Yo`: a name written as itself when it is plain, as JSON otherwise. */
export function plainOrJsonName(name: string): string {
  return Yo(name);
}

/** Source `ylt`: one `{plugin, key}` reference written the way the state rule names it. */
export function stateReference(reference: { plugin: string; key: string }): string {
  return ylt(reference);
}

/** Source `oRe`: is this one of the four clock calls. */
export function isClockCall(name: string): boolean {
  return oRe(name);
}

/** Source `iIt`: is this a call whose refusal is a dropped call. */
export function isDroppableCall(name: string): boolean {
  return iIt(name);
}

/** Source `nUn`: is this a call the state rule covers. */
export function isStateCall(name: string): boolean {
  return nUn(name);
}

/** Source `tEs`: is this a call the environment rule covers. */
export function isEnvCall(name: string): boolean {
  return tEs(name);
}

/** Source `tho`: does this call go through the funnel. */
export function isFunnelCall(name: string): boolean {
  return tho(name);
}

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  call with the source's own. */
export const SOURCE_BODIES = {
  G2e, H2e, HGt, Hp, iIt, jGt, kJt, Kt, kme, nUn, nzt, oRe, Qqo, R3, rho, Sme, tEs, tho, UGt, Xqo, Xt, ylt, Yo,
};

export { G2e, H2e, HGt, Hp, iIt, jGt, kJt, Kt, kme, nUn, nzt, oRe, Qqo, R3, rho, Sme, tEs, tho, UGt, Xqo, Xt, ylt, Yo };

export type {
  PluginCallCaller, PluginCallChain, PluginCallHolder, PluginCallKnownArgs, PluginCallOp, PluginCallRef,
  PluginCallScan, PluginCallState,
};
