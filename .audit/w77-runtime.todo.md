# W77 runtime trail

## W77-01 acceptance (2026-10-17)

- [x] **Source read.** `ce` and `I` measured in UTF-16 code units.
- [x] **Port.** `cardQuestionMap` and `own` replace the direct question loop.
- [x] **Tolerance.** Absent/non-array lists yield an empty map; empty shown plus
  empty answer is admitted; unknown answer keys still refuse.
- [x] **Gates.** interaction-tools 32/32, tsc 0, build 0, full 2,104/2,104,
  chain 767/767, notices 0, source index unchanged, identity `13f00168…`.
- [ ] Remaining C-11: full renderer and formatting host.
