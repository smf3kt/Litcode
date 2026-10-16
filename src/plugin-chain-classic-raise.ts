// The generic classic raise: the raise point every classic hook event other than PreToolUse shares.
// The copied bodies live in ./plugin-chain-classic-raise-source.ts; this module is the host seam
// around them.
//
// Source: `Ikt` (chunk-sfn1dbxq.js [562773,563154)) is what the product's own hook runner does when
// `Q_t(event)` holds — `FDe` names the site, `Cro` waits out a module whose hooks are still loading,
// `aP` dispatches over the three arms, and `h7n` folds the answer into the record list the caller
// sees. `Ikt` builds its outer arms with `xkt` over `e.runClassicHooks`, the engine's configured-hook
// runner, which in this product is ./hooks.ts and has already run on the same path; so those arms
// arrive here as inputs, the adaptation W45-15 recorded for `m_t`, and `xkt`/`mkt`/`QY`/`ckt` are not
// copied. Two measured differences from `Ikt` follow from that: `znr` passes one origin to both the
// pre-gate and the dispatch where `Ikt` passes `void 0` to the gate (that origin reaches only the
// pre-gate's diagnostic text), and the module handlers are the only middle arm this product has.
import { FDe, Q_t, die, fe, gkt, h7n, znr } from './plugin-chain-classic-raise-source.js';

/** The classic event names this product raises on the tool path; `FDe` prefixes them with `classic.`
 *  and they are the bare names of the source's own event list (`Ewr`). */
export const CLASSIC_POST_TOOL_USE = 'PostToolUse';
export const CLASSIC_POST_TOOL_USE_FAILURE = 'PostToolUseFailure';
export const CLASSIC_POST_TOOL_BATCH = 'PostToolBatch';
export const CLASSIC_PERMISSION_REQUEST = 'PermissionRequest';
export const CLASSIC_PERMISSION_DENIED = 'PermissionDenied';

/** Source `dze`'s answer as its consumers read it: `answer.permissionRequestResult` with a `behavior`
 *  of `allow`/`deny` and, on an allow, an optional `updatedInput` (chunk-9c5se12s.js [7120,7900),
 *  chunk-fyhzvvp0.js [15500,16250)). */
export type ClassicPermissionRequestResult = { behavior?: 'allow' | 'deny'; updatedInput?: unknown; message?: string };

/** One hook run as the classic chain records it (source `Rkt`/`Pkt`). */
export type ClassicHookRecord = {
  command: string;
  succeeded: boolean;
  output: string;
  blocked: boolean;
  /** Source `answerHeld`: set when a run handed its answer on instead of being the result itself. */
  answerHeld?: boolean;
};

export type ClassicEventRaise = {
  /** The bare event name, as the source hands it to `Ikt` (`PostToolUse`, `SessionStart`, …). */
  event: string;
  hookInput: Record<string, unknown>;
  signal?: AbortSignal;
  origin?: unknown;
  /** Source `xkt(e, {managedHooksOnly: true}, h)`: the managed pass, when this product has one. */
  managed?: unknown;
  /** Source `xkt(e, {managedHooksExcluded: true}, h)`: the event's core. */
  core?: unknown;
};

export type ClassicEventAnswer = {
  /** The folded record list, as the source's caller sees it (`Ikt`'s return). */
  records: ClassicHookRecord[];
  /** The raw chain answer; its `block`, `additionalContexts` and `permissionBehavior` live here. */
  answer: Record<string, unknown>;
  /** Source `gkt(answer)`: the text the answer blocks with, or `undefined` when it blocks nothing. */
  block: string | undefined;
};

/** Source `fe(event, payload)`: the hook input a classic event is handed. `session_id` and `cwd` are
 *  the engine's own values, so a caller supplies both through the payload the source spreads over them. */
export function classicHookInput(event: string, payload: Record<string, unknown> = {}): Record<string, unknown> {
  return fe(event, payload);
}

/** Source `Q_t(event)`: whether the product path may raise the event at all — a legal classic event
 *  name, not PreToolUse (the tool call owns that), and one some loaded module hooks. */
export function classicEventRaised(event: string): boolean {
  return Boolean(Q_t(event));
}

/** Source `die(event)`: whether any loaded module hooks the event, without the name check. */
export function classicEventHooked(event: string): boolean {
  return Boolean(die(event));
}

/** Source `Ikt`: raise one classic event and fold its answer into the record list. The middle arm is
 *  the plugin-module handlers; the outer two are the inputs a caller supplies. */
export async function raiseClassicEvent(options: ClassicEventRaise): Promise<ClassicEventAnswer> {
  const name = FDe(options.event);
  const answer = (await znr({
    hookInput: options.hookInput,
    managed: options.managed,
    core: options.core,
    signal: options.signal,
    origin: options.origin,
  })) as Record<string, unknown>;
  return { records: h7n([], answer, { event: options.event, command: `${name} hook` }) as ClassicHookRecord[], answer, block: gkt(answer) };
}
