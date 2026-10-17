# W51 runtime trail

## W51-01 acceptance (2026-10-17)

- [x] **Archives are readable without mutation.** `listWorktreeArchives` reads each archive as a
  session directory and reports name, created time, session count and newest title.
- [x] **The picker surface exists.** `/worktree-history` lists up to 20; `restore ARCHIVE` accepts
  an exact name or a unique prefix and refuses ambiguity.
- [x] **Restore preserves session paths.** The original worktree name is required and recreated, so
  archived metadata still points at the restored checkout.
- [x] **Restore is crash-aware.** It reuses the W50 intent, moves the archive back before removing
  a created checkout, and keeps the checkout when the move back cannot be proven.
- [x] **Gates.** tsc 0, worktree-session 5/5, interactive 7/7, full 2,085/2,085, chain 767/767,
  notices 0, build 0, both smokes exit 0, index unchanged, identity `436bb75f…`.
- [ ] Remaining C-4 items: concurrent new-lock race, capture-correlation crash window,
  power-loss/GC.
