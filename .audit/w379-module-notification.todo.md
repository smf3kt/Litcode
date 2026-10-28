# W379 file-module notification

Base: bd5ddd1. Family: Hooks, remains Partial. Local only.

- [x] Reproduce compiled red: a relay mounted before file adoption stays unhooked after the module is loaded.
- [x] Read recovered `a_e`/`Pe`/`vVe`/`iF` and the `Xye` → `rIn` → `r5t` → `wc` → `gs` notification chain; identities and UTF-16 ranges are in W378.
- [x] The mounted-relay regression fails before product changes with `false !== true` at file adoption; it also covers edit delivery, version invalidation, disposal and repeated unload.
- [x] Adapt inventory change notification through the existing host: file load and removal notify mounted relays and advance the `ui.render` version; repeated unload does not republish. The focused regression passes.
- [x] Related 71/71 plus classic-hook consumers 13/13, check/build, compiled direct probe, plugin toggle 42/42 and live mounted-editor install 5/5 pass at `664fc876dac320035ed2b9ad73325c8cc6800610212743692e66070b21998aa5`.
- [x] Independent review VERIFIED_SCOPED; CURRENT/FEATURES updated. Retirement-throw notification remains untested.
- [x] Stage exact paths for local commit.
