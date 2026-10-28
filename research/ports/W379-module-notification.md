# W379 file-module notification

Status: independently VERIFIED_SCOPED. Base `bd5ddd1`. Hooks remains Partial.

## Predicate

A composer mounted before an actual local plugin file loads observes its `prompt.edit` handler, relays an edit, and stops relaying after the plugin is removed. Module changes invalidate the existing render-version store. Disposed relays remain detached, and removal of an already removed record does not send a new inventory change.

## Source and adaptation boundary

Sample `2.1.296` SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`. All source ranges below are zero-based, half-open UTF-16 code units. The identities and bodies were checked in W378.

- In chunk-sfn1dbxq.js SHA-256 `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`, `a_e` [2385002,2389680), its `Pe` [2386573,2387113), `vVe` [2391116,2393895), and `iF` [2390383,2390919) update or retire `loadedModules`, then call `Xye` [2370710,2370787).
- `Xye` calls `rIn` [273315,273333), `r5t` [272197,272250), and `wc` [271971,272059) from chunk-n3ykh62m.js SHA-256 `2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac`. `wc` increments the `ui.render` key in `OL()`'s render-version store. The existing `src/plugin-chain-render-keys-source.ts` carries `wc` verbatim; `src/plugin-chain-registry-stores-source.ts` carries `gs` [1141,1399) from chunk-tavdbgyw.js SHA-256 `3ce548e44986d7954bff4d9ce784041040c20028b4176413cd5d459072106d80`, publishing changed snapshots to its subscribers.
- `cue` in chunk-24k7d6mw.js SHA-256 `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`, [797251,797511), selects `Jl('prompt.edit')` through `Re(OL(), ...)`. The host's `src/plugin-chain-relay.ts` uses its own module listener instead of React. Before this change, `src/plugin-chain-loader.ts` mutated `it().loadedModules` without that listener, while `installChainModule` in `src/plugin-chain-host.ts` notified it. The local adaptation publishes the existing host signal and the source-backed render invalidation after real inventory changes. The other `Xye` effects are not claimed as ported.

## Baseline

The compiled probe at content identity `f1ee3d49321096923a6041afe5829a929594580f81c0cf3e23d9a8b9f4cbce02` observed `chainHooked: true` and `relayRecording: false` after loading a plugin file into a mounted relay, then failed the expected recording assertion. The new source regression also fails `false !== true` on the mounted relay after file adoption. The source and result are in the job temporary directory; the result SHA-256 is `281d30bf16b669bc271ac2f6eeb5bd6a51aaa80f131094e7a3d15bfefded4ac5`.

## Adaptation

The `modulesChanged` host seam now advances `ui.render` with the recovered `wc` map-copy operation and notifies its existing module listeners. `loadChainModule` publishes after insertion and after actual removal and retirement. A repeated unload returns before publishing. This is a local synchronous adaptation of the source store/effect chain: the host retains its module listeners, does not claim the other `Xye` effects, and does not claim React paced-effect timing.

## Validation

At content identity `664fc876dac320035ed2b9ad73325c8cc6800610212743692e66070b21998aa5`, source hashes are host `4a6929bf991021a7b30b1ab15e2f45102876573ed9fc591bf9dccfd7ffe56129` and loader `4f6bf70acb10ff152cbb7d27c4b713362088fc7c8fc2dfae66da3d7686b33ccc`; the regression file hashes to `833797cfe0ee89fa5538298f7f463b6eb574ea48f3fd69cd5cfdb80ec1a1c6d7`. The new regression passes and covers a mounted relay, an already disposed relay, a real file module's edit, version increments and repeated unload. Related plugin, loader, relay, render and toggle suites pass 71/71; four additional classic-hook consumer suites pass 13/13. `npm run check` and `npm run build` pass. The compiled direct probe changes from `chainHooked: true, relayRecording: false` to `true, true`. The compiled plugin toggle driver passes 42/42 with zero model calls. A second compiled PTY driver starts without the plugin, installs it through `plugin_install` while the same editor stays mounted, and observes its `prompt.edit` handler on subsequent typing without reload; 5/5 checks pass, with two owned loopback model requests, exit zero and the session lock released. The owned `w379-` fixture directories are absent after the probes. Full suite and live upstream are not run. The independent review returned `VERIFIED_SCOPED` in 12 calls, checking the diff, host store, load and removal ordering, repeated unload and regression assertions. It did not rerun tests, builds, CLI or identity, or reread the recovered `Xye` chain. It identified an untested retirement-exception boundary: if `record.retire()` throws after inventory removal, notification is skipped. The recovered `iF` also retires records before `Xye`; equivalence under a thrown retirement was not tested.

Temporary evidence SHA-256: focused output `951bf93388f11d1686de5884a7b6594aaf30bd8c613842e25bc987612e8220a0`; classic consumer output `dde91b2a633ecf0385aee6fd2dc06e4139105c839d7f4a53e94681528fb6e352`; build output `73c2de792f5ecd1c9d5783772391135a2b6e172af9052efba62659cd4dd1c933`; toggle output `e4327461e501523470cbf8a79485efa6082406af2dd2d225b2bc1ff13fe4478a`; live PTY driver `c3df96b61e7043cbd5d133b337fff3bc68fcc83e76792f8d6a0615d63b8906ae`; PTY output `febc9fdd84a0cdfeb4f2a6b6183f98fbdb92797fe6a6375488204ab18a316ede`; source regression red `7399851ab60390b2b5c26c3949fd6930b7d6a38f2d941be25d6012fe70d083bb`.
