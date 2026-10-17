# W73 runtime trail

## W73-01 acceptance (2026-10-17)

- [x] **Source path read.** `create()` validates preview format before dispatch and
  admits the host answer through `V`/`le` before building the result.
- [x] **Card host wired.** `cardAnswers: true` plus an `askCard` callback; the
  returned object is admitted and becomes the tool result.
- [x] **Default unchanged.** The indexed `ask` contract stays the default; the
  source client is represented by the explicit callback.
- [x] **Gates.** interaction-tools 30/30, tsc 0, build 0, full 2,101/2,101, chain
  767/767, notices 0, source index unchanged, identity `ef8f4ab4…`.
- [ ] Remaining C-11: full renderer, formatting host, annotation normalization.
