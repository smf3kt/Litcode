# W111 runtime trail

## W111-01 acceptance (2026-10-17)

- [x] **Source read.** Output schema, translation retention, the collection
  into `$e`, and both watcher registration helpers.
- [x] **Port.** startSession return value, initialWatchPaths, and registration
  on clear/fork, resume, config reload and cwd relocation.
- [x] **Bounds.** Existing watcher limits apply; headless ignores the paths;
  the plugin-late replace mode has no local analogue.
- [x] **Gates.** focused 63/63, tsc 0, build 0, full 2,150/2,150, chain
  767/767, notices 0, source index unchanged, identity `ec6093d6…`.
- [ ] Remaining C-6: the rest of the script semantics.
