# W107 runtime trail

## W107-01 acceptance (2026-10-17)

- [x] **Source read.** Output schema, the attachment injection and its
  isolated-context exclusion, and the non-blocking error attachment.
- [x] **Port.** SubagentStart joins the pending hook context that the first
  request consumes.
- [x] **Bounds.** Top-level sessions do not raise the event; the context is
  delivered once, before the first message.
- [x] **Gates.** focused 45/45, tsc 0, build 0, full 2,145/2,145, chain
  767/767, notices 0, source index unchanged, identity `b6d0794d…`.
- [ ] Remaining C-6: the rest of the script semantics.
