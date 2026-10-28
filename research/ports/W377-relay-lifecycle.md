# W377 plugin edit relay lifecycle

Status: independently verified within this lifecycle scope. Base `ee4c90c`; Hooks remains Partial.

## Predicate

After a terminal or edit relay is disposed, later plugin module changes cannot invoke its selector or effects. A separate live relay still receives the same module changes. Disposal continues to abort in-flight edits, drops queued edits, and is idempotent.

## Source and owner

Sample `2.1.296` SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`. Ranges are zero-based, half-open UTF-16. Source modules match `extracted-v2/manifest.json`.

- `cue`, chunk-24k7d6mw.js SHA-256 `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`, [797251,797511), body SHA-256 `aea5495c0649b27a8e42b83f241c2adbf23148dcd80ea8aa6ae584f4a1cff636`. It subscribes to `Re(OL(), ...)`, updates the relay on selection changes and calls `T.dispose()` on unmount.
- `Re`, chunk-5b7mmg84.js SHA-256 `05f8803b1d7dea53e80b234ff14f162653a7ea46e889dfe05d364b7d13e7646b`, [758,1288), body SHA-256 `d4649217ba34eb09e5bd80e2af2009b8e82122cecdfaaac0782e65b40d821183`, delegates the store subscription to `Rt`. `Rt`, chunk-kexg5hxg.js SHA-256 `ff0c3b2de749b1a99560e47932f3e6f8976b4128d678bf28189128944cadd3f4`, [5027,5085), body SHA-256 `9f40c753c38814f6ac24ab1cffd81f3d097162725b5ef211aba7a25b601e8f2c`, calls React's `useSyncExternalStore`.
- `YHo`, chunk-6ejn7q9s.js SHA-256 `e652d11d8941d479b41f93f296877a1bc0544c549ddd6b9999f681192effbfee`, [121977,122681), body SHA-256 `7f3024bf9e2d147ac4132fb6269f0171b2b46060abc12ec3a1f0cc644bb439c1`, clears the batch and aborts its signal on disposal.
- The product replaces React with `hookHost` in `src/plugin-chain-relay.ts:49-103`. `src/plugin-chain-host.ts:190-192` returns the unsubscribe closure, but the host drops it. `src/tui.ts` calls the relay's `dispose()` at terminal close.

## Baseline

At identity `6a6a89d1004a724f2d7daa59ecc9628a83bbd819561455b24281f74081a74c07`, the existing relay suite passed 10/10. The owned compiled plugin-toggle CLI passed 42/42 at the preceding driver identity `cbe7f1ad`, including actual `prompt.edit` input, plugin disable/re-enable and cleanup, with zero model requests. Product, tests and build were unchanged between those identities. A direct source and compiled-artifact probe disposed a relay, then installed a `prompt.edit` module. Both returned `recordingAfterDispose: true` and logged `prompt.edit: hooked; the composer relays its edits to the chain`. The probe does not imply a whole-family defect.

## Adaptation

The copied `cue` and `YHo` bodies remain authoritative. `hookHost` now returns its value and an idempotent unmount, which releases the store subscription and commits its effect cleanups in reverse order. The public relay exposes that unmount as `dispose`; `cue`'s existing cleanup calls `YHo.dispose()`. The new lifecycle regression failed before the change at `test/plugin-chain-relay.test.ts:159` with `true !== false`, while the existing relay suite passed 10/10.

## Validation

- New lifecycle regression passes, including an independently live relay and repeated disposal. Related relay, loader and plugin module tests pass 26/26; existing tests cover queued and in-flight edit disposal.
- `npm run check` and `npm run build` pass. The compiled direct lifecycle probe verifies that a disposed relay remains silent while a live relay responds; the real compiled plugin-toggle CLI passes 42/42 with zero model requests and releases its locks and owned processes.
- CLI candidate identity `75ac0c0dcedbb7aece5346a9dc089d4466e88c9c028b528d1b430a6f13ce0985` has 941 input, 360 validation and 662 build records. A test handler was then simplified without changing its assertions; the focused regression and type check pass again. Final identity `f7412a1beeb3cf8c8e18aff4303ecc87c720d543a7703e738f726120daf06d4f` differs in exactly `test/plugin-chain-relay.test.ts`; all product and build records match the compiled candidate.

## Workflow checks

S-1 and S-7 bind the reproduced failure to `cue`, `Re`, `Rt` and `YHo` before the host adaptation. S-2 and S-4 preserve the original cleanup and give the store subscription a single unmount owner. S-5 checks a disposed and a live relay, repeated disposal, and the existing queued/in-flight cases. S-6 keeps the terminal close consumer. S-3 is inapplicable because no rendered output changes. No new standard is introduced.

## Review and scope

Independent review returned `VERIFIED_SCOPED` in 12 calls. It checked the four source bodies, subscription ownership, terminal close path and existing queued/in-flight cancellation; it reran the relay suite 11/11. It found no confirmed defect. Its scope did not include an independent identity recomputation or a rerun of the compiled CLI, build or full suite; those are main-run evidence above. `YHo` retains its recording flag if disposed while hooked, as the source does, but the removed subscription prevents subsequent updates. The host's generic effect-cleanup loop stops if a disposer throws; the sole current cleanup calls the copied `YHo.dispose`, which clears a batch and aborts. The Hooks family remains Partial for plugin-to-host calls and the VM/worker environment. No full-suite rerun is claimed for this local lifecycle fix; the preceding W376 full run was 3458/3458.
