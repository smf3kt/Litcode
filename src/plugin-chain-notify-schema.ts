// The zod binding the notification bar's stored-ledger schema is written against (W45-28). The
// source's schema body (`TWt`, chunk-sfn1dbxq.js [1691527,1691764), copied verbatim into
// ./plugin-chain-notify-store-source.ts) names six minified builders, and this module binds each of
// them to the product's own `zod`, so the copied body runs unreadable, exactly as the source's does.
//
// What each name is, from the extracted bundle (chunk-9cmjz7j9.js / chunk-fdwn5gdv.js — the modules
// the source's own import map points at):
//
// The source's sixth name, `p`, is not bound here: it is the bundle's own lazy-memo accessor, copied
// verbatim from its module (chunk-fdwn5gdv.js [615,965)) into ./plugin-chain-notify-store-source.ts,
// because its value is the accessor rather than a schema. `TWt` holds the accessor and `SEt` calls it.
//
//   u   chunk-9cmjz7j9.js [84440,…): `function u(e,t){let r={type:"object",shape:e…`, `Zxe` the
//       ZodObject class — an object whose shape is given.
//   o   chunk-9cmjz7j9.js [79809,…): `function o(e){return cn(Ern,e)}` beside the ZodString
//       machinery — a string.
//   v   chunk-9cmjz7j9.js [82318,…): `function v(e){return Sn(LHt,e)}` beside the ZodNumberFormat
//       machinery — a number.
//   A   chunk-9cmjz7j9.js [83595,…): `function A(e,t){return Dn(xAo,e,t)}`, taken by the schema as
//       `A(u({…}).readonly())` — the array builder.
//   H   the boolean. Its own declaration sits among the format builders, so it is settled by the pair
//       that has to round-trip through it: `lLs` [1694273,1694442) writes `isManaged: sOn(plugin)` and
//       `wasShown: !1`, both booleans, and `SEt` [1692468,1692581) parses what the store holds and
//       falls back to `RYr` on any failure. A schema that did not accept booleans would make every
//       read fall back, and the store would never hold anything — the regression drives that
//       round-trip (`parses the ledger the append path writes`).
import { z } from 'zod';

/** `z.object` — the source's `u`. */
export const u = z.object;
/** `z.string` — the source's `o`. */
export const o = z.string;
/** `z.boolean` — the source's `H`. */
export const H = z.boolean;
/** `z.number` — the source's `v`. */
export const v = z.number;
/** `z.array` — the source's `A`. */
export const A = z.array;
