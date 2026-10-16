// Build the W45-70 seam: the prose is written here, every quoted body is pulled straight out of its
// module slice so a quote cannot drift from the copy it documents.
import fs from 'node:fs';

const plan = JSON.parse(fs.readFileSync('research/ports/W45-call-dispatch-blocks.plan.json', 'utf8'));
const body = (index) => {
  const block = plan.blocks[index];
  return fs.readFileSync(`extracted-v2/modules/${block.file}`, 'utf8').slice(block.range[0], block.range[1]);
};
const speak = (file, range, units, text) => `//\n// [${range[0]},${range[1]}) ${units} units, ${file}. ${text}\n`;

const parts = [];
parts.push(`// The \`$\` call dispatcher (W45-70) — what a plugin's \`$\` method call passes before anything runs,
// and what happens to the call afterwards. The copied bodies live in
// ./plugin-chain-call-dispatch-source.ts; this module is the seam around them.
//
// Source, chunk-sfn1dbxq.js. The dispatcher itself:
//
//   ${body(11)}
${speak('chunk-sfn1dbxq.js', [2356082, 2356850], 768, `\`G2e\` — a plugin's \`$.<name>(...)\` call. It copies the arguments when the call carries state, runs the four gates below, the call table's own check and (for a call whose refusal is a dropped call rather than a thrown one) the notice that leaves the text beside the record, and then applies the entry's own \`raise\`, then its \`stamp\`, then its \`run\`. Three roads leave it: an event the catalog holds goes through the funnel \`Hze\` with the call table's entry as its floor, an \`interface.call\` for a two-segment name goes through the funnel with its own bottom, and everything else runs straight into the entry.`)}
//
// The four gates a call passes before anything runs:
//
//   ${body(5)}
${speak('chunk-sfn1dbxq.js', [1838826, 1839344], 518, `\`Sme\` — the gate itself: the caller's hooks module must be loaded and its scan must list this call, the call must not be withheld, no hooks module behind the call may be unadmitted (a clock call is exempt), and the caller is handed back the module's known args. Every refusal is the plugin's own error text, so a refused call reads as the plugin's mistake rather than the host's.`)}
//
//   ${body(4)}
${speak('chunk-sfn1dbxq.js', [1838526, 1838826], 300, `\`kme\` — the scan rule: the module's scan must list this call. The refusal names the calls it does list, or says it lists none.`)}
//
//   ${body(3)}
${speak('chunk-sfn1dbxq.js', [1838257, 1838526], 269, `\`jGt\` — the plugin a call is withheld by: a holder staged for this environment first, then one staged before it, then the live withheld set, and last another hooks module that crashed while withholding the same first segment.`)}
//
//   ${body(2)}
${speak('chunk-sfn1dbxq.js', [1838166, 1838257], 91, `\`UGt\` — whether another hooks module that crashed while withholding also holds this first segment.`)}
//
//   ${body(1)}
${speak('chunk-sfn1dbxq.js', [1837732, 1838166], 434, `\`HGt\` — the sentence a withheld call is refused with, and the rule that a plugin is told once per first segment: the module is named by its storage id when the registry knows it, so a plugin that was removed after withholding is named by what it was, not by what it is now.`)}
//
//   ${body(0)}
${speak('chunk-sfn1dbxq.js', [1837694, 1837732], 38, `\`R3\` — the first segment of a dotted name, which is the unit both the withholding log and the withheld set are keyed by.`)}
//
// The two scan rules over what the module declared:
//
//   ${body(6)}
${speak('chunk-sfn1dbxq.js', [1844394, 1844768], 374, `\`nzt\` — the environment rule: a \`$.env.get("<name>")\` or \`$.env.set("<name>")\` call must name a variable the scan lists, reads for a read and writes for a write. A call whose first argument is not an object with a string name is refused before the list is consulted, with its own sentence.`)}
//
//   ${body(10)}
${speak('chunk-sfn1dbxq.js', [2355576, 2356082], 506, `\`Qqo\` — the state rule: a \`$.state.get({ plugin, key })\` or \`$.state.set({ plugin, key })\` call must refer to a reference the scan lists, reads for a read and writes for a write. The refusal names the reference the call asked for and lists what the scan holds.`)}
//
// The host check's droppable notice, the spelling a call is refused under, and the argument copy:
//
//   ${body(7)}
${speak('chunk-sfn1dbxq.js', [2345040, 2345175], 135, `\`H2e\` — the notice a refused call leaves when its refusal is a dropped call rather than a thrown one: the sentence is logged and recorded, so the pane can say the call was dropped while the plugin is still told the same refusal.`)}
//
//   ${body(8)}
${speak('chunk-sfn1dbxq.js', [2355306, 2355414], 108, `\`kJt\` — the spelling a call is refused under: an \`interface.call\` is named by its own name and method, every other call by the name it was made with.`)}
//
//   ${body(9)}
${speak('chunk-sfn1dbxq.js', [2355414, 2355576], 162, `\`Xqo\` — the argument copy a call that carries a reference is handed, so a hook cannot reach the object the plugin still holds. A non-object argument is passed through as it is.`)}
//
// The name lists and the small predicates under them, chunk-m4qpskd4.js unless said otherwise:
//
//   ${body(13)}
${speak('chunk-m4qpskd4.js', [51989, 52018], 29, `\`Xt\` — the two names the environment scan rule covers. The runner copy declares its own \`Xt\` that is a different statement, so this one is copied rather than the name imported; the suite measures the difference.`)}
//
//   ${body(14)}
${speak('chunk-m4qpskd4.js', [52018, 52046], 28, `\`tEs\` — whether this call is one the environment scan reads.`)}
//
//   ${body(15)}
${speak('chunk-m4qpskd4.js', [52046, 52107], 61, `\`Kt\` and \`nUn\` — the two names the state rule covers, and the test over them.`)}
//
//   ${body(16)}
${speak('chunk-m4qpskd4.js', [52107, 52160], 53, `\`Yo\` — a name written as itself when it is plain and as JSON otherwise. The relay copy carries a same-named helper that is a different statement, so this one is copied here too.`)}
//
//   ${body(17)}
${speak('chunk-m4qpskd4.js', [52160, 52204], 44, `\`ylt\` — one \`{plugin, key}\` reference written the way the state rule names it.`)}
//
//   ${body(18)}
${speak('chunk-m4qpskd4.js', [52373, 52425], 52, `\`rho\` — the sentence a call is refused with when the plugin that owned it was removed.`)}
//
//   ${body(12)}
${speak('chunk-m4qpskd4.js', [47535, 47564], 29, `\`tho\` — whether the call goes through the funnel at all: the catalog's own value events do.`)}
//
//   ${body(19)}
${speak('chunk-nyce03br.js', [159794, 159880], 86, `\`oRe\` — the four clock calls, which are the exemption the unadmitted gate carries.`)}
//
//   ${body(20)}
${speak('chunk-nyce03br.js', [160097, 160194], 97, `\`Hp\` and \`iIt\` — the calls whose refusal is a dropped call rather than a thrown one, and the test over them.`)}
//
// What the dispatcher reads that is already carried: the log and the two-segment name predicate from the
// host seam, the overridden-answer chain (\`Aws\`), the object test, the error class and the
// override-dispatcher getter (\`swr\`) from the runner copy, the value-event catalog (\`Q$n\`) from the
// classic copy, the withholding labels (\`D5t\`) from the loader copy, the clock-call test's argument
// reader (\`xme\`) from the clock copy, the plugin label and the dropped record from the ui copy, and the
// funnel with its two tables from the host-call copy.
import type {
  PluginCallCaller, PluginCallChain, PluginCallHolder, PluginCallKnownArgs, PluginCallOp, PluginCallRef,
  PluginCallScan, PluginCallState,
} from './plugin-chain-registry-state.js';
import {
  G2e, H2e, HGt, Hp, iIt, jGt, kJt, Kt, kme, nUn, nzt, oRe, Qqo, R3, rho, Sme, tEs, tho, UGt, Xqo, Xt, ylt, Yo,
} from './plugin-chain-call-dispatch-source.js';

