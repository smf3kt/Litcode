// The bundle's own require, bound at the seam (W45-49). The vendored code the lockfile library carries
// calls it for the standard modules it needs — `Le("fs")`, `Le("constants")`, `Le("path")`,
// `Le("stream")`, `Le("util")` — so the copied bodies need a name that answers what the bundle's
// runtime answered.
//
// Source: chunk-txt1tvjz.js [1624,1647) — the last declarator of that chunk's runtime statement:
//
//   Le=import.meta.require;
//
// The bundle runs under a runtime that puts `require` on `import.meta`; the product's own modules are
// ESM, so the equivalent binding is `createRequire(import.meta.url)`. It answers the same objects —
// requiring a builtin returns the very module object the ESM side imports, which is what graceful-fs
// patches and what its callers then observe — and it works on the runtime this product starts under.
import { createRequire } from 'node:module';

export const Le = createRequire(import.meta.url);
