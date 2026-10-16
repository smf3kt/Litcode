// The module-to-host call path: the raise point for the value events (`ui.*`, `prompt.*`, `state.*`,
// `env.*` and the rest of `Q$n`), which no classic site reaches — a classic raise asks
// `Q_t(event)`, and the gate only holds for names prefixed `classic.`. The copied bodies live in
// ./plugin-chain-host-call-source.ts; this module is the host seam around them.
//
// Source: `Hze` (chunk-sfn1dbxq.js [1842591,1843388) 797 units) is what a plugin method call funnels
// into. It collects the chain's handlers for the event (`P0`), waits out a module whose hooks are
// still loading and retries when one is found (`N5t`), runs the dispatch (`aP`) with the call table's
// own action as the floor (`bottom`), and returns the answer's `value` — throwing the answer's `deny`
// as the plugin's own error text. Two of its checks are its own: a two-segment non-dotted name
// (`Z$n(e)`, so `ui.log` but not `ui.*`) whose args are no object throws before anything runs, and a
// denied answer throws `${plugin}: $.${event}: ${deny}`.
//
// Why nothing in this product raises it yet: every caller of `Hze` in the source is the plugin-call
// dispatcher — `Ot` (chunk-kwp08k6x.js [38986,39121), reached when the plugin's `$` object runs a
// method) and its twin in the chain module (chunk-sfn1dbxq.js [2356634,2356788)), plus two special
// cases: `$.prompt.read` (chunk-sfn1dbxq.js [2341631)) and `interface.call` for a two-segment name
// (chunk-sfn1dbxq.js [2356634)). This product installs plugin modules but has no `$` object, so no
// `$` method call exists to funnel. The engine's own writes are a different path: a status line goes
// through `Vyt` (chunk-sfn1dbxq.js [494176,494224)) to the bound session, and a plugin log line
// through `mce` (carried at src/plugin-chain-records.ts:149), neither of which passes through `Hze`.
// Raising at those would fire on engine-authored text, which the source never does; so this seam
// ships ready for the `$` surface and raises nothing on its own.
import { Cme, Hze } from './plugin-chain-host-call-source.js';

/** The caller a plugin call carries. `origin` is the chain origin `P0` filters handlers by and `aJ`
 *  turns into the record's plugin/tier; `plugin` is the calling plugin's name, which the denied-answer
 *  text and the `bottom` action read; `scopeHolder.scope` is the async-local scope `YPn` runs the
 *  dispatch inside, when the caller holds one. */
export type HostCallCaller = {
  plugin: string;
  origin: unknown;
  signal?: AbortSignal;
  scopeHolder?: { scope?: unknown };
};

/** One call table entry's `{check, run}` as `Hze` reads it: `check` gets the (copied) argument and
 *  the caller and returns the text of a refusal, and `run` is the action the call table gives the
 *  name — `mce` for `ui.log`, the session's status line for `ui.status`. On the dispatch path `run`
 *  is the chain's floor, reached when a handler calls `next` past the last one; with no handler at
 *  all the whole call is `run`. */
export type HostCallBottom = {
  check?: (args: unknown, caller: HostCallCaller) => string | undefined;
  run: (args: any, caller: HostCallCaller) => unknown;
};

export type HostCallRaise = {
  /** The value-event name, dotted and two-segment (`ui.log`), as the source's catalog spells it. */
  event: string;
  args: unknown;
  caller: HostCallCaller;
  /** Source `bottom`: the call table's action for the name. The copied `Hze` runs it as the chain's
   *  floor, and — when the chain has no handler — as the whole call. */
  bottom?: HostCallBottom;
  /** Source `raise`: the descriptor `P0` filters a caller's own handlers by. */
  raise?: unknown;
};

/** Source `Cme.has(event)`: whether `Hze` runs the copier over the argument before handing it to the
 *  floor — on the dispatch path only. A call no module hooks short-circuits straight to the floor
 *  with the caller's own object (`if (y.length === 0 && s) return YPn(b, () => s.run(n, r))`), so
 *  neither the copier nor the table entry's `check` runs there. The copier is `tIt`, which rebuilds
 *  only what it repairs: a well-formed argument arrives as the same object, and a subtree holding a
 *  lone surrogate arrives as a new object on the path to the change with its untouched siblings still
 *  shared. The twelve names are ui.open, ui.toast, ui.notify, ui.status, ui.log, ui.notice, ui.ask,
 *  tool.register, command.register, agent.register, prompt.fill and prompt.suggest. */
export function hostCallCopied(event: string): boolean {
  return Cme.has(event);
}

/** Source `Hze`: raise one value event and return its answer's value. The two throws are the source's
 *  own (`is-no-object` before the dispatch, and the answer's `deny` after it), and so is the floor's
 *  `${event}: ${text} (host check)` when the table entry's `check` refuses the argument. */
export async function raiseHostCall(request: HostCallRaise): Promise<unknown> {
  return Hze({
    event: request.event,
    args: request.args,
    caller: request.caller,
    bottom: request.bottom,
    raise: request.raise,
  });
}