/** Source \`Xt\`: the two names the environment scan rule covers. */
export const ENV_CALLS: readonly string[] = Xt;
/** Source \`Kt\`: the two names the state scan rule covers. */
export const STATE_CALLS: readonly string[] = Kt;
/** Source \`Hp\`: the calls whose refusal is a dropped call rather than a thrown one. */
export const DROPPED_CALLS: readonly string[] = Hp;

/** Source \`G2e\`: a plugin's \`$.<name>(...)\` call, dispatched. The copied body is async, so the answer
 *  is always a promise — a refused call rejects rather than throwing at the call site. */
export function dispatchCall(
  chain: PluginCallChain,
  call: { op: string; args: unknown; caller: PluginCallCaller },
): Promise<unknown> {
  return G2e(chain, call) as Promise<unknown>;
}

/** Source \`Sme\`: the gate a call passes before anything runs, answering the caller's known args. */
export function admittedCall(state: PluginCallState, gate: { spelling: string; caller: PluginCallCaller; isClock: boolean }): unknown {
  return Sme({ state }, gate);
}

/** Source \`kme\`: whether the module's scan lists this call — nothing when it does, the refusal otherwise. */
export function scanAllowsCall(scan: PluginCallScan | undefined, name: string): string | undefined {
  return kme(scan, name);
}

