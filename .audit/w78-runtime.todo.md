# W78 runtime trail

## W78-01 acceptance (2026-10-17)

- [x] **Source read.** `$oe`, `uHe`, `QP` and `gl` measured in UTF-16 code
  units.
- [x] **Port.** Permissive name filter, longest-first escaped alternation, first
  duplicate position, session schema relaxation.
- [x] **Tests updated.** Three headers now parse permissively instead of
  throwing; new filter and expansion cases added.
- [x] **Gates.** config+session 70/70, tsc 0, build 0, full 2,105/2,105, chain
  767/767, notices 0, source index unchanged, identity `1c2b556a…`.
- [ ] Remaining C-10: source precedence, dynamic discovery, effect-journal crash
  recovery; shell AST stays not-ported.
