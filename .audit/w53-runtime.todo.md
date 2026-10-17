# W53 runtime trail

## W53-01 acceptance (2026-10-17)

- [x] **Intent precedes capture.** `checkpointConversation` writes a durable association intent
  before `captureCheckpoint` runs.
- [x] **Success clears it.** The intent is removed after the journal append is durable.
- [x] **Capture failure clears it.** A synchronous capture error leaves no intent behind.
- [x] **Reopen completes the window.** A resumed session appends the missing event from the
  validated manifest under the session lock.
- [x] **Unprovable intents stay.** Foreign sessions, unreadable files and digest mismatches are
  retained; a missing manifest and an already-present identical association are cleared.
- [x] **Real crash verified.** A child process SIGKILLed from inside the checkpoint append leaves
  manifest + intent; the next open restores the event.
- [x] **Gates.** tsc 0, rewind 7/7, checkpoints 21/21, full 2,088/2,088, chain 767/767, crash smoke
  both modes, notices 0, build 0, index unchanged, identity `df90fb56…`.
- [ ] Remaining C-4 item: power-loss/GC.
