# W96 runtime trail

## W96-01 acceptance (2026-10-18)

- [x] **Source read.** Builder, source mapping, both watcher gates and the
  exit-2 blocking set.
- [x] **Port.** Watcher-driven raise with `source`/`file_path`, policy
  non-blocking, gated reload fan-out.
- [x] **Correction.** The synchronous invented raises are removed.
- [x] **Bounds.** No MDM poll; explicit managed file stands in; non-skill
  catalogs raise nothing.
- [x] **Gates.** config-watch 4/4, hooks 52/52, interactive 9/9, tsc 0,
  build 0, full 2,127/2,127, chain 767/767, notices 0, source index unchanged,
  identity `6443354c…`.
- [ ] Remaining C-6: full consumers and the remaining unwired event fields.
