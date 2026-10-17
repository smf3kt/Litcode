# W54 — provable checkpoint garbage collection and the durable write order

## Source position

The checkpoint store is this runtime's construction; W04 records that the recovered durable
checkpoint transaction was never established. This package stays inside the local contract and the
recovered observe-and-prove policy (`zPo`, chunk-sfn1dbxq.js [1801370,1802540), UTF-8 bytes).

## Garbage collection

`recoverCheckpoint` already holds the store lock and has resolved any pending transaction before
it sweeps. Under that lock it now removes only what it can prove:

- a content-addressed object whose 64-hex name no valid manifest references;
- an association intent whose creator pid is dead and whose manifest was never published.

Anything that weakens the proof retains the whole affected set: an unknown file name in
`objects`, an unreadable or invalid manifest, a manifest set over the 2,000-entry cap, more than
100,000 objects, or a store directory over the 1,024-entry scan cap. Symlinks and non-regular
objects are never removed. A live creator keeps its intent because the capture may still publish.

A capture and a restore write their objects while holding the same store lock, so an unreferenced
object cannot belong to an in-flight operation. A resolved transaction's objects become
unreferenced only after its transaction file is gone.

## Power-loss ordering

Every durable checkpoint writer goes through `atomicWrite`: create an `O_EXCL` staging file in the
target directory, write it, `fsync` the file, run the ownership verifier, rename over the target
and `fsync` the parent directory. The order is:

1. association intent (before capture);
2. content-addressed objects (each file then directory fsync);
3. manifest, last, after a second workspace digest check;
4. transaction, before any target effect.

A cut before the rename leaves only a store-tagged staging file, which the next lock sweeps. A cut
after the rename has the directory fsync that makes the name durable. Hardware-level power-loss
equivalence (device caches, torn writes) is not measurable locally and remains a stated limitation,
not a behavior claim.

## Verification

Checkpoints 23/23 with one case for the sweep and one for the conservative invalid-manifest path;
rewind 7/7; full 2,090/2,090; chain 767/767; tsc 0; build 0; notices 0; checkpoint crash smoke eight
cutpoints in source and compiled modes; source index unchanged; identity `6eaa8c28…`.
