# W48 runtime trail

## W48-01 acceptance (2026-10-17)

- [x] **Staging names carry the store.** `atomicWrite` writes
  `.checkpoint-<12hex store tag>-<uuid>.tmp`; the tag is the store path's SHA-256 prefix.
- [x] **Recovery sweeps under the lock.** The store, objects and manifests directories are swept;
  a pending transaction sweeps each target directory once before its ownership checks.
- [x] **Ownership is fail-closed.** Foreign tags, untagged legacy names, directories and symlinks
  stay; only regular files with this store's tag are removed.
- [x] **Crash smokes stay clean.** Source and compiled smokes pass at eight SIGKILL cutpoints plus
  `/checkpoint-recover` with `stagingResidue:[]`.
- [x] **Gates.** tsc 0, checkpoints 21/21, rewind 5/5, full 2,081/2,081, chain 767/767, notices 0,
  build 0, index unchanged, identity `f3419f9c…`.
- [ ] Remaining C-4 items: worktree archive picker, concurrent new-lock race, power-loss archive
  recovery, capture-correlation crash window, power-loss/GC.
