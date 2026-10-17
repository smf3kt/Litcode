# W53 — capture and its session association form one recoverable unit

## Source position

The checkpoint store and its session journal are this runtime's construction. W04 records that the
recovered durable checkpoint transaction was never established, so this is a local extension. It
follows the recovered observe-and-prove policy (`zPo`, chunk-sfn1dbxq.js [1801370,1802540), UTF-8
bytes): recovery acts only on facts it can prove and retains everything else.

## Window

`captureCheckpoint` publishes objects and then the manifest atomically; `checkpointConversation`
then appends `{kind:"checkpoint", name, digest, boundary}` to the session journal. A crash after the
manifest and before that append left a checkpoint no session reached, because the next
`automaticCheckpoint` had to use a fresh name and an explicit name stayed occupied until the user
picked another. The reverse ordering was already safe: an association can never point at a missing
manifest.

## Behavior

1. Before capture, `checkpointConversation` atomically writes
   `<store>/.assoc-<uuid>.json` naming the session, checkpoint, boundary and creator pid.
2. Capture publishes the manifest. On a capture error the intent is cleared; a crash leaves it.
3. The journal append follows; success clears the intent. A failed append keeps it.
4. Every resumed `Session.open` scans this session's intents under the session lock:
   - a validated manifest with no matching event appends the missing event and clears the intent;
   - an intent whose manifest was never published is cleared;
   - an intent already represented by the same name and digest is cleared;
   - a foreign session, an unreadable intent or a digest mismatch stays for inspection.

The append reuses the recorded boundary, so deduplication and rewind see exactly the association
the crashed process intended.

## Verification

Rewind 7/7 with two new cases: one drives the recovery rules (missing manifest, foreign session,
invalid file, idempotent reopen) and one kills a real child process with SIGKILL from inside
`Session.append` after capture, then asserts the next open restores the event and clears the
intent. Checkpoints 21/21, full 2,088/2,088, chain 767/767, tsc 0, build 0, notices 0, checkpoint
crash smoke eight cutpoints in source and compiled modes, source index unchanged, identity
`df90fb56…`.
