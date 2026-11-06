# W122 runtime trail

## W122-01 acceptance (2026-10-17)

- [x] **Source read.** `smn` normalizes paths, `sAr` holds them, `emn` activates
  on a touched workspace-relative path, `MU` runs the test from the file tools.
- [x] **Port.** Frontmatter `paths`, the loader split, the live held list, the
  gitignore matcher and the in-place catalog/prompt update.
- [x] **Bounds.** `/**` trim and lone-`**` rules, non-string error, workspace
  escape/absolute skip, no-op re-activation, dynamic directory discovery left
  open, ignore@7.0.5 noticed.
- [x] **Gates.** focused 134/134, lifecycle 55/55, tsc 0, build 0, full
  2,190/2,190, chain 768/768, notices 0, source index unchanged, identity
  `03e2bef1…`.
- [ ] Remaining C-10: dynamic directory discovery, reserved names and collision
  naming.
