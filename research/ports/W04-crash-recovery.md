# W04 durable recovery usage chain

Date: 2026-10-11. Status: verified finite process-crash chain.
Classification: local rewrite. Original durable checkpoint transaction and
declarative-DAG crash recovery implementations were not established; this
package preserves conservative ownership and explicit unknown-effect rules.

Checkpoint restoration saves content-addressed rollback objects and intended
before/after bytes, modes and removal states before target effects. A durable
transaction binds workspace, lock owner and optional rewind branch prefix.
Recovery compares every target before rollback. Outside edits retain the entire
transaction for reconciliation. Dead owners can be reclaimed; live owners stay
exclusive. A complete rewind/branch journal proof overrides a missing commit
marker, preserving committed files and history after interruption.

Source and compiled `smoke-checkpoint-crash.mjs` each exercised eight real
SIGKILL cutpoints plus interactive `/checkpoint-recover`: pre-effect, target
rename, removal and recorded-directory interruption roll back; branch-commit
and marker interruption preserve the committed branch; outside edits and
mkdir-before-inode ownership uncertainty preserve the transaction. Successful
second recovery returns none. Marker/cleanup-fsync exceptions are covered by
three essential regressions with the existing checkpoint tests.

Workflow source and compiled CLI each killed an actual running process after
task A completed and task B performed its first write_file effect. Resume
reported B's effects as unknown; resume without retry_interrupted made zero
additional effects. Explicit retry made the second effect while reusing A's
original completed child, with A called once. Parent/workflow active locks were
released; the old interrupted B journal lock remains as unknown child state.
Dead recovery guards are reclaimed with token/stat/PID checks; a second crash
during token-claim reclamation retains an explicit inspection boundary.

```
node scripts/smoke-checkpoint-crash.mjs --compiled
node scripts/smoke-workflow-cli.mjs --crash --compiled
```

The accepted source checkpoint symbols are captureCheckpoint,
restoreCheckpoint, recoverCheckpoint, recoverTransaction and branchProof;
workflow symbols are WorkflowStore.acquire and WorkflowRegistry.start.
Exact target ranges/hashes and compiled receipts are bound in the shared
local-completion evidence after final freeze. Existing original UI-mode and
script-resume references remain research/INTERACTIVE.md and prior workflow
records; they establish design observations, not copied durable algorithms.

Residuals: unpublished .checkpoint-UUID.tmp files have no durable path/inode
ownership and remain visible; mkdir-before-inode cannot be silently reclaimed.
Pre-journal branch creation, power-loss durability, PID reuse, adversarial path
Final adversarial review found and fixed a synchronous rollback ownership bug:
an unexecuted target edited to exactly the intended after-content is preserved,
the earlier applied path rolls back, and the transaction remains pending.
Fresh-process matching still cannot distinguish an outside edit equal to after
from an interrupted effect; this is an explicit residual, not provenance proof.
replacement and arbitrary callbacks without branch proof remain outside this
measured process-crash contract. No unknown tool or workflow effect is replayed
without an explicit user instruction.

## W48-01 staging ownership (2026-10-17)

The atomic writer now tags staging names with the store path digest
(`.checkpoint-<12hex>-<uuid>.tmp`), and recovery sweeps this store's tags under the checkpoint
lock in the store directories and in a pending transaction's target directories. The residual
above still applies to the pre-W48 untagged names, which stay visible. [W48 record](W48-checkpoint-staging.md).


## W53-01 capture association (2026-10-17)

Capture now writes a durable association intent before publishing the manifest, and a resumed
`Session.open` appends the missing checkpoint event under the session lock. The intent is cleared
once the event is durable; intents with no published manifest are cleared, while foreign,
unreadable or digest-mismatched files stay for inspection. [W53 record](W53-checkpoint-association.md).


## W54-01 garbage collection and write order (2026-10-17)

Recovery now sweeps content-addressed objects no valid manifest references and association intents
whose creator died before publishing a manifest, under the store lock and only when the whole
reference set is provable. The durable writers share one order: fsync the file, rename, fsync the
directory; the manifest is published last and the transaction before effects. [W54 record](W54-checkpoint-gc.md).
