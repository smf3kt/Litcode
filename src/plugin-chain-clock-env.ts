// The `$` call table's clock and env floors (W45-45): the two families a plugin reaches its own
// process through. The copied bodies live in ./plugin-chain-clock-env-source.ts; this module is the
// host seam around them.
//
// Source: the entries of the plugin-method table `Iqo(state)` (chunk-sfn1dbxq.js, its literal
// opened by `var Iqo=(e)=>szt({…})` at [2346570,…)), taken verbatim, chunk-sfn1dbxq.js:
//
//   "clock.now":{run:cDo}                                    [2354369,2354390)  21 units
//   "clock.sleep":vme,"clock.after":vme,"clock.every":vme    [2354391,2354444)  53 units, three keys
//   "env.get":{check:s2t,run:pFo}                            [2354606,2354635)  29 units
//   "env.set":{check:s2t,run:gFo}                            [2354636,2354665)  29 units
//
// The clock's three keys share one entry object: `vme` is `{check:mDo, run:(e,n)=>pDo(e,n.signal)}`,
// so `clock.sleep`, `clock.after` and `clock.every` are the same wait with the same check, and the
// name a plugin uses changes nothing but the spelling it is logged under. That entry, and the two
// env entries, are table fragments rather than statements, so their bodies are ported here as the
// arrows above with the keys the source gives them.
//
// What the ported bodies do, all measured from the source:
//  · `cDo` is `()=>Promise.resolve(Date.now())` — the process's own clock, not the pluggable clock
//    `Q` takes: `clock.now` never goes through `nS`, so a test clock cannot move it.
//  · `pDo` is `Q(e.ms, n, {…n && {abortError: () => pwr(n)}})` — the wait runs on the caller's own
//    signal, and an abort rejects with `pwr`'s answer: the reason itself when it is an Error, the
//    reason's text when it is anything else, and `wait aborted` only for a signal that carries no
//    reason at all (`wlt(signal, "wait aborted")` — Node's own `AbortController` always sets one). A
//    call with no signal passes no options, so the timer is never cancelled and never rejects.
//  · `mDo` is the check both entry kinds share through `vme`: a finite number of milliseconds, else
//    `takes { ms }, a non-negative number of milliseconds (got ${String(n)})` — the text the source
//    writes even for a negative or fractional ms, because `fwr` only asks for a finite number.
//  · `xme`, `pFo`, `s2t` and `gFo` are the env floor. `xme` reads a plain object's `name` when it is
//    a string; `s2t` refuses a name that is missing, empty, or holds `=` or a NUL byte, and refuses a
//    value that is neither a string nor absent (nor one holding a NUL). `pFo` answers the process's
//    environment, except that `USER_TYPE` is always `external` — the source never lets a plugin read
//    that variable from its own process. `gFo` writes the value, or deletes the variable when the
//    plugin passed none, and both runs answer a resolved promise.
//
// This package binds six table names: the four clock keys and the two env keys. The rest of the
// table's process family is not here: `http.fetch` sits beside the clock keys in the same literal
// but runs a request, `process.run`/`process.spawn` go through the process host, and `settings.read`
// reads the settings sources rather than the environment.
import { raiseHostCall, type HostCallBottom, type HostCallCaller } from './plugin-chain-host-call.js';
import { cDo, gFo, mDo, pDo, pFo, s2t, vme, xme } from './plugin-chain-clock-env-source.js';

/** One table entry as `Hze` reads it: `check` refuses an argument with a text, `run` is the floor. */
export type ClockEnvCallEntry = HostCallBottom;

/** The clock names this package's table slice holds. */
export type ClockCallEvent = 'clock.now' | 'clock.sleep' | 'clock.after' | 'clock.every';

/** The env names this package's table slice holds. */
export type EnvCallEvent = 'env.get' | 'env.set';

/** The clock slice, ported verbatim from the source's literal above. */
export function clockCallTable(): Record<ClockCallEvent, ClockEnvCallEntry> {
  return {
    'clock.now': { run: cDo as unknown as ClockEnvCallEntry['run'] },
    'clock.sleep': vme as ClockEnvCallEntry,
    'clock.after': vme as ClockEnvCallEntry,
    'clock.every': vme as ClockEnvCallEntry,
  };
}

/** The env slice, ported verbatim from the source's literal above. */
export function envCallTable(): Record<EnvCallEvent, ClockEnvCallEntry> {
  return {
    'env.get': { check: s2t, run: pFo },
    'env.set': { check: s2t, run: gFo },
  };
}

/** Raise one `$` clock call the way the plugin-method dispatcher does: the table entry for the name
 *  is the chain's floor, so a plugin's hooks may answer first and `next()` reaches the floor. */
export async function raiseClockCall(request: {
  event: ClockCallEvent;
  args: unknown;
  caller: HostCallCaller;
  raise?: unknown;
}): Promise<unknown> {
  return raiseHostCall({
    event: request.event,
    args: request.args,
    caller: request.caller,
    bottom: clockCallTable()[request.event],
    raise: request.raise,
  });
}

/** Raise one `$` env call, by the same route. */
export async function raiseEnvCall(request: {
  event: EnvCallEvent;
  args: unknown;
  caller: HostCallCaller;
  raise?: unknown;
}): Promise<unknown> {
  return raiseHostCall({
    event: request.event,
    args: request.args,
    caller: request.caller,
    bottom: envCallTable()[request.event],
    raise: request.raise,
  });
}

/** Source `cDo`: the process's own clock, as the `clock.now` floor answers it. */
export function clockNow(): Promise<number> {
  return cDo();
}

/** Source `pDo` over `Q`: wait `ms`, reject on abort with the signal's own reason. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return pDo({ ms }, signal) as Promise<void>;
}

/** Source `mDo`: the text a sleep refuses a non-finite `ms` with, or `undefined`. */
export function clockMsRefusal(args: unknown): string | undefined {
  return mDo(args);
}

/** Source `s2t`: the text the env entries refuse an argument with, or `undefined`. */
export function envArgumentRefusal(args: unknown): string | undefined {
  return s2t(args);
}

/** Source `pFo`: the process environment, with `USER_TYPE` answered as `external`. */
export function readProcessEnv(name: string): Promise<string | undefined> {
  return pFo({ name });
}

/** Source `gFo`: set the variable, or unset it when the value is `undefined`. */
export function writeProcessEnv(name: string, value: string | undefined): Promise<void> {
  return gFo({ name, value }) as Promise<void>;
}

/** Source `xme`: the `name` of a plain object, when it is a string. */
export function argumentName(args: unknown): string | undefined {
  return xme(args);
}
