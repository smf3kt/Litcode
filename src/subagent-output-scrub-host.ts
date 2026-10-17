// The subagent output scrub's host bindings (W174).
//
//   - `$Z`/`D0s` (chunk-gyf58rwf.js sha256 7a6a01732760c89b5d434cc5ba98faf72b10917d85b771671f8201e9e3d8d2ad)
//     are `Bt(e,"NFKC")`/`Bt(e,"NFKD")`. `Bt` normalizes a chunk at a time and carries the trailing
//     grapheme cluster into the next chunk to bound memory; the carried cluster is exactly the part
//     that can combine across a chunk boundary, so whole-string `String.prototype.normalize` returns
//     the same text. The scrub calls it on keys and short tag names.
//   - `po` (chunk-ae84tp6z.js sha256 901937cc8e68c765b7dddc4875578a6b1759f5e9a2535bee85829bea8ace200f,
//     `var po=V`, `function V(t,e){...n.cache=new(V.Cache||RDt)...}`) is lodash memoize. The scrub
//     keys its caches by `undefined` for the zero-argument getters and by a joined string in `w`,
//     so a Map keyed by the resolver result or first argument is the same cache.
//   - `k` (chunk-bk5ct2gw.js sha256 efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1,
//     `function k(e,n){return $n(e,n).value}`) reads a configuration value with a fallback. This
//     build carries no remote configuration, so the fallback is the value.
//   - `Yn` (chunk-yvnhkg35.js sha256 ce3689687897e987959f19ab07f98d79e5c925a8b15620dce02d29ba4943348d,
//     `jx={},Yn=TPe(jx,null)`) is `Object.create(null)` because `TPe` defines getters only for the
//     keys it is given and this instance is given none. Property reads are therefore undefined.
//   - `DTe` (chunk-d2vt7d7f.js sha256 21ad41ecb752dc19cd0e977037c3aea9c020e84b9bb5ec6bc80aa2432248514b,
//     [688,1463) declares `DTe="NOTE: this agent stopped at its "`) begins the max-turns note that
//     the forgery pattern matches. The other declarators in that statement use names this package
//     does not depend on, so only the value is adopted here.
//   - `Pbo` (chunk-phm7wwmz.js sha256 40e46cb899d8e325ee27e23dca0b298833a9b246ca314a282f860e768e6baf12)
//     is `re().lead`; `te`'s `lead` getter is `RRs(Kkr())` and needs no page or envelope state.
//     A host binds the same expression through `bindScrubLead` after both sources are loaded.

/** Source `V<key>`: the first argument, or the resolver result, is the cache key. */
export function po<T extends (...args: any[]) => any>(
  fn: T,
  resolver?: (...args: Parameters<T>) => unknown,
): T & { cache: Map<unknown, unknown> } {
  const cache = new Map<unknown, unknown>();
  const memoized = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    const key = resolver === undefined ? args[0] : resolver.apply(this, args);
    if (cache.has(key)) return cache.get(key) as ReturnType<T>;
    const value = fn.apply(this, args) as ReturnType<T>;
    cache.set(key, value);
    return value;
  };
  const bound = memoized as typeof memoized & { cache: Map<unknown, unknown> };
  bound.cache = cache;
  return bound as T & { cache: Map<unknown, unknown> };
}

/** Source `$Z`: NFKC normalization. */
export function normalizeNfkc(value: string): string {
  return value.normalize('NFKC');
}

/** Source `D0s`: NFKD normalization. */
export function normalizeNfkd(value: string): string {
  return value.normalize('NFKD');
}

/** Source `k`: configuration reads fall back to the default in this build. */
export function k(_name: string, fallback: unknown): unknown {
  return fallback;
}

/** Source `Yn`: an empty object with no prototype, so every property read is undefined. */
export const Yn = Object.create(null) as Record<string, string | undefined>;

/** Source `DTe`: the max-turns note's opening text. */
export const DTe = 'NOTE: this agent stopped at its ';

let scrubLead: (() => RegExp) | null = null;

/** Binds source `Pbo`'s `lead` value: `RRs(Kkr())`, built by the wrapper's live expression. */
export function bindScrubLead(lead: () => RegExp): void {
  scrubLead = lead;
}

/** Source `Pbo`: the memoized bracketed lead pattern. */
export function Pbo(): RegExp {
  if (scrubLead === null) throw new Error('subagent output scrub lead is not bound');
  return scrubLead();
}
