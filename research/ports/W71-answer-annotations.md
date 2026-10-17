# W71 — per-answer annotations

## Source position

`chunk-ktr9sak2.js` (UTF-16 code units):

| Symbol | Range | Contents |
| --- | --- | --- |
| constants | ~2011 | `M=8192`, `te=8192`, `ne=32768`, `oe=2000`, `ie=2000` |
| `V` | [2142,2202) | admission wrapper: try `le`, catch -> refused "threw" |
| `le` | [2202,4005) | shown-field integrity, answers, annotations, response, followUp, size caps |
| `pe` | [4720,…) | preview admission: exact shown-preview match, else normalized form within 2000 |
| `J` | [9560,9925) | annotation shape: per-question `{preview?, notes?}`, keyed by question text |

`le` handles annotations as follows: the map must be an object; every key must be a
question text from the call; each value must be an object whose only fields are `preview` and
`notes`; `preview` must be a string admitted by `pe`; `notes` must be a string of at most 8192
code units. Unknown annotation fields refuse the whole card.

## Port

The product answer contract now carries `annotations?: { preview?, notes? }` on each
`QuestionAnswer`:

- the shape is strict (unknown fields refused) and `notes` is capped at 8192, the source `te`;
- `preview` must exactly equal a preview the question showed (the first `pe` arm:
  `e.previews.has(t)`);
- the source keys annotations by question text; the product answers are indexed by
  `questionIndex`, so the annotation travels with its answer instead.

## Deliberate omissions

- `pe`'s second arm — a normalized-equivalent preview of at most 2000 code units with no
  control characters or width mismatch — depends on rendering normalization helpers
  (`Gat`/`nD`/`pc`/`ZSo`) that belong to the renderer port; exact shown-preview matching is
  ported and never admits a preview the question did not show.
- The card answer map, `response`, `followUp`, `afkTimeoutMs` and shown-field integrity checks
  remain part of the separate card contract.
- The product still enforces its own answer rules (one answer per question, selections match the
  choices) before annotations are checked.

## Verification

`interaction-tools` 28/28 with one new case (shown preview plus notes round-trip; a preview the
question did not show is refused; unknown annotation fields and notes over 8192 are rejected;
empty notes are preserved). tsc 0; build 0; full 2,099/2,099; chain 767/767; notices 0; source
index unchanged; identity `3ed12d16…`.
