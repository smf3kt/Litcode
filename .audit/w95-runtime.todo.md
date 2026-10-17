# W95 runtime trail

## W95-01 acceptance (2026-10-18)

- [x] **Source read.** `VYr`, its call site and the schema enum.
- [x] **Port.** Expansion-only raise with the four recovered fields.
- [x] **Correction.** The per-prompt raise is gone; attachments now assert
  silence.
- [x] **Bounds.** `command_source` unset; the skill-runtime fork path does not
  yet carry expansion metadata.
- [x] **Gates.** agent-lifecycle 38/38, interactive 8/8, attachments 2/2, tsc 0,
  build 0, full 2,124/2,124, chain 767/767, notices 0, source index unchanged,
  identity `50e58886…`.
- [ ] Remaining C-6: full consumers.
