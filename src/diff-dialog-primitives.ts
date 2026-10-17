// Readable seam over the diff dialog's smallest primitives. The bodies are copied verbatim in
// ./diff-dialog-primitives-source.ts.
//
// Source: chunk-ax7r0qj7.js (sha256 8e782f9b…), `I` [798,839) selects the singular or plural word.
// chunk-a8pz28bf.js (sha256 f9c6096c…), `Ib` [1139,1603) renders the added/removed stat label, with
// `diffAddedWord`/`diffRemovedWord` colors from the recovered theme. Both are zero-based UTF-16
// half-open ranges.
import { I, Ib } from './diff-dialog-primitives-source.js';

/** Source `I`: `count === 1 ? singular : plural`, defaulting the plural to `singular + "s"`. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return I(count, singular, plural) as string;
}

export interface DiffStatLabelProps {
  added: number;
  removed: number;
  bold?: boolean;
}

/** Source `Ib`: the `+added`/`-removed` label; both zero renders nothing. */
export function DiffStatLabel(props: DiffStatLabelProps): unknown {
  return Ib(props as never);
}

/** The copied bodies under their source names, for comparison with the source's own. */
export const SOURCE_BODIES = { I, Ib };
