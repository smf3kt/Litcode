# W69 runtime trail

## W69-01 acceptance (2026-10-17)

- [x] **Source read.** `Ae` [19624,20102), its `validateInput` [16528,16776) and the `uPr`
  gate [98437,98515) measured in UTF-16 code units; the three messages copied verbatim.
- [x] **Gate ported.** `previewFormat: "html"` checks every option preview before dispatch; a
  missing option keeps previews opaque.
- [x] **Host setting adapted.** The launch-options store and `pPr` setter are replaced by the
  explicit factory option; the reason is recorded.
- [x] **Gates.** interaction-tools 23/23, tsc 0, build 0, full 2,094/2,094, chain 767/767,
  notices 0, source index unchanged, identity `dc4f6cce…`.
- [ ] Remaining C-11: full renderer, formatting host, notes/annotations, extended kinds.
