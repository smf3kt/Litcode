# W98 runtime trail

## W98-01 acceptance (2026-10-18)

- [x] **Source read.** Stop builder, both serializers, the filter, type map,
  truncation and cron source.
- [x] **Port.** `active()`, `stopState(owner)`, AgentEvents provider and all
  Agent construction paths.
- [x] **Bounds.** Shell/monitor only; running-only statuses; no MCP task
  registry.
- [x] **Gates.** background 23/23, runtime-resources 11/11, agent-lifecycle
  39/39, tsc 0, build 0, full 2,131/2,131, chain 767/767, notices 0, source
  index unchanged, identity `9b2dc7df…`.
- [ ] Remaining C-6: full consumers and the fork-skill expansion metadata.
