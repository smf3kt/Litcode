// The keybinding module's row reader (W45-68) — the last part of the module, and the only one that turns
// the bindings a caller holds into the rows a table is drawn from. The copied bodies live in
// ./plugin-chain-keys-rows-source.ts; this module is the seam around them. W45-66 ported the tables a
// Button is measured against and W45-67 the editor that reads a keybindings file; what is left is the
// reader the settings pane calls (`G(){return Ace(w1)}` in the source, chunk-6ccen3s8.js) and the mapper
// that turns a freshly read file back into the names the runtime knows before the rows are read.
//
// Source, chunk-6ccen3s8.js. The reader and the mapper:
//
//   function Ace(e){let r=[];for(let n of e)for(let[s,c]of Object.entries(n.bindings))r.push({chord:h9(s),action:c,context:n.context});return r}
//
// [10481,10621) 140 units. `Ace` — one row per binding. Every block is walked in the order it holds,
// every binding of a block in the order the file wrote it, and the chord is handed to the editor's own
// splitter (`h9`) as the row is built, so a row carries keys rather than a string. The action is copied
// as it stands, `null` included: unbinding a default is a row like any other, and the reader is not the
// place that decides what a null action means.
//
//   function ge(e){return e.map((r)=>({context:r.context,bindings:oo(r.bindings,(n)=>n!==null&&Q(n)?Re[n]:n)}))}
//
// [11037,11145) 108 units. `ge` — the blocks of a file as the runtime reads them. Each block's bindings
// are mapped value-wise (this chunk's lodash `mapValues`, `oo` below), and the one substitution is the
// six legacy action names: a value that is one of them is replaced by the name it is read as, and
// everything else — including `null`, which the check refuses before the map is consulted — is left
// alone. The context is carried over as it stands, and `mapValues` answers a new object, so the blocks a
// caller handed in are not rewritten behind its back.
//
// This chunk's lodash `mapValues`, and the two helpers under it this copy does not carry:
//
//   function Yr(e,t){return e&&Lxr(e,t,Wpe)}var JMt=Yr;
//
// [21687,21738) 51 units. `JMt` is `mapValues`' own-key walk: the object, the iteratee, and the keys of
// the object — `Wpe` — with `Lxr` doing the walking. Both of those are already carried by the internals
// copy, which is why this pair is imported rather than copied: what is declared here is the pair of names
// this chunk knows them by.
//
//   function Di(e,t){var o={};return t=uU(t,3),JMt(e,function(r,i,s){zZ(o,i,t(r,i,s))}),o}var oo=Di;
//
// [24850,24946) 96 units across two statements. `Di` is this chunk's `mapValues` — the iteratee folded to
// arity three (`uU`), the object walked by its own keys, and each value replaced by the result, written
// through `zZ` rather than assigned, which is what keeps a key literally named `__proto__` a property of
// the answer instead of its prototype. `oo` is the name the mapper above reaches it by; the two names are
// the same function.
//
// The helpers under this map-values come from the copies that already carry them: `h9`, `Q` and `Re` from
// ./plugin-chain-keys-editor-source.js, and `Lxr`, `Wpe`, `uU` and `zZ` from
// ./plugin-chain-lodash-internals-source.js (which this package widened by one export — `Wpe` — so that
// the walk here is read out of it rather than copied a second time).
import type { KeyBindingRecord, KeyBindingRow, KeyBindingsBlockInput } from './plugin-chain-registry-state.js';
import { Ace, Di, ge, oo } from './plugin-chain-keys-rows-source.js';

/** Source `Ace`: the rows a keybindings table is drawn from — one row per binding, with the chord already
 *  split into the keys it is made of. */
export function bindingRows(blocks: readonly KeyBindingsBlockInput[]): KeyBindingRow[] {
  return Ace(blocks) as KeyBindingRow[];
}

/** Source `ge`: the blocks of a keybindings file as the runtime reads them, with the six legacy action
 *  names replaced by the names they are read as. Answers new blocks; the argument is not rewritten. */
export function rewriteLegacyBindings(blocks: readonly KeyBindingsBlockInput[]): KeyBindingsBlockInput[] {
  return ge(blocks) as KeyBindingsBlockInput[];
}

/** Source `Di`: this chunk's lodash `mapValues` — the same function the mapper above is written through,
 *  exposed so a caller or a test can read what the mapper does a value at a time. */
export function mapValuesForRows<Value, Result>(
  object: Record<string, Value> | null | undefined,
  iteratee: (value: Value, key: string, object: unknown) => Result,
): Record<string, Result> {
  return Di(object, iteratee) as Record<string, Result>;
}

/** Source `oo`: the name the mapper reaches `mapValues` by. It is `Di` itself. */
export const MAP_VALUES_ALIAS = oo as typeof Di;

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  call with the source's own. */
export const SOURCE_BODIES = { Ace, Di, ge, oo };

export { Ace, Di, ge, oo };

export type { KeyBindingRecord, KeyBindingRow, KeyBindingsBlockInput };
