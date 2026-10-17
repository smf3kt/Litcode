# W70 — extended question kinds

## Source position

The recovered AskUserQuestion surface in `chunk-ktr9sak2.js` (UTF-16 code units):

| Symbol | Range | Contents |
| --- | --- | --- |
| `X` | [5090,5660) | base option: label, description, preview |
| `Y` | [5660,5811) | extended option: description optional |
| `B` | [5827,7001) | base question: header required, options 2-4, multiSelect default false |
| `G` | [7068,8434) | extended question: kind, description, options default [], placeholder, min, max, step, defaultValue, unit |
| `me` | [8434,9556) | per-kind superRefine |
| `J` | [9560,9925) | per-answer annotations (preview, notes) |
| `Q.check` | [9925,10217) | question texts unique, option labels unique per question |
| `be` | [11256,…) | extended input schema: optional title plus `me()` questions |
| `K` | [12694,12893) | host card input: kind defaults to `"choice"` |

`me()` rules, with messages copied verbatim:

1. `placeholder` only on `text`; `min`/`max`/`step`/`defaultValue`/`unit` only on `number` —
   `<field> applies only to "<kind>" questions.`
2. choice: fewer than 2 options — `A choice question needs 2-4 options; use kind "text" for an
   open-ended question.`
3. text/number with options — `A "<kind>" question takes no options; remove them or omit kind to
   ask a choice question.`
4. text/number with multiSelect — `multiSelect applies only to choice questions, not "<kind>".`
5. number without numeric min < max — `A number question needs numeric min and max with min <
   max.`
6. number defaultValue outside min..max — `defaultValue must lie within min..max.`

## Port

`src/interaction-tools.ts` adds `extendedQuestions?: boolean`, the product counterpart of the
host `extendedQuestionsEnabled` launch option that gates `Awe()` in the source:

- the request type gains `title` and per-question `kind`, `description`, `placeholder`, `min`,
  `max`, `step`, `defaultValue`, `unit`;
- `extendedQuestionShape` ports `me()` in the source's check order with its messages; options
  default to `[]`, multiSelect defaults to false, and the advertised input schema switches with
  the option;
- before dispatch, `kind ?? "choice"` is written into every question, as `K` does;
- `uniqueQuestionTexts` ports `Q.check`'s question-text uniqueness in both modes;
- a custom schema issue now keeps its message in the thrown error, so the recovered messages reach
  the caller instead of being reduced to a path and code.

## Deliberate omissions and adaptations

- The host launch-options store is replaced by the explicit `extendedQuestions` option, as with
  W69's preview format.
- The answer contract stays the product's `questionIndex/selected/other`; the source's newer card
  answer map, per-answer annotations (`J`) and the emitted answer JSON are not ported. Number
  range is a host-control property in the source too; it validates no numeric answer text.
- Extended options keep a required `description` because the product host renders it; `Y` makes
  it optional.
- The source's `title`, `description`, `placeholder` and `unit` are unbounded strings; the
  product's overall payload budget still bounds the request.

## Verification

`interaction-tools` 27/27 with four new cases (kind defaulting and field forwarding; every rule
message in source order; extended fields and title rejected unless enabled; duplicate question
texts rejected). tsc 0; build 0; full 2,098/2,098; chain 767/767; notices 0; source index
unchanged; identity `054cdd94…`.
