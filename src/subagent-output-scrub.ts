// The subagent output scrub (W174).
//
// `ups` (chunk-nvcqkjfn.js sha256 c4cde5c8c03097dd9fdb4cc2fe12bcca28559fd2373979c62e23906c9b7ab9f9,
// [9158,9387)) walks a structured value, removes reserved keys from every object, rewrites each
// string and key through the control-tag, forgery and escalation pattern tables, and reports what
// matched. The call site (chunk-hedqf2m1.js [73056)) passes `reservedKeys:["webFetchSavedFiles"]`
// when a schema-mode child produced structured output.
//
// `Pbo` returns `RRs(Kkr())`: the bracketed artifact lead pattern. The source caches it in `te`'s
// `lead` getter; the same lazily-built value is bound here after both copied sources load.
import { Kkr, RRs } from './subagent-output-scrub-tags-source.js';
import { ups } from './subagent-output-scrub-scan-source.js';
import { bindScrubLead } from './subagent-output-scrub-host.js';

export interface SubagentOutputScrubFinding {
  category: string;
  pattern: string;
  count: number;
  reportable: boolean;
}

export interface SubagentOutputScrubResult<T> {
  value: T;
  findings: SubagentOutputScrubFinding[];
  reportable: string[];
  droppedReservedKeys: number;
}

let lead: RegExp | null = null;
bindScrubLead(() => (lead ??= RRs(Kkr())));

const runScrub = ups as unknown as (
  value: unknown,
  options: { reservedKeys: readonly string[] },
) => SubagentOutputScrubResult<unknown>;

/** Source `ups`: scrubs a structured subagent result and reports the matches. */
export function scrubSubagentOutput<T>(
  value: T,
  options: { reservedKeys?: readonly string[] } = {},
): SubagentOutputScrubResult<T> {
  return runScrub(value, { reservedKeys: options.reservedKeys ?? [] }) as SubagentOutputScrubResult<T>;
}
