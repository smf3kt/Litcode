# W382 concurrent plugin adoption

Base: e251425. Family: Hooks, remains Partial. Local only.

- [x] Compiled red: two concurrent identical declarations load two records; removal leaves one. A declaration removed while its module import is held still becomes active after release. Both owned fixtures are cleaned.
- [x] Bind source `de`/`NDe` queue, `uen` state, `UNs` operation context and `kVo`/`CVo`/`MVo` ordering. Independent reader confirms ordering and boundaries; source reader used 15 calls plus two wrappers against 12.
- [x] Record the `NDe`-ordered adapter, per-call failure, all-sibling barrier, asynchronous error contract and synchronous listener reentry boundary in the source record.
- [x] Implement source-grounded concurrency ownership with three regression groups for duplicate, removal, replacement, sibling failure and listener behavior.
- [x] Related 56/56, check/build, compiled five-scenario probe, actual CLI toggle 42/42 and full 3473/3473 pass at identity 151da6474037f89bf68ca364dd6bb6286cd3c4660332539b3a512ffdd837a326; identity remains unchanged after the full suite.
- [x] Independent review returned NOT_VERIFIED for partial batch removal after a notification throw and duplicate names within one array; both reproduce in owned regressions. Read source `iF` and the installed-index uniqueness boundary before repair.
- [x] Repair both findings; related 58/58, check/build, seven compiled cases, actual CLI 42/42 and full 3475/3475 pass at c21f8092f2c819f3c4a7a155365ad8791fd37bffdb6819332674ba7e3ff06632, unchanged after the full suite.
- [x] Fresh scoped repair review returned VERIFIED_SCOPED for the two findings and identified a retirement-throw boundary; the independent conditional finding is reproduced in an isolated red regression.
- [x] Preserve not-yet-retired owners when retirement throws; the focused regression passes. The first throwing environment remains a separately recorded cleanup boundary.
- [x] Candidate passes related 59/59, check/build, eight compiled scenarios, actual CLI 42/42 and full 3476/3476 at 53776570d363351e4d19d3a71612e7a787a540c94b0ce336c0228d76762860cd. Fresh independent review verifies the later-owner repair and queue tests 9/9.
- [x] Correct independent-review fixture cleanup; focused 9/9 and check pass at 881c7f4d522c441f6fed4bb3376e960a655f859e6b0de8133933390910164b2f; product/build remain unchanged. Record remaining retirement notification and first-environment boundaries.
- [x] Update CURRENT, FEATURES, STATUS, coding standard and the compact port record; prepare exact-path local commit.
