// The schema names the keybinding module builds its two schemas with (W45-67). The recovered application
// bundles its own copy of zod, and the copied bodies reach it under the bundled names: `u`, `U`, `o`,
// `ue`, `Ue`, `Bm` and `A`. The product already depends on zod, so this module binds those seven names to
// the library's own entry points rather than porting a second copy of it — a host boundary of the same
// kind as ./plugin-chain-fs-boundaries.ts, and the only import the editor copy takes beyond the tables
// W45-66 ported.
//
// The mapping is read off the source's call sites, one alias at a time:
//
//   `u({ tag: "command:help" })`            — an object schema, and `.describe()` hangs off it
//   `U(v9t)`, `U([...ZDe, ...Z])`           — a schema from an array of literals: an enum
//   `o()`, `o().regex(/^command:…/)`,
//   `o().optional()`, `o().nullable()`      — a string schema
//   `ue(o(), o().nullable())`               — two arguments: a record keyed by strings
//   `Ue([U([…]), o(), Bm()])`               — one argument, an array of alternatives: a union
//   `Bm()`                                  — no arguments and no literals: null
//   `A(ze())`                               — one schema argument: an array of it
//
// That reading is not taken on trust. The editor suite writes a keybindings document through both
// schemas and asserts what they accept and refuse, including the legacy names (`Z`) and the `command:`
// form, which is what makes the mapping observable rather than nominal.
import { z } from 'zod';

/** Source `u`: `z.object`. */
export const u = z.object;

/** Source `U`: `z.enum`, from the array of literals the source hands it. */
export const U = z.enum;

/** Source `o`: `z.string`, with `regex`, `optional` and `nullable` read off it. */
export const o = z.string;

/** Source `ue`: `z.record`, from the key and value schemas the source hands it. */
export const ue = z.record;

/** Source `Ue`: `z.union`, from the array of alternatives the source hands it. */
export const Ue = z.union;

/** Source `Bm`: `z.null`, the unbind value a binding may be set to. */
export const Bm = z.null;

/** Source `A`: `z.array`, from the schema the source hands it. */
export const A = z.array;

/** The library the seven names are bound to, for a caller that wants the version this port measured
 *  against, and the seven source names under one record for a record or a test. */
export const SCHEMA_LIBRARY = z;
export const SCHEMA_ALIASES = { u, U, o, ue, Ue, Bm, A };
