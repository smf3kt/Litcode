# W123 runtime trail

## W123-01 acceptance (2026-10-17)

- [x] **Source read.** `MU` triggers `dAr`, `dAr` walks ancestors and
  `git check-ignore`s the containing directory, `E3t` loads with the project
  source, `WRn` re-reads discovered directories on rescan.
- [x] **Port.** Session candidate set, ancestor walk, gitignore skip, tolerant
  directory loader, in-place catalog append and prompt re-render.
- [x] **Bounds.** Once per candidate, workspace boundary, no duplicate names,
  dynamic `paths` stay visible per `E3t`, diskless/policy/sync gates absent.
- [x] **Gates.** focused 137/137, three-suite 164/164, tsc 0, build 0, full
  2,194/2,194, chain 768/768, notices 0, source index unchanged, identity
  `4149770c…`.
- [ ] Remaining C-10: reserved names and collision naming.
