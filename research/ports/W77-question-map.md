# W77 — question-map tolerance

## Source position

`ce(e)` (chunk-ktr9sak2.js, UTF-16 [4005,4482)) builds the shown-question map:

- a non-array `e` returns an empty map with `extended: false`;
- a non-plain question clears `extended`;
- a non-string `kind` clears `extended`, a non-string `question` skips the entry;
- `multiSelect`, `options` and each option's `preview` are read through
  `I(e,t)` [4988,5042), which returns an own field or `undefined`;
- duplicates collapse through `Map.set`.

`le` obtains the list with `I(e,"questions")`, so an absent list is the same
empty-map case rather than an exception.

## Port

`admitCardAnswer` now calls `cardQuestionMap(own(shownRecord, 'questions'))`
instead of iterating `shown.questions` directly:

- `own` ports `I` and is used for every shown-question read (`kind`,
  `question`, `options`, `multiSelect`, `preview`);
- a non-array or absent list yields an empty map and `extended: false`;
- non-plain questions and non-string kinds clear `extended`; a non-string
  question text skips the entry, matching the source order.

This makes an empty shown object admissible with an empty answer, and keeps
answer keys unknown against the empty map, exactly as `V`/`le` does.

## Verification

`interaction-tools` 32/32 with three added assertions: `{}` shown and `{}`
answer is admitted; `{questions: 5}` shown is admitted unchanged; an answer key
against the empty map refuses as `answers`. tsc 0; build 0; full 2,104/2,104;
chain 767/767; notices 0; source index unchanged; identity `13f00168…`.
