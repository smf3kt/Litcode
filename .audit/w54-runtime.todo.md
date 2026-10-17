# W54 runtime trail

## W54-01 acceptance (2026-10-17)

- [x] **GC runs under the store lock.** It follows transaction recovery, so rollback objects are
  never swept before the transaction is resolved.
- [x] **Objects are provably unreferenced.** Every manifest must validate and the complete
  reference set must fit the caps before any object is removed.
- [x] **Intents are provably dead.** Only a dead creator with no published manifest loses its
  intent; a live creator keeps it.
- [x] **Uncertain stores are retained.** Unknown names, symlinks, unreadable manifests and capped
  stores keep everything.
- [x] **Write order recorded.** Intent, object, manifest and transaction all fsync the file,
  rename, then fsync the directory; the manifest is last and the transaction precedes effects.
- [x] **Gates.** tsc 0, checkpoints 23/23, rewind 7/7, full 2,090/2,090, chain 767/767, crash smoke
  both modes, notices 0, build 0, index unchanged, identity `6eaa8c28…`.
- [x] **C-4 complete.** Stale lock, staging, create reservation, archive intent/picker, lock
  contention, capture association, GC and write order are all covered. The hardware-level
  power-loss limitation is recorded in the port note.
