# W72 runtime trail

## W72-01 acceptance (2026-10-17)

- [x] **Source read.** `qht`, `V`, `le`, `ce`, `de`, `pe` and the limit
  constants measured in UTF-16 code units.
- [x] **Rules ported.** Shown-field integrity, host-only field, answer keying and
  joining, strict annotations, response, extended-only followUp and size caps.
- [x] **Default contract unchanged.** The validator is exported for a card host;
  `ask_user_question` keeps its indexed answer contract.
- [x] **Gates.** interaction-tools 29/29, tsc 0, build 0, full 2,100/2,100, chain
  767/767, notices 0, source index unchanged, identity `21433e88…`.
- [ ] Remaining C-11: card host wiring, full renderer, formatting host.