/** Source \`nzt\`: the environment scan rule for one call's arguments. */
export function scanAllowsEnv(scan: PluginCallScan, op: string, args: unknown): string | undefined {
  return nzt(scan, op, args);
}

/** Source \`Qqo\`: the state scan rule for one call's arguments. */
export function scanAllowsState(scan: PluginCallScan, op: string, args: unknown): string | undefined {
  return Qqo(scan, op, args);
}

/** Source \`jGt\`: the plugin a call is withheld by, or nothing when it is not withheld. */
export function withheldBy(state: PluginCallState, caller: PluginCallCaller, first: string): string | undefined {
  return jGt(state, caller, first);
}

/** Source \`UGt\`: another hooks module that crashed while withholding this first segment. */
export function crashedHolder(state: PluginCallState, plugin: string, first: string): string | undefined {
  return UGt(state, plugin, first);
}

/** Source \`HGt\`: the sentence a withheld call is refused with, logged once per plugin and first segment. */
export function withheldSentence(
  state: PluginCallState,
  withheld: { plugin: string; spelling: string; by: string },
): string {
  return HGt(state, withheld);
}

/** Source \`H2e\`: the notice a refused call leaves when its refusal is a dropped call. */
export function droppedCallNotice(plugin: string, name: string, problem: string): void {
  H2e(plugin, name, problem);
}

/** Source \`kJt\`: the spelling a call is refused under. */
export function callSpelling(op: string, args: unknown): string {
  return kJt(op, args);
}

/** Source \`Xqo\`: the argument copy a call that carries a reference is handed. */
export function copyCallArgs<T>(args: T): T {
  return Xqo(args) as T;
}

/** Source \`R3\`: the first segment of a dotted name. */
export function firstSegment(name: string): string {
  return R3(name);
}

/** Source \`rho\`: the sentence for a call whose plugin was removed. */
export function removedByPlugin(name: string, plugin: string): string {
  return rho(name, plugin);
}

/** Source \`Yo\`: a name written as itself when it is plain, as JSON otherwise. */
export function plainOrJsonName(name: string): string {
  return Yo(name);
}

/** Source \`ylt\`: one \`{plugin, key}\` reference written the way the state rule names it. */
export function stateReference(reference: { plugin: string; key: string }): string {
  return ylt(reference);
}

/** Source \`oRe\`: is this one of the four clock calls. */
export function isClockCall(name: string): boolean {
  return oRe(name);
}

/** Source \`iIt\`: is this a call whose refusal is a dropped call. */
export function isDroppableCall(name: string): boolean {
  return iIt(name);
}

/** Source \`nUn\`: is this a call the state rule covers. */
export function isStateCall(name: string): boolean {
  return nUn(name);
}

/** Source \`tEs\`: is this a call the environment rule covers. */
export function isEnvCall(name: string): boolean {
  return tEs(name);
}

/** Source \`tho\`: does this call go through the funnel. */
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
`);
fs.writeFileSync('src/plugin-chain-call-dispatch.ts', parts.join(''));
console.log('seam written', fs.readFileSync('src/plugin-chain-call-dispatch.ts', 'utf8').split('\n').length, 'lines');
