# W72 — card answer admission

## Source position

`chunk-ktr9sak2.js` (UTF-16 code units):

| Symbol | Range | Contents |
| --- | --- | --- |
| `qht` | [1397,1484) | comma-join; parts holding `", "` or a quote are JSON-quoted |
| limits | ~2011 | `M=8192`, `te=8192`, `ne=32768`, `oe=2000`, `ie=2000`; `gH=50000` (chunk-phm7wwmz.js) gives `se=48000` |
| `V` | [2142,2202) | try `le`, catch -> `{kind:"refused", rule:"threw"}` |
| `le` | [2202,4005) | shown-field integrity, answers, annotations, response, followUp, size caps |
| `ce` | [4005,4482) | question map by text: multiSelect, option count, preview set; extended = every question has a string kind |
| `de` | [4482,4720) | an answer may omit `kind: "choice"` where the shown question carries it |
| `pe` | [4720,4845) | preview admission |

## Port

`admitCardAnswer(shown, answer)` returns `{kind:"admitted", input}` or
`{kind:"refused", rule}`, with the source's rule names:

- the answer must be a plain object (`not_an_object`);
- `afkTimeoutMs` is a host-only field (`host_field`); `answers`, `annotations`,
  `response` and `followUp` may not already exist on the shown input
  (`changed_shown_field`); any other key must exist on the shown input
  (`unknown_field`) and be unchanged, with the recovered `de` allowance for a
  `kind: "choice"` omitted from the returned questions when no title was shown;
- answers are keyed by question text; a string is capped at 8192, a multiSelect
  array at optionCount+1 entries each capped at 8192, and arrays join through the
  recovered `qht` (JSON-quoted when a part contains `", "` or a quote);
- annotations are strict `{preview?, notes?}` per known question; a preview must
  exactly equal one the question showed (the first `pe` arm) and notes are capped
  at 8192;
- `response` is a string capped at 8192; `followUp` is a boolean accepted only
  when every shown question carries a string kind;
- key lengths are added to the preview budget and the totals must stay within
  32768 text units and 48000 combined units (`ne`, `se`).

The admitted input spreads the shown request and adds the admitted maps, matching
`c={...e}`.

## Deliberate omissions

- No product host emits card answers yet, so the default `ask_user_question`
  contract is unchanged; the validator is exported for a card host adapter.
- `pe`'s normalized-equivalent arm (shown preview ≤ 2000 units after `Gat`,
  with no `nD` condition) depends on renderer helpers and stays with the
  renderer port.
- `xHe` compares after a transform (`Y(_(e))`); this port compares plain JSON
  structurally, and the transform's normalization is not applied.
- `oe`, `ie` and the `oe` reserve are recorded in the source table; only the
  caps that the admitted paths use are enforced.

## Verification

`interaction-tools` 29/29 with one new case covering: admitted card with answers,
annotations, response and followUp; multiSelect joining and `", "` quoting;
host-only, unknown and changed fields; single-choice array refusal; unknown
answer keys; a preview the question did not show; followUp on a non-extended card;
the omitted-`kind` allowance and the reverse (adding kind) refusal; a non-object
answer; and the total-size refusal. tsc 0; build 0; full 2,100/2,100; chain
767/767; notices 0; source index unchanged; identity `21433e88…`.
