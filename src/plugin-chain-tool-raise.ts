// The classic PreToolUse event's raise point, as the source puts it on the tool call. The copied
// bodies live in ./plugin-chain-tool-raise-source.ts; this module is the host seam around them.
//
// Source: `m_t` (chunk-sfn1dbxq.js [504681,505531), an 850-unit async generator) raises the event with
// `$go(b, [M, ...P0("classic.PreToolUse", h), X], {signal: r, origin: aJ(h)})` — the managed pass, the
// plugin-module handlers for the event, and the settings core — then folds the answer with `mDe`. This
// product's own settings hooks are dispatched by ./hooks.ts, so the managed and settings passes arrive
// here as inputs and the raise carries the module handlers, which is the part of `m_t`'s list this
// product has. The envelope (`rIt`), the dispatcher (`$go`), the gate (`Mo`), the denial record
// (`RFe`) and the answer mapping (`mDe`) are the source's own bodies, copied whole.
import { P0, aJ } from './plugin-chain-records.js';
import { Jl } from './plugin-chain-relay-source.js';
import { Mo, RFe, $go, mDe, rIt } from './plugin-chain-tool-raise-source.js';

/** The chain name the classic tool-call hooks answer under (source `Ua`'s `event`). */
export const CLASSIC_PRE_TOOL_USE = 'classic.PreToolUse';

/** Source `Jl("classic.PreToolUse")`: whether any loaded module hooks the event with no argument
 *  pattern. This is the source's own gate for wrapping the tool call at all (`Mo`). */
export function classicPreToolUseHooked(): boolean {
  return Boolean(Jl(CLASSIC_PRE_TOOL_USE, undefined, undefined));
}

/** Source `rIt(tool, tool_use_id, input)` = `No`: the envelope a classic hook is asked about. */
export function classicPreToolUseEnvelope(tool: string, toolUseId: string | undefined, input: unknown): unknown {
  return rIt(tool, toolUseId, input);
}

/** Source `RFe()`: the record an answer is kept in, which `Mo`'s core carries. */
export function newDenialRecord() {
  return RFe();
}

/** Source `Mo(origin, denials)`: the cores the chain withholds from the bottom while a classic
 *  PreToolUse hook exists — empty when none does, which is the source's own gate. */
export function toolCallCores(origin: unknown, denials: ReturnType<typeof RFe>): Record<string, unknown> {
  return Mo(origin, denials);
}

/** What a classic PreToolUse answer means for the caller, in the source's `mDe` shape. */
export type ClassicPermission = {
  permissionBehavior?: 'deny' | 'ask' | 'allow';
  hookPermissionDecisionReason?: string;
  updatedInput?: unknown;
  additionalContexts?: string[];
};

/** What the product's tool path needs back from the raise: the envelope the hook saw, the raw answer
 *  and the permission it maps to. */
export type ClassicPreToolUseAnswer = {
  envelope: unknown;
  answer: Record<string, unknown>;
  permission: ClassicPermission;
};

/** Raise `classic.PreToolUse` over the loaded plugin modules' handlers, the way the source's tool path
 *  does: the envelope first, then `$go` with the module handlers, then `mDe`'s mapping. `managed` and
 *  `settingsCore` are the source's `M` and `X` slots, which this product's own hook layer fills. */
export async function raiseClassicPreToolUse(options: {
  tool: string;
  toolUseId?: string;
  input: unknown;
  origin?: unknown;
  signal?: AbortSignal;
  managed?: unknown;
  settingsCore?: unknown;
  bottom?: unknown;
}): Promise<ClassicPreToolUseAnswer> {
  const envelope = rIt(options.tool, options.toolUseId, options.input);
  const handlers = [
    ...(options.managed !== undefined ? [options.managed] : []),
    ...P0(CLASSIC_PRE_TOOL_USE, options.origin),
    ...(options.settingsCore !== undefined ? [options.settingsCore] : []),
  ];
  const answer = (await $go(envelope, handlers, {
    signal: options.signal,
    origin: aJ(options.origin),
    ...(options.bottom !== undefined && {bottom: options.bottom}),
  })) as Record<string, unknown>;
  return {envelope, answer, permission: mDe(answer as never) as ClassicPermission};
}
