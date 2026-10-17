# W81 runtime trail

## W81-01 acceptance (2026-10-17)

- [x] **Source read.** `ke` and `e7r` measured in UTF-16 code units.
- [x] **Port.** Per-file watcher callback with add/change/unlink mapping and the
  recovered payload at the interactive raise.
- [x] **Display.** Result `systemMessages` are written, matching the source's
  watcher display path.
- [x] **Gates.** config-watch 3/3, tsc 0, build 0, full 2,108/2,108, chain
  767/767, notices 0, source index unchanged, identity `700a4af5…`.
- [ ] Remaining C-6: hook-returned `watchPaths`, failure-output display, full
  consumers and script semantics.
