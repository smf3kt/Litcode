# W75 — shown-field comparison

## Source position

`le` compares every non-reserved shown field through `xHe(t[f], e[f])`
(chunk-ktr9sak2.js [2446,…)), where `t` is the answer and `e` the shown input.
`de` (chunk-ktr9sak2.js [4711,…)) ends with the same call after stripping a
`kind: "choice"` the answer omitted.

`chunk-sfn1dbxq.js` (UTF-16 code units):

| Symbol | Range | Contents |
| --- | --- | --- |
| `xHe` | [501668,501915) | bounds-walk the answer field, then deep-compare both JSON roundtrips |
| `sze` | [502534,502843) | iterative walk collecting `values`, `depth`, `chars` |
| `fDe` | [502843,503039) | count one value; key length and string length feed `chars`; objects queue at their level |
| `pDe` | [503039,503092) | `typeof e === "object" && e !== null` |
| bounds | 501639 | `F8n=64` depth, `$8n=20000` values, `B8n=1048576` characters |

The comparison is `N8n(Y(_(e)), Y(_(n)))`: `_` is `JSON.stringify`
(chunk-gyf58rwf.js [59764,…)), `Y` is `JSON.parse` (chunk-gyf58rwf.js
[60056,…)), and `N8n` is `isDeepStrictEqual` from `util`.
When the walk stops out of bounds, `xHe` reports a warning and returns false;
the admission rule is then `changed_shown_field`.

## Port

`cardFieldUnchanged(answerValue, shownValue)` replaces the previous plain
structural comparison:

- `cardAnswerWithinBounds` ports `sze`/`fDe`/`pDe` exactly: the walk starts at
  level 1, counts the root, adds key lengths and string lengths to the
  character budget, and queues arrays and objects; it stays within when values
  ≤ 20000, depth ≤ 64 and characters ≤ 1,048,576;
- the values are compared after a JSON roundtrip with `isDeepStrictEqual`, so
  key order, `NaN`/`-0` and other JSON-equivalent forms match the source;
- `sameQuestions` (the `de` allowance) uses the same comparison.

The source's out-of-bounds warning is not emitted; this runtime has no warning
channel in admission, and the refusal is the observable effect.

## Verification

`interaction-tools` 32/32 with one new case: a shown `null` field may be
returned as `NaN` (both JSON-serialize to `null`), a 64-level nested shown field
is admitted while 65 levels and a 20,000-element array are refused with
`changed_shown_field`. tsc 0; build 0; full 2,103/2,103; chain 767/767; notices
0; source index unchanged; identity `b03f27a0…`.
