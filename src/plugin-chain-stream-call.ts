// The module-to-host call path, streaming half: the raise point for the streaming plugin calls
// (`streamOps`: a model completion, spoken audio, a session send — the calls whose answer is a
// stream of chunks rather than a value). The copied bodies live in ./plugin-chain-stream-call-source.ts
// and ./plugin-chain-stream-source.ts; this module is the host seam around them, the twin of
// ./plugin-chain-host-call.ts.
//
// Source: `aGe` (chunk-sfn1dbxq.js [1843388,1844317) 929 units, with the withheld-result texts `tzt`
// and the await-then-stream retry `ezt` above it) is what a plugin's streaming method call funnels
// into. It collects the event's streaming handlers (`has`, the records copy), waits out a module whose
// hooks are still loading (`N5t`, the same gate `Hze` uses) and retries when one appears, then runs the
// streaming stage (`iwr` over `Jx`) and relays its chunks through `tRe`. Three of its rules are its own:
//
//   - a chain with no handler and a floor is the floor: `bottom.stream(args, caller)` is returned
//     directly, so neither the dispatch nor the floor's `check` runs;
//   - on the dispatch path the floor's own stream is wrapped by `tRe(Se, M)`, which marks the call
//     `started` as soon as the floor yields a chunk, and its final value marks it `ran`;
//   - a result carrying `deny` throws `${plugin}: $.${event}${tzt[state]}: ${deny}`, where the state
//     says whether the floor ran at all (`tzt.nothing` is empty, `started` and `ran` are not), and the
//     floor's `check` refusal throws `${event}: ${text} (host check)`.
//
// Unlike the value events' `Hze` there is no argument copier on this path: the streaming call hands the
// caller's own argument to the handler.
//
// Why nothing in this product raises it yet: every caller of `aGe` in the source is the streaming
// plugin-call dispatcher `Iye` (chunk-sfn1dbxq.js [2356982,2357180)), which reads `e.streamOps[n]` off
// the plugin `$` surface. This product installs plugin modules but has no `$` object, so no streaming
// method call exists to funnel; the seam ships ready for that surface.
import { aGe } from './plugin-chain-stream-call-source.js';

/** The caller a streaming plugin call carries: `plugin` is the calling plugin's name (its own name
 *  prefixes the `deny` text), `origin` is the chain origin the handler collection and the record's
 *  plugin/tier are read from, and `signal` is the call's abort signal. */
export type StreamingHostCallCaller = {
  plugin: string;
  origin: unknown;
  signal?: AbortSignal;
};

/** The answer of one streaming call: the value the chain settled on, or the text of a `deny`. */
export type StreamingHostCallAnswer = { value: unknown; deny?: string };

/** What a streaming call hands its caller: the chunks the chain yields, and — as the generator's
 *  return value — the answer above. */
export type StreamingHostCallStream = AsyncGenerator<unknown, StreamingHostCallAnswer>;

/** One `streamOps` table entry as `aGe` reads it: `check` gets the argument and the caller and returns
 *  the text of a refusal, and `stream` is the call table's own stream — the chain's floor when a
 *  handler calls `next` past the last one, and the whole call when no handler hooks the event. */
export type StreamingHostCallBottom = {
  check?: (args: unknown, caller: StreamingHostCallCaller) => string | undefined;
  stream: (args: never, caller: StreamingHostCallCaller) => StreamingHostCallStream;
};

export type StreamingHostCall = {
  /** The streaming event name, dotted and two-segment (`session.receive`), as the catalog spells it. */
  event: string;
  args: unknown;
  caller: StreamingHostCallCaller;
  /** Source `bottom`: the `streamOps` entry for the name. The copied `aGe` reaches it through the
   *  stage's `next`, and runs it as the whole call when the chain has no handler. */
  bottom?: StreamingHostCallBottom;
};

/** Source `aGe`: raise one streaming call and hand back its stream. The chunk relay, the floor's
 *  `check` refusal and the `deny` text are the source's own. */
export function raiseStreamingHostCall(request: StreamingHostCall): StreamingHostCallStream {
  return aGe({
    event: request.event,
    args: request.args,
    caller: request.caller,
    bottom: request.bottom,
  });
}
