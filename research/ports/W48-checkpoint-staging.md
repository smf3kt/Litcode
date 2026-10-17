# W48 — checkpoint staging files carry their store and are reclaimed

## Source status

This is an extension of the local checkpoint rewrite, not a port. W04 records that the original
durable checkpoint transaction implementation was never established, and W04's residual names the
unpublished `.checkpoint-UUID.tmp` files as having no durable path or inode ownership. The
staging contract below therefore follows this runtime's own atomic writer and store lock.

## What changed

`atomicWrite` now names its staging file `.checkpoint-<tag>-<uuid>.tmp`, where `tag` is the
first 12 hex characters of the SHA-256 of the absolute store path (`.agent/checkpoints`). The
name alone proves which store owns the file, without a sidecar and without trusting a pid.

`recoverCheckpoint` holds the store lock for every checkpoint write, so while that lock is held
no live writer can own a staging file. Under the lock it sweeps `<store>`, `<store>/objects`
and `<store>/manifests`. `recoverTransaction`, after validating the transaction and before its
ownership and conflict checks, sweeps the parent directory of every operation target once. That
second sweep also lets a recorded directory that must be removed come empty.

Only regular files whose name matches the exact tagged pattern are removed. Files tagged for
another store, untagged legacy staging (the pre-W48 `.checkpoint-<uuid>.tmp` name), directories
and symlinks stay for inspection. Each directory scan is bounded at 10,000 entries and stops
there. Unlink failures other than ENOENT propagate.

## Verification

Checkpoints 21/21 (two new cases: store sweep with foreign/legacy/symlink retention; pending
transaction sweeps its target directories while retaining the transaction), rewind 5/5, full
2,081/2,081, chain 767/767, source and compiled crash smokes pass with `stagingResidue:[]` at all
eight SIGKILL cutpoints plus `/checkpoint-recover`, build 0, tsc 0, notices 0, source index
unchanged at 75 chunks / 323,525 units, identity `f3419f9c…`.
