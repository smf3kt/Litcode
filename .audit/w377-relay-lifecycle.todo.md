# W377 plugin edit relay lifecycle

Base: ee4c90c. Family: Hooks, stays Partial. One active package, local only.

- [x] Capture source and compiled red: a disposed relay switches to recording and logs after a later module install. Existing relay suite 10/10; compiled plugin toggle CLI 42/42 at identity `cbe7f1ad`.
- [x] Read source: `cue` chunk-24k7d6mw.js SHA-256 `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` [797251,797511); `YHo` chunk-6ejn7q9s.js SHA-256 `e652d11d8941d479b41f93f296877a1bc0544c549ddd6b9999f681192effbfee` [121977,122681); `Re` chunk-5b7mmg84.js SHA-256 `05f8803b1d7dea53e80b234ff14f162653a7ea46e889dfe05d364b7d13e7646b` [758,1288); `Rt` chunk-kexg5hxg.js SHA-256 `ff0c3b2de749b1a99560e47932f3e6f8976b4128d678bf28189128944cadd3f4` [5027,5085). All coordinates are zero-based, half-open UTF-16.
- [x] Add one lifecycle regression. Before repair it fails `true !== false` at the disposed relay; it also verifies a live relay and repeated disposal.
- [x] Adapt the existing hook host to own its subscription and effect cleanup; retain the copied `cue`/`YHo` bodies and existing terminal close entry.
- [x] Related 26/26, check/build, compiled lifecycle probe and actual plugin CLI 42/42 at `75ac0c0d`. Final test-only simplification passes the focused regression and check; identity `f7412a1b` changes one validation file, with product/build unchanged.
- [x] Independent review returned `VERIFIED_SCOPED`, checked the four source bodies and reran the relay suite 11/11 in 12 calls. It did not repeat the CLI, build, full suite or identity.
- [x] Update CURRENT, FEATURES and port evidence.
- [x] Prepare exact-path local commit; unrelated changes and `dist/` remain outside it.
