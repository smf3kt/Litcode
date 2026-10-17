# W114 runtime trail

## W114-01 acceptance (2026-10-17)

- [x] **Source read.** The child-worktree repository-root check and its
  advisory text, plus the neighbouring entry point's variant.
- [x] **Port.** repositoryState none/root/elsewhere and the factory advisory.
- [x] **Bounds.** Only a workspace with no repository takes the advisory; a
  nested workspace keeps the manager's root error.
- [x] **Gates.** focused 88/88, tsc 0, build 0, full 2,155/2,155, chain
  767/767, notices 0, source index unchanged, identity `95c17af3…`.
- [ ] Remaining C-6: the rest of the hook output consumers and script semantics.
