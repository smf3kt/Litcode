# W121 runtime trail

## W121-01 acceptance (2026-10-17)

- [x] **Source read.** The inline handoff validates each extracted span, gives
  it a synthetic tool-use id and runs it through the tool runtime, so a crash
  leaves a started call with no result.
- [x] **Port.** The append-only per-owner journal with fsynced starts and
  terminal records, digest-only identity, recovery reporting and acknowledgement.
- [x] **Bounds.** Dedicated file instead of synthetic tool events; per-span
  recovery; failed reruns keep the warning; torn tail discarded; malformed
  records and 4 MiB overrun fail closed; child runtimes share `initial`.
- [x] **Gates.** focused 35/35, extended 86/86, tsc 0, build 0, full
  2,184/2,184, chain 768/768, notices 0, source index unchanged, identity
  `04147ee3…`.
- [ ] Remaining C-10: source precedence and dynamic discovery.
