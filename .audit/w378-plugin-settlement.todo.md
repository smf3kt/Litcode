# W378 plugin hook load settlement

Base: dc51435. Family: Hooks, stays Partial. Local only.

- [x] Reproduce compiled red: a missing module rejects its adoption; after its declaration is removed, `pluginHooksModulesSettled()` still rejects the original error.
- [x] Bind source bodies before editing: `vVe`/`CVo`/`iF` and `tGe` in chunk-sfn1dbxq.js SHA-256 `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`; `iOn`/`N5t`/`gas` in chunk-2kdsvp3x.js SHA-256 `2005e8ff7e9534510b3d7f687d6a190f21c5930f1d8e5397070e2fa018bf52d2`. Exact UTF-16 ranges in the port record.
- [x] Focused regression fails before repair with `ERR_MODULE_NOT_FOUND` after removal and reports the pending barrier's unhandled rejection; it preserves the original rejected load and checks a live module's edit.
- [x] Adapt settlement tracking without suppressing original adoption failure or dropping in-flight loads. A separate regression holds a sibling load until released.
- [x] Related 31/31, check/build, compiled failure/recovery and plugin CLI 42/42 pass at `f1ee3d49321096923a6041afe5829a929594580f81c0cf3e23d9a8b9f4cbce02`.
- [x] Independent review VERIFIED_SCOPED, with two new tests independently passing 2/2; CURRENT/FEATURES updated.
- [x] Stage exact paths for local commit.
- [x] Source-ground the separate real-file loader notification gap and capture its compiled red. Its repair belongs to the next package.
