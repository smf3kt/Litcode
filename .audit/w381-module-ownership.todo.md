# W381 module ownership on notification failure

Base: 62f7216. Family: Hooks, remains Partial. Local only.

- [x] Reproduce the compiled baseline: a notification listener throws after publication, the registry lacks an owner, a retry loads a second environment and removal leaves the first one behind. Baseline output SHA-256 `2d6bc7f37f3b40384abf9c328a2e296b5eea57a81772398026fb8dbf0d51ef14`.
- [x] Read source `eVe`, `a_e`/`Pe`, `vVe`, `iF`, `CVo` and `gs`; source publication precedes notification and the source inventory retains the record. Independent static reading confirms the ownership distinction, within its recorded limits.
- [x] Record the adapter: create the unload handle and hand it to the registry after insertion and before notification; remove the registry owner before invoking unload. Propagate listener failures; standalone direct-load recovery remains separate.
- [x] Implement the source-grounded adapter and a regression for load and unload notification exceptions.
- [x] Check/build, related suites 48/48, compiled red/green and actual CLI toggle 42/42 pass at content identity `280143a4f49a8b89c0d6f9a65744663bcb89eb7c58a7696e68a99e8d46d22678`.
- [x] Independent review returned NOT_VERIFIED and found a mounted editor missing notification after a throw and same-declaration retry; a compiled probe reproduces it. Source `a_e` sets `isSetRecord` only after `Xye` and gates its unchanged fast path on that flag.
- [x] Add source-grounded pending/in-flight/completed notification retry and verify the compiled editor, reentry, exception propagation and cleanup. Related 48/48, check/build and actual CLI toggle 42/42 pass at `919667c23e09756fe0ca73b286d50bc518edda7d28a8c8de61aa9be56cfc1970`.
- [x] Independent repair review found a synchronous retry throw bypasses the barrier for earlier sibling loads; compiled red confirms an unhandled missing-module rejection.
- [x] Register the all-settled barrier even when the declaration loop throws; compiled held-success and failing sibling probes, related 49/49, check/build and actual CLI toggle 42/42 pass at `234c5914046fdac5ca743b7be2ed48a93bf8344ab424e5de481ae15ee93fc4b5`.
- [x] Independent final review found removal notification failure leaves the mounted editor stale even after an empty-declaration retry; compiled red confirms it.
- [x] Consolidate notification acknowledgment into inventory-scoped state covering insert, remove, retry and nested mutations; compiled removal/nested/repeat probes, related 49/49, check/build and CLI toggle 42/42 pass at `fa07d81b1893c7df22a146cb7a35f1c49a5ec9b5c68fe23b9a3194dcb6732fbe`.
- [x] Independent repair review identified a nested removal after the editor's listener leaves that editor stale until an extra reconciliation; compiled red confirms it.
- [x] Drain successful nested inventory changes and verify the late-listener ordering and failure retry contract. Compiled red/green, related 50/50, check/build and actual CLI toggle 42/42 pass at `db6230d6db5b67e5ee8be1b1cb130f598dbf3fd8dd80aa13c30a2811d4ab0061`.
- [x] Independent final repair review verified three regressions and compiled failure/reentry/settlement fixtures; CURRENT and FEATURES are updated.
- [x] Stage the exact W381 paths for local commit.
