# W73 — card host wiring

## Source position

The recovered tool's `create()` body (chunk-ktr9sak2.js, UTF-16) calls the host card
and validates its answer before the result is emitted:

- `validateInput` [16528,16776) checks preview format before dispatch;
- the host answer path admits through `V`/`le` [2142,4005) — the contract ported
  in W72 — with `qht` [1397,1484), `ce` [4005,4482), `de` [4482,4720) and `pe`
  [4720,4845);
- `V` returns `{kind:"refused", rule}` or `{kind:"admitted", input}`; the tool
  result is built from the admitted input.

## Port

`ask_user_question` now accepts both host contracts:

- default: `ask` returns `{answers:[{questionIndex, selected, other?, annotations?}]}`
  and `validAnswer` checks it, as before;
- `cardAnswers: true`: `askCard` returns the shown input plus `answers`,
  `annotations`, `response` and `followUp`; the returned object is passed through
  `admitCardAnswer` against the structured clone of the shown request, and a
  refusal throws `ask_user_question: card answer refused (<rule>)`. The admitted
  object is returned as the tool result.

Callbacks resolve from the factory first, then from `context.interaction`, as the
existing ask/plan/report callbacks do. A missing `askCard` in card mode fails
before dispatch with `host askCard callback is missing`.

## Adaptation

The source host is the original client, which owns the card UI and sends the answer
object. This runtime has no such client, so the host is an explicit `askCard`
callback and the mode is opt-in. The default indexed contract stays the default,
because the product TUI, runtime and tests consume it; the card path is available
to a host adapter that wants the source shape.

## Verification

`interaction-tools` 30/30 with one new case: a valid card is admitted and returned
with the joined answers and response; a card with an unknown field is refused with
the source rule; card mode without `askCard` fails; a context-level `askCard`
answers. tsc 0; build 0; full 2,101/2,101; chain 767/767; notices 0; source index
unchanged; identity `ef8f4ab4…`.
